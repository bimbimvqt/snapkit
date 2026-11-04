export function subscriptionFromCustomer(customer, { now = Date.now(), entitlement = 'pro', allowSandbox = false } = {}) {
  const grant = customer?.subscriber?.entitlements?.[entitlement];
  const subscription = grant?.product_identifier ? customer?.subscriber?.subscriptions?.[grant.product_identifier] : null;
  const purchases = customer?.subscriber?.non_subscriptions?.[grant?.product_identifier] || [];
  const latestPurchase = purchases.find(purchase => purchase.purchase_date === grant?.purchase_date) || purchases.at(-1);
  const sandbox = subscription?.is_sandbox === true || latestPurchase?.is_sandbox === true;
  const expires = grant?.expires_date ? Date.parse(grant.expires_date) : null;
  const grace = subscription?.grace_period_expires_date ? Date.parse(subscription.grace_period_expires_date) : null;
  const until = Math.max(expires || 0, grace || 0);
  const active = !!grant && (!sandbox || allowSandbox) && (grant.expires_date === null || Number.isFinite(expires) && until > now);
  return { plan: active ? 'pro' : 'free', active, expiresAt: active && until ? new Date(until).toISOString() : null, lifetime: active && grant.expires_date === null,
    renews: active && !!subscription && !subscription.unsubscribe_detected_at && !subscription.billing_issues_detected_at && grant.expires_date !== null,
    billingIssue: active && !!subscription?.billing_issues_detected_at, sandbox, checkedAt: new Date(now).toISOString() };
}
export function webhookUsers(event) {
  return [...new Set([event?.app_user_id, ...(Array.isArray(event?.transferred_from) ? event.transferred_from : []), ...(Array.isArray(event?.transferred_to) ? event.transferred_to : [])].filter(value => typeof value === 'string' && value.length > 0 && value.length <= 512))];
}
