#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ChoreCompletionStatuses,
  ChoreFrequencyPools,
  PointSourceTypes,
  RewardCatalogItemTypes,
  RewardRedemptionStatuses,
} from '../src/constants/schema.js';
import { EntitlementFeatureKeys } from '../src/constants/entitlements.js';
import {
  buildStudentChoreWorkspaceModel,
  buildStudentSafeChoreView,
  getNextEligibleTime,
} from '../src/utils/choreUtils.js';
import { buildAllowanceLedgerEntry } from '../src/utils/allowanceUtils.js';
import { buildStudentRewardStoreModel } from '../src/utils/rewardUtils.js';
import {
  resolveEntitlementFeatures,
  resolveEntitlementState,
} from '../src/utils/entitlementUtils.js';
import {
  DASHBOARD_FEATURE_STATES,
  dashboardFeaturesById,
  resolveDashboardFeatureState,
} from '../src/constants/dashboardFeatures.js';
import { applyPointLedgerMutation } from '../functions/src/pointLedgerUtils.js';
import {
  buildRewardRequestDecision,
  buildRewardStatusTransition,
} from '../functions/src/rewardRedemptionUtils.js';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const getCallableBlock = (source, functionName) => {
  const start = source.indexOf(`export const ${functionName} = onCall`);
  assert.notEqual(start, -1, `${functionName} should be implemented as a trusted callable`);

  const end = source.indexOf('\nexport const ', start + 1);
  return source.slice(start, end === -1 ? source.length : end);
};

const assertCallableRequiresAccess = (source, functionName, accessKey) => {
  const block = getCallableBlock(source, functionName);
  assert.ok(
    block.includes('assertHouseholdModuleAccess') && block.includes(`'${accessKey}'`),
    `${functionName} should require ${accessKey}`
  );
};

const featureAccess = (features = {}) => Object.fromEntries(
  Object.values(EntitlementFeatureKeys).map((featureKey) => [
    featureKey,
    { isEnabled: Boolean(features[featureKey]) },
  ])
);

const students = [
  { id: 'student_a', name: 'Ada' },
  { id: 'student_b', name: 'Ben' },
];
const now = new Date('2026-05-25T10:00:00.000-05:00');
const weekConfig = {
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: 'America/Chicago',
};
const routineTemplates = [{
  id: 'routine_morning',
  title: 'Morning Routine',
  student_ids: [],
  checklist_items: [
    { id: 'teeth', label: 'Brush teeth' },
    { id: 'bed', label: 'Make bed' },
  ],
  counts_toward_allowance: true,
  counts_toward_points: true,
  is_active: true,
}];
const routineCompletions = [{
  id: 'routine_morning_student_a_2026-05-25',
  student_id: 'student_a',
  routine_template_id: 'routine_morning',
  date_key: '2026-05-25',
  completed_item_ids: ['teeth', 'bed'],
  completed_at: new Date('2026-05-25T08:00:00.000-05:00'),
}];
const choreDefinitions = [
  {
    id: 'weekly_shared',
    title: 'Wipe counters',
    frequency_pool: ChoreFrequencyPools.WEEKLY,
    all_students_eligible: true,
    eligible_student_ids: [],
    minimum_cooldown_days: 0,
    is_active: true,
  },
  {
    id: 'weekly_sibling_claimed',
    title: 'Sweep porch',
    frequency_pool: ChoreFrequencyPools.WEEKLY,
    all_students_eligible: true,
    eligible_student_ids: [],
    minimum_cooldown_days: 0,
    is_active: true,
  },
  {
    id: 'monthly_cooldown',
    title: 'Clean pantry shelf',
    frequency_pool: ChoreFrequencyPools.MONTHLY,
    all_students_eligible: true,
    eligible_student_ids: [],
    minimum_cooldown_days: 15,
    is_active: true,
  },
  {
    id: 'monthly_available',
    title: 'Dust baseboards',
    frequency_pool: ChoreFrequencyPools.MONTHLY,
    all_students_eligible: false,
    eligible_student_ids: ['student_a'],
    minimum_cooldown_days: 0,
    is_active: true,
  },
];
const choreClaims = [{
  id: 'claim_b',
  chore_definition_id: 'weekly_sibling_claimed',
  student_id: 'student_b',
  status: 'claimed',
  claimed_at: new Date('2026-05-25T09:00:00.000-05:00'),
  expires_at: new Date('2026-05-26T09:00:00.000-05:00'),
}];
const choreCompletions = [
  {
    id: 'completion_weekly_a',
    chore_definition_id: 'weekly_shared',
    student_id: 'student_a',
    status: ChoreCompletionStatuses.APPROVED,
    completed_at: new Date('2026-05-25T08:30:00.000-05:00'),
    quota_blocks: 1,
  },
  {
    id: 'completion_monthly_b',
    chore_definition_id: 'monthly_cooldown',
    student_id: 'student_b',
    status: ChoreCompletionStatuses.APPROVED,
    completed_at: new Date('2026-05-24T08:30:00.000-05:00'),
    quota_blocks: 1,
  },
];
const rewardCatalogItems = [{
  id: 'reward_movie',
  type: RewardCatalogItemTypes.PARENT_CREATED,
  title: 'Movie night pick',
  point_cost: 40,
  stock_quantity: 1,
  available_quantity: 1,
  eligible_student_ids: ['student_a'],
  redemption_requires_approval: true,
  is_active: true,
}];

