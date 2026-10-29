import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
let child, state;
const port = 14319;
const base = `http://127.0.0.1:${port}`;
before(async () => {
  child = spawn(process.execPath, ['server/index.js', '--demo'], { env: { ...process.env, PORT: String(port) }, stdio: 'pipe' });
  await new Promise((resolve, reject) => { child.once('error', reject); child.stdout.on('data', b => { if (b.toString().includes('http://')) resolve(); }); child.once('exit', code => reject(new Error(`Server exited ${code}`))); });
  state = await fetch(`${base}/api/state`).then(r => r.json());
});
after(() => child?.kill());
const post = (route, body, token = state.token) => fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Snapkit-Token': token }, body: JSON.stringify(body) });
test('API rejects missing mutation token and hostile origins', async () => {
  assert.equal((await post('/api/scan', {}, 'bad-token')).status, 403);
  assert.equal((await fetch(`${base}/api/state`, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
});
test('demo API performs target selection and manages Flutter sessions', async () => {
  assert.equal(state.demo, true); assert.equal(state.platform, 'darwin'); assert.equal(state.devices.length, 6);
  const target = await post('/api/target', { id: 'demo-android-1' }).then(r => r.json());
  assert.equal(target.settings.targetId, 'demo-android-1');
  const started = await post('/api/sessions', { id: 'demo-android-1' }).then(r => r.json());
  assert.equal(started.sessions[0].status, 'running');
  const reload = await post('/api/sessions/reload-all', {}).then(r => r.json());
  assert.equal(reload.results[0].ok, true);
  assert.equal((await post('/api/sessions/demo-android-1/stop', {})).status, 200);
  assert.equal((await post('/api/devices/missing/boot', {})).status, 400);
});
test('demo screenshots remain empty and never fabricate captures', async () => {
  const result = await post('/api/devices/demo-ios-1/screenshot', {}).then(r => r.json());
  assert.equal(result.filename, undefined);
  assert.deepEqual(await fetch(`${base}/api/screenshots`).then(r => r.json()), []);
});
test('folder picker and provisioning APIs support demo creation and reject incompatible legacy model', async () => {
  const picked = await post('/api/folders/pick', {}).then(r => r.json());
  assert.match(picked.path, /SanDiskSSDData/);
  const catalog = await fetch(`${base}/api/provision/catalog`).then(r => r.json());
  assert.ok(catalog.ios.models.some(m => m.id === 'legacy:iphone-5' && m.runtimeIds.length === 0));
  const invalid = await post('/api/provision/create', { platform: 'ios', name: 'iPhone 5', model: 'legacy:iphone-5', runtime: 'demo:ios18' });
  assert.equal(invalid.status, 400);
  const created = await post('/api/provision/create', { platform: 'ios', name: 'Test iPhone', model: 'demo:iphone16', runtime: 'demo:ios18' }).then(r => r.json());
  assert.equal(created.job.status, 'completed');
  const current = await fetch(`${base}/api/state`).then(r => r.json());
  assert.ok(current.devices.some(d => d.name === 'Test iPhone'));
});
