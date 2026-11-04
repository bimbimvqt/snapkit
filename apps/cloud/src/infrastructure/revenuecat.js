import { timingSafeEqual, createHash } from 'node:crypto';
export function secureEqual(a, b) {
  const digest = value => createHash('sha256').update(String(value || '')).digest();
  return typeof a === 'string' && typeof b === 'string' && a.length > 0 && b.length > 0 && timingSafeEqual(digest(a), digest(b));
}
export async function revenueCatCustomer(userId, { apiKey, fetcher = fetch } = {}) {
  if (!apiKey) throw new Error('RevenueCat is not configured');
  if (typeof userId !== 'string' || !userId || userId.length > 512 || /[\x00-\x1f]/.test(userId)) throw new Error('Invalid account identity');
  const response = await fetcher('https://api.revenuecat.com/v1/subscribers/' + encodeURIComponent(userId), { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (response.status === 404) return { subscriber: { entitlements: {} } };
  if (!response.ok) throw new Error('Subscription provider is temporarily unavailable');
  return response.json();
}
