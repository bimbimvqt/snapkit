import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { generateKeyPairSync } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { jwtVerify } from 'jose';
import { AppStoreConnect } from '../../apps/agent/src/infrastructure/app-store-connect.js';
import { AppleTeams } from '../../apps/agent/src/modules/apple/teams.js';
import { AppleSigning } from '../../apps/agent/src/modules/apple/signing.js';
import { ReleaseBuilds } from '../../apps/agent/src/modules/releases/release-builds.js';
import { releasePlan } from '../../apps/agent/src/domain/release-plan.js';
const teamId = 'ABCDE12345', app = { id: '1234567890', name: 'Example', bundleId: 'com.example.app' };
const identity = { keyId: 'AB12CD34EF', issuerId: '12345678-1234-1234-1234-123456789012' };
async function fixture(t) { const root = await mkdtemp(path.join(os.tmpdir(), 'snapkit-apple-')); t.after(() => rm(root, { recursive: true, force: true })); return root; }
const record = value => ({ id: value.id, attributes: { name: value.name, bundleId: value.bundleId } });

test('Apple API signs a short ES256 token and lists all app pages without exposing credentials', async t => {
  const root = await fixture(t), keyPath = path.join(root, `AuthKey_${identity.keyId}.p8`);
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  await writeFile(keyPath, privateKey.export({ format: 'pem', type: 'pkcs8' })); let calls = 0;
  const api = new AppStoreConnect({ fetcher: async (url, options) => {
    const token = options.headers.Authorization.slice(7), verified = await jwtVerify(token, publicKey, { issuer: identity.issuerId, audience: 'appstoreconnect-v1', algorithms: ['ES256'] });
    assert.equal(verified.protectedHeader.kid, identity.keyId); assert.equal(verified.payload.exp - verified.payload.iat, 300); assert.equal(url.origin, 'https://api.appstoreconnect.apple.com'); calls++;
    return Response.json(calls === 1 ? { data: [record(app)], links: { next: '/v1/apps?cursor=next' } } : { data: [record({ ...app, id: '1234567891', name: 'Another' })] });
  } });
  const apps = await api.apps({ ...identity, keyPath }); assert.equal(calls, 2); assert.equal(apps.length, 2); assert.equal(apps[0].name, 'Another'); assert.equal(JSON.stringify(apps).includes('PRIVATE'), false);
  await assert.rejects(api.request('https://evil.example/v1/apps', 'secret'), /Invalid Apple/);
});
test('Apple errors never include upstream bodies or tokens; invalid keys and app IDs fail locally', async t => {
  const root = await fixture(t), api = new AppStoreConnect({ fetcher: async () => new Response('secret upstream body', { status: 403 }) });
  await assert.rejects(api.request('/v1/apps', 'private-token'), error => /permission/.test(error.message) && !/secret|private-token/.test(error.message));
  await assert.rejects(api.readApp({}, '../users'), /Choose an app/);
  const keyPath = path.join(root, `AuthKey_${identity.keyId}.p8`); await writeFile(keyPath, 'not an ES256 key');
  await assert.rejects(api.token({ ...identity, keyPath }), /valid App Store Connect ES256/);
});
test('team connections persist locally; selections are separate per flavor/workspace and never expose key paths', async t => {
  const root = await fixture(t), api = { apps: async () => [app], readApp: async () => app }, teams = new AppleTeams({ root, api });
  await teams.restore(); await teams.connect({ teamId, name: 'Studio', ...identity, keyPath: '/private/key.p8' });
  await teams.select('/project', { teamId, appId: app.id, flavor: 'dev' });
  assert.equal(teams.snapshot('/project', 'dev').bundleId, app.bundleId); assert.throws(() => teams.snapshot('/project', 'prod'), /Choose an Apple/); assert.throws(() => teams.snapshot('/other', 'dev'));
  assert.equal(JSON.stringify(teams.catalog('/project')).includes('/private'), false); assert.equal(JSON.stringify(teams.catalog('/project')).includes(identity.issuerId), false);
  if (process.platform !== 'win32') assert.equal((await stat(path.join(root, 'apple-teams.json'))).mode & 0o777, 0o600);
  const restored = new AppleTeams({ root, api }); await restored.restore(); assert.deepEqual(restored.snapshot('/project', 'dev'), teams.snapshot('/project', 'dev'));
  const snapshot = teams.snapshot('/project', 'dev'); await teams.remove(teamId); assert.throws(() => teams.identity(snapshot), /Reconnect/); assert.throws(() => teams.snapshot('/project', 'dev'));
});
test('failed Apple refresh preserves the connected key and cached apps; app changes cannot redirect saved IPAs', async t => {
  const root = await fixture(t), api = { apps: async () => [app], readApp: async () => ({ ...app, bundleId: 'com.other' }) }, teams = new AppleTeams({ root, api });
  await teams.connect({ teamId, name: 'Studio', ...identity, keyPath: '/key.p8' }); await teams.select('/project', { teamId, appId: app.id, flavor: '' }); const snapshot = teams.snapshot('/project', '');
  api.apps = async () => { throw Error('Apple unavailable'); }; await assert.rejects(teams.refresh(teamId), /unavailable/); assert.equal(teams.teams[teamId].apps.length, 1);
  await assert.rejects(teams.verify(snapshot), /bundle ID has changed/);
});

