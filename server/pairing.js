import { randomBytes } from 'node:crypto';

export class Pairings {
  constructor(origin, now = Date.now) { this.origin = origin; this.now = now; this.sessions = new Map(); this.pending = null; }
  create() {
    const code = randomBytes(6).toString('hex').toUpperCase();
    this.pending = { code, expiresAt: this.now() + 300000, attempts: 0 };
    return { code: code.match(/.{4}/g).join('-'), expiresAt: this.pending.expiresAt, origin: this.origin };
  }
  claim(code, origin) {
    if (origin !== this.origin) throw new Error('Website origin is not allowed');
    const pending = this.pending;
    if (!pending || this.now() >= pending.expiresAt || pending.attempts >= 10) throw new Error('Pairing code expired. Generate a new code in the local Dashboard.');
    pending.attempts++;
    if (typeof code !== 'string' || code.replaceAll('-', '').toUpperCase() !== pending.code) throw new Error('Invalid pairing code');
    this.pending = null;
    for (const [key, session] of this.sessions) if (this.now() >= session.expiresAt) this.sessions.delete(key);
    if (this.sessions.size >= 10) throw new Error('Too many website connections. Revoke connections in the local Dashboard.');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = this.now() + 8 * 3600000;
    this.sessions.set(token, { origin, expiresAt });
    return { token, expiresAt };
  }
  allows(token, origin) {
    const session = this.sessions.get(token);
    if (!session || session.origin !== origin) return false;
    if (this.now() >= session.expiresAt) { this.sessions.delete(token); return false; }
    return true;
  }
  revoke(token) { if (token) this.sessions.delete(token); else { this.sessions.clear(); this.pending = null; } }
}
