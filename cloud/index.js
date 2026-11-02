import express from 'express';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { secureEqual, subscriptionFromCustomer, revenueCatCustomer, webhookUsers } from './revenuecat.js';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
export function createCloud({ env = process.env, fetcher = fetch } = {}) {
  const app = express(); app.disable('x-powered-by'); app.set('trust proxy', 1);
  const key = env.REVENUECAT_SECRET_API_KEY, webhookAuth = env.REVENUECAT_WEBHOOK_AUTH;
  const configured = !!key && !!webhookAuth && !!env.AUTH_JWKS_URL && !!env.AUTH_ISSUER && !!env.AUTH_AUDIENCE;
  const jwks = env.AUTH_JWKS_URL && env.AUTH_JWKS_URL.startsWith('https://') ? createRemoteJWKSet(new URL(env.AUTH_JWKS_URL)) : null;
  const statePath = path.join(env.SNAPKIT_CLOUD_DATA || path.join(root, 'cloud-data'), 'subscriptions.json');
  let state = { events: {}, customers: {} }, queue = Promise.resolve(), releaseCache, releaseUntil = 0;
  const loaded = readFile(statePath, 'utf8').then(raw => { state = JSON.parse(raw); }).catch(error => { if (error.code !== 'ENOENT') throw error; });
  const limits = new Map();
  const sweep = setInterval(() => { for (const [ip, entry] of limits) if (Date.now() > entry.until) limits.delete(ip); }, 60000); sweep.unref();
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self' https://api.github.com; frame-ancestors 'none'; base-uri 'self'", 'Cache-Control': 'no-store' });
    const allowedOrigin = 'https://bimbimvqt.github.io';
    if (req.headers.origin === allowedOrigin) { res.set('Access-Control-Allow-Origin', allowedOrigin); res.vary('Origin'); }
    if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'GET, OPTIONS'); return res.sendStatus(204); }
    const ip = req.ip || 'unknown'; const now = Date.now();
    const rate = limits.get(ip); const count = rate && rate.until > now ? rate : { count: 0, until: now + 60000 };
    count.count++; limits.set(ip, count);
    if (count.count > (req.path === '/v1/webhooks/revenuecat' ? 600 : 120)) return res.status(429).set('Retry-After', '60').json({ error: 'Please try again in a minute.' });
    if (limits.size > 20000) limits.delete(limits.keys().next().value);
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.get('/health', (_req, res) => res.json({ product: 'snapkit-cloud', version, status: 'ok', channel: 'beta' }));
  app.get('/v1/billing/config', (_req, res) => res.json({ provider: 'revenuecat', phase: 'free-beta', checkoutEnabled: false, accountEnabled: !!jwks && !!env.AUTH_ISSUER && !!env.AUTH_AUDIENCE, configured,
    notice: 'All beta features are free. No card is required and no subscription starts automatically.', plans: [{ id: 'free', name: 'Free', price: null, features: ['Local device management', 'Create and start virtual devices', 'Use any editor'] }, { id: 'pro', name: 'Pro', price: null, includedInBeta: true, features: ['Multi-device Flutter debug selection', 'Saved project setups', 'Coordinated editor restart'] }] }));
  app.post('/v1/billing/checkout', (_req, res) => res.status(503).json({ code: 'BETA_FREE', error: 'Subscriptions are not on sale during beta. No payment has been taken.' }));
  app.get('/v1/releases/latest', async (req, res) => {
    if (!['darwin', 'win32'].includes(req.query.platform) || !['arm64', 'x64'].includes(req.query.arch) || req.query.platform === 'win32' && req.query.arch !== 'x64') return res.status(400).json({ error: 'Choose macOS Apple Silicon, macOS Intel, or Windows x64.' });
    if (!releaseCache || Date.now() >= releaseUntil) {
      try {
        const response = await fetcher('https://api.github.com/repos/bimbimvqt/snapkit/releases?per_page=20', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Snapkit-release-service' }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Release lookup failed');
        releaseCache = await response.json(); releaseUntil = Date.now() + 60000;
      } catch { return res.status(503).json({ error: 'Downloads are temporarily unavailable. Please try GitHub Releases.', url: 'https://github.com/bimbimvqt/snapkit/releases' }); }
    }
    const osName = req.query.platform === 'darwin' ? 'mac' : 'win';
    const release = releaseCache.find(item => !item.draft && item.assets?.some(asset => asset.name === `Snapkit-${item.tag_name.replace(/^v/, '')}-${osName}-${req.query.arch}.${osName === 'mac' ? 'dmg' : 'exe'}`));
    if (!release) return res.json({ version: null, available: false, url: 'https://github.com/bimbimvqt/snapkit/releases', channel: 'beta' });
    const asset = release.assets.find(asset => asset.name === `Snapkit-${release.tag_name.replace(/^v/, '')}-${osName}-${req.query.arch}.${osName === 'mac' ? 'dmg' : 'exe'}`);
    res.json({ version: release.tag_name.replace(/^v/, ''), available: true, url: release.html_url, downloadUrl: asset.browser_download_url, size: asset.size, channel: release.prerelease ? 'beta' : 'stable', signed: false });
  });
  app.get('/v1/me/subscription', async (req, res) => {
    if (!jwks || !env.AUTH_ISSUER || !env.AUTH_AUDIENCE || !key) return res.status(503).json({ error: 'Account subscriptions are not available during this beta.' });
    let identity;
    try { identity = (await jwtVerify((req.headers.authorization || '').replace(/^Bearer /, ''), jwks, { issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE, algorithms: ['RS256', 'ES256'] })).payload.sub; if (!identity) throw new Error('Missing subject'); }
    catch { return res.status(401).json({ error: 'Sign in to your Snapkit account again.' }); }
    try { res.json(subscriptionFromCustomer(await revenueCatCustomer(identity, { apiKey: key, fetcher }), { entitlement: env.REVENUECAT_ENTITLEMENT || 'pro' })); }
    catch { res.status(503).json({ error: 'Could not refresh your subscription. Please try again later.' }); }
  });
  app.post('/v1/webhooks/revenuecat', async (req, res) => {
    if (!webhookAuth || !key) return res.status(503).json({ error: 'Subscription processing is not configured.' });
    if (!secureEqual(req.headers.authorization, webhookAuth)) return res.status(401).json({ error: 'Unauthorized' });
    const event = req.body?.event;
    if (typeof event?.id !== 'string' || event.id.length > 256 || !event.id || !webhookUsers(event).length) return res.status(400).json({ error: 'Invalid subscription event' });
    const operation = queue.catch(() => {}).then(async () => {
      await loaded;
      if (state.events[event.id]) return { duplicate: true };
      const updates = {};
      for (const userId of webhookUsers(event)) {
        const customer = await revenueCatCustomer(userId, { apiKey: key, fetcher });
        updates[createHash('sha256').update(userId).digest('hex')] = subscriptionFromCustomer(customer, { entitlement: env.REVENUECAT_ENTITLEMENT || 'pro' });
      }
      const events = { ...state.events, [event.id]: Date.now() };
      const ordered = Object.entries(events).sort((a, b) => b[1] - a[1]).slice(0, 10000);
      const next = { events: Object.fromEntries(ordered), customers: { ...state.customers, ...updates } };
      await mkdir(path.dirname(statePath), { recursive: true });
      await writeFile(statePath + '.tmp', JSON.stringify(next), { mode: 0o600 }); await rename(statePath + '.tmp', statePath); state = next;
      return { received: true };
    });
    queue = operation;
    try { res.json(await operation); } catch { res.status(503).json({ error: 'Event not processed; retry later.' }); }
  });
  for (const page of ['demo', 'control', 'preview']) app.get('/' + page + '/', (_req, res) => res.redirect(302, 'https://bimbimvqt.github.io/snapkit/' + page + '/'));
  app.get('/i18n.js', (_req, res) => res.sendFile(path.join(root, 'public/i18n.js')));
  app.get('/favicon.svg', (_req, res) => res.sendFile(path.join(root, 'site/favicon.svg')));
  app.use(express.static(path.join(root, 'site'), { maxAge: '5m' }));
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'Request too large' : 'Invalid request' }));
  return app;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createCloud().listen(Number(process.env.PORT || 8080), process.env.HOST || '127.0.0.1', () => console.log('Snapkit release service ready'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
