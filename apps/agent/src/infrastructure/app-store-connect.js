import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { importPKCS8, SignJWT } from 'jose';
import { testFlightIdentity } from '../domain/release-plan.js';
const origin = 'https://api.appstoreconnect.apple.com';
export async function appleKey(input) {
  const identity = testFlightIdentity(input);
  if (!path.isAbsolute(identity.keyPath) || path.basename(identity.keyPath) !== `AuthKey_${identity.keyId}.p8`) throw Error('Choose an existing AuthKey_KEYID.p8 file matching your Key ID.');
  const info = await stat(identity.keyPath).catch(() => null);
  if (!info?.isFile() || info.size > 16384) throw Error('The App Store Connect key was moved or removed. Configure it again.');
  return identity;
}
export class AppStoreConnect {
  constructor({ fetcher = fetch } = {}) { this.fetcher = fetcher; }
  async token(input) {
    const identity = await appleKey(input);
    let key;
    try { key = await importPKCS8(await readFile(identity.keyPath, 'utf8'), 'ES256'); }
    catch { throw Error('This file is not a valid App Store Connect ES256 private key.'); }
    return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: identity.keyId, typ: 'JWT' }).setIssuer(identity.issuerId).setAudience('appstoreconnect-v1').setIssuedAt().setExpirationTime('5m').sign(key);
  }
  async request(url, token, signal) {
    const target = new URL(url, origin);
    if (target.origin !== origin || !/^\/v1\/apps(?:\/\d+)?$/.test(target.pathname) || target.username || target.password) throw Error('Invalid Apple API link.');
    let response;
    try { response = await this.fetcher(target, { redirect: 'error', headers: { Authorization: `Bearer ${token}` }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }); }
    catch { throw Error(signal?.aborted ? 'Task cancelled.' : 'Could not reach App Store Connect. Check your connection and try again.'); }
    if (!response.ok) throw Error(({ 401: 'Apple rejected this API key. Check the Key ID, Issuer ID and private key.', 403: 'This API key does not have permission to access these apps.', 404: 'This app is no longer accessible with the connected team key.', 429: 'Apple is limiting requests. Wait a moment and try again.' })[response.status] || 'App Store Connect could not complete this request. Try again later.');
    // App metadata is bounded; Apple error bodies/JWTs are never forwarded to the UI.
    const raw = await response.text(); if (raw.length > 4 * 1024 * 1024) throw Error('Apple returned too much app metadata.');
    try { return JSON.parse(raw); } catch { throw Error('Apple returned invalid app metadata.'); }
  }
  app(record) {
    const id = String(record?.id || ''), bundleId = String(record?.attributes?.bundleId || ''), name = String(record?.attributes?.name || '');
    if (!/^\d{1,30}$/.test(id) || !/^[A-Za-z0-9][A-Za-z0-9.-]{1,254}$/.test(bundleId) || !name || name.length > 300) throw Error('Apple returned invalid app metadata.');
    return { id, bundleId, name };
  }
  async apps(identity, signal) {
    const token = await this.token(identity), apps = [], seen = new Set(); let next = '/v1/apps?limit=200&fields[apps]=name,bundleId';
    for (let page = 0; next; page++) {
      if (page >= 10 || seen.has(next)) throw Error('Too many apps were returned. Limit the API key to the apps you manage.');
      seen.add(next); const result = await this.request(next, token, signal);
      if (!Array.isArray(result.data)) throw Error('Apple returned invalid app metadata.');
      apps.push(...result.data.map(record => this.app(record))); next = result.links?.next || '';
    }
    return [...new Map(apps.map(app => [app.id, app])).values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async readApp(identity, appId, signal) {
    if (!/^\d{1,30}$/.test(appId)) throw Error('Choose an app from this team.');
    return this.app((await this.request(`/v1/apps/${appId}?fields[apps]=name,bundleId`, await this.token(identity), signal)).data);
  }
}
