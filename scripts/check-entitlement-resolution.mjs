#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  buildEntitlementBillingState,
  buildEntitlementWriteForBillingSync,
  resolveEntitlementRecord,
} from '../functions/src/index.js';

const NOW = new Date('2026-05-22T18:00:00.000Z');
const NOW_MS = NOW.getTime();
const FUTURE = new Date('2026-06-22T18:00:00.000Z');
const PAST = new Date('2026-04-22T18:00:00.000Z');

const buildBillingState = (overrides = {}) => buildEntitlementBillingState({
  planId: 'core',
  subscriptionStatus: 'active',
  billingProvider: 'stripe',
  featureOverrides: {},
  trialEndsAt: null,
  currentPeriodEnd: FUTURE,
  updatedAt: NOW,
  ...overrides,
});

const noOverrideSync = buildEntitlementWriteForBillingSync({
  parentId: 'parent_no_override',
  existingEntitlement: {
    parent_id: 'parent_no_override',
    plan_id: 'free',
    subscription_status: null,
    billing_provider: null,
    feature_overrides: {},
    usage_snapshot: {
      students: 1,
      curriculum_items: 2,
    },
  },
  billingState: buildBillingState(),
  nowTimestamp: NOW,
  nowMillis: NOW_MS,
});

assert.equal(noOverrideSync.hasActiveManualOverride, false);
assert.equal(noOverrideSync.entitlementDoc.plan_id, 'core');
assert.equal(noOverrideSync.entitlementDoc.subscription_status, 'active');
assert.equal(noOverrideSync.entitlementDoc.billing_provider, 'stripe');
assert.equal(noOverrideSync.entitlementDoc.billing_state.plan_id, 'core');
assert.equal(noOverrideSync.entitlementDoc.resolution_source, 'billing');
assert.equal(noOverrideSync.entitlementDoc.updated_via, 'billing_webhook');
assert.deepEqual(noOverrideSync.entitlementDoc.usage_snapshot, {
  students: 1,
  curriculum_items: 2,
});

const activeOverrideExisting = {
  parent_id: 'parent_active_override',
  plan_id: 'lockdown',
  subscription_status: 'active',
  billing_provider: 'stripe',
  feature_overrides: {
    can_use_lockdown_extension: true,
    can_use_lockdown_kiosk: true,
  },
  usage_snapshot: {
    students: 3,
    curriculum_items: 9,
  },
  trial_ends_at: null,
  current_period_end: FUTURE,
  billing_state: buildBillingState(),
  manual_override: {
    is_active: true,
    plan_id: 'lockdown',
    subscription_status: 'active',
    feature_overrides: {
      can_use_lockdown_extension: true,
      can_use_lockdown_kiosk: true,
    },
    reason: 'Temporary Lockdown test',
    expires_at: FUTURE,
    applied_by_uid: 'operator_1',
    applied_by_email: 'operator@example.com',
    applied_at: NOW,
  },
};

const activeOverrideSync = buildEntitlementWriteForBillingSync({
  parentId: activeOverrideExisting.parent_id,
  existingEntitlement: activeOverrideExisting,
  billingState: buildBillingState({
    planId: 'free',
    subscriptionStatus: 'canceled',
    currentPeriodEnd: null,
  }),
  nowTimestamp: NOW,
  nowMillis: NOW_MS,
});

assert.equal(activeOverrideSync.hasActiveManualOverride, true);
assert.equal(activeOverrideSync.entitlementDoc.plan_id, 'lockdown');
assert.equal(activeOverrideSync.entitlementDoc.subscription_status, 'active');
assert.deepEqual(activeOverrideSync.entitlementDoc.feature_overrides, {
  can_use_lockdown_extension: true,
  can_use_lockdown_kiosk: true,
});
assert.equal(activeOverrideSync.entitlementDoc.current_period_end, FUTURE);
assert.equal(activeOverrideSync.entitlementDoc.billing_state.plan_id, 'free');
assert.equal(activeOverrideSync.entitlementDoc.billing_state.subscription_status, 'canceled');
assert.equal(activeOverrideSync.entitlementDoc.resolution_source, 'manual_override');

const expiredOverrideSync = buildEntitlementWriteForBillingSync({
  parentId: 'parent_expired_override',
  existingEntitlement: {
    ...activeOverrideExisting,
    parent_id: 'parent_expired_override',
    manual_override: {
      ...activeOverrideExisting.manual_override,
      expires_at: PAST,
    },
  },
  billingState: buildBillingState({
    planId: 'core',
    subscriptionStatus: 'past_due',
  }),
  nowTimestamp: NOW,
  nowMillis: NOW_MS,
});

assert.equal(expiredOverrideSync.hasActiveManualOverride, false);
assert.equal(expiredOverrideSync.hasExpiredManualOverride, true);
assert.equal(expiredOverrideSync.entitlementDoc.plan_id, 'core');
assert.equal(expiredOverrideSync.entitlementDoc.subscription_status, 'past_due');
assert.equal(expiredOverrideSync.entitlementDoc.resolution_source, 'billing');
assert.equal(expiredOverrideSync.entitlementDoc.manual_override.is_active, false);

const clearedOverrideResolved = resolveEntitlementRecord({
  parentId: 'parent_cleared_override',
  entitlementDoc: {
    parent_id: 'parent_cleared_override',
    plan_id: 'lockdown',
    subscription_status: 'active',
    billing_state: buildBillingState({
      planId: 'core',
      subscriptionStatus: 'active',
    }),
    manual_override: {
      ...activeOverrideExisting.manual_override,
      is_active: false,
      expires_at: null,
    },
  },
  nowMillis: NOW_MS,
});

assert.equal(clearedOverrideResolved.hasActiveManualOverride, false);
assert.equal(clearedOverrideResolved.plan_id, 'core');
assert.equal(clearedOverrideResolved.subscription_status, 'active');
assert.equal(clearedOverrideResolved.resolution_source, 'billing');

const featureOverrideResolved = resolveEntitlementRecord({
  parentId: 'parent_feature_override',
  entitlementDoc: {
    parent_id: 'parent_feature_override',
    billing_state: buildBillingState({
      planId: 'core',
      featureOverrides: {
        can_use_lockdown_extension: true,
      },
    }),
  },
  nowMillis: NOW_MS,
});

assert.deepEqual(featureOverrideResolved.features, {
  can_use_projects: true,
  can_use_lockdown_extension: true,
  can_use_lockdown_kiosk: false,
});

console.log('Entitlement resolution checks passed.');
