import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataRoot } from '../../infrastructure/storage/paths.js';
const CLOUD = process.env.SNAPKIT_ACCOUNT_SERVER || 'https://snapkit.vn';
if (new URL(CLOUD).protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(new URL(CLOUD).hostname)) throw Error('Account server must use HTTPS');
const pending = new Map();
process.parentPort?.on('message', event => {
  const message = event.data;
  if (message?.type !== 'account-storage-result') return;
  const task = pending.get(message.id); if (!task) return;
  pending.delete(message.id); clearTimeout(task.timer); message.error ? task.reject(Error('Secure account storage unavailable')) : task.resolve(message.value);
});
async function credentialStore(action, value) {
  if (process.parentPort && process.env.SNAPKIT_DESKTOP === '1') return new Promise((resolve, reject) => {
    const id = randomUUID(), timer = setTimeout(() => { pending.delete(id); reject(Error('Secure account storage timed out')); }, 3000);
    pending.set(id, { resolve, reject, timer }); process.parentPort.postMessage({ type: 'account-storage', id, action, value });
  });
  const file = path.join(dataRoot, 'state/account-session.json');
  if (action === 'read') return JSON.parse(await readFile(file, 'utf8').catch(() => 'null'));
  if (!value) return unlink(file).catch(() => {});
  await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(value), { mode: 0o600 });
}
export class LocalAccount {
  constructor({ fetcher = fetch, storage = credentialStore } = {}) { this.fetcher = fetcher; this.storage = storage; this.token = ''; this.user = null; this.checked = 0; this.flow = null; this.pending = null; this.loaded = false; this.error = ''; }
  async request(route, body, token = this.token) {
    let response;
    try { response = await this.fetcher(CLOUD + route, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) }); }
    catch { throw Error('Cannot connect to the Snapkit account service. Check your connection and try again.'); }
    const result = await response.json(); if (!response.ok) { const error = Error(result.error || 'Account service unavailable.'); error.status = response.status; throw error; } return result;
  }
  async status(fresh = false) {
    if (!this.loaded) this.loaded = this.storage('read').then(value => { this.token = value?.token || ''; }).catch(() => {});
    await this.loaded;
    if (!this.token) return { required: true, authenticated: false, user: null, error: this.error };
    if (!fresh && this.user && Date.now() - this.checked < 60000) return { required: true, authenticated: true, user: this.user };
    if (!this.pending) this.pending = this.request('/v1/account').then(result => { this.user = result.user; this.checked = Date.now(); this.error = ''; }).catch(async error => {
      this.user = null; this.error = error.status === 401 ? 'Your session expired. Sign in again.' : 'Connect to the internet to verify your Snapkit account.';
      if (error.status === 401) { this.token = ''; await this.storage('write', null).catch(() => {}); }
    }).finally(() => { this.pending = null; });
    await this.pending; return { required: true, authenticated: !!this.user, user: this.user, error: this.error };
  }
  async start() { this.flow = await this.request('/v1/auth/desktop/start', {}); this.error = ''; return { browserUrl: this.flow.browserUrl, expiresIn: this.flow.expiresIn }; }
  async poll() {
    if (!this.flow) return this.status();
    const result = await this.request('/v1/auth/desktop/poll', { flowId: this.flow.flowId, pollToken: this.flow.pollToken });
    if (result.pending) return { pending: true };
    if (!result.token) throw Error('Invalid sign-in response.');
    this.token = result.token; this.flow = null; this.user = null;
    const status = await this.status(true);
    if (!status.authenticated) throw Error(status.error || 'Sign-in could not be verified.');
    try { await this.storage('write', { token: this.token }); } catch { status.sessionOnly = true; }
    return status;
  }
  async logout() { if (this.token) await this.request('/v1/auth/logout', {}).catch(() => {}); this.token = ''; this.user = null; this.flow = null; this.error = ''; await this.storage('write', null).catch(() => {}); }
}
