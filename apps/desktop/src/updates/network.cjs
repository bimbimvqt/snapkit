'use strict';
const https = require('node:https');
const { createWriteStream } = require('node:fs');
const { createHash } = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { downloadURL } = require('./policy.cjs');
function request(url, signal, redirects = 0, range) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { signal, headers: { 'User-Agent': 'Snapkit-Desktop-Updater', Accept: 'application/vnd.github+json', 'Accept-Encoding': 'identity', ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}) }, timeout: 30000 }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        try { if (redirects >= 5) throw Error('Too many update redirects.'); const next = downloadURL(new URL(response.headers.location, url).href); resolve(request(next, signal, redirects + 1, range)); } catch (error) { reject(error); }
      } else if (range ? response.statusCode !== 206 || response.headers['content-range'] !== `bytes ${range.start}-${range.end}/${range.total}` || response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity' : response.statusCode !== 200) {
        response.destroy(); reject(Error('Update server did not return the requested data.'));
      }
      else resolve(response);
    });
    req.on('timeout', () => req.destroy(Error('Update connection timed out. Try again.'))); req.on('error', reject);
  });
}
async function releaseList(signal) {
  const response = await request('https://api.github.com/repos/bimbimvqt/snapkit/releases?per_page=30', signal);
  const parts = []; let bytes = 0;
  for await (const chunk of response) { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) { response.destroy(); throw Error('Invalid update response.'); } parts.push(chunk); }
  const releases = JSON.parse(Buffer.concat(parts).toString()); if (!Array.isArray(releases)) throw Error('Invalid update response.'); return releases;
}
async function download(asset, file, signal, onProgress) {
  const response = await request(downloadURL(asset.url), signal);
  const hash = createHash('sha256'); let bytes = 0;
  const meter = new Transform({ transform(chunk, _encoding, callback) { bytes += chunk.length; if (bytes > asset.size) return callback(Error('Update file size does not match.')); hash.update(chunk); onProgress(bytes); callback(null, chunk); } });
  await pipeline(response, meter, createWriteStream(file, { flags: 'wx', mode: 0o600 }), { signal });
  if (bytes !== asset.size || hash.digest('hex') !== asset.sha256) throw Error('Update verification failed. Download the update again.');
}
async function downloadRange(asset, start, size, signal, onProgress) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(size) || start < 0 || size <= 0 || size > 4 * 1024 * 1024 || start + size > asset.size) throw Error('Invalid update range.');
  const response = await request(downloadURL(asset.url), signal, 0, { start, end: start + size - 1, total: asset.size });
  const parts = []; let bytes = 0;
  for await (const chunk of response) { bytes += chunk.length; if (bytes > size) { response.destroy(); throw Error('Update range exceeds expected size.'); } parts.push(chunk); onProgress(bytes); }
  if (bytes !== size) throw Error('Update range is incomplete.');
  return Buffer.concat(parts);
}
module.exports = { releaseList, download, downloadRange };