const freeFeatures = resolveEntitlementState({ entitlementDoc: null }).features;
assert.equal(freeFeatures[EntitlementFeatureKeys.DAILY_ROUTINES], true);
assert.equal(freeFeatures[EntitlementFeatureKeys.CHORES], false);
assert.equal(freeFeatures[EntitlementFeatureKeys.REWARDS], false);
assert.equal(
  resolveDashboardFeatureState(dashboardFeaturesById.chores, { featureAccess: featureAccess(freeFeatures) }),
  DASHBOARD_FEATURE_STATES.VISIBLE,
  'free accounts should see the chores route for daily routines'
);

for (const planId of ['core', 'lockdown']) {
  const planFeatures = resolveEntitlementFeatures(planId);
  assert.equal(planFeatures[EntitlementFeatureKeys.DAILY_ROUTINES], true);
  assert.equal(planFeatures[EntitlementFeatureKeys.CHORES], true);
  assert.equal(planFeatures[EntitlementFeatureKeys.REWARDS], true);
}

const freeStudentView = buildStudentSafeChoreView({
  studentId: 'student_a',
  routineTemplates,
  routineCompletions,
  choreDefinitions: [],
  choreClaims: [],
  choreCompletions: [],
  pointWallets: [],
  rewardCatalogItems: [],
  rewardRedemptions: [],
  now,
  weekConfig,
});
const freeWorkspace = buildStudentChoreWorkspaceModel({
  choreState: freeStudentView,
  enabled: true,
  hasStudentContext: true,
  now,
  weekConfig,
});
const freeRewardStore = buildStudentRewardStoreModel({
  rewardState: { wallet: null, catalog: [], myRedemptions: [] },
  enabled: false,
  hasStudentContext: true,
});

assert.equal(freeWorkspace.routines.length, 1, 'free student view keeps daily routine behavior');
assert.equal(freeWorkspace.availableChores.length, 0, 'free student view excludes chore pools');
assert.equal(freeRewardStore.canShowArea, false, 'free student view excludes reward store behavior');

const paidStudentView = buildStudentSafeChoreView({
  studentId: 'student_a',
  routineTemplates,
  routineCompletions,
  choreDefinitions,
  choreClaims,
  choreCompletions,
  pointWallets: [
    { id: 'student_a', student_id: 'student_a', total_points: 100, lifetime_points: 100 },
    { id: 'student_b', student_id: 'student_b', total_points: 900, lifetime_points: 900 },
  ],
  rewardCatalogItems,
  rewardRedemptions: [{
    id: 'redemption_b',
    student_id: 'student_b',
    status: RewardRedemptionStatuses.REQUESTED,
    title_snapshot: 'Sibling reward',
    point_cost_snapshot: 50,
  }],
  now,
  weekConfig,
});

assert.deepEqual(
  paidStudentView.chores.available.map((chore) => chore.id).sort(),
  ['monthly_available'],
  'student-safe paid view should only include available, eligible, non-cooling-down chores'
);
assert.equal(
  paidStudentView.chores.claimed.some((chore) => chore.id === 'weekly_sibling_claimed'),
  false,
  'student-safe paid view should not expose sibling active claims as own work'
);
assert.equal(paidStudentView.rewards.wallet.student_id, 'student_a');
assert.deepEqual(paidStudentView.rewards.myRedemptions, [], 'student reward state excludes sibling redemptions');

const monthlyNextEligible = getNextEligibleTime({
  frequencyPool: ChoreFrequencyPools.MONTHLY,
  completedAt: new Date('2026-05-29T09:00:00.000-05:00'),
  minimumCooldownDays: 15,
  weekConfig,
});
assert.equal(monthlyNextEligible.toISOString(), '2026-06-13T14:00:00.000Z');

const allowanceEntry = buildAllowanceLedgerEntry({
  studentId: 'student_a',
  quota: {
    required_routine_days: 1,
    required_weekly_chore_blocks: 1,
    required_monthly_chore_blocks: 0,
  },
  allowancePolicy: {
    period_type: 'weekly',
    allowance_amount: 10,
    completion_policy: 'all_or_nothing',
    include_routines: true,
  },
  weekConfig,
  routineTemplates,
  routineCompletions,
  choreDefinitions,
  choreCompletions,
  referenceDate: now,
});

