import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { releasePlan, runReleasePlan, redactBuildLog, projectVersion } from '../../apps/agent/src/domain/release-plan.js';
import { ReleaseBuilds } from '../../apps/agent/src/modules/releases/release-builds.js';
import { gradleFlavors, releaseCatalog, validateRelease } from '../../apps/agent/src/modules/releases/release-catalog.js';

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'snapkit-release-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const workspace = path.join(dir, 'Flutter Project'); await mkdir(path.join(workspace, 'lib'), { recursive: true });
  await mkdir(path.join(workspace, 'android/app'), { recursive: true }); await mkdir(path.join(workspace, 'ios'), { recursive: true });
  await writeFile(path.join(workspace, 'pubspec.yaml'), 'name: example\nversion: 1.2.0+7\ndependencies:\n  flutter:\n    sdk: flutter\n');
  await writeFile(path.join(workspace, 'lib/main_dev.dart'), 'void main() {}');
  await writeFile(path.join(workspace, 'android/app/build.gradle.kts'), 'android { productFlavors { create("dev") { dimension = "env" } create("prod") { dimension = "env" } } }');
  return { dir, workspace };
}
const input = { format: 'apk', flavor: 'dev', target: 'lib/main_dev.dart', buildName: '1.2.0', buildNumber: '8' };
test('release plans preserve flavor, entrypoint, defines and version as command arguments', () => {
  const plan = releasePlan({ ...input, defineFile: '/Folder With Spaces/dev.json' }, 'win32');
  assert.deepEqual(plan.args, ['build','apk','--release','--flavor','dev','--target','lib/main_dev.dart','--dart-define-from-file','/Folder With Spaces/dev.json','--build-name','1.2.0','--build-number','8']);
  assert.equal(releasePlan({ format: 'aab' }, 'darwin').args[1], 'appbundle');
  assert.throws(() => releasePlan({ format: 'ipa' }, 'win32'), /macOS/);
  for (const bad of [{ format: 'shell' }, { ...input, flavor: '--bad' }, { ...input, buildNumber: '1;whoami' }, { ...input, buildName: '1.2' }]) assert.throws(() => releasePlan(bad, 'darwin'));
  assert.deepEqual(releasePlan({ format: 'ipa' }, 'darwin').args.slice(-2), ['--export-method', 'app-store']);
});
test('catalog discovers Android flavors, profiles and version without changing project files', async t => {
  const { workspace } = await fixture(t);
  const catalog = await releaseCatalog(workspace, { flavor:'dev', target:input.target }, 'darwin');
  assert.deepEqual(catalog.androidFlavors, ['dev','prod']); assert.equal(catalog.version,'1.2.0+7');
  assert.equal(catalog.buildName, '1.2.0'); assert.equal(catalog.buildNumber, '7');
  assert.ok(catalog.profiles.some(profile => profile.flavor === 'prod' && profile.review));
  assert.deepEqual(gradleFlavors('productFlavors { dev { dimension "env" }; prod { dimension "env" } }'), ['dev','prod']);
  assert.equal((await validateRelease(workspace, input, 'darwin')).format, 'apk');
  await assert.rejects(validateRelease(workspace, { ...input, target:'../outside.dart' }, 'darwin'), /entrypoint/);
  const defaults = await validateRelease(workspace, { ...input, buildName: '', buildNumber: '' }, 'darwin');
  assert.equal(defaults.buildName, '1.2.0'); assert.equal(defaults.buildNumber, '7');
  assert.match(defaults.args.join(' '), /--build-name 1.2.0 --build-number 7/);
});
test('release profiles deduplicate effective paths and keep genuinely different configs for the same flavor', async t => {
  const { workspace } = await fixture(t); await mkdir(path.join(workspace, '.vscode'));
  const profile = (name, defineFile) => ({ name, type: 'dart', request: 'launch', program: 'lib/main_dev.dart', args: ['--flavor', 'dev', '--dart-define-from-file', defineFile] });
  await writeFile(path.join(workspace, '.vscode/launch.json'), JSON.stringify({ configurations: [profile('Development', 'config/dev.json'), profile('Alternate dev', 'config/other.json')] }));
  const catalog = await releaseCatalog(workspace, { flavor: 'dev', target: path.join(workspace, 'lib/main_dev.dart'), defineFile: path.join(workspace, 'config/../config/dev.json') }, 'darwin');
  assert.equal(catalog.profiles.filter(p => p.flavor === 'dev').length, 2);
  assert.equal(catalog.profiles.some(p => p.name === 'Workspace settings'), false);
  assert.equal(catalog.profiles.find(p => p.current)?.name, 'Development');
  const custom = await releaseCatalog(workspace, { flavor: 'dev', target: input.target, defineFile: 'config/custom.json' }, 'darwin');
  assert.equal(custom.profiles.filter(p => p.flavor === 'dev').length, 3);
});
test('project versions read quoted YAML values, comments and missing build metadata without guessing', () => {
  for (const value of ['version: 1.2.118+190 # app version', 'version: "1.2.118+190"', "version: '1.2.118+190'"]) assert.deepEqual(projectVersion(value), { version: '1.2.118+190', buildName: '1.2.118', buildNumber: '190' });
  assert.deepEqual(projectVersion('version: 1.2.0'), { version: '1.2.0', buildName: '1.2.0', buildNumber: '' });
  assert.deepEqual(projectVersion('name: example'), { version: '', buildName: '', buildNumber: '' });
});
test('build jobs isolate workspaces, serialize, snapshot artifacts and reject stale build output', async t => {
  const { dir, workspace } = await fixture(t); let finish;
  const runner = new ReleaseBuilds({ root:path.join(dir,'data'), platform:'darwin', execute:async (_name,args,{cwd,onOutput}) => { assert.equal(cwd,await realpath(workspace)); assert.equal(args[1],'apk'); onOutput('building password=hidden\n'); await new Promise(resolve => { finish = resolve; }); const file=path.join(workspace,'build/app/outputs/flutter-apk/app-dev-release.apk'); await mkdir(path.dirname(file),{recursive:true});await writeFile(file,'new release artifact'); } });
  const job = await runner.start(workspace,input); await new Promise(resolve=>setTimeout(resolve,20));
  await assert.rejects(runner.start(workspace,input), /running/); finish(); await runner.active.done;
  const saved=runner.find(workspace,job.id);assert.equal(saved.status,'succeeded');assert.equal(saved.log.includes('hidden'),false);
  const artifact=await runner.artifact(workspace,job.id,saved.artifacts[0].id);assert.equal(await readFile(artifact.file,'utf8'),'new release artifact');
  assert.equal(runner.list('/another/workspace').jobs.length,0);assert.throws(()=>runner.find('/another/workspace',job.id));
  runner.execute=async()=>{}; const stale=await runner.start(workspace,input);await runner.active.done;assert.equal(runner.find(workspace,stale.id).status,'failed');
  const restored=new ReleaseBuilds({root:runner.root});await restored.restore();assert.equal(restored.find(workspace,job.id).status,'succeeded');
  await runner.delete(workspace,job.id);await assert.rejects(runner.artifact(workspace,job.id,saved.artifacts[0].id));
});
test('cancelled builds finish before allowing another job and interrupted uploads are not retried automatically', async t => {
  const {dir,workspace}=await fixture(t);
  const runner=new ReleaseBuilds({root:path.join(dir,'data'),platform:'darwin',execute:async(_name,_args,{signal})=>{await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));}});
  const job=await runner.start(workspace,input);await new Promise(resolve=>setTimeout(resolve,20));await runner.cancel(workspace,job.id);assert.equal(runner.find(workspace,job.id).status,'cancelled');
  runner.jobs.push({...job,id:'interrupted-job',status:'building',uploadStatus:'uploading'});await runner.save();
  const restored=new ReleaseBuilds({root:runner.root});await restored.restore();const recovered=restored.find(workspace,'interrupted-job');assert.equal(recovered.status,'interrupted');assert.equal(recovered.uploadStatus,'unknown');
});
test('upload needs explicit confirmation and only sends saved IPA with a local key directory', async t => {
  const {dir,workspace}=await fixture(t);let uploaded=false;
  const runner=new ReleaseBuilds({root:path.join(dir,'data'),platform:'darwin',execute:async(name,args,options)=>{if(name==='xcrun'){uploaded=true;assert.equal(args[0],'altool');assert.equal(options.env.API_PRIVATE_KEYS_DIR,dir);assert.ok(args.includes('--apiIssuer'));}else{const file=path.join(workspace,'build/ios/ipa/example.ipa');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,'signed IPA fixture');}}});
  const job = { id: 'legacy-ipa', project: runner.project(workspace), workspace, plan: releasePlan({...input,format:'ipa'},'darwin'), status:'succeeded', artifacts:[{id:'legacy-artifact',name:'example.ipa'}] };
  runner.jobs.push(job);await mkdir(path.join(runner.root,job.id),{recursive:true});await writeFile(path.join(runner.root,job.id,'example.ipa'),'legacy IPA');
  const keyPath=path.join(dir,'AuthKey_AB12CD34EF.p8');await writeFile(keyPath,'private key fixture');
  await runner.identity(workspace,{keyId:'AB12CD34EF',issuerId:'12345678-1234-1234-1234-123456789012',keyPath});
  await assert.rejects(runner.upload(workspace,job.id,'wrong'),/Confirm/);assert.equal(uploaded,false);
  await runner.upload(workspace,job.id,job.id);await runner.active.done;assert.equal(uploaded,true);assert.equal(runner.find(workspace,job.id).uploadStatus,'uploaded');
  await assert.rejects(runner.upload(workspace,job.id,job.id),/already/);
  assert.equal(JSON.stringify(runner.list(workspace)).includes(keyPath),false);
});
test('release logs redact credentials and private key blocks',()=>{assert.equal(redactBuildLog('password=test Bearer hidden\n-----BEGIN PRIVATE KEY-----\nsecret data\n-----END PRIVATE KEY-----').includes('secret data'),false);});
test('release subprocess runner streams output, reports failure and cancels its owned process', async()=>{
  const {releaseCommand}=await import('../../apps/agent/src/infrastructure/process/release-command.js');
  let output='';await releaseCommand(process.execPath,['-e','console.log("release process ready")'],{onOutput:value=>{output+=value;}});assert.match(output,/ready/);
  await assert.rejects(releaseCommand(process.execPath,['-e','process.exit(2)']),/code 2/);
  const controller=new AbortController();const pending=releaseCommand(process.execPath,['-e','console.log("started");setInterval(()=>{},1000)'],{signal:controller.signal,onOutput:()=>controller.abort()});
  await assert.rejects(pending,/cancelled/);
});

