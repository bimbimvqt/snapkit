'use strict';
const fs = require('./filesystem.cjs').promises;
const path = require('node:path');
const { scan, validateMap, planBlocks } = require('./blocks.cjs');
const { verifyFile } = require('./install.cjs');
const network = require('./network.cjs');
function packageName(version, platform, arch) { return `Snapkit-${version}-${platform === 'darwin' ? 'mac' : 'win'}-${arch}.${platform === 'darwin' ? 'zip' : 'exe'}`; }
async function seedBaseline({ cache, file, asset, version, platform, arch }) {
  if (!asset || asset.version !== version || asset.name !== packageName(version, platform, arch) || !/^[a-f0-9]{64}$/.test(asset.sha256 || '') || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > 1024 ** 3) return false;
  const next = path.join(cache, 'baseline-next'), baseline = path.join(cache, 'baseline');
  try {
    const existing = await fs.readFile(path.join(baseline, 'metadata.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (existing?.version === version && existing.sha256 === asset.sha256 && (await fs.stat(path.join(baseline, 'package.bin')).catch(() => null))?.size === asset.size) return true;
    if ((await fs.stat(file)).size !== asset.size) return false;
    await fs.rm(next, { recursive: true, force: true }); await fs.mkdir(next, { recursive: true });
    await fs.copyFile(file, path.join(next, 'package.bin'));
    await verifyFile(path.join(next, 'package.bin'), asset.sha256);
    await fs.writeFile(path.join(next, 'metadata.json'), JSON.stringify({ version, platform, arch, size: asset.size, sha256: asset.sha256 }), { mode: 0o600 });
    await fs.rm(baseline, { recursive: true, force: true }); await fs.rename(next, baseline); return true;
  } finally { await fs.rm(next, { recursive: true, force: true }).catch(() => {}); }
}
async function writeAll(handle, buffer, position) {
  let written = 0;
  while (written < buffer.length) { const result = await handle.write(buffer, written, buffer.length - written, position + written); if (!result.bytesWritten) throw Error('Could not write update.'); written += result.bytesWritten; }
}
async function smartDownload(asset, file, signal, progress, { cache, version, platform, arch, fullDownload = network.download, rangeDownload = network.downloadRange, mapDownload = network.download } = {}) {
  const full = async reason => {
    signal.throwIfAborted(); await fs.rm(file, { force: true });
    const info = { mode: 'full', size: asset.size, fullSize: asset.size, reused: 0, fallback: !!reason };
    progress(0, info); await fullDownload(asset, file, signal, received => progress(received, info)); return info;
  };
  if (!asset.blockmap) return full(false);
  const mapFile = file + '.map'; let source, output;
  try {
    const baseline = path.join(cache, 'baseline'), baseFile = path.join(baseline, 'package.bin');
    const metadata = JSON.parse(await fs.readFile(path.join(baseline, 'metadata.json'), 'utf8'));
    if (metadata.version !== version || metadata.platform !== platform || metadata.arch !== arch || !/^[a-f0-9]{64}$/.test(metadata.sha256 || '')) return full(false);
    progress(0, { mode: 'planning', size: asset.size, fullSize: asset.size, reused: 0 });
    const base = await scan(baseFile, signal);
    if (base.sha256 !== metadata.sha256 || base.size !== metadata.size) throw Error('Cached baseline changed.');
    await mapDownload(asset.blockmap, mapFile, signal, () => {});
    const target = validateMap(JSON.parse(await fs.readFile(mapFile, 'utf8')), asset), plan = planBlocks(base, target);
    if (plan.downloadSize > asset.size * .9 || plan.ranges > 128) return full(false);
    const info = { mode: 'delta', size: plan.downloadSize, fullSize: asset.size, reused: plan.reused, fallback: false };
    source = await fs.open(baseFile, 'r'); output = await fs.open(file, 'wx', 0o600);
    let received = 0; progress(0, info);
    for (const step of plan.steps) {
      signal.throwIfAborted(); let buffer;
      if (step.source !== undefined) {
        buffer = Buffer.allocUnsafe(step.size);
        let read = 0;
        while (read < buffer.length) { const result = await source.read(buffer, read, buffer.length - read, step.source + read); if (!result.bytesRead) throw Error('Cached baseline is incomplete.'); read += result.bytesRead; }
      } else {
        buffer = await rangeDownload(asset, step.offset, step.size, signal, count => progress(received + count, info)); received += step.size;
        if (buffer.length !== step.size) throw Error('Delta range size mismatch.');
      }
      await writeAll(output, buffer, step.offset);
    }
    await output.close(); output = null; await source.close(); source = null;
    await verifyFile(file, asset.sha256); signal.throwIfAborted(); progress(received, info); return info;
  } catch (error) {
    await output?.close().catch(() => {}); output = null; await source?.close().catch(() => {}); source = null;
    if (signal.aborted) throw error;
    return full(true);
  } finally {
    await output?.close().catch(() => {}); await source?.close().catch(() => {}); await fs.rm(mapFile, { force: true }).catch(() => {});
  }
}
module.exports = { smartDownload, seedBaseline, packageName };
