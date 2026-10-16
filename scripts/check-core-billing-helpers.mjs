#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  resolveCoreBillingConfig, validateBillingPayload, verifyCorePrice,
  verifyPortalConfiguration, verifyProviderMode, isTerminalSubscription,
  resolveBillingSubscriptionPlan,
  providerParent, requiresLegacyBillingReconciliation,
} from '../functions/src/coreBillingPolicy.js';
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const config = resolveCoreBillingConfig({ CORE_BILLING_MODE: 'test', CORE_BILLING_APP_ORIGIN: 'https://gridworkz.com',
  CORE_BILLING_CHECKOUT_ENABLED: 'true', corePriceId: 'price_core', CORE_BILLING_PORTAL_CONFIGURATION_ID: 'bpc_safe' });
let checks = 0;
const check = (fn) => { fn(); checks++; };
check(() => assert.equal(resolveCoreBillingConfig({}).checkoutEnabled, false));
check(() => assert.equal(config.checkoutEnabled, true));
for (const origin of ['http://gridworkz.com', 'https://gridworkz.com/', 'https://gridworkz.com/path', 'https://user@gridworkz.com',
  'https://gridworkz.com?x=1', 'https://localhost', 'https://app.localhost', 'https://127.0.0.2', 'http://127.0.0.1:3000']) {
  check(() => assert.equal(resolveCoreBillingConfig({ CORE_BILLING_MODE: 'test', CORE_BILLING_APP_ORIGIN: origin }).valid, false));
}
check(() => assert.equal(resolveCoreBillingConfig({ CORE_BILLING_MODE: 'test', CORE_BILLING_APP_ORIGIN: 'http://127.0.0.1:3000', FUNCTIONS_EMULATOR: 'true' }).valid, true));
check(() => assert.equal(resolveCoreBillingConfig({ CORE_BILLING_MODE: 'live', CORE_BILLING_APP_ORIGIN: 'https://gridworkz.com', CORE_BILLING_CHECKOUT_ENABLED: 'true' }).checkoutEnabled, false));
check(() => assert.equal(resolveCoreBillingConfig({ CORE_BILLING_MODE: 'live', CORE_BILLING_APP_ORIGIN: 'https://gridworkz.com', CORE_BILLING_CHECKOUT_ENABLED: 'true', CORE_BILLING_LIVE_APPROVED: 'true' }).checkoutEnabled, true));
const payload = { intent_id: 'safe_checkout_intent_1', return_target: 'settings' };
const validate = (overrides = {}) => validateBillingPayload({ parentId: 'parent', payload, checkout: true, HttpsError, ...overrides });
check(() => validate());
check(() => assert.throws(() => validate({ parentId: null }), { code: 'unauthenticated' }));
for (const field of ['price', 'price_id', 'customer', 'parent_id', 'return_url', 'plan_id']) {
  check(() => assert.throws(() => validate({ payload: { ...payload, [field]: 'forged' } }), { code: 'invalid-argument' }));
}
for (const invalid of [null, [], { ...payload, return_target: 'https://evil.test' }, { ...payload, intent_id: '../x' }]) {
  check(() => assert.throws(() => validate({ payload: invalid }), { code: 'invalid-argument' }));
}
const price = { id: 'price_core', active: true, livemode: false, currency: 'usd', unit_amount: 500,
  type: 'recurring', billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } };
