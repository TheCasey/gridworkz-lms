import { createHash } from 'node:crypto';

export const BILLING_LEASE_MS = 120000;
// Stripe may prune keys after 24 hours. Stop replaying before that boundary.
export const BILLING_REPLAY_MS = 23 * 60 * 60 * 1000;
export const billingId = (value) => createHash('sha256').update(value).digest('hex');
export const providerId = (value) => typeof value === 'string' ? value : value?.id || '';
export const providerParent = (value) => {
  const values = ['parent_id', 'parentId', 'uid'].map((key) => value?.metadata?.[key])
    .filter((entry) => entry !== undefined && entry !== '');
  if (!values.length || values.some((entry) => typeof entry !== 'string' || !entry.trim()
    || entry !== entry.trim() || entry.includes('/') || entry.length > 128)) return '';
  return new Set(values).size === 1 ? values[0] : '';
};
const LEGACY_CUSTOMER_KEYS = ['stripe_customer_id', 'stripeCustomerId', 'customer_id', 'billing_customer_id', 'provider_customer_id'];
const LEGACY_SUBSCRIPTION_KEYS = ['stripe_subscription_id', 'stripeSubscriptionId', 'subscription_id', 'billing_subscription_id', 'provider_subscription_id'];
export const legacyBillingProviderIds = (entitlement = {}) => {
  const records = [entitlement, entitlement.billing_state || {}, entitlement.billing || {}];
  const read = (keys) => [...new Set(records.flatMap((record) => keys.map((key) => record[key]))
    .filter((value) => typeof value === 'string' && value.trim()))];
  return { customers: read(LEGACY_CUSTOMER_KEYS), subscriptions: read(LEGACY_SUBSCRIPTION_KEYS) };
};
export const requiresLegacyBillingReconciliation = (entitlement = {}) => {
  const ids = legacyBillingProviderIds(entitlement);
  // Preserve the former customer's management path even after a canceled downgrade.
  return Boolean(ids.customers.length || ids.subscriptions.length
    || [entitlement, entitlement.billing_state || {}, entitlement.billing || {}]
      .some((record) => record.billing_provider === 'stripe'));
};
export const isTerminalSubscription = (value) => ['canceled', 'incomplete_expired'].includes(value?.status);

// Price IDs are operator supplied, never taken from parent records or requests.
// Metadata can confirm a recognized price; it cannot turn an unknown price into Core.
export const resolveBillingSubscriptionPlan = (subscription, { corePriceIds = [], lockdownPriceIds = [] } = {}) => {
  const items = subscription?.items?.data;
  if (!Array.isArray(items) || items.length !== 1 || subscription.items.has_more) return null;
  const priceId = providerId(items[0].price);
  const core = corePriceIds.includes(priceId);
  const lockdown = lockdownPriceIds.includes(priceId);
  if (core === lockdown) return null;
  const plan = core ? 'core' : 'lockdown';
  for (const key of ['plan_id', 'gridworkz_plan_id']) {
    const raw = subscription.metadata?.[key];
    if (raw === undefined || raw === '') continue;
    const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if ((normalized === 'pro' ? 'core' : normalized) !== plan) return null;
  }
  return plan;
};

export const validateBillingPayload = ({ parentId, payload, checkout = false, status = false, HttpsError }) => {
  if (!parentId || typeof parentId !== 'string') throw new HttpsError('unauthenticated', 'Sign in to manage billing.');
  const allowed = status ? [] : checkout ? ['intent_id', 'return_target'] : ['return_target'];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).some((key) => !allowed.includes(key))) {
    throw new HttpsError('invalid-argument', 'Unsupported billing request.');
  }
  if (!status && payload.return_target !== 'settings') throw new HttpsError('invalid-argument', 'Invalid return target.');
  if (checkout && !/^[A-Za-z0-9_-]{16,100}$/.test(payload.intent_id || '')) {
    throw new HttpsError('invalid-argument', 'A valid checkout intent is required.');
  }
};

export const resolveCoreBillingConfig = (env = process.env) => {
  const mode = ['test', 'live'].includes(env.CORE_BILLING_MODE) ? env.CORE_BILLING_MODE : null;
  let origin = null;
  try {
    const candidate = new URL(env.CORE_BILLING_APP_ORIGIN);
    const loopback = candidate.hostname === 'localhost' || candidate.hostname.endsWith('.localhost')
      || candidate.hostname.startsWith('127.') || candidate.hostname === '[::1]';
    if (candidate.origin === env.CORE_BILLING_APP_ORIGIN && !candidate.username && !candidate.password
      && (candidate.protocol === 'https:' && !loopback
        || env.FUNCTIONS_EMULATOR === 'true' && loopback && ['http:', 'https:'].includes(candidate.protocol))) origin = candidate.origin;
  } catch { /* Unconfigured origins fail closed. */ }
  const valid = Boolean(mode && origin);
  return {
    mode, origin, valid,
    checkoutEnabled: valid && env.CORE_BILLING_CHECKOUT_ENABLED === 'true'
      && (mode !== 'live' || env.CORE_BILLING_LIVE_APPROVED === 'true'),
    priceId: env.corePriceId || '',
    portalConfigurationId: env.CORE_BILLING_PORTAL_CONFIGURATION_ID || '',
    returnUrl: origin ? `${origin}/dashboard/settings` : null,
  };
};

export const verifyProviderMode = (object, config, HttpsError) => {
  if (typeof object?.livemode !== 'boolean' || object.livemode !== (config.mode === 'live')) {
    throw new HttpsError('failed-precondition', 'Billing mode requires reconciliation.');
  }
};

export const verifyCorePrice = (price, config, HttpsError) => {
  verifyProviderMode(price, config, HttpsError);
  if (price.id !== config.priceId || !price.active || price.currency !== 'usd' || price.unit_amount !== 500
    || price.type !== 'recurring' || price.recurring?.interval !== 'month'
    || price.recurring?.interval_count !== 1 || price.recurring?.usage_type !== 'licensed'
    || price.billing_scheme !== 'per_unit' || price.transform_quantity || price.tiers_mode) {
    throw new HttpsError('failed-precondition', 'Core billing is not configured for $5 monthly.');
  }
};

export const verifyPortalConfiguration = (configuration, config, HttpsError) => {
  verifyProviderMode(configuration, config, HttpsError);
  if (configuration.id !== config.portalConfigurationId || !configuration.active
    || configuration.features?.subscription_update?.enabled !== false
    || configuration.features?.subscription_cancel?.enabled !== true
    || configuration.features?.subscription_cancel?.mode !== 'at_period_end') {
    throw new HttpsError('failed-precondition', 'Safe billing management is not configured.');
  }
};