const phone = { id: 'physical-android', flutterId: '192.168.1.5:5555', name: 'Pixel phone', group: 'physical', platform: 'android', state: 'online' };
test('Run Release targets exactly one physical device with flavor/defines and rejects simulators or unsupported hosts', () => {
  const base = releasePlan({ ...input, defineFile: 'config/dev.json' }, 'darwin');
  const plan = runReleasePlan(base, phone, 'win32');
  assert.deepEqual(plan.args, ['run','--release','--no-resident','--device-id','192.168.1.5:5555','--flavor','dev','--target','lib/main_dev.dart','--dart-define-from-file','config/dev.json']);
  assert.equal(plan.operation, 'run'); assert.equal(plan.device.name, 'Pixel phone');
  assert.ok(!runReleasePlan(releasePlan({format:'ipa'}, 'darwin'), {...phone, platform:'ios'}, 'darwin').args.includes('--export-method'));
  for (const device of [undefined, {...phone, group:'android'}, {...phone,state:'offline'}, {...phone,flutterId:''}, {...phone,flutterId:'--bad'}, {...phone,platform:'linux'}]) assert.throws(() => runReleasePlan(base, device, 'darwin'));
  assert.throws(() => runReleasePlan(base, {...phone,platform:'ios'}, 'win32'), /macOS/);
});
test('Run Release reuses local validation and task lifecycle without collecting artifacts or Apple uploads', async t => {
  const {dir, workspace} = await fixture(t), calls=[];
  const runner = new ReleaseBuilds({root:path.join(dir,'data'), platform:'darwin', execute:async (command,args,options) => { calls.push({command,args}); options.onOutput('installed and started'); }});
  const job = await runner.start(workspace, {...input,operation:'run',format:'aab'}, phone);
  await runner.active.done;
  const saved=runner.find(workspace,job.id);
  assert.equal(saved.status,'succeeded'); assert.deepEqual(saved.artifacts,[]);
  assert.equal(saved.plan.buildName,'1.2.0'); assert.equal(saved.plan.buildNumber,'7');
  assert.equal(saved.plan.format,'apk'); assert.equal(saved.plan.operation,'run');
  assert.equal(calls.length,1); assert.equal(calls[0].command,'flutter'); assert.equal(calls[0].args[0],'run');
  assert.match(saved.log,/installed and started/);
  await assert.rejects(runner.upload(workspace,job.id,job.id), /completed IPA/);
  await assert.rejects(runner.start(workspace,{...input,operation:'run',flavor:'missing'},phone), /flavor configured/);
  await assert.rejects(runner.start(workspace,{...input,operation:'run'}), /physical/);
  const restored = new ReleaseBuilds({root:runner.root}); await restored.restore();
  assert.equal(restored.find(workspace,job.id).plan.device.name,phone.name);
  // Physical iOS launch uses development signing from the project, never App Store export/key preparation.
  runner.apple.signing.prepare = async () => { throw Error('App Store signing must not run'); };
  const ios = await runner.start(workspace, {...input, operation:'run', apple:{teamId:'BAD'}}, {...phone,id:'iphone',flutterId:'iphone-udid',platform:'ios'});
  await runner.active.done;
  assert.equal(runner.find(workspace,ios.id).status,'succeeded'); assert.equal(calls.at(-1).args[0],'run');
  assert.ok(!calls.at(-1).args.includes('--export-method'));

});
test('Run Release cancellation and failed device launch never report success or produce artifacts', async t => {
  const {dir,workspace}=await fixture(t);
  const runner=new ReleaseBuilds({root:path.join(dir,'data'),platform:'darwin',execute:async (_command,_args,{signal}) => new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('device disconnected')), {once:true}))});
  const job=await runner.start(workspace,{...input,operation:'run'},phone);
  await assert.rejects(runner.start(workspace,input),/Another release task/);
  await runner.cancel(workspace,job.id); assert.equal(runner.find(workspace,job.id).status,'cancelled');
  runner.execute=async()=>{throw Error('device disconnected')};
  const failed=await runner.start(workspace,{...input,operation:'run'},phone); await runner.active.done;
  assert.equal(runner.find(workspace,failed.id).status,'failed'); assert.deepEqual(runner.find(workspace,failed.id).artifacts,[]);
});

test('desktop build activity includes all projects without workspace paths, profile inputs or logs',()=>{const runner=new ReleaseBuilds({root:'/unused'});runner.jobs=[{id:'build',status:'building',workspace:'/private/project',log:'secret',plan:{format:'apk',flavor:'private',defineFile:'secret.json'}},{id:'other',status:'succeeded',workspace:'/other/project',plan:{format:'ipa'}}];assert.deepEqual(runner.activity(),{jobs:[{id:'build',status:'building',plan:{format:'apk',operation:undefined}},{id:'other',status:'succeeded',plan:{format:'ipa',operation:undefined}}]});});
