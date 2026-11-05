'use strict';
const http = require('node:http');
const {randomUUID} = require('node:crypto');
const {WebSocket, WebSocketServer} = require('ws');
const loopback = host => ['127.0.0.1', 'localhost', '[::1]'].includes(host);
function inspectorURL(value, port) {
  const url = new URL(value);
  if (url.protocol !== 'ws:' || !loopback(url.hostname) || Number(url.port) !== port || url.pathname !== '/inspector/debug' || url.username || url.password) throw Error('Metro returned an unsafe inspector address');
  return url;
}
function localOrigin(value, port) {
  if (!value) return true;
  try {const url = new URL(value); return url.protocol === 'http:' && loopback(url.hostname) && Number(url.port) === port;} catch {return false;}
}
async function inspectorCommand(target, port, method, params = {}) {
  const url = inspectorURL(target.webSocketDebuggerUrl, port);
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, {origin: `http://localhost:${port}`});
    const timer = setTimeout(() => finish(Error(`Inspector timed out: ${method}`)), 10000);
    let finished = false;
    function finish(error, result) {if (finished) return; finished = true; clearTimeout(timer); socket.close(); error ? reject(error) : resolve(result);}
    socket.on('open', () => socket.send(JSON.stringify({id: 1, method, params})));
    socket.on('message', raw => {try {const message = JSON.parse(raw.toString()); if (message.id === 1) finish(message.error ? Error(message.error.message) : null, message.result);} catch (error) {finish(error);}});
    socket.on('error', error => finish(error));
    socket.on('close', () => finish(Error('Inspector disconnected')));
  });
}
async function createInspectorBridge(target, metroPort) {
  const upstreamURL = inspectorURL(target.webSocketDebuggerUrl, metroPort);
  const key = randomUUID(), connections = new Set();
  const wss = new WebSocketServer({noServer: true, maxPayload: 64 * 1024 * 1024});
  let port, closed = false;
  // VS Code's inspector discovery sends Host: localhost without the port.
  const allowed = req => ['127.0.0.1:' + port, 'localhost:' + port, 'localhost', '127.0.0.1'].includes(req.headers.host) && localOrigin(req.headers.origin, port);
  const server = http.createServer((req, res) => {
    if (!allowed(req)) {res.writeHead(403); res.end(); return;}
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    const description = {id: key, type: 'node', title: target.title || 'React Native Hermes', webSocketDebuggerUrl: `ws://127.0.0.1:${port}/${key}`};
    if (req.url === '/json' || req.url === '/json/list') res.end(JSON.stringify([description]));
    else if (req.url === '/json/version') res.end(JSON.stringify({Browser: 'Hermes', 'Protocol-Version': '1.3', webSocketDebuggerUrl: description.webSocketDebuggerUrl}));
    else {res.writeHead(404); res.end('{}');}
  });
  server.on('upgrade', (req, socket, head) => {
    if (closed || !allowed(req) || req.url !== '/' + key) {socket.destroy(); return;}
    wss.handleUpgrade(req, socket, head, downstream => wss.emit('connection', downstream));
  });
  wss.on('connection', downstream => {
    const upstream = new WebSocket(upstreamURL, {origin: `http://localhost:${metroPort}`, maxPayload: 64 * 1024 * 1024});
    connections.add(downstream); connections.add(upstream);
    let queued = [], bytes = 0;
    upstream.on('open', () => {for (const data of queued) upstream.send(data.toString()); queued = []; bytes = 0;});
    downstream.on('message', data => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data.toString());
      else if (upstream.readyState === WebSocket.CONNECTING && (bytes += data.length) < 2 * 1024 * 1024) queued.push(data);
      else downstream.close();
    });
    upstream.on('message', data => {if (downstream.readyState === WebSocket.OPEN) downstream.send(data.toString());});
    const cleanup = () => {connections.delete(downstream); connections.delete(upstream); downstream.terminate(); upstream.terminate(); queued = [];};
    downstream.on('error', cleanup); upstream.on('error', cleanup);
    downstream.on('close', cleanup); upstream.on('close', cleanup);
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  port = server.address().port;
  return {port, dispose() {if (closed) return; closed = true; for (const socket of connections) socket.terminate(); connections.clear(); wss.close(); server.close();}};
}
module.exports = {createInspectorBridge, inspectorCommand, inspectorURL};
