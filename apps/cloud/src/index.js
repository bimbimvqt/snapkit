import express from 'express';
import { createAccounts } from './accounts.js';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { secureEqual, revenueCatCustomer } from './infrastructure/revenuecat.js';
import { subscriptionFromCustomer, webhookUsers } from './domain/subscription.js';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
export function createCloud({ env = process.env, fetcher = fetch, verifyGoogle } = {}) {
  const accounts = createAccounts({ env, fetcher, verifyGoogle });
  const app = express(); app.disable('x-powered-by'); app.set('trust proxy', 1);
  const key = env.REVENUECAT_SECRET_API_KEY, webhookAuth = env.REVENUECAT_WEBHOOK_AUTH;
  const configured = !!key && !!webhookAuth && accounts.config().configured;
  const statePath = path.join(env.SNAPKIT_CLOUD_DATA || path.join(root, 'cloud-data'), 'subscriptions.json');
  let state = { events: {}, customers: {} }, queue = Promise.resolve(), releaseCache, releaseUntil = 0, releasePending, releaseRetryAt = 0;
  const loaded = readFile(statePath, 'utf8').then(raw => { state = JSON.parse(raw); }).catch(error => { if (error.code !== 'ENOENT') throw error; });
  const limits = new Map();
  const sweep = setInterval(() => { for (const [ip, entry] of limits) if (Date.now() > entry.until) limits.delete(ip); }, 60000); sweep.unref();
  app.use((req, res, next) => {
    // Only paired controllers may contact the user's loopback agent.
    if (/^\/(admin|auth|v1|control|preview|demo)(\/|$)/.test(req.path)) res.set('X-Robots-Tag', 'noindex, nofollow');
    const controller = /^\/(control|preview)(\/|$)/.test(req.path);
    const connections = controller ? ' http://127.0.0.1:* http://localhost:*' : '';
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': `default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self' https://api.github.com${connections}; frame-ancestors 'none'; base-uri 'self'`, 'Cache-Control': 'no-store' });
    const allowedOrigins = new Set(['https://snapkit.vn', 'https://bimbimvqt.github.io', new URL(env.SNAPKIT_PUBLIC_URL || 'https://snapkit.vn').origin]);
    if (allowedOrigins.has(req.headers.origin)) { res.set('Access-Control-Allow-Origin', req.headers.origin); res.vary('Origin'); }
    if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'GET, OPTIONS'); return res.sendStatus(204); }
    const ip = req.ip || 'unknown'; const now = Date.now();
    const rate = limits.get(ip); const count = rate && rate.until > now ? rate : { count: 0, until: now + 60000 };
    count.count++; limits.set(ip, count);
    if (count.count > (req.path === '/v1/webhooks/revenuecat' ? 600 : 120)) return res.status(429).set('Retry-After', '60').json({ error: 'Please try again in a minute.' });
    if (limits.size > 20000) limits.delete(limits.keys().next().value);
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  accounts.install(app);
  app.get('/admin', (req, res, next) => req.path === '/admin' ? res.redirect('/admin/') : next());
  app.get('/auth/complete', (_req, res) => res.sendFile(path.join(root, 'apps/website/auth/complete.html')));
  app.get('/health', (_req, res) => res.json({ product: 'snapkit-cloud', version, status: 'ok', channel: 'beta' }));
  app.get('/v1/billing/config', (_req, res) => res.json({ provider: 'revenuecat', phase: 'free-beta', checkoutEnabled: false, accountEnabled: accounts.config().configured, configured,
    notice: 'All beta features are free. No card is required and no subscription starts automatically.', plans: [{ id: 'free', name: 'Free', price: null, features: ['Local device management', 'Create and start virtual devices', 'Use any editor'] }, { id: 'pro', name: 'Pro', price: null, includedInBeta: true, features: ['Multi-device Flutter debug selection', 'Saved project setups', 'Coordinated editor restart'] }] }));
  app.post('/v1/billing/checkout', (_req, res) => res.status(503).json({ code: 'BETA_FREE', error: 'Subscriptions are not on sale during beta. No payment has been taken.' }));
  async function releaseCatalog() {
    if (releaseCache && Date.now() < releaseUntil) return releaseCache;
    if (releasePending) return releasePending;
    if (Date.now() < releaseRetryAt) throw Error('Release service is cooling down');
    releasePending = (async () => {
      try {
        const response = await fetcher('https://api.github.com/repos/bimbimvqt/snapkit/releases?per_page=20', {headers:{Accept:'application/vnd.github+json','User-Agent':'Snapkit-release-service'},signal:AbortSignal.timeout(10000)});
        if (!response.ok) throw Error('Release lookup failed');
        const releases = await response.json();
        if (!Array.isArray(releases) || releases.length > 100 || releases.some(item => !item || typeof item.tag_name !== 'string' || !Array.isArray(item.assets))) throw Error('Invalid release catalog');
        if (!releases.some(item => item.tag_name === 'v'+version)) {
          const tagged = await fetcher('https://api.github.com/repos/bimbimvqt/snapkit/releases/tags/v'+version,{headers:{Accept:'application/vnd.github+json','User-Agent':'Snapkit-release-service'},signal:AbortSignal.timeout(10000)});
          if (tagged.ok) { const item = await tagged.json(); if (item?.tag_name === 'v'+version && Array.isArray(item.assets)) releases.push(item); }
        }
        releases.sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||'')));
        releaseCache = releases; releaseUntil = Date.now()+5*60000; return releases;
      } catch (error) { releaseRetryAt = Date.now()+60000; throw error; }
      finally { releasePending = null; }
    })();
    return releasePending;
  }
  app.get('/v1/releases/desktop', async (_req,res) => {
    try {
      const releases = await releaseCatalog();
      res.json(releases.filter(item=>!item.draft).map(item=>({tag_name:item.tag_name,draft:false,prerelease:item.prerelease===true,assets:item.assets.map(({name,size,digest,browser_download_url})=>({name,size,digest,browser_download_url}))})));
    } catch { res.status(503).json({error:'Update metadata is temporarily unavailable. Try again shortly.'}); }
  });
  app.get('/v1/releases/latest', async (req, res) => {
    if (!['darwin', 'win32'].includes(req.query.platform) || !['arm64', 'x64'].includes(req.query.arch) || req.query.platform === 'win32' && req.query.arch !== 'x64') return res.status(400).json({ error: 'Choose macOS Apple Silicon, macOS Intel, or Windows x64.' });
    let releases;
    try { releases = await releaseCatalog(); } catch { return res.status(503).json({ error: 'Downloads are temporarily unavailable. Please try GitHub Releases.', url: 'https://github.com/bimbimvqt/snapkit/releases' }); }
    const osName = req.query.platform === 'darwin' ? 'mac' : 'win';
    const publicContent = await accounts.content();
    const release = releases.find(item => (!publicContent.recommendedVersion || item.tag_name === 'v' + publicContent.recommendedVersion) && !item.draft && item.assets?.some(asset => asset.name === `Snapkit-${item.tag_name.replace(/^v/, '')}-${osName}-${req.query.arch}.${osName === 'mac' ? 'dmg' : 'exe'}`));
    if (!release) return res.json({ version: null, available: false, url: 'https://github.com/bimbimvqt/snapkit/releases', channel: 'beta' });
    const asset = release.assets.find(asset => asset.name === `Snapkit-${release.tag_name.replace(/^v/, '')}-${osName}-${req.query.arch}.${osName === 'mac' ? 'dmg' : 'exe'}`);
    res.json({ version: release.tag_name.replace(/^v/, ''), available: true, url: release.html_url, downloadUrl: asset.browser_download_url, size: asset.size, channel: release.prerelease ? 'beta' : 'stable', signed: false });
  });
  app.get('/v1/me/subscription', async (req, res) => {
    if (!key || !accounts.config().configured) return res.status(503).json({ error: 'Account subscriptions are not available during this beta.' });
    const account = await accounts.identity(req);
    if (!account) return res.status(401).json({ error: 'Sign in to your Snapkit account again.' });
    try { res.json(subscriptionFromCustomer(await revenueCatCustomer(account.user.id, { apiKey: key, fetcher }), { entitlement: env.REVENUECAT_ENTITLEMENT || 'pro' })); }
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
  app.get('/language.css', (_req, res) => res.sendFile(path.join(root, 'packages/ui/language.css')));
  app.get('/i18n.js', (_req, res) => res.sendFile(path.join(root, 'packages/ui/i18n.js')));
  app.get('/favicon.svg', (_req, res) => res.sendFile(path.join(root, 'packages/ui/favicon.svg'), error => { if (error) res.sendFile(path.join(root, 'packages/ui/favicon.svg')); }));
  app.use(express.static(path.join(root, 'apps/website'), { maxAge: '5m' }));
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, _req, res, _next) => res.status([403, 409, 413].includes(error.status) ? error.status : 400).json({ error: error.status === 413 ? 'Request too large' : 'Invalid request' }));
  return app;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createCloud().listen(Number(process.env.PORT || 8080), process.env.HOST || '127.0.0.1', () => console.log('Snapkit release service ready'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
