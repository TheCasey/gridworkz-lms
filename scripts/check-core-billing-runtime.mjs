#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createCoreBillingService } from '../functions/src/coreBillingAuthority.js';
import { resolveCoreBillingConfig, resolveBillingSubscriptionPlan, billingId, BILLING_LEASE_MS } from '../functions/src/coreBillingPolicy.js';

// This test intentionally cannot use production or a remotely exposed emulator.
assert.equal(process.env.GCLOUD_PROJECT, 'demo-gridworkz-direction', 'Explicit disposable demo project required.');
for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  assert.match(process.env[name] || '', /^(127\.0\.0\.1|localhost):\d+$/, `${name} must point to loopback.`);
}
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { HttpsError } = require('firebase-functions/v2/https');
const { buildEntitlementBillingState, buildEntitlementWriteForBillingSync } = await import('../functions/src/index.js');
const db = getFirestore();
const runId = `core_${randomUUID().replaceAll('-', '')}`;
const uids = [];
const eventIds = [];
const reports = [];
let clock = Date.now();
let enabled = true;
let origin = 'https://gridworkz.com';
let hooks = {};
const customers = new Map();
const sessions = new Map();
const subscriptions = new Map();
const keys = new Map();
const calls = { customer: 0, session: 0, portal: 0 };
const price = { id: 'price_core_test', livemode: false, active: true, currency: 'usd', unit_amount: 500,
  type: 'recurring', billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } };
const getConfig = () => resolveCoreBillingConfig({ CORE_BILLING_MODE: 'test', CORE_BILLING_APP_ORIGIN: origin,
  CORE_BILLING_CHECKOUT_ENABLED: String(enabled), corePriceId: price.id, CORE_BILLING_PORTAL_CONFIGURATION_ID: 'bpc_safe' });
const stripe = {
  prices: { retrieve: async () => structuredClone(price) },
  customers: {
    retrieve: async (id) => structuredClone(customers.get(id)),
    create: async (params, options) => {
      if (keys.has(options.idempotencyKey)) return structuredClone(keys.get(options.idempotencyKey));
      calls.customer++;
      const value = { id: `cus_${runId}_${calls.customer}`, livemode: false, ...params };
      customers.set(value.id, value); keys.set(options.idempotencyKey, value);
      if (hooks.customer) await hooks.customer(value);
      return structuredClone(value);
    },
  },
  subscriptions: { list: async ({ customer }) => {
    if (hooks.listSubscriptions) await hooks.listSubscriptions(customer);
    return { data: [...subscriptions.values()].filter((value) => value.customer === customer).map((value) => structuredClone(value)), has_more: false };
  } },
  checkout: { sessions: {
    retrieve: async (id) => structuredClone(sessions.get(id)),
    list: async ({ customer }) => ({ data: [...sessions.values()].filter((value) => value.customer === customer).map((value) => structuredClone(value)), has_more: false }),
    create: async (params, options) => {
      if (keys.has(options.idempotencyKey)) return structuredClone(keys.get(options.idempotencyKey));
      calls.session++;
      const value = { id: `cs_${runId}_${calls.session}`, livemode: false, status: 'open', url: 'https://checkout.stripe.com/c/pay/test', ...params };
      sessions.set(value.id, value); keys.set(options.idempotencyKey, value);
      if (hooks.session) await hooks.session(value);
      return structuredClone(value);
    },
  } },
  billingPortal: {
    configurations: { retrieve: async () => ({ id: 'bpc_safe', active: true, livemode: false, features: {
      subscription_update: { enabled: false }, subscription_cancel: { enabled: true, mode: 'at_period_end' },
    } }) },
    sessions: { create: async () => { calls.portal++; return { url: 'https://billing.stripe.com/p/session/test' }; } },
  },
};
const service = createCoreBillingService({ db, Timestamp, HttpsError, getStripe: () => stripe, getConfig, now: () => clock,
  buildBillingWrite: ({ parentId, existingEntitlement, subscription, nowTimestamp, nowMillis }) => subscription && !resolveBillingSubscriptionPlan(subscription, { corePriceIds: [price.id] }) ? null : buildEntitlementWriteForBillingSync({
    parentId, existingEntitlement, nowTimestamp, nowMillis,
    billingState: buildEntitlementBillingState({ planId: subscription ? 'core' : 'free',
      subscriptionStatus: subscription ? ['incomplete', 'unpaid', 'past_due'].includes(subscription.status) ? 'past_due' : subscription.status : 'canceled',
      billingProvider: 'stripe', updatedAt: nowTimestamp }),
  }),
  queueAudit: (tx, value) => tx.create(db.collection('entitlementAuditLogs').doc(), {
    parent_id: value.parentId, reason: value.reason, created_at: value.createdAt,
  }),
});
const fixture = async () => { const uid = `${runId}_${uids.length}`; uids.push(uid); await db.collection('parents').doc(uid).set({ parent_id: uid }); return uid; };
const payload = (suffix = randomUUID()) => ({ intent_id: `intent_${suffix}`, return_target: 'settings' });
const checkout = (parentId, data = payload()) => service.checkout({ parentId, payload: data });
const account = async (uid) => (await db.collection('billingAccounts').doc(uid).get()).data();
const subscription = (uid, customer, status = 'active', id = `sub_${uid}`) => {
  const value = { id, customer, status, livemode: false, metadata: { parent_id: uid, plan_id: 'core' }, items: { data: [{ price: price.id }] } };
  subscriptions.set(id, value); return value;
};
const event = (customer, type = 'customer.subscription.updated', extra = {}) => {
  const id = `evt_${runId}_${eventIds.length}`; eventIds.push(id);
  return { id, type, livemode: false, data: { object: { customer, ...extra } } };
};
const check = async (name, fn) => { await fn(); reports.push(name); console.log(`PASS ${name}`); };

