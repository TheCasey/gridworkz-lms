#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildEntitlementWriteForManualOverride,
  buildEntitlementWriteForOverrideClear,
  buildFallbackEntitlementInitializationWrite,
  buildOperatorDowngradeWarnings,
  ensureOperatorSessionRecord,
  normalizeOperatorEntitlementOverridePayload,
} from '../functions/src/index.js';

const NOW = new Date('2026-05-22T18:00:00.000Z');
const NOW_MS = NOW.getTime();
const FUTURE_ISO = '2026-06-22T18:00:00.000Z';

const assertHttpsError = (fn, code, label) => {
  assert.throws(
    fn,
    (error) => error?.code === code,
    label
  );
};

assertHttpsError(
  () => normalizeOperatorEntitlementOverridePayload({
    plan_id: 'core',
    subscription_status: 'active',
    reason: ' ',
  }, { nowMillis: NOW_MS }),
  'invalid-argument',
  'missing support reason rejects override mutation'
);

assertHttpsError(
  () => normalizeOperatorEntitlementOverridePayload({
    plan_id: 'enterprise',
    subscription_status: 'active',
    reason: 'Plan test',
  }, { nowMillis: NOW_MS }),
  'invalid-argument',
  'invalid plan rejects override mutation'
);

assertHttpsError(
  () => normalizeOperatorEntitlementOverridePayload({
    plan_id: 'core',
    subscription_status: 'paused',
    reason: 'Status test',
  }, { nowMillis: NOW_MS }),
  'invalid-argument',
  'invalid subscription status rejects override mutation'
);

assertHttpsError(
  () => normalizeOperatorEntitlementOverridePayload({
    plan_id: 'core',
    reason: 'Feature test',
    feature_overrides: {
      can_use_projects: 'yes',
    },
  }, { nowMillis: NOW_MS }),
  'invalid-argument',
  'non-boolean feature override rejects override mutation'
);

assertHttpsError(
  () => normalizeOperatorEntitlementOverridePayload({
    plan_id: 'core',
    reason: 'Feature test',
    feature_overrides: {
      can_edit_billing: true,
    },
  }, { nowMillis: NOW_MS }),
  'invalid-argument',
  'unknown feature override rejects override mutation'
);

assertHttpsError(
  () => normalizeOperatorEntitlementOverridePayload({
    plan_id: 'core',
    reason: 'Expired test',
    expires_at: '2026-04-22T18:00:00.000Z',
  }, { nowMillis: NOW_MS }),
  'invalid-argument',
  'past expiration rejects override mutation'
);

const normalizedOverride = normalizeOperatorEntitlementOverridePayload({
  plan_id: ' lockdown ',
  subscription_status: 'active',
  feature_overrides: {
    can_use_lockdown_extension: true,
    can_use_lockdown_kiosk: true,
  },
  reason: ' Temporary Lockdown support test ',
  expires_at: FUTURE_ISO,
}, { nowMillis: NOW_MS });

assert.equal(normalizedOverride.plan_id, 'lockdown');
assert.equal(normalizedOverride.subscription_status, 'active');
assert.deepEqual(normalizedOverride.feature_overrides, {
  can_use_lockdown_extension: true,
  can_use_lockdown_kiosk: true,
});
assert.equal(normalizedOverride.reason, 'Temporary Lockdown support test');
assert.equal(normalizedOverride.expires_at.toMillis(), Date.parse(FUTURE_ISO));

const freeWarnings = buildOperatorDowngradeWarnings({
  planId: 'free',
  usageSummary: {
    students: 3,
    curriculum_items: 4,
  },
  lockdownSummary: {
    has_saved_setup: false,
  },
});
assert.deepEqual(
  freeWarnings.map((warning) => warning.code).sort(),
  ['free_curriculum_limit_exceeded', 'free_student_limit_exceeded']
);

const lockdownRemovalWarnings = buildOperatorDowngradeWarnings({
  planId: 'core',
  usageSummary: {
    students: 1,
    curriculum_items: 1,
  },
  lockdownSummary: {
    has_saved_setup: true,
    configured_students: 1,
  },
});
assert.deepEqual(
  lockdownRemovalWarnings.map((warning) => warning.code),
  ['lockdown_setup_would_be_disabled']
);

const operatorSession = ensureOperatorSessionRecord({
  uid: 'operator_1',
  operatorRecord: {
    uid: 'operator_1',
    email: 'operator@example.com',
    role: 'support',
    is_active: true,
  },
});
assert.equal(operatorSession.uid, 'operator_1');

assertHttpsError(
  () => ensureOperatorSessionRecord({ uid: 'operator_1', operatorRecord: null }),
  'permission-denied',
  'missing operator record receives permission-denied'
);
assertHttpsError(
  () => ensureOperatorSessionRecord({
    uid: 'operator_1',
    operatorRecord: {
      uid: 'operator_1',
      email: 'operator@example.com',
      role: 'support',
      is_active: false,
    },
  }),
  'permission-denied',
  'inactive operator receives permission-denied'
);

