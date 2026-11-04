'use strict';
const { createReadStream } = require('./filesystem.cjs');
const { createHash } = require('node:crypto');
const MIN = 16 * 1024, MAX = 256 * 1024, MASK = 0xffff;
const gear = new Uint32Array(256); let seed = 0x713a9b27;
for (let i = 0; i < 256; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; gear[i] = seed >>> 0; }
// Content-defined boundaries survive insertions and changed ZIP offsets. Memory stays bounded.
async function scan(file, signal) {
  const blocks = [], full = createHash('sha256'), buffer = Buffer.allocUnsafe(MAX);
  let count = 0, fingerprint = 0, size = 0;
  const flush = () => { if (!count) return; blocks.push({ size: count, sha256: createHash('sha256').update(buffer.subarray(0, count)).digest('hex') }); count = 0; fingerprint = 0; };
  for await (const chunk of createReadStream(file, { signal })) {
    full.update(chunk); size += chunk.length;
    if (size > 1024 ** 3) throw Error('Update exceeds size limit.');
    for (const byte of chunk) {
      buffer[count++] = byte; fingerprint = ((fingerprint << 1) + gear[byte]) >>> 0;
      if (count === MAX || count >= MIN && (fingerprint & MASK) === 0) flush();
    }
  }
  flush(); return { algorithm: 'snapkit-gear32-v1', size, sha256: full.digest('hex'), blocks };
}
function validateMap(map, asset) {
  if (map?.algorithm !== 'snapkit-gear32-v1' || map.size !== asset.size || map.sha256 !== asset.sha256 || !Array.isArray(map.blocks) || !map.blocks.length || map.blocks.length > 65536) throw Error('Invalid delta map.');
  let size = 0;
  for (const block of map.blocks) {
    if (!Number.isSafeInteger(block.size) || block.size <= 0 || block.size > MAX || !/^[a-f0-9]{64}$/.test(block.sha256 || '')) throw Error('Invalid delta block.');
    size += block.size;
  }
  if (size !== asset.size) throw Error('Delta map size mismatch.');
  return map;
}
function planBlocks(base, target) {
  const known = new Map(); let offset = 0;
  for (const block of base.blocks) { known.set(block.sha256 + ':' + block.size, offset); offset += block.size; }
  offset = 0; let reused = 0;
  const steps = [];
  for (const block of target.blocks) {
    const source = known.get(block.sha256 + ':' + block.size);
    if (source !== undefined) { steps.push({ offset, size: block.size, source }); reused += block.size; }
    else {
      const last = steps.at(-1);
      if (last && last.source === undefined && last.offset + last.size === offset && last.size + block.size <= 4 * 1024 * 1024) last.size += block.size;
      else steps.push({ offset, size: block.size });
    }
    offset += block.size;
  }
  return { steps, reused, downloadSize: target.size - reused, ranges: steps.filter(step => step.source === undefined).length };
}
module.exports = { scan, validateMap, planBlocks };
