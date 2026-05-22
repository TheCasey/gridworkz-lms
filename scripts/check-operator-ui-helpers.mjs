#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  EntitlementFeatureKeys,
  PlanIds,
  SubscriptionStatuses,
} from '../src/constants/entitlements.js';
import {
  OPS_STATE_LABELS,
  buildOverrideDiffPreview,
  buildOverrideRiskWarnings,
  validateSupportReason,
} from '../src/components/ops/operatorEntitlementUi.js';

const distinctLabels = Object.values(OPS_STATE_LABELS);

assert.deepEqual(distinctLabels, [
  'Effective State',
  'Billing State',
  'Manual Override',
]);
assert.equal(new Set(distinctLabels).size, 3, 'state labels stay distinct');

assert.deepEqual(validateSupportReason('   '), {
  isValid: false,
  normalizedReason: '',
  message: 'A non-empty support reason is required.',
});
assert.deepEqual(validateSupportReason('  Temporary support test  '), {
  isValid: true,
  normalizedReason: 'Temporary support test',
  message: '',
});

const diffRows = buildOverrideDiffPreview({
  currentState: {
    plan_id: PlanIds.FREE,
    subscription_status: null,
    features: {
      [EntitlementFeatureKeys.PROJECTS]: false,
      [EntitlementFeatureKeys.LOCKDOWN_EXTENSION]: false,
      [EntitlementFeatureKeys.LOCKDOWN_KIOSK]: false,
    },
  },
  currentManualOverride: {
    is_active: false,
  },
  draftOverride: {
    plan_id: PlanIds.LOCKDOWN,
    subscription_status: SubscriptionStatuses.ACTIVE,
    feature_overrides: {
      [EntitlementFeatureKeys.PROJECTS]: true,
      [EntitlementFeatureKeys.LOCKDOWN_EXTENSION]: true,
      [EntitlementFeatureKeys.LOCKDOWN_KIOSK]: true,
    },
    expires_at: '2026-06-22T18:00:00.000Z',
  },
});

const diffByKey = Object.fromEntries(diffRows.map((row) => [row.key, row]));

assert.equal(diffByKey.plan.changed, true, 'plan change is identified');
assert.equal(diffByKey.plan.beforeLabel, 'Free');
assert.equal(diffByKey.plan.afterLabel, 'Lockdown');
assert.equal(diffByKey.status.changed, true, 'status change is identified');
assert.equal(diffByKey.status.beforeLabel, 'No Billing State');
assert.equal(diffByKey.status.afterLabel, 'Active');
assert.equal(diffByKey.features.changed, true, 'feature changes are identified');
assert.equal(diffByKey.features.changes.length, 3);
assert.equal(diffByKey.expiration.changed, true, 'expiration change is identified');

const riskWarnings = buildOverrideRiskWarnings({
  draftOverride: {
    plan_id: PlanIds.FREE,
    feature_overrides: {
      [EntitlementFeatureKeys.PROJECTS]: false,
      [EntitlementFeatureKeys.LOCKDOWN_EXTENSION]: false,
      [EntitlementFeatureKeys.LOCKDOWN_KIOSK]: false,
    },
  },
  usageSummary: {
    students: 3,
    curriculum_items: 4,
  },
  lockdownSummary: {
    has_saved_setup: true,
  },
});

assert.deepEqual(
  riskWarnings.map((warning) => warning.code).sort(),
  [
    'curriculum_limit_exceeded',
    'lockdown_setup_would_be_disabled',
    'student_limit_exceeded',
  ]
);

console.log('Operator UI helper checks passed.');
