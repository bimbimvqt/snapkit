import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('capture downloads work when Snapkit data is inside a hidden directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), '.snapkit-capture-'));
  const project = createHash('sha256').update(path.resolve(root)).digest('hex');
  const id = 'download-regression', bytes = Buffer.from('89504e470d0a1a0a', 'hex');
  const account = createServer((_req, res) => {res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({user: {id: 'fixture'}}));});
  const portProbe = createServer();
  let agent;
  try {
    await new Promise(resolve => account.listen(0, '127.0.0.1', resolve));
    await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
    const port = portProbe.address().port;
    await new Promise(resolve => portProbe.close(resolve));
    await mkdir(path.join(root, 'state'), {recursive: true});
    await mkdir(path.join(root, 'device-tools', project), {recursive: true});
    await writeFile(path.join(root, 'state/account-session.json'), JSON.stringify({token: 'test-only-fixture'}));
    await writeFile(path.join(root, 'state/preferences.json'), JSON.stringify({developerProfile: {role: 'frontend', framework: 'react-native'}}));
    await writeFile(path.join(root, 'state/settings.json'), JSON.stringify({workspace: root, targetIds: [], framework: 'react-native'}));
    await writeFile(path.join(root, 'device-tools/index.json'), JSON.stringify({sets: [], captures: [{id, project, kind: 'image', status: 'ready', createdAt: '2026-11-05T00:00:00.000Z'}]}));
    await writeFile(path.join(root, 'device-tools', project, id + '.png'), bytes);
    agent = spawn(process.execPath, ['apps/agent/src/main.js'], {env: {...process.env, PORT: String(port), SNAPKIT_DATA_ROOT: root, SNAPKIT_ACCOUNT_SERVER: `http://127.0.0.1:${account.address().port}`, SNAPKIT_ADB: process.execPath, SNAPKIT_EMULATOR: process.execPath, SNAPKIT_XCRUN: process.execPath}, stdio: ['ignore', 'pipe', 'pipe']});
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Agent startup timed out')), 10000);
      agent.once('error', error => {clearTimeout(timer); reject(error);});
      agent.once('exit', code => {clearTimeout(timer); reject(Error('Agent exited: ' + code));});
      agent.stdout.on('data', data => {if (data.toString().includes('http://')) {clearTimeout(timer); resolve();}});
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/tools/captures/${id}/file`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/tools/captures/missing/file`)).status, 404);
  } finally {
    if (agent && agent.exitCode === null) {const ended = new Promise(resolve => agent.once('exit', resolve)); agent.kill(); await ended;}
    await new Promise(resolve => account.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});
