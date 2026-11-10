import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { adminRoles, permissionsFor, hasPermission, routePermission } from './domain/admin-access.js';
const secret = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
const DAY = 86400000;
const safeUser = user => ({ id: user.id, name: user.name, email: user.email, picture: user.picture, role: user.role, disabled: user.disabled, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt });
export const defaultContent = () => ({ revision: 0, registrationOpen: true, recommendedVersion: '', announcement: { en: '', vi: '' }, landing: {
  en: { headline: 'Debug multiple devices. From your favorite editor.', description: 'Select your devices, press F5 and test your app across screens.' },
  vi: { headline: 'Debug nhiều thiết bị. Ngay từ editor của bạn.', description: 'Chọn thiết bị, bấm F5 và kiểm tra ứng dụng trên nhiều màn hình.' }
} });
// Upgrade only untouched historical landing copy; preserve every custom edit.
export function refreshDefaultLanding(content) {
  const legacy = {
    en: { headline: 'Every device. One place to build.', description: 'Prepare your devices in a few clicks. Focus on your next great app.' },
    vi: { headline: 'Mọi thiết bị. Một nơi điều khiển.', description: 'Chuẩn bị thiết bị trong vài thao tác. Tập trung làm nên ứng dụng tiếp theo của bạn.' }
  };
  const next = structuredClone(content), defaults = defaultContent();
  let changed = false;
  for (const lang of ['en', 'vi']) for (const field of ['headline', 'description']) {
    if (next.landing?.[lang]?.[field] === legacy[lang][field]) {
      next.landing[lang][field] = defaults.landing[lang][field]; changed = true;
    }
  }
  if (changed) next.revision++;
  return next;
}
export function createAccounts({ env, fetcher = fetch, verifyGoogle } = {}) {
  const origin = new URL(env.SNAPKIT_PUBLIC_URL || 'https://snapkit.vn').origin;
  const configured = !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
  const admins = new Set((env.SNAPKIT_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean));
  const file = path.join(env.SNAPKIT_CLOUD_DATA || 'cloud-data', 'accounts.json');
  let db = { users: {}, sessions: {}, content: defaultContent(), audit: [] }, queue = Promise.resolve();
  const loaded = readFile(file, 'utf8').then(raw => { db = JSON.parse(raw); if (!db.users || !db.sessions || !db.content) throw Error('Invalid account database'); db.content = refreshDefaultLanding(db.content); }).catch(e => { if (e.code !== 'ENOENT') throw e; });
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
  const isOwner = user => admins.has(user.email.toLowerCase());
  const role = user => isOwner(user) ? 'admin' : Object.hasOwn(adminRoles, user.adminRole) ? user.adminRole : 'user';
  const userView = user => ({ ...safeUser(user), role: role(user), isOwner: isOwner(user) });
  const mutate = (req, permission, task) => transaction(next => {
    const current = next.users[req.account.user.id];
    if (!current || current.disabled || !hasPermission(role(current), permission)) { const error = Error('Permission revoked.'); error.status = 403; throw error; }
    return task(next);
  });
  async function identity(req) {
    await loaded;
    const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
    const cookie = /(?:^|;\s*)snapkit_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    const raw = bearer || cookie;
    if (!raw || raw.length > 128) return null;
    const session = db.sessions[hash(raw)], user = session && db.users[session.userId];
    if (!session || session.expires < Date.now() || !user || user.disabled) return null;
    return { user: userView(user), sessionId: hash(raw), bearer: !!bearer };
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
      if (input.submissionId !== undefined && (typeof input.submissionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.submissionId))) return res.status(400).json({error: 'Invalid feedback.'});
      const now = Date.now();
      for (const [key, rate] of feedbackRates) if (rate.until < now) feedbackRates.delete(key);
      const ip = req.ip || 'unknown'; const rate = feedbackRates.get(ip) || { count: 0, until: now + 3600000 };
      if (rate.count >= 5) return res.status(429).set('Retry-After', String(Math.ceil((rate.until - now) / 1000))).json({ error: 'Too many submissions.' });
      if (feedbackRates.size >= 20000 && !feedbackRates.has(ip)) return res.status(503).json({ error: 'Please try again later.' });
      rate.count++; feedbackRates.set(ip, rate);
      let id = randomUUID();
      await transaction(next => {
        next.feedback ||= [];
        const existing = input.submissionId && next.feedback.find(entry => entry.submissionId === input.submissionId);
        if (existing) { id = existing.id; return; }
        if (next.feedback.length >= 20000) throw Error('Feedback inbox is full.');
        next.feedback.push({ id, ...(input.submissionId ? {submissionId: input.submissionId} : {}), type: input.type, message: input.message.trim(), name: (input.name || '').trim(), email: (input.email || '').trim(), rating: input.rating ?? null, status: 'new', moderation: 'pending', publishConsent: input.type === 'review' && input.publishConsent === true, createdAt: new Date().toISOString() });
      });
      res.status(201).json({ received: true, id });
    });
    app.get('/v1/public/reviews', async (req, res) => {
      await loaded;
      const reviews = (db.feedback || []).filter(entry => entry.type === 'review' && entry.moderation === 'approved' && entry.publishConsent === true && Number.isInteger(entry.rating) && entry.rating >= 1 && entry.rating <= 5).slice().reverse();
      const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
      res.json({ total: reviews.length, reviews: reviews.slice(offset, offset + 6).map(({ id, name, message, rating, createdAt }) => ({ id, name, message, rating, createdAt })) });
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
      flows.set(state, { nonce, verifier, desktopId, returnTo:req.query.returnTo==='/join/'?'/join/':null, browserHash: hash(browserBinding), expires: Date.now() + 10 * 60000 });
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
          const user = { id, email: claims.email, name: String(claims.name || claims.email).slice(0, 160), picture, adminRole: existing?.adminRole || 'user', role: admins.has(claims.email.toLowerCase()) ? 'admin' : 'user', disabled: false, createdAt: existing?.createdAt || now, lastLoginAt: now };
          next.users[id] = user;
          const sessions = Object.entries(next.sessions).filter(([, s]) => s.userId === id).sort((a, b) => b[1].expires - a[1].expires);
          for (const [key] of sessions.slice(9)) delete next.sessions[key];
          next.sessions[hash(token)] = { userId: id, expires: Date.now() + 30 * DAY };
          audit(next, user, 'sign-in'); return userView(user);
        });
        // The browser and desktop get different sessions: browser logout must not
        // unexpectedly invalidate the independently signed-in desktop app.
        if (flow.desktopId) {
          const target = desktop.get(flow.desktopId); if (!target) throw Error('Desktop sign-in expired.');
          target.token = token; target.user = user;
          return res.redirect('/auth/complete');
        }
        cookie(res, token); res.redirect(flow.returnTo||'/admin/');
      } catch {
        if (flow.desktopId && desktop.has(flow.desktopId)) desktop.get(flow.desktopId).failed = true;
        res.redirect(flow.desktopId ? '/auth/complete?result=failed' : flow.returnTo?'/join/?auth=failed':'/admin/?auth=failed');
      }
    });
    app.get('/v1/account', async (req, res) => {
      const account = await identity(req); if (!account) return res.status(401).json({ error: 'Sign in with Google to continue.' });
      res.json({ user: account.user, permissions: permissionsFor(account.user.role), expiresAt: new Date(db.sessions[account.sessionId].expires).toISOString() });
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
      const permission = routePermission(req.path, req.method);
      if (!permission || !hasPermission(account.user.role, permission)) return res.status(403).json({ error: 'You do not have permission for this action.', code: 'FORBIDDEN' });
      if (req.method !== 'GET' && !account.bearer && !csrf(req)) return res.status(403).json({ error: 'Invalid request origin.' });
      req.account = account; next();
    });
    app.get('/v1/admin/feedback', async (req, res) => {
      await loaded; const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
      const search = String(req.query.search || '').slice(0,160).toLowerCase();
      const entries = [...(db.feedback || [])].reverse().filter(entry =>
        (!search || [entry.name,entry.email,entry.message].join(' ').toLowerCase().includes(search)) &&
        (!req.query.type || req.query.type === 'all' || entry.type === req.query.type) &&
        (!req.query.status || req.query.status === 'all' || entry.type !== 'review' && entry.status === req.query.status) &&
        (!req.query.moderation || req.query.moderation === 'all' || entry.type === 'review' && (entry.moderation || 'pending') === req.query.moderation));
      res.json({ total: entries.length, entries: entries.slice(offset, offset + 50) });
    });
    app.post('/v1/admin/feedback/status', async (req, res) => {
      if (typeof req.body?.id !== 'string' || !['new', 'reviewing', 'done'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid feedback status.' });
      await mutate(req, 'feedback.manage', next => {
        const entry = next.feedback?.find(item => item.id === req.body.id); if (!entry) throw Error('Feedback not found.');
        entry.status = req.body.status; audit(next, req.account.user, 'feedback-' + entry.status, entry.id);
      }); res.json({ saved: true });
    });
    app.post('/v1/admin/feedback/moderation', async (req, res) => {
      if (typeof req.body?.id !== 'string' || !['pending', 'approved', 'rejected'].includes(req.body.moderation)) return res.status(400).json({ error: 'Invalid review moderation.' });
      await mutate(req, 'feedback.manage', next => {
        const entry = next.feedback?.find(item => item.id === req.body.id);
        if (!entry || entry.type !== 'review') { const error = Error('Only reviews can be published.'); error.status = 409; throw error; }
        if (req.body.moderation === 'approved' && (entry.publishConsent !== true || !Number.isInteger(entry.rating) || entry.rating < 1 || entry.rating > 5)) { const error = Error('This review has no permission for publication.'); error.status = 409; throw error; }
        entry.moderation = req.body.moderation; entry.moderatedAt = new Date().toISOString();
        audit(next, req.account.user, 'review-' + entry.moderation, entry.id);
      }); res.json({ saved: true });
    });
    app.get('/v1/admin/overview', async (req, res) => {
      await loaded; const users = Object.values(db.users), feedback = db.feedback || [];
      const can = permission => hasPermission(req.account.user.role, permission);
      res.json({ users: users.length, activeUsers: users.filter(user => !user.disabled).length, sessions: Object.values(db.sessions).filter(session => session.expires > Date.now()).length,
        ...(can('content.read') ? { content: db.content } : {}),
        ...(can('audit.read') ? { audit: db.audit.slice(-30).reverse() } : {}),
        ...(can('feedback.read') ? { feedback: { total: feedback.length, open: feedback.filter(entry => entry.type !== 'review' && entry.status !== 'done').length, pending: feedback.filter(entry => entry.type === 'review' && entry.publishConsent && (!entry.moderation || entry.moderation === 'pending')).length, published: feedback.filter(entry => entry.type === 'review' && entry.publishConsent && entry.moderation === 'approved').length } } : {}) });
    });
    app.get('/v1/admin/content', async (_req, res) => res.json({content: await content()}));
    app.get('/v1/admin/audit', async (_req, res) => {
      await loaded; res.json({ entries: db.audit.slice(-100).reverse().map(entry => ({...entry, actorName: db.users[entry.actor]?.name || entry.actor})) });
    });
    app.get('/v1/admin/roles', (_req, res) => res.json({roles:adminRoles}));
    app.post('/v1/admin/users/role', async (req, res) => {
      const input = req.body;
      if (typeof input?.id !== 'string' || typeof input.role !== 'string' || input.role !== 'user' && !Object.hasOwn(adminRoles,input.role)) return res.status(400).json({error:'Invalid account role.'});
      await mutate(req, 'roles.manage', next => {
        const user = next.users[input.id];
        if (!user) throw Error('Account not found.');
        if (isOwner(user) || user.id === req.account.user.id) { const error = Error('Owner and your own role are protected.'); error.status=403; throw error; }
        user.adminRole = input.role;
        audit(next, req.account.user, 'assign-role:' + input.role, user.id);
      }); res.json({saved:true});
    });
    app.get('/v1/admin/users', async (req, res) => {
      await loaded; const search = String(req.query.search || '').slice(0, 160).toLowerCase(), offset = Math.max(0, Math.min(1000000, Number(req.query.offset) || 0));
      const users = Object.values(db.users).filter(u => (u.email + ' ' + u.name).toLowerCase().includes(search)).sort((a, b) => b.lastLoginAt.localeCompare(a.lastLoginAt));
      res.json({ total: users.length, users: users.slice(offset, offset + 50).map(u => userView(u)) });
    });
    app.post('/v1/admin/users/access', async (req, res) => {
      if (typeof req.body?.id !== 'string' || typeof req.body.disabled !== 'boolean') return res.status(400).json({ error: 'Choose an account and access status.' });
      await mutate(req, 'users.manage', next => {
        const user = next.users[req.body.id]; if (!user) throw Error('Account not found.');
        if (isOwner(user) || user.id === req.account.user.id) throw Error('Administrator accounts cannot be disabled here.');
        user.disabled = req.body.disabled;
        if (user.disabled) for (const [id, session] of Object.entries(next.sessions)) if (session.userId === user.id) delete next.sessions[id];
        audit(next, req.account.user, user.disabled ? 'disable-user' : 'enable-user', user.id);
      }); res.json({ saved: true });
    });
    app.post('/v1/admin/content', async (req, res) => {
      const input = req.body;
      const validateText = (value, limit) => typeof value === 'string' && value.length <= limit && !/[\u0000-\u0008]/.test(value);
      if (!input || !Number.isInteger(input.revision) || typeof input.registrationOpen !== 'boolean' || !validateText(input.recommendedVersion, 40) || input.recommendedVersion && !/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(input.recommendedVersion) || !['en', 'vi'].every(lang => validateText(input.announcement?.[lang], 500) && validateText(input.landing?.[lang]?.headline, 160) && input.landing[lang].headline.trim() && validateText(input.landing?.[lang]?.description, 500))) return res.status(400).json({ error: 'Check the content fields and version format.' });
      const result = await mutate(req, 'content.write', next => {
        if (next.content.registrationOpen !== input.registrationOpen && !hasPermission(role(next.users[req.account.user.id]), 'users.manage')) { const error = Error('Account settings require administrator access.'); error.status = 403; throw error; }
        if (next.content.revision !== input.revision) { const error = Error('Content changed in another window. Reload before saving.'); error.status = 409; throw error; }
        next.content = { revision: input.revision + 1, registrationOpen: input.registrationOpen, recommendedVersion: input.recommendedVersion, announcement: { en: input.announcement.en, vi: input.announcement.vi }, landing: { en: { headline: input.landing.en.headline, description: input.landing.en.description }, vi: { headline: input.landing.vi.headline, description: input.landing.vi.description } } };
        audit(next, req.account.user, 'publish-content'); return next.content;
      }); res.json({ content: result });
    });
  }
  return { install, identity, content, config, origin, isActiveUser:async id=>{await loaded;return !!db.users[id]&&!db.users[id].disabled;} };
}
function hashForPKCE(value) { return createHash('sha256').update(value).digest('base64url'); }
