'use strict';
const {spawn} = require('node:child_process');
const {readFile, realpath, stat} = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const {inspectorCommand} = require('./react-native-transport.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function request(port, route) {
  return new Promise((resolve, reject) => {
    const req = http.get({hostname: '127.0.0.1', port, path: route, timeout: 3000}, res => {
      let text = ''; res.on('data', data => {text += data; if (text.length > 2 * 1024 * 1024) req.destroy(Error('Metro response too large'));});
      res.on('end', () => {if (res.statusCode !== 200) reject(Error(`Metro ${route}: ${res.statusCode}`)); else resolve({text, headers: res.headers});});
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(Error('Metro request timed out'))); req.on('error', reject);
  });
}
function execute(command, args, {cwd, env, signal, output = () => {}, background = false, timeout = 600000} = {}) {
  const child = spawn(command, args, {cwd, env: {...process.env, ...env}, shell: false, detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  let text = '', settled = false, timer;
  const kill = () => {
    if (child.exitCode !== null || !child.pid) return;
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore'}).on('error', () => {});
    else {try {process.kill(-child.pid, 'SIGTERM');} catch {child.kill();}}
  };
  const promise = new Promise((resolve, reject) => {
    const done = error => {if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(text);};
    const abort = () => {kill(); done(Error('React Native launch cancelled'));};
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => {const part = data.toString(); text = (text + part).slice(-2 * 1024 * 1024); output(part);});
    child.on('error', error => done(error));
    child.on('close', code => done(code === 0 ? null : Error(`${path.basename(command)} exited ${code}: ${text.slice(-3000)}`)));
    if (!background) timer = setTimeout(() => {kill(); done(Error('React Native build timed out'));}, timeout);
    signal?.addEventListener('abort', abort, {once: true}); if (signal?.aborted) abort();
  });
  if (background) promise.catch(error => output(error.message + '\n'));
  return {promise, kill};
}
async function communityCli(root) {
  const pkgPath = require.resolve('@react-native-community/cli/package.json', {paths: [root]});
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  const entry = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['rnc-cli'];
  if (!entry) throw Error('Install @react-native-community/cli in this project');
  return path.resolve(path.dirname(pkgPath), entry);
}
function createRuntime({output = () => {}, run = execute} = {}) {
  const metros = new Map();
  async function ensureMetro(root, port, cli, node, signal) {
    let response;
    try {response = await request(port, '/status');} catch {}
    if (!response) {
      const key = root + ':' + port;
      if (!metros.has(key)) {
        output(`Starting Metro for ${root} on port ${port}\n`);
        const metro = run(node, [cli, 'start', '--port', String(port), '--no-interactive'], {cwd: root, signal: undefined, output, background: true});
        metros.set(key, metro);
        metro.promise.then(() => {if (metros.get(key) === metro) metros.delete(key);}, () => {if (metros.get(key) === metro) metros.delete(key);});
      }
      for (let n = 0; n < 60 && !signal.aborted; n++) {await delay(500); try {response = await request(port, '/status'); break;} catch {}}
    }
    if (signal.aborted) throw Error('React Native launch cancelled');
    if (!response || response.text.trim() !== 'packager-status:running') throw Error(`Metro is not available on port ${port}`);
    const metroRoot = response.headers['x-react-native-project-root'];
    if (typeof metroRoot !== 'string' || await realpath(metroRoot) !== await realpath(root)) throw Error(`Port ${port} belongs to a different Metro project. Choose a free port in the debug configuration.`);
  }
  const targets = async port => JSON.parse((await request(port, '/json/list')).text);
  async function launch(root, config, {port, node, signal, cli}) {
    if (signal.aborted) throw Error('React Native launch cancelled');
    if (!(await stat(path.join(root, config.platform)).catch(() => null))?.isDirectory()) throw Error(`This React Native project has no ${config.platform} native folder. Run Expo prebuild if needed.`);
    output(`\nBuilding and launching ${config.name} (${config.deviceId})…\n`);
    const android = config.platform === 'android';
    const args = [cli, android ? 'run-android' : 'run-ios', android ? '--deviceId' : '--udid', config.deviceId, '--no-packager', '--port', String(port), ...(android ? ['--active-arch-only'] : [])];
    const text = await run(node, args, {cwd: root, signal, output}).promise;
    const appId = android ? /cmp=([\w.]+)\//.exec(text)?.[1] : /Launching "([\w.-]+)"/.exec(text)?.[1];
    if (!appId) throw Error(`Could not identify the launched app on ${config.name}. See Snapkit Debug Sync output.`);
    const native = android ? 'adb' : 'xcrun';
    const component = android ? /cmp=([\w.]+\/[\w.$]+)/.exec(text)?.[1] : null;
    if (android && !component) throw Error('Could not identify the Android launch activity');
    if (android) await run(native, ['-s', config.deviceId, 'shell', 'am', 'start', '-W', '-n', component], {cwd: root, signal}).promise;
    // Remove/reconnect this app on exactly this device and observe the inspector
    // identity that disappears. Model names are never used as device identity.
    let before = [];
    for (let i = 0; i < 120 && !signal.aborted; i++) {before = (await targets(port)).filter(t => t.appId === appId); if (before.length) break; await delay(500);}
    if (!before.length) throw Error(`No Hermes runtime connected for ${config.name}`);
    // CLI launch can return while the native activity is still starting. Let
    // that launch settle before stopping it to measure its inspector identity.
    await delay(2000);
    before = (await targets(port)).filter(t => t.appId === appId);
    await run(native, android ? ['-s', config.deviceId, 'shell', 'am', 'force-stop', appId] : ['simctl', 'terminate', config.deviceId, appId], {cwd: root, signal}).promise;
    if (android) {
      await delay(1000);
      await run(native, ['-s', config.deviceId, 'shell', 'am', 'force-stop', appId], {cwd: root, signal}).promise;
    }
    let removed = [];
    for (let i = 0; i < 120 && !signal.aborted; i++) {
      const current = await targets(port); removed = before.filter(t => !current.some(c => c.id === t.id));
      if (removed.length) break;
      await delay(300);
    }

    await run(native, android ? ['-s', config.deviceId, 'shell', 'am', 'start', '-n', component] : ['simctl', 'launch', config.deviceId, appId], {cwd: root, signal}).promise;
    if (removed.length !== 1) {output(`Runtime identities before stop: ${before.map(t => t.id).join(', ')}; removed: ${removed.map(t => t.id).join(', ')}\n`); throw Error(`Could not uniquely identify the Hermes runtime on ${config.name}. Close other debug tools and retry.`);}
    let target;
    for (let i = 0; i < 120 && !signal.aborted; i++) {target = (await targets(port)).find(t => t.id === removed[0].id); if (target) break; await delay(500);}
    if (!target) throw Error(`Hermes did not reconnect on ${config.name}`);
    const evaluation = await inspectorCommand(target, port, 'Runtime.evaluate', {expression: 'typeof HermesInternal !== "undefined"', returnByValue: true});
    if (evaluation.result?.value !== true) throw Error('Snapkit native debugging requires Hermes. Enable Hermes in this React Native project.');
    output(`Hermes ready: ${config.name}\n`);
    return target;
  }
  return {ensureMetro, launch, dispose() {for (const metro of metros.values()) metro.kill(); metros.clear();}};
}
module.exports = {createRuntime, communityCli, execute, request};
