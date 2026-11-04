import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { releasePlan, redactBuildLog } from '../../apps/agent/src/domain/release-plan.js';
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
  assert.ok(catalog.profiles.some(profile => profile.flavor === 'prod' && profile.review));
  assert.deepEqual(gradleFlavors('productFlavors { dev { dimension "env" }; prod { dimension "env" } }'), ['dev','prod']);
  assert.equal((await validateRelease(workspace, input, 'darwin')).format, 'apk');
  await assert.rejects(validateRelease(workspace, { ...input, target:'../outside.dart' }, 'darwin'), /entrypoint/);
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
  const job=await runner.start(workspace,{...input,format:'ipa'});await runner.active.done;
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