async function signingFixture(t, { bundleId = app.bundleId, team = teamId, style = 'Automatic' } = {}) {
  const root = await fixture(t); let profile = { TeamIdentifier: [teamId], Entitlements: { 'application-identifier': `${teamId}.${app.bundleId}`, 'get-task-allow': false } }, info = { CFBundleIdentifier: app.bundleId, CFBundleShortVersionString: '1.2.0', CFBundleVersion: '7' };
  const signing = new AppleSigning({ platform: 'darwin', run: async (name, args, options) => {
    if (args[0] === 'xcodebuild') { assert.equal(await readFile(options.env.XCODE_XCCONFIG_FILE, 'utf8'), `// Snapkit build only. The project is not modified.\nDEVELOPMENT_TEAM = ${teamId}\n`); return { stdout: JSON.stringify([{ buildSettings: { PRODUCT_TYPE: 'com.apple.product-type.application', PRODUCT_BUNDLE_IDENTIFIER: bundleId, DEVELOPMENT_TEAM: team, CODE_SIGN_STYLE: style } }]) }; }
    if (args[0] === '-Z1') return { stdout: 'Payload/Example.app/Info.plist\nPayload/Example.app/embedded.mobileprovision\n' };
    if (args[0] === '-p' || args[0] === 'cms') return { stdout: Buffer.from('plist fixture') };
    if (args[0] === '-extract') { const source = args.at(-1).endsWith('Info.plist') ? info : profile; const value = args[1].split('.').reduce((value, key) => value?.[key], source); if (value === undefined) throw Error('No value'); return { stdout: args[2] === 'raw' && typeof value === 'string' ? value : JSON.stringify(value) }; }
    if (args[0] === '-convert' && args[1] === 'json') { const file = args.at(-1); if (file.endsWith('Info.plist')) return { stdout: JSON.stringify(info) }; if (file.endsWith('profile.plist')) return { stdout: JSON.stringify(profile) }; return { stdout: await readFile(file, 'utf8') }; }
    return { stdout: '' };
  } });
  return { root, signing, profile, info };
}
test('signing preflight creates per-build team/export settings without modifying the project', async t => {
  const { root, signing } = await signingFixture(t), prepared = await signing.prepare('/project', { teamId, bundleId: app.bundleId }, { flavor: 'prod' }, root);
  const config = JSON.parse(await readFile(prepared.exportOptions, 'utf8')); assert.equal(config.teamID, teamId); assert.equal(config.destination, 'export'); assert.equal(config.signingStyle, 'automatic');
});
test('signing preflight blocks wrong bundle/team, conflicting export team and missing manual profiles', async t => {
  for (const [options, message] of [[{ bundleId: 'com.other' }, /bundle ID/], [{ team: 'OTHER12345' }, /signing team/], [{ style: 'Manual' }, /manual signing/]]) {
    const { root, signing } = await signingFixture(t, options); await assert.rejects(signing.prepare('/project', { teamId, bundleId: app.bundleId }, {}, root), message);
  }
  const { root, signing } = await signingFixture(t), file = path.join(root, 'custom.plist'); await writeFile(file, JSON.stringify({ method: 'app-store', teamID: 'OTHER12345' }));
  await assert.rejects(signing.prepare('/project', { teamId, bundleId: app.bundleId }, { exportOptions: file }, root), /different Apple team/);
});
test('saved IPA is checked for team, bundle ID, store distribution, version and build before upload', async t => {
  const { root, signing, profile, info } = await signingFixture(t), apple = { teamId, bundleId: app.bundleId }, plan = { buildName: '1.2.0', buildNumber: '7' };
  assert.equal((await signing.inspectIPA('/saved.ipa', apple, plan, root)).buildNumber, '7');
  profile.TeamIdentifier = ['OTHER12345']; await assert.rejects(signing.inspectIPA('/saved.ipa', apple, plan, root), /does not match/); profile.TeamIdentifier = [teamId];
  profile.ProvisionedDevices = ['device']; await assert.rejects(signing.inspectIPA('/saved.ipa', apple, plan, root), /App Store distribution/); delete profile.ProvisionedDevices;
  profile.Entitlements['get-task-allow'] = true; await assert.rejects(signing.inspectIPA('/saved.ipa', apple, plan, root), /App Store distribution/); profile.Entitlements['get-task-allow'] = false;
  info.CFBundleVersion = '8'; await assert.rejects(signing.inspectIPA('/saved.ipa', apple, plan, root), /version or build/);
});
test('IPA jobs bind their destination permanently; switching flavor selections cannot redirect an upload', async t => {
  const root = await fixture(t), keyPath = path.join(root, `AuthKey_${identity.keyId}.p8`); await writeFile(keyPath, 'fixture');
  const checked = [], api = { apps: async () => [app, { ...app, id: '1234567891', bundleId: 'com.example.prod' }], readApp: async (_key, id) => { checked.push(id); return id === app.id ? app : { ...app, id, bundleId: 'com.example.prod' }; } };
  let inspections = 0;
  const apple = new AppleTeams({ root, api, signing: { prepare: async () => ({ env: process.env, exportOptions: '/generated.plist' }), inspectIPA: async (_file, snapshot) => { inspections++; assert.equal(snapshot.appId, app.id); return { teamId, bundleId: app.bundleId }; } } });
  await apple.connect({ teamId, name: 'Studio', ...identity, keyPath }); await apple.select(root, { teamId, appId: app.id, flavor: 'dev' });
  let uploads = 0;
  const runner = new ReleaseBuilds({ root: path.join(root, 'data'), platform: 'darwin', apple, validate: async (workspace, input) => ({ workspace, ...releasePlan(input, 'darwin') }), execute: async (name, args, options) => {
    if (name === 'xcrun') { uploads++; assert.equal(args[0], 'altool'); assert.ok(args.includes(keyPath) === false); return; }
    assert.equal(args.at(-1), '/generated.plist'); assert.ok(options.env); const file = path.join(root, 'build/ios/ipa/example.ipa'); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, 'signed IPA fixture');
  } });
  const job = await runner.start(root, { format: 'ipa', flavor: 'dev' }); await runner.active.done; assert.equal(runner.find(root, job.id).status, 'succeeded');
  await apple.select(root, { teamId, appId: '1234567891', flavor: 'dev' });
  await runner.upload(root, job.id, job.id); await runner.active.done;
  assert.equal(uploads, 1); assert.equal(inspections, 2); assert.deepEqual(checked, [app.id, app.id]); assert.equal(runner.find(root, job.id).apple.bundleId, app.bundleId);
  await assert.rejects(runner.start(root, { format: 'ipa', flavor: 'dev', apple: job.apple }), /selection changed/);
});
test('an Apple preflight rejection blocks upload before invoking altool', async t => {
  const root = await fixture(t), keyPath = path.join(root, `AuthKey_${identity.keyId}.p8`); await writeFile(keyPath, 'fixture');
  const apple = new AppleTeams({ root, api: { apps: async () => [app], readApp: async () => { throw Error('This API key does not have permission to access these apps.'); } } });
  await apple.connect({ teamId, name:'Studio', ...identity, keyPath }); let called = false;
  const runner = new ReleaseBuilds({ root, platform:'darwin', apple, execute:async()=>{called=true;} });
  const id = 'saved-ipa'; await mkdir(path.join(root,id));await writeFile(path.join(root,id,'app.ipa'),'fixture');
  runner.jobs.push({id,project:runner.project(root),workspace:root,plan:{format:'ipa'},apple:{teamId,appId:app.id,bundleId:app.bundleId},status:'succeeded',artifacts:[{id:'file',name:'app.ipa'}]});
  await runner.upload(root,id,id);await runner.active.done;assert.equal(called,false);assert.equal(runner.find(root,id).uploadStatus,'blocked');assert.match(runner.find(root,id).uploadError,/Upload was not started/);
});
test('team discovery reads only project signing settings and public certificate identities', async t => {
  const root = await fixture(t);await mkdir(path.join(root,'ios/Runner.xcodeproj'),{recursive:true});await writeFile(path.join(root,'ios/Runner.xcodeproj/project.pbxproj'),'DEVELOPMENT_TEAM = ABCDE12345;');
  const signing=new AppleSigning({platform:'darwin',run:async(name,args)=>{assert.equal(name,'/usr/bin/security');assert.deepEqual(args,['find-identity','-v','-p','codesigning']);return {stdout:'1) HASH "Apple Distribution: Example Studio (ABCDE12345)"\n2) HASH "Apple Development: Example User (OTHER12345)"\n'};}});
  const teams=await signing.detected(root);assert.equal(teams.length,2);assert.equal(teams[0].name,'Example Studio');assert.equal(teams[0].distributionCertificate,true);assert.equal(teams[1].developmentCertificate,true);
  assert.deepEqual(await new AppleSigning({platform:'win32'}).detected(root),[]);
});
test('real macOS plutil extracts signing fields despite Date/Data entries in a provisioning profile', { skip: process.platform !== 'darwin' }, async t => {
  const {execFile} = await import('node:child_process'), {promisify} = await import('node:util'), run = promisify(execFile);
  const root=await fixture(t), file=path.join(root,'profile.plist');
  await writeFile(file, '<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CreationDate</key><date>2026-11-04T00:00:00Z</date><key>DeveloperCertificates</key><array><data>Y2VydGlmaWNhdGU=</data></array><key>TeamIdentifier</key><array><string>ABCDE12345</string></array><key>Entitlements</key><dict><key>application-identifier</key><string>ABCDE12345.com.example.app</string><key>get-task-allow</key><false/></dict></dict></plist>');
  await assert.rejects(run('/usr/bin/plutil',['-convert','json','-o','-','--',file]));
  const result=await new AppleSigning().fields(file,{TeamIdentifier:'array','Entitlements.application-identifier':'string','Entitlements.get-task-allow':'bool',ProvisionedDevices:'array'});
  assert.deepEqual(result,{TeamIdentifier:[teamId],'Entitlements.application-identifier':`${teamId}.${app.bundleId}`,'Entitlements.get-task-allow':false});
});