assert.equal(allowanceEntry.completed_counts.total_blocks, 2);
assert.equal(allowanceEntry.calculated_earned_amount, 10);
assert.equal(allowanceEntry.remaining_amount, 10);

let pointState = applyPointLedgerMutation({
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: PointSourceTypes.CHORE_COMPLETION,
  sourceId: 'completion_weekly_a',
  deltaPoints: 5,
  description: 'Chore completion',
  pointWallets: [],
  pointLedgerEntries: [],
});
assert.equal(pointState.wallet.total_points, 5);
pointState = applyPointLedgerMutation({
  ...pointState,
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: PointSourceTypes.ROUTINE_COMPLETION,
  sourceId: 'routine_morning_student_a_2026-05-25',
  deltaPoints: 2,
  description: 'Routine completion',
});
assert.equal(pointState.wallet.total_points, 7);

const negativeSpend = applyPointLedgerMutation({
  ...pointState,
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: PointSourceTypes.ADJUSTMENT,
  sourceId: 'adjustment_negative',
  deltaPoints: -20,
});
assert.equal(negativeSpend.applied, false, 'point wallets cannot go below zero');
assert.equal(negativeSpend.code, 'insufficient_points');

const downgradeFeatures = resolveEntitlementFeatures('free');
assert.equal(downgradeFeatures[EntitlementFeatureKeys.DAILY_ROUTINES], true);
assert.equal(downgradeFeatures[EntitlementFeatureKeys.CHORES], false);
assert.equal(downgradeFeatures[EntitlementFeatureKeys.REWARDS], false);
assert.equal(
  buildStudentSafeChoreView({
    studentId: 'student_a',
    routineTemplates,
    routineCompletions,
    choreDefinitions: [],
    choreClaims: [],
    choreCompletions: [],
    pointWallets: [],
    rewardCatalogItems: [],
    rewardRedemptions: [],
    now,
    weekConfig,
  }).routines.length,
  1,
  'downgrade preserves routine history while paid creates are locked by entitlement checks'
);

const functionsSource = await readSource('functions/src/index.js');
[
  'upsertRoutineTemplate',
  'completeRoutine',
  'readStudentChoreState',
].forEach((functionName) => {
  assertCallableRequiresAccess(functionsSource, functionName, 'canUseDailyRoutines');
});

[
  'upsertChoreSettings',
  'upsertChoreDefinition',
  'syncAllowanceLedger',
  'claimChore',
  'completeChore',
  'reviewChoreCompletion',
].forEach((functionName) => {
  assertCallableRequiresAccess(functionsSource, functionName, 'canUseChores');
});

[
  'upsertRewardSettings',
  'adjustStudentPoints',
  'upsertRewardCatalogItem',
  'requestRewardRedemption',
  'cancelRewardRedemption',
  'reviewRewardRedemption',
].forEach((functionName) => {
  assertCallableRequiresAccess(functionsSource, functionName, 'canUseRewards');
});

const routineTemplateBlock = getCallableBlock(functionsSource, 'upsertRoutineTemplate');
assert.ok(
  routineTemplateBlock.includes('counts_toward_allowance: access.canUseChores') &&
  routineTemplateBlock.includes('counts_toward_points: access.canUseRewards'),
  'free routine writes should scrub paid allowance and point eligibility flags'
);

const rewardDecision = buildRewardRequestDecision({
  rewardCatalogItems,
  rewardRedemptions: [],
  studentId: 'student_a',
  rewardCatalogItemId: 'reward_movie',
  walletPoints: 100,
});
assert.equal(rewardDecision.ok, true);
assert.equal(rewardDecision.status, RewardRedemptionStatuses.REQUESTED);
assert.equal(rewardDecision.ledger_source_type, PointSourceTypes.REWARD_REDEMPTION_RESERVATION);

const reserved = applyPointLedgerMutation({
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: rewardDecision.ledger_source_type,
  sourceId: 'redemption_a',
  deltaPoints: -40,
  pointWallets: [{ student_id: 'student_a', total_points: 100, lifetime_points: 100 }],
  pointLedgerEntries: [],
});
assert.equal(reserved.wallet.total_points, 60, 'parent-created reward requests reserve points immediately');

const rejectTransition = buildRewardStatusTransition({
  redemption: {
    id: 'redemption_a',
    status: RewardRedemptionStatuses.REQUESTED,
    point_cost_snapshot: 40,
  },
  action: 'reject',
});
assert.equal(rejectTransition.refund_points, true);
const refunded = applyPointLedgerMutation({
  ...reserved,
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: PointSourceTypes.REWARD_REDEMPTION_REFUND,
  sourceId: 'redemption_a',
  deltaPoints: 40,
});
assert.equal(refunded.wallet.total_points, 100, 'rejected reward requests refund reserved points');

console.log('check-chores-rewards-e2e: all assertions passed');