try {
  await check('authenticated nonparent cannot invoke billing or create a binding', async () => {
    const uid = `${runId}_nonparent`;
    await assert.rejects(checkout(uid), { code: 'permission-denied' });
    await assert.rejects(service.status({ parentId: uid, payload: {} }), { code: 'permission-denied' });
    await assert.rejects(service.portal({ parentId: uid, payload: { return_target: 'settings' } }), { code: 'permission-denied' });
    assert.equal(await account(uid), undefined); assert.equal(calls.customer, 0);
  });
  await check('disabled checkout fails closed without provider mutation', async () => {
    const uid = await fixture(); enabled = false;
    assert.equal((await service.status({ parentId: uid, payload: {} })).checkout_available, false);
    await assert.rejects(checkout(uid), { code: 'failed-precondition' }); assert.equal(calls.customer, 0); enabled = true;
  });
  await check('legacy server Stripe state and historical IDs close unbound purchase', async () => {
    const before = { ...calls };
    for (const entitlement of [
      { billing_provider: 'stripe', plan_id: 'core', subscription_status: 'active' },
      { billing_state: { billing_provider: 'stripe', plan_id: 'free', subscription_status: 'canceled' } },
      { plan_id: 'free', stripe_customer_id: 'cus_historical' },
      { plan_id: 'free', billing_state: { subscription_id: 'sub_historical' } },
    ]) {
      const uid = await fixture(); await db.collection('accountEntitlements').doc(uid).set(entitlement);
      const status = await service.status({ parentId: uid, payload: {} });
      assert.equal(status.checkout_available, false); assert.equal(status.binding_state, 'reconciliation_required');
      await assert.rejects(checkout(uid), { code: 'failed-precondition' });
      assert.equal((await account(uid)).stripe_customer_id, undefined);
    }
    assert.equal(calls.customer, before.customer); assert.equal(calls.session, before.session);
  });
  await check('current provider metadata adopts legacy binding and ignores event metadata identity', async () => {
    const uid = await fixture(); const customerId = `cus_legacy_${uid}`;
    customers.set(customerId, { id: customerId, livemode: false, metadata: { parent_id: uid, uid } });
    const sub = subscription(uid, customerId);
    await db.collection('accountEntitlements').doc(uid).set({ parent_id: uid, billing_provider: 'stripe',
      plan_id: 'core', stripe_customer_id: customerId, stripe_subscription_id: sub.id });
    await assert.rejects(checkout(uid), { code: 'failed-precondition' });
    const trigger = event(customerId, 'customer.subscription.updated', { metadata: { parent_id: 'forged_event_parent' } });
    assert.equal((await service.webhook(trigger)).disposition, 'synced');
    const binding = await account(uid); assert.equal(binding.stripe_customer_id, customerId);
    assert.equal(binding.binding_source, 'verified_legacy_metadata'); assert.equal(binding.reconciliation_required, false);
    assert.equal((await db.collection('accountEntitlements').doc(uid).get()).data().stripe_customer_id, customerId);
    assert.ok((await service.portal({ parentId: uid, payload: { return_target: 'settings' } })).url);
  });
  await check('conflicting prior legacy IDs retain retry until explicit correction', async () => {
    const uid = await fixture(); const customerId = `cus_prior_${uid}`;
    customers.set(customerId, { id: customerId, livemode: false, metadata: { parent_id: uid } });
    const priorSub = subscription(uid, customerId);
    const entitlement = db.collection('accountEntitlements').doc(uid);
    await entitlement.set({ billing_provider: 'stripe', stripe_customer_id: 'cus_other_legacy', plan_id: 'core' });
    const trigger = event(customerId);
    await assert.rejects(service.webhook(trigger), { code: 'unavailable' });
    assert.equal((await db.collection('billingEventReceipts').doc(billingId(`test:${trigger.id}`)).get()).exists, false);
    assert.equal((await account(uid)).stripe_customer_id, undefined);
    assert.equal((await entitlement.get()).data().stripe_customer_id, 'cus_other_legacy');
    await entitlement.update({ stripe_customer_id: customerId, stripe_subscription_id: 'sub_wrong_prior_customer' });
    await assert.rejects(service.webhook(trigger), { code: 'unavailable' });
    assert.equal((await account(uid)).stripe_customer_id, undefined);
    await entitlement.update({ stripe_subscription_id: priorSub.id });
    assert.equal((await service.webhook(trigger)).disposition, 'synced');
    assert.equal((await account(uid)).stripe_customer_id, customerId);
  });
  await check('missing and contradictory current provider aliases remain retryable before adoption', async () => {
    const uid = await fixture(); const customerId = `cus_alias_${uid}`;
    const customer = { id: customerId, livemode: false, metadata: {} }; customers.set(customerId, customer);
    subscription(uid, customerId);
    const trigger = event(customerId, 'customer.subscription.updated', { metadata: { parent_id: uid } });
    await assert.rejects(service.webhook(trigger), { code: 'unavailable' });
    customer.metadata = { parent_id: uid, uid: 'contradictory_parent' };
    await assert.rejects(service.webhook(trigger), { code: 'unavailable' });
    assert.equal((await account(uid)).stripe_customer_id, undefined);
    assert.equal((await account(uid)).reconciliation_required, true);
    assert.equal((await service.status({ parentId: uid, payload: {} })).checkout_available, false);
    await assert.rejects(checkout(uid), { code: 'failed-precondition' });
    assert.equal((await db.collection('billingEventReceipts').doc(billingId(`test:${trigger.id}`)).get()).exists, false);
    customer.metadata = { parent_id: uid };
    assert.equal((await service.webhook(trigger)).disposition, 'synced');
  });
  await check('old customer event preserves established replacement customer binding', async () => {
    const uid = await fixture(); await checkout(uid); const current = await account(uid);
    subscription(uid, current.stripe_customer_id, 'active', `sub_current_${uid}`);
    const oldCustomerId = `cus_old_${uid}`;
    customers.set(oldCustomerId, { id: oldCustomerId, livemode: false, metadata: { parent_id: uid } });
    subscription(uid, oldCustomerId, 'canceled', `sub_old_${uid}`);
    const trigger = event(oldCustomerId, 'customer.subscription.deleted', { id: `sub_old_${uid}` });
    assert.equal((await service.webhook(trigger)).disposition, 'synced');
    const binding = await account(uid); assert.equal(binding.stripe_customer_id, current.stripe_customer_id);
    assert.equal(binding.stripe_subscription_id, `sub_current_${uid}`);
    assert.equal((await db.collection('accountEntitlements').doc(uid).get()).data().plan_id, 'core');
  });
  await check('concurrent requests create one customer and one open checkout', async () => {
    const uid = await fixture(); const before = { ...calls };
    const results = await Promise.allSettled([checkout(uid), checkout(uid)]);
    assert.ok(results.some((result) => result.status === 'fulfilled'));
    assert.equal(calls.customer - before.customer, 1); assert.equal(calls.session - before.session, 1);
    assert.equal((await checkout(uid)).reused, true);
    const intentDocs = await db.collection('billingCheckoutIntents').where('parent_id', '==', uid).get(); assert.equal(intentDocs.size, 1);
  });
  await check('lost customer response replays exact persisted intent and key', async () => {
    const uid = await fixture(); const request = payload(); const before = { ...calls };
    hooks.customer = async () => { hooks.customer = null; throw new Error('lost response'); };
    await assert.rejects(checkout(uid, request), { code: 'unavailable' });
    assert.ok((await account(uid)).pending_checkout);
    await checkout(uid, request); assert.equal(calls.customer - before.customer, 1); assert.equal(calls.session - before.session, 1);
  });
  await check('lost session response recovered across different client intent', async () => {
    const uid = await fixture(); const before = { ...calls };
    hooks.session = async () => { hooks.session = null; throw new Error('lost response'); };
    await assert.rejects(checkout(uid), { code: 'unavailable' });
    await checkout(uid); assert.equal(calls.customer - before.customer, 1); assert.equal(calls.session - before.session, 1);
    const attempts = await db.collection('billingCheckoutAttempts').where('parent_id', '==', uid).get();
    assert.ok(attempts.docs.some((doc) => doc.data().stage === 'unknown'));
  });
  await check('uncertain intent beyond idempotency retention blocks recreation', async () => {
    const uid = await fixture(); const before = { ...calls };
    hooks.customer = async () => { hooks.customer = null; throw new Error('crash'); };
    await assert.rejects(checkout(uid), { code: 'unavailable' });
    clock += 24 * 60 * 60 * 1000;
    await assert.rejects(checkout(uid), { code: 'failed-precondition' });
    assert.equal(calls.customer - before.customer, 1); assert.equal((await account(uid)).reconciliation_required, true);
  });
  await check('expired known checkout permits fresh intent but rejects finished intent reuse', async () => {
    const uid = await fixture(); const request = payload(); await checkout(uid, request);
    sessions.get((await account(uid)).pending_checkout.session_id).status = 'expired';
    await assert.rejects(checkout(uid, request), (error) => error.details?.code === 'billing_intent_closed');
    assert.ok((await checkout(uid)).url);
  });
  await check('known open session cannot reuse revoked server return configuration', async () => {
    const uid = await fixture(); await checkout(uid); const before = calls.session;
    origin = 'https://new-gridworkz.example';
    try { await assert.rejects(checkout(uid), { code: 'failed-precondition' }); }
    finally { origin = 'https://gridworkz.com'; }
    assert.equal(calls.session, before); assert.equal((await account(uid)).reconciliation_required, true);
  });
  await check('all nonterminal subscriptions and scheduled cancellation block purchase', async () => {
    const uid = await fixture(); await checkout(uid); const binding = await account(uid); const before = calls.session;
    for (const status of ['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'paused']) {
      const sub = subscription(uid, binding.stripe_customer_id, status); sub.cancel_at_period_end = true;
      await assert.rejects(checkout(uid), { code: 'failed-precondition' });
      assert.equal((await service.status({ parentId: uid, payload: {} })).checkout_available, false);
    }
    assert.equal(calls.session, before);
  });
  await check('portal remains available after downgrade and purchase gate off', async () => {
    const uid = await fixture(); await checkout(uid); enabled = false;
    assert.ok((await service.portal({ parentId: uid, payload: { return_target: 'settings' } })).url);
    const status = await service.status({ parentId: uid, payload: {} });
    assert.equal(status.checkout_available, false); assert.equal(status.portal_available, true); enabled = true;
  });
  await check('provider metadata mismatch blocks writable identity association', async () => {
    const uid = await fixture(); await checkout(uid); const binding = await account(uid);
    customers.get(binding.stripe_customer_id).metadata.parent_id = 'forged_other';
    await assert.rejects(checkout(uid), { code: 'failed-precondition' });
    await assert.rejects(service.portal({ parentId: uid, payload: { return_target: 'settings' } }), { code: 'failed-precondition' });
    const trigger = event(binding.stripe_customer_id);
    await assert.rejects(service.webhook(trigger), { code: 'unavailable' });
    assert.equal((await db.collection('billingEventReceipts').doc(billingId(`test:${trigger.id}`)).get()).exists, false);
    customers.get(binding.stripe_customer_id).metadata.parent_id = uid; subscription(uid, binding.stripe_customer_id);
    assert.equal((await service.webhook(trigger)).disposition, 'synced');
    assert.equal((await account(uid)).reconciliation_required, false);
  });
  await check('duplicate and old deletion reconcile replacement current state atomically', async () => {
    const uid = await fixture(); await checkout(uid); const binding = await account(uid);
    subscription(uid, binding.stripe_customer_id, 'active', `sub_replacement_${uid}`);
    await db.collection('accountEntitlements').doc(uid).set({ parent_id: uid, usage_snapshot: { students: 4, curriculum_items: 9 }, product_direction_version: 1 });
    const trigger = event(binding.stripe_customer_id, 'customer.subscription.deleted', { id: 'sub_old', status: 'canceled' });
    assert.equal((await service.webhook(trigger)).disposition, 'synced');
    assert.equal((await service.webhook(trigger)).duplicate, true);
    const entitlement = (await db.collection('accountEntitlements').doc(uid).get()).data();
    assert.equal(entitlement.plan_id, 'core'); assert.equal(entitlement.usage_snapshot.students, 4); assert.equal(entitlement.product_direction_version, 1);
    assert.equal((await account(uid)).stripe_subscription_id, `sub_replacement_${uid}`);
    assert.equal((await db.collection('entitlementAuditLogs').where('parent_id', '==', uid).get()).size, 1);
  });
  await check('out of order active trigger cannot revive canceled provider state', async () => {
    const uid = await fixture(); await checkout(uid); const binding = await account(uid);
    subscription(uid, binding.stripe_customer_id, 'canceled');
    await service.webhook(event(binding.stripe_customer_id, 'customer.subscription.updated', { status: 'active' }));
    assert.equal((await db.collection('accountEntitlements').doc(uid).get()).data().plan_id, 'free');
  });
  await check('unknown provider price and conflicting multiple subscriptions get durable reconciliation', async () => {
    const uid = await fixture(); await checkout(uid); const binding = await account(uid);
    const sub = subscription(uid, binding.stripe_customer_id); sub.items.data[0].price = 'price_unknown';
    assert.equal((await service.webhook(event(binding.stripe_customer_id))).disposition, 'unmapped_plan');
    assert.equal((await db.collection('accountEntitlements').doc(uid).get()).exists, false);
    sub.items.data[0].price = price.id;
    subscription(uid, binding.stripe_customer_id, 'active', `sub_duplicate_${uid}`);
    assert.equal((await service.webhook(event(binding.stripe_customer_id))).disposition, 'multiple_subscriptions');
    assert.equal((await account(uid)).reconciliation_required, true);
  });
  await check('webhook rereads support override and usage changed during provider retrieval', async () => {
    const uid = await fixture(); await checkout(uid); const binding = await account(uid); subscription(uid, binding.stripe_customer_id);
    hooks.listSubscriptions = async (customer) => {
      if (customer !== binding.stripe_customer_id) return;
      hooks.listSubscriptions = null;
      await db.collection('accountEntitlements').doc(uid).set({ parent_id: uid, plan_id: 'lockdown', subscription_status: 'active',
        usage_snapshot: { students: 7, curriculum_items: 13 }, product_direction_version: 1,
        manual_override: { is_active: true, plan_id: 'lockdown', subscription_status: 'active', expires_at: Timestamp.fromMillis(clock + 600000) } });
    };
    await service.webhook(event(binding.stripe_customer_id));
    const value = (await db.collection('accountEntitlements').doc(uid).get()).data();
    assert.equal(value.plan_id, 'lockdown'); assert.equal(value.billing_state.plan_id, 'core');
    assert.equal(value.usage_snapshot.students, 7); assert.equal(value.product_direction_version, 1); assert.equal(value.manual_override.is_active, true);
  });
  await check('lease takeover fences expired provider holder and recovers created session', async () => {
    const uid = await fixture(); let unblock; let entered;
    const waiting = new Promise((resolve) => { entered = resolve; });
    const blocked = new Promise((resolve) => { unblock = resolve; });
    hooks.session = async () => { hooks.session = null; entered(); await blocked; };
    const stale = checkout(uid); await waiting; clock += BILLING_LEASE_MS + 1;
    const result = await checkout(uid); assert.ok(result.url); unblock();
    await assert.rejects(stale, { code: 'unavailable' }); assert.equal((await account(uid)).lease, null);
  });
  await check('busy webhook retries and unmapped events have durable disposition', async () => {
    const uid = await fixture(); await checkout(uid); const binding = await account(uid); subscription(uid, binding.stripe_customer_id);
    const trigger = event(binding.stripe_customer_id);
    await db.collection('billingAccounts').doc(uid).update({ lease: { token: 'busy', expires_at_ms: clock + 10000 } });
    await assert.rejects(service.webhook(trigger), { code: 'unavailable' });
    assert.equal((await db.collection('billingEventReceipts').doc(billingId(`test:${trigger.id}`)).get()).exists, false);
    await db.collection('billingAccounts').doc(uid).update({ lease: null }); await service.webhook(trigger);
    const orphan = event(`cus_orphan_${runId}`); await assert.rejects(service.webhook(orphan), { code: 'unavailable' });
    assert.equal((await db.collection('billingEventReceipts').doc(billingId(`test:${orphan.id}`)).get()).exists, false);
    await assert.rejects(service.webhook({ ...orphan, id: `bad_${orphan.id}`, livemode: true }), { code: 'failed-precondition' });
  });
  console.log(`Core billing persisted runtime: ${reports.length} scenarios passed; isolated Firestore emulator, injected fake provider only.`);
} finally {
  hooks = {};
  for (const uid of uids) {
    for (const collection of ['billingCheckoutIntents', 'billingCheckoutAttempts', 'entitlementAuditLogs']) {
      const docs = await db.collection(collection).where('parent_id', '==', uid).get();
      for (const doc of docs.docs) await doc.ref.delete();
    }
    await db.collection('billingAccounts').doc(uid).delete(); await db.collection('accountEntitlements').doc(uid).delete(); await db.collection('parents').doc(uid).delete();
  }
  for (const id of eventIds) await db.collection('billingEventReceipts').doc(billingId(`test:${id}`)).delete();
}
