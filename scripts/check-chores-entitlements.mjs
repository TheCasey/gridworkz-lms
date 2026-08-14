#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  buildEntitlementBillingState,
  buildFeatureSet,
  normalizeEntitlementFeatureOverrides,
  normalizeOperatorEntitlementOverridePayload,
  resolveEntitlementRecord,
} from '../functions/src/index.js';
import {
  DASHBOARD_FEATURE_STATES,
  dashboardFeaturesById,
  getDashboardFeatureByPath,
  resolveDashboardFeatureState,
  resolveDashboardFeatures,
} from '../src/constants/dashboardFeatures.js';
import {
  EntitlementFeatureKeys,
  getEntitlementPlan,
} from '../src/constants/entitlements.js';
import {
  resolveEntitlementFeatures,
  resolveEntitlementState,
} from '../src/utils/entitlementUtils.js';

const NOW_MS = Date.parse('2026-05-25T18:00:00.000Z');

const buildFeatureAccess = (features = {}) => Object.values(EntitlementFeatureKeys).reduce(
  (resolvedAccess, featureKey) => ({
    ...resolvedAccess,
    [featureKey]: {
      isEnabled: Boolean(features[featureKey]),
    },
  }),
  {}
);

const freeFallback = resolveEntitlementState({
  entitlementDoc: null,
  students: [],
  subjects: [],
});

assert.equal(freeFallback.planId, 'free');
assert.equal(freeFallback.features[EntitlementFeatureKeys.DAILY_ROUTINES], true);
assert.equal(freeFallback.features[EntitlementFeatureKeys.CHORES], false);
assert.equal(freeFallback.features[EntitlementFeatureKeys.REWARDS], false);

const freeFallbackDashboardFeatures = resolveDashboardFeatures({
  featureAccess: buildFeatureAccess(freeFallback.features),
});
const lockedChoresFeature = freeFallbackDashboardFeatures.find((feature) => feature.id === 'chores');

assert.ok(lockedChoresFeature, 'chores feature is present in the shared dashboard registry');
assert.equal(lockedChoresFeature.shellState, DASHBOARD_FEATURE_STATES.VISIBLE);
assert.equal(lockedChoresFeature.isLocked, false);

for (const planId of ['free', 'core', 'lockdown']) {
  const plan = getEntitlementPlan(planId);

  assert.equal(
    plan.features[EntitlementFeatureKeys.DAILY_ROUTINES],
    true,
    `${planId} includes daily routine access`
  );
  assert.equal(
    plan.features[EntitlementFeatureKeys.CHORES],
    planId !== 'free',
    `${planId} chore pool packaging follows PM-approved free/paid split`
  );
  assert.equal(
    plan.features[EntitlementFeatureKeys.REWARDS],
    planId !== 'free',
    `${planId} rewards packaging follows PM-approved free/paid split`
  );
}

const frontendFeatureOverride = resolveEntitlementFeatures('free', {
  [EntitlementFeatureKeys.CHORES]: true,
  [EntitlementFeatureKeys.REWARDS]: true,
});

assert.equal(frontendFeatureOverride[EntitlementFeatureKeys.CHORES], true);
assert.equal(frontendFeatureOverride[EntitlementFeatureKeys.REWARDS], true);

const functionsFeatureOverride = buildFeatureSet('free', {
  [EntitlementFeatureKeys.CHORES]: true,
  [EntitlementFeatureKeys.REWARDS]: true,
});

assert.equal(functionsFeatureOverride[EntitlementFeatureKeys.CHORES], true);
assert.equal(functionsFeatureOverride[EntitlementFeatureKeys.REWARDS], true);

const choresRouteFeature = dashboardFeaturesById.chores;

assert.ok(choresRouteFeature, 'chores route is registered in the dashboard shell');
assert.equal(getDashboardFeatureByPath('chores').id, 'chores');
assert.deepEqual(
  choresRouteFeature.entitlementGate.requiredFeatureKeys,
  [
    EntitlementFeatureKeys.DAILY_ROUTINES,
    EntitlementFeatureKeys.CHORES,
    EntitlementFeatureKeys.REWARDS,
  ]
);
assert.equal(
  resolveDashboardFeatureState(choresRouteFeature, {
    featureAccess: buildFeatureAccess({
      [EntitlementFeatureKeys.DAILY_ROUTINES]: false,
      [EntitlementFeatureKeys.CHORES]: false,
      [EntitlementFeatureKeys.REWARDS]: false,
    }),
  }),
  DASHBOARD_FEATURE_STATES.LOCKED
);
assert.equal(
  resolveDashboardFeatureState(choresRouteFeature, {
    featureAccess: buildFeatureAccess({
      [EntitlementFeatureKeys.DAILY_ROUTINES]: true,
      [EntitlementFeatureKeys.CHORES]: false,
      [EntitlementFeatureKeys.REWARDS]: false,
    }),
  }),
  DASHBOARD_FEATURE_STATES.VISIBLE
);
assert.equal(
  resolveDashboardFeatureState(choresRouteFeature, {
    featureAccess: buildFeatureAccess({
      [EntitlementFeatureKeys.DAILY_ROUTINES]: false,
      [EntitlementFeatureKeys.CHORES]: true,
      [EntitlementFeatureKeys.REWARDS]: false,
    }),
  }),
  DASHBOARD_FEATURE_STATES.VISIBLE
);

const normalizedOverrides = normalizeEntitlementFeatureOverrides({
  can_use_projects: true,
  can_use_daily_routines: true,
  can_use_chores: true,
  can_use_rewards: false,
  can_use_lockdown_extension: false,
  unknown_feature: true,
});

assert.deepEqual(normalizedOverrides, {
  can_use_projects: true,
  can_use_daily_routines: true,
  can_use_chores: true,
  can_use_rewards: false,
  can_use_lockdown_extension: false,
});

const operatorOverride = normalizeOperatorEntitlementOverridePayload({
  plan_id: 'free',
  subscription_status: 'active',
  reason: 'Enable future household module placeholder for validation',
  feature_overrides: {
    can_use_daily_routines: true,
    can_use_chores: true,
    can_use_rewards: true,
  },
}, { nowMillis: NOW_MS });

assert.deepEqual(operatorOverride.feature_overrides, {
  can_use_daily_routines: true,
  can_use_chores: true,
  can_use_rewards: true,
});

const billingState = buildEntitlementBillingState({
  planId: 'free',
  subscriptionStatus: 'active',
  billingProvider: 'stripe',
  featureOverrides: {
    can_use_daily_routines: false,
    can_use_chores: true,
    can_use_rewards: false,
    ignored_flag: true,
  },
});

assert.deepEqual(billingState.feature_overrides, {
  can_use_daily_routines: false,
  can_use_chores: true,
  can_use_rewards: false,
});

const resolvedFunctionsEntitlement = resolveEntitlementRecord({
  parentId: 'parent_chores_override',
  entitlementDoc: {
    parent_id: 'parent_chores_override',
    billing_state: billingState,
  },
  nowMillis: NOW_MS,
});

assert.equal(resolvedFunctionsEntitlement.features.can_use_chores, true);
assert.equal(resolvedFunctionsEntitlement.features.can_use_rewards, false);
assert.equal(resolvedFunctionsEntitlement.features.can_use_daily_routines, false);
assert.equal(resolvedFunctionsEntitlement.features.can_use_projects, false);

console.log('Chores entitlement checks passed.');
