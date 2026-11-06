import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { createRemoteJWKSet, jwtVerify } from 'jose';
const secret = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
const DAY = 86400000;
const safeUser = user => ({ id: user.id, name: user.name, email: user.email, picture: user.picture, role: user.role, disabled: user.disabled, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt });
export const defaultContent = () => ({ revision: 0, registrationOpen: true, recommendedVersion: '', announcement: { en: '', vi: '' }, landing: {
  en: { headline: 'Every device. One place to build.', description: 'Prepare your devices in a few clicks. Focus on your next great app.' },
  vi: { headline: 'Mọi thiết bị. Một nơi điều khiển.', description: 'Chuẩn bị thiết bị trong vài thao tác. Tập trung làm nên ứng dụng tiếp theo của bạn.' }
} });
export function createAccounts({ env, fetcher = fetch, verifyGoogle } = {}) {
  const origin = new URL(env.SNAPKIT_PUBLIC_URL || 'https://snapkit.vn').origin;
  const configured = !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
  const admins = new Set((env.SNAPKIT_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean));
  const file = path.join(env.SNAPKIT_CLOUD_DATA || 'cloud-data', 'accounts.json');
  let db = { users: {}, sessions: {}, content: defaultContent(), audit: [] }, queue = Promise.resolve();
  const loaded = readFile(file, 'utf8').then(raw => { db = JSON.parse(raw); if (!db.users || !db.sessions || !db.content) throw Error('Invalid account database'); }).catch(e => { if (e.code !== 'ENOENT') throw e; });
  loaded.catch(() => {});
  const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  const flows = new Map(), desktop = new Map();
  const cleanup = () => { const now = Date.now(); for (const map of [flows, desktop]) for (const [id, flow] of map) if (flow.expires < now) map.delete(id); };
  const transaction = task => {
    const result = queue.catch(() => {}).then(async () => {
      await loaded;
      const next = structuredClone(db), value = await task(next);
      for (const [id, session] of Object.entries(next.sessions)) if (session.expires < Date.now()) delete next.sessions[id];
      next.audit = next.audit.slice(-500);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file + '.tmp', JSON.stringify(next), { mode: 0o600 }); await rename(file + '.tmp', file); db = next;
      return value;
    }); queue = result; return result;
  };
  const role = user => admins.has(user.email.toLowerCase()) ? 'admin' : 'user';
  async function identity(req) {
    await loaded;
    const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
    const cookie = /(?:^|;\s*)snapkit_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    const raw = bearer || cookie;
    if (!raw || raw.length > 128) return null;
    const session = db.sessions[hash(raw)], user = session && db.users[session.userId];
    if (!session || session.expires < Date.now() || !user || user.disabled) return null;
    return { user: { ...safeUser(user), role: role(user) }, sessionId: hash(raw), bearer: !!bearer };
  }
  const csrf = req => req.headers.origin === origin && req.headers['x-snapkit-request'] === '1';
  const cookie = (res, token, age = 30 * DAY) => res.setHeader('Set-Cookie', `snapkit_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(age / 1000)}`);
  function config() { return { configured, required: true, provider: 'google', loginUrl: origin + '/auth/google/start', adminUrl: origin + '/admin/' }; }
  async function content() { await loaded; return structuredClone(db.content); }
  function audit(next, actor, action, target = '') { next.audit.push({ at: new Date().toISOString(), actor: actor.id, action, target }); }
  function install(app) {
    app.get('/v1/auth/config', (_req, res) => res.json(config()));
    const feedbackRates = new Map();
    app.post('/v1/feedback', async (req, res) => {
      if (req.headers.origin !== origin || req.headers['x-snapkit-request'] !== '1') return res.status(403).json({ error: 'Invalid request origin.' });
      const input = req.body || {};
      if (input.website) return res.status(400).json({ error: 'Invalid feedback.' });
      const text = (value, max) => typeof value === 'string' && value.length <= max && !/[\u0000-\u0008]/.test(value);
      if (!['review', 'bug', 'feature', 'other'].includes(input.type) || !text(input.message, 4000) || input.message.trim().length < 10 || !text(input.name || '', 100) || !text(input.email || '', 254) || input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.rating != null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) || input.type === 'review' && input.rating == null) return res.status(400).json({ error: 'Check your feedback fields.' });
      const now = Date.now();
      for (const [key, rate] of feedbackRates) if (rate.until < now) feedbackRates.delete(key);
      const ip = req.ip || 'unknown'; const rate = feedbackRates.get(ip) || { count: 0, until: now + 3600000 };
      if (rate.count >= 5) return res.status(429).set('Retry-After', String(Math.ceil((rate.until - now) / 1000))).json({ error: 'Too many submissions.' });
      if (feedbackRates.size >= 20000 && !feedbackRates.has(ip)) return res.status(503).json({ error: 'Please try again later.' });
      rate.count++; feedbackRates.set(ip, rate);
      const id = randomUUID();
      await transaction(next => {
        next.feedback ||= [];
        if (next.feedback.length >= 20000) throw Error('Feedback inbox is full.');
        next.feedback.push({ id, type: input.type, message: input.message.trim(), name: (input.name || '').trim(), email: (input.email || '').trim(), rating: input.rating ?? null, status: 'new', createdAt: new Date().toISOString() });
      });
      res.status(201).json({ received: true, id });
    });
    app.get('/v1/public/content', async (_req, res) => res.json(await content()));
    app.post('/v1/auth/desktop/start', (_req, res) => {
      if (!configured) return res.status(503).json({ error: 'Google sign-in is not configured yet.' });
      cleanup(); if (desktop.size >= 1000) return res.status(429).json({ error: 'Too many sign-in requests. Try again later.' });
      const id = secret(), pollToken = secret();
      desktop.set(id, { pollHash: hash(pollToken), expires: Date.now() + 10 * 60000 });
      res.json({ pollToken, flowId: id, browserUrl: origin + '/auth/google/start?desktop=' + id, expiresIn: 600, interval: 3 });
    });
    app.post('/v1/auth/desktop/poll', (req, res) => {
      cleanup(); const flow = desktop.get(req.body?.flowId);
      if (!flow || typeof req.body?.pollToken !== 'string' || hash(req.body.pollToken) !== flow.pollHash) return res.status(410).json({ error: 'Sign-in expired. Start again.' });
      if (flow.failed) { desktop.delete(req.body.flowId); return res.status(403).json({ error: 'Google sign-in could not be completed. Try again.' }); }
      if (!flow.token) return res.json({ pending: true });
      desktop.delete(req.body.flowId); res.json({ token: flow.token, user: flow.user });
    });
    app.get('/auth/google/start', async (req, res) => {
      if (!configured) return res.redirect('/admin/?auth=unavailable');
      cleanup(); if (flows.size >= 1000) return res.status(429).send('Please try again later.');
      const desktopId = typeof req.query.desktop === 'string' && desktop.has(req.query.desktop) ? req.query.desktop : null;
      if (req.query.desktop && !desktopId) return res.status(400).send('Sign-in expired. Please start again in Snapkit.');
      const state = secret(), nonce = secret(), verifier = secret(), browserBinding = secret();
      flows.set(state, { nonce, verifier, desktopId, browserHash: hash(browserBinding), expires: Date.now() + 10 * 60000 });
      res.setHeader('Set-Cookie', `snapkit_oauth=${browserBinding}; Path=/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: origin + '/auth/google/callback', response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: hashForPKCE(verifier), code_challenge_method: 'S256', prompt: 'select_account' }).toString();
      res.redirect(url.href);
    });
    app.get('/auth/google/callback', async (req, res) => {
      cleanup(); const flow = flows.get(req.query.state); flows.delete(req.query.state);
      const binding = /(?:^|;\s*)snapkit_oauth=([^;]+)/.exec(req.headers.cookie || '')?.[1];
      if (!flow || !binding || hash(binding) !== flow.browserHash) return res.status(400).send('Sign-in expired or invalid. Please start again.');
      try {
        if (req.query.error || typeof req.query.code !== 'string' || req.query.code.length > 4096) throw Error('Google authorization was not completed.');
        const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: origin + '/auth/google/callback', code: req.query.code, grant_type: 'authorization_code', code_verifier: flow.verifier }), signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw Error('Google sign-in failed.');
        const tokens = await response.json();
        const claims = verifyGoogle ? await verifyGoogle(tokens.id_token) : (await jwtVerify(tokens.id_token, jwks, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: env.GOOGLE_CLIENT_ID, algorithms: ['RS256'] })).payload;
        if (!claims.sub || !claims.email || claims.email_verified !== true || claims.nonce !== flow.nonce || typeof claims.email !== 'string') throw Error('Invalid Google identity.');
        const token = secret(), now = new Date().toISOString();
        const user = await transaction(next => {
          const id = 'google:' + claims.sub, existing = next.users[id];
          if (existing?.disabled || !existing && !next.content.registrationOpen && !admins.has(claims.email.toLowerCase())) throw Error('Account access is not available.');
          const picture = typeof claims.picture === 'string' && /^https:\/\/lh[0-9]*\.googleusercontent\.com\//.test(claims.picture) ? claims.picture : '';
          const user = { id, email: claims.email, name: String(claims.name || claims.email).slice(0, 160), picture, role: admins.has(claims.email.toLowerCase()) ? 'admin' : 'user', disabled: false, createdAt: existing?.createdAt || now, lastLoginAt: now };
          next.users[id] = user;
          const sessions = Object.entries(next.sessions).filter(([, s]) => s.userId === id).sort((a, b) => b[1].expires - a[1].expires);
          for (const [key] of sessions.slice(9)) delete next.sessions[key];
          next.sessions[hash(token)] = { userId: id, expires: Date.now() + 30 * DAY };
          audit(next, user, 'sign-in'); return safeUser(user);
        });
        // The browser and desktop get different sessions: browser logout must not
        // unexpectedly invalidate the independently signed-in desktop app.
        if (flow.desktopId) {
          const target = desktop.get(flow.desktopId); if (!target) throw Error('Desktop sign-in expired.');
          target.token = token; target.user = user;
          return res.redirect('/auth/complete');
        }
        cookie(res, token); res.redirect('/admin/');
      } catch {
        if (flow.desktopId && desktop.has(flow.desktopId)) desktop.get(flow.desktopId).failed = true;
        res.redirect(flow.desktopId ? '/auth/complete?result=failed' : '/admin/?auth=failed');
      }
    });
    app.get('/v1/account', async (req, res) => {
      const account = await identity(req); if (!account) return res.status(401).json({ error: 'Sign in with Google to continue.' });
      res.json({ user: account.user, expiresAt: new Date(db.sessions[account.sessionId].expires).toISOString() });
    });
    app.post('/v1/auth/logout', async (req, res) => {
      const account = await identity(req);
      if (!account) { cookie(res, '', 0); return res.json({ signedOut: true }); }
      if (!account.bearer && !csrf(req)) return res.status(403).json({ error: 'Invalid request origin.' });
      await transaction(next => { delete next.sessions[account.sessionId]; }); cookie(res, '', 0); res.json({ signedOut: true });
    });
    app.use('/v1/admin', async (req, res, next) => {
      const account = await identity(req);
      if (!account) return res.status(401).json({ error: 'Sign in with your administrator Google account.' });
      if (account.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
      if (req.method !== 'GET' && !account.bearer && !csrf(req)) return res.status(403).json({ error: 'Invalid request origin.' });
      req.account = account; next();
    });
    app.get('/v1/admin/feedback', async (req, res) => {
      await loaded; const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
      const entries = [...(db.feedback || [])].reverse();
      res.json({ total: entries.length, entries: entries.slice(offset, offset + 50) });
    });
    app.post('/v1/admin/feedback/status', async (req, res) => {
      if (typeof req.body?.id !== 'string' || !['new', 'reviewing', 'done'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid feedback status.' });
      await transaction(next => {
        const entry = next.feedback?.find(item => item.id === req.body.id); if (!entry) throw Error('Feedback not found.');
        entry.status = req.body.status; audit(next, req.account.user, 'feedback-' + entry.status, entry.id);
      }); res.json({ saved: true });
    });
    app.get('/v1/admin/overview', async (_req, res) => { await loaded; const users = Object.values(db.users); res.json({ users: users.length, activeUsers: users.filter(u => !u.disabled).length, sessions: Object.values(db.sessions).filter(s => s.expires > Date.now()).length, content: db.content, audit: db.audit.slice(-30).reverse() }); });
    app.get('/v1/admin/users', async (req, res) => {
      await loaded; const search = String(req.query.search || '').slice(0, 160).toLowerCase(), offset = Math.max(0, Math.min(1000000, Number(req.query.offset) || 0));
      const users = Object.values(db.users).filter(u => (u.email + ' ' + u.name).toLowerCase().includes(search)).sort((a, b) => b.lastLoginAt.localeCompare(a.lastLoginAt));
      res.json({ total: users.length, users: users.slice(offset, offset + 50).map(u => ({ ...safeUser(u), role: role(u) })) });
    });
    app.post('/v1/admin/users/access', async (req, res) => {
      if (typeof req.body?.id !== 'string' || typeof req.body.disabled !== 'boolean') return res.status(400).json({ error: 'Choose an account and access status.' });
      await transaction(next => {
        const user = next.users[req.body.id]; if (!user) throw Error('Account not found.');
        if (role(user) === 'admin') throw Error('Administrator accounts cannot be disabled here.');
        user.disabled = req.body.disabled;
        if (user.disabled) for (const [id, session] of Object.entries(next.sessions)) if (session.userId === user.id) delete next.sessions[id];
        audit(next, req.account.user, user.disabled ? 'disable-user' : 'enable-user', user.id);
      }); res.json({ saved: true });
    });
    app.post('/v1/admin/content', async (req, res) => {
      const input = req.body;
      const validateText = (value, limit) => typeof value === 'string' && value.length <= limit && !/[\u0000-\u0008]/.test(value);
      if (!input || !Number.isInteger(input.revision) || typeof input.registrationOpen !== 'boolean' || !validateText(input.recommendedVersion, 40) || input.recommendedVersion && !/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(input.recommendedVersion) || !['en', 'vi'].every(lang => validateText(input.announcement?.[lang], 500) && validateText(input.landing?.[lang]?.headline, 160) && input.landing[lang].headline.trim() && validateText(input.landing?.[lang]?.description, 500))) return res.status(400).json({ error: 'Check the content fields and version format.' });
      const result = await transaction(next => {
        if (next.content.revision !== input.revision) { const error = Error('Content changed in another window. Reload before saving.'); error.status = 409; throw error; }
        next.content = { revision: input.revision + 1, registrationOpen: input.registrationOpen, recommendedVersion: input.recommendedVersion, announcement: { en: input.announcement.en, vi: input.announcement.vi }, landing: { en: { headline: input.landing.en.headline, description: input.landing.en.description }, vi: { headline: input.landing.vi.headline, description: input.landing.vi.description } } };
        audit(next, req.account.user, 'publish-content'); return next.content;
      }); res.json({ content: result });
    });
  }
  return { install, identity, content, config, origin };
}
function hashForPKCE(value) { return createHash('sha256').update(value).digest('base64url'); }