check(() => verifyCorePrice(price, config, HttpsError));
for (const patch of [{ livemode: true }, { unit_amount: 1000 }, { currency: 'eur' }, { active: false }, { id: 'price_lockdown' },
  { recurring: { ...price.recurring, interval: 'year' } }, { recurring: { ...price.recurring, interval_count: 2 } },
  { recurring: { ...price.recurring, usage_type: 'metered' } }, { transform_quantity: { divide_by: 2 } }]) {
  check(() => assert.throws(() => verifyCorePrice({ ...price, ...patch }, config, HttpsError), { code: 'failed-precondition' }));
}
check(() => assert.throws(() => verifyProviderMode({}, config, HttpsError)));
const portal = { id: 'bpc_safe', active: true, livemode: false, features: {
  subscription_update: { enabled: false }, subscription_cancel: { enabled: true, mode: 'at_period_end' },
} };
check(() => verifyPortalConfiguration(portal, config, HttpsError));
check(() => assert.throws(() => verifyPortalConfiguration({ ...portal, features: { subscription_update: { enabled: true } } }, config, HttpsError)));
check(() => assert.throws(() => verifyPortalConfiguration({ ...portal, id: 'bpc_other' }, config, HttpsError)));
for (const cancellation of [undefined, { enabled: false, mode: 'at_period_end' }, { enabled: true, mode: 'immediately' }]) {
  check(() => assert.throws(() => verifyPortalConfiguration({ ...portal, features: {
    ...portal.features, subscription_cancel: cancellation,
  } }, config, HttpsError)));
}
check(() => assert.equal(providerParent({ metadata: { parent_id: 'parent', parentId: 'parent', uid: 'parent' } }), 'parent'));
check(() => assert.equal(providerParent({ metadata: { parent_id: 'parent', uid: 'other' } }), ''));
check(() => assert.equal(providerParent({ metadata: { parent_id: 'parent', uid: null } }), ''));
check(() => assert.equal(providerParent({ metadata: { parent_id: '../parent' } }), ''));
check(() => assert.equal(requiresLegacyBillingReconciliation({ billing_state: { billing_provider: 'stripe', plan_id: 'core' } }), true));
check(() => assert.equal(requiresLegacyBillingReconciliation({ stripe_customer_id: 'cus_historical', plan_id: 'free' }), true));
check(() => assert.equal(requiresLegacyBillingReconciliation({ billing_state: { subscription_id: 'sub_historical' } }), true));
check(() => assert.equal(requiresLegacyBillingReconciliation({ plan_id: 'core', manual_override: { is_active: true } }), false));
for (const status of ['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'paused']) check(() => assert.equal(isTerminalSubscription({ status }), false));
for (const status of ['canceled', 'incomplete_expired']) check(() => assert.equal(isTerminalSubscription({ status }), true));
const mappings = { corePriceIds: ['price_core', 'price_historical_core'], lockdownPriceIds: ['price_lockdown'] };
const sub = { items: { data: [{ price: { id: 'price_core' } }] }, metadata: { plan_id: 'core' } };
check(() => assert.equal(resolveBillingSubscriptionPlan(sub, mappings), 'core'));
check(() => assert.equal(resolveBillingSubscriptionPlan({ ...sub, metadata: { plan_id: 'pro' } }, mappings), 'core'));
check(() => assert.equal(resolveBillingSubscriptionPlan({ ...sub, metadata: {} }, mappings), 'core'));
check(() => assert.equal(resolveBillingSubscriptionPlan({ ...sub, items: { data: [{ price: 'price_historical_core' }] } }, mappings), 'core'));
check(() => assert.equal(resolveBillingSubscriptionPlan({ ...sub, metadata: { plan_id: 'lockdown' } }, mappings), null));
check(() => assert.equal(resolveBillingSubscriptionPlan({ ...sub, metadata: { plan_id: 'arbitrary' } }, mappings), null));
check(() => assert.equal(resolveBillingSubscriptionPlan({ ...sub, metadata: { plan_id: 'core', gridworkz_plan_id: 'lockdown' } }, mappings), null));
check(() => assert.equal(resolveBillingSubscriptionPlan({ ...sub, items: { data: [{ price: 'price_unknown' }] } }, mappings), null));
check(() => assert.equal(resolveBillingSubscriptionPlan({ ...sub, items: { data: [...sub.items.data, { price: 'price_unknown' }] } }, mappings), null));
check(() => assert.equal(resolveBillingSubscriptionPlan({ ...sub, items: { ...sub.items, has_more: true } }, mappings), null));
check(() => assert.equal(resolveBillingSubscriptionPlan(sub, { ...mappings, lockdownPriceIds: ['price_core'] }), null));
console.log(`Core billing policy: ${checks} assertions passed.`);