const existingEntitlement = {
  parent_id: 'parent_1',
  plan_id: 'core',
  subscription_status: 'active',
  billing_provider: 'stripe',
  feature_overrides: {},
  usage_snapshot: {
    students: 1,
    curriculum_items: 1,
  },
  billing_state: {
    plan_id: 'core',
    subscription_status: 'active',
    billing_provider: 'stripe',
    feature_overrides: {},
    trial_ends_at: null,
    current_period_end: null,
    updated_at: NOW,
  },
};
const manualWrite = buildEntitlementWriteForManualOverride({
  parentId: 'parent_1',
  existingEntitlement,
  overridePayload: normalizedOverride,
  operatorSession,
  usageSnapshot: {
    students: 3,
    curriculum_items: 4,
  },
  nowTimestamp: NOW,
});

assert.equal(manualWrite.plan_id, 'lockdown');
assert.equal(manualWrite.resolution_source, 'manual_override');
assert.equal(manualWrite.billing_state.plan_id, 'core');
assert.deepEqual(manualWrite.usage_snapshot, {
  students: 3,
  curriculum_items: 4,
});
assert.equal(manualWrite.manual_override.applied_by_uid, 'operator_1');

const clearWrite = buildEntitlementWriteForOverrideClear({
  parentId: 'parent_1',
  existingEntitlement: {
    ...existingEntitlement,
    ...manualWrite,
  },
  usageSnapshot: {
    students: 2,
    curriculum_items: 3,
  },
  nowTimestamp: NOW,
});

assert.equal(clearWrite.plan_id, 'core');
assert.equal(clearWrite.resolution_source, 'billing');
assert.equal(clearWrite.updated_via, 'operator_clear_override');
assert.equal(clearWrite.manual_override.is_active, false);
assert.deepEqual(clearWrite.usage_snapshot, {
  students: 2,
  curriculum_items: 3,
});

const initializedWrite = buildFallbackEntitlementInitializationWrite({
  parentId: 'parent_missing',
  usageSnapshot: {
    students: 0,
    curriculum_items: 0,
  },
  nowTimestamp: NOW,
});

assert.equal(initializedWrite.plan_id, 'free');
assert.equal(initializedWrite.subscription_status, null);
assert.equal(initializedWrite.billing_provider, null);
assert.equal(initializedWrite.resolution_source, 'fallback_initialized');

const functionsSource = readFileSync(new URL('../functions/src/index.js', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../src/constants/schema.js', import.meta.url), 'utf8');
const trustedOperationsSource = readFileSync(
  new URL('../src/firebase/trustedOperations.js', import.meta.url),
  'utf8'
);
const operatorCallableNames = [
  'searchParentAccounts',
  'getOperatorEntitlementRecord',
  'initializeEntitlementRecord',
  'applyEntitlementOverride',
  'clearEntitlementOverride',
];

for (const callableName of operatorCallableNames) {
  const start = functionsSource.indexOf(`export const ${callableName} = onCall`);
  const next = functionsSource.indexOf('\nexport const ', start + 1);
  const callableSource = functionsSource.slice(
    start,
    next === -1 ? functionsSource.length : next
  );

  assert.notEqual(start, -1, `${callableName} is exported as a callable`);
  assert.ok(
    callableSource.includes('ensureActiveOperator(request)'),
    `${callableName} reuses active-operator authorization`
  );
}

for (const mutationName of [
  'initializeEntitlementRecord',
  'applyEntitlementOverride',
  'clearEntitlementOverride',
]) {
  const start = functionsSource.indexOf(`export const ${mutationName} = onCall`);
  const next = functionsSource.indexOf('\nexport const ', start + 1);
  const callableSource = functionsSource.slice(
    start,
    next === -1 ? functionsSource.length : next
  );

  assert.ok(
    callableSource.includes('queueEntitlementAuditWrite'),
    `${mutationName} records an entitlement audit log`
  );
}

for (const functionName of [
  'SEARCH_PARENT_ACCOUNTS',
  'GET_OPERATOR_ENTITLEMENT_RECORD',
  'INITIALIZE_ENTITLEMENT_RECORD',
  'APPLY_ENTITLEMENT_OVERRIDE',
  'CLEAR_ENTITLEMENT_OVERRIDE',
]) {
  assert.ok(
    schemaSource.includes(functionName),
    `${functionName} is exported in TrustedFunctionNames`
  );
}

for (const wrapperName of [
  'searchTrustedParentAccounts',
  'getTrustedOperatorEntitlementRecord',
  'initializeTrustedEntitlementRecord',
  'applyTrustedEntitlementOverride',
  'clearTrustedEntitlementOverride',
]) {
  assert.ok(
    trustedOperationsSource.includes(`export const ${wrapperName}`),
    `${wrapperName} client wrapper is exported`
  );
}

console.log('Operator entitlement function checks passed.');
