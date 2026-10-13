import assert from 'node:assert/strict';
import {
  buildFeatureSet, buildRoutineFirstEntitlementPatch, resolveEntitlementRecord,
  buildEntitlementWriteForBillingSync, buildEntitlementBillingState,
} from '../functions/src/index.js';
import { EntitlementFeatureKeys, getEntitlementPlan } from '../src/constants/entitlements.js';
import { resolveEntitlementState } from '../src/utils/entitlementUtils.js';

for (const planId of ['free', 'core', 'lockdown', 'pro']) {
  const clientPlan = getEntitlementPlan(planId);
  const doc = { parent_id: 'parity-parent', plan_id: planId, product_direction_version: 1 };
  const server = resolveEntitlementRecord({ parentId: doc.parent_id, entitlementDoc: doc });
  const client = resolveEntitlementState({ entitlementDoc: doc });
  assert.equal(server.plan_id, client.planId);
  assert.deepEqual(server.features, buildFeatureSet(client.planId));
  assert.equal(clientPlan.limits.students, planId === 'free' ? 2 : null);
  assert.equal(server.limits.maxStudents, clientPlan.limits.students);
  assert.equal(server.limits.maxActiveSubjects, clientPlan.limits.curriculum_items);
  assert.equal(client.features[EntitlementFeatureKeys.ROUTINE_REWARDS], true);
  assert.equal(client.features[EntitlementFeatureKeys.CHORES], false);
  assert.equal(client.features[EntitlementFeatureKeys.REWARDS], false);
  assert.equal(resolveEntitlementState({ entitlementDoc: { ...doc, product_direction_version: 0 } }).features[EntitlementFeatureKeys.ROUTINE_REWARDS], false);
}
for (const key of [EntitlementFeatureKeys.ROUTINE_REWARDS, EntitlementFeatureKeys.DAILY_ROUTINES]) {
  assert.equal(resolveEntitlementState({ entitlementDoc: {
    plan_id: 'free', product_direction_version: 1, feature_overrides: { [key]: false },
  } }).features[EntitlementFeatureKeys.ROUTINE_REWARDS], false);
}
const nowMillis = Date.parse('2026-10-13T15:00:00Z');
const doc = {
  parent_id: 'migration-parent', plan_id: 'lockdown', product_direction_version: 1,
  billing_state: buildEntitlementBillingState({ planId: 'core', subscriptionStatus: 'active', billingProvider: 'stripe' }),
  manual_override: { is_active: true, plan_id: 'lockdown', expires_at: new Date(nowMillis + 60000), feature_overrides: {} },
  usage_snapshot: { students: 11, curriculum_items: 6 },
  stripe_customer_id: 'preserved-customer',
};
const original = structuredClone(doc);
const patch = buildRoutineFirstEntitlementPatch({ parentId: doc.parent_id, entitlementDoc: doc, activate: true, nowMillis });
assert.equal(patch.plan_id, 'lockdown');
assert.equal(patch.product_direction_version, 1);
assert.equal(patch.limits.maxStudents, null);
for (const key of ['billing_state', 'manual_override', 'usage_snapshot', 'stripe_customer_id']) assert.ok(!Object.hasOwn(patch, key));
assert.deepEqual(doc, original);
const merged = { ...doc, ...patch };
assert.deepEqual(buildRoutineFirstEntitlementPatch({ parentId: doc.parent_id, entitlementDoc: merged, activate: true, nowMillis: nowMillis + 3000 }), patch);
const billingWrite = buildEntitlementWriteForBillingSync({ parentId: doc.parent_id, existingEntitlement: merged,
  billingState: buildEntitlementBillingState({ planId: 'free', subscriptionStatus: 'canceled' }), nowMillis, nowTimestamp: new Date(nowMillis),
});
assert.equal(billingWrite.entitlementDoc.product_direction_version, 1);
assert.deepEqual({ ...merged, ...billingWrite.entitlementDoc }.manual_override, doc.manual_override);

const legacyOverride = { parent_id: 'legacy-override-parent', plan_id: 'free',
  manual_override: { is_active: true, plan_id: 'core', expires_at: new Date(nowMillis + 1000) } };
const legacyPatch = buildRoutineFirstEntitlementPatch({ parentId: legacyOverride.parent_id, entitlementDoc: legacyOverride, activate: true, nowMillis });
assert.equal(resolveEntitlementRecord({ parentId: legacyOverride.parent_id, entitlementDoc: { ...legacyOverride, ...legacyPatch }, nowMillis: nowMillis + 2000 }).plan_id, 'free', 'Expired legacy override cannot become the fallback billing plan');

console.log('Routine entitlement parity and migration contract checks passed.');
