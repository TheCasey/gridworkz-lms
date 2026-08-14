#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  PointSourceTypes,
  RewardCatalogItemTypes,
  RewardRedemptionStatuses,
} from '../src/constants/schema.js';
import {
  buildDefaultRewardSettings,
  buildStudentSafeRewardState,
  getAwardablePointValueForSource,
  sumPointLedgerEntriesForStudent,
} from '../src/utils/rewardUtils.js';
import {
  applyPointLedgerMutation,
  getPointValueForSource,
  normalizePointSettings,
  SCHOOL_BLOCK_POINT_AWARD_MODE,
} from '../functions/src/pointLedgerUtils.js';

const DEFAULT_SETTINGS = buildDefaultRewardSettings();
assert.deepEqual(DEFAULT_SETTINGS, {
  school_block_points: 0,
  chore_block_points: 0,
  routine_day_points: 0,
  routine_points_enabled: false,
});

const configuredSettings = normalizePointSettings({
  school_block_points: 3,
  chore_block_points: 5,
  routine_day_points: 2,
  routine_points_enabled: true,
});

assert.equal(
  SCHOOL_BLOCK_POINT_AWARD_MODE,
  'deferred_pending_trusted_completion',
  'public submission-trigger school awards should stay disabled until a trusted school completion path exists'
);

let state = {
  pointWallets: [],
  pointLedgerEntries: [],
};

assert.equal(
  getPointValueForSource({
    sourceType: PointSourceTypes.SCHOOL_BLOCK,
    rewardSettings: configuredSettings,
  }),
  3,
  'school block point settings should still normalize and persist even while automatic awards are deferred'
);

const choreAward = applyPointLedgerMutation({
  ...state,
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: PointSourceTypes.CHORE_COMPLETION,
  sourceId: 'chore_completion_1',
  deltaPoints: getPointValueForSource({
    sourceType: PointSourceTypes.CHORE_COMPLETION,
    rewardSettings: configuredSettings,
  }),
  description: 'Chore completion',
});
assert.equal(choreAward.applied, true);
assert.equal(choreAward.wallet.total_points, 5);
assert.equal(choreAward.pointLedgerEntries.length, 1);
state = choreAward;

const duplicateChoreAward = applyPointLedgerMutation({
  ...state,
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: PointSourceTypes.CHORE_COMPLETION,
  sourceId: 'chore_completion_1',
  deltaPoints: getPointValueForSource({
    sourceType: PointSourceTypes.CHORE_COMPLETION,
    rewardSettings: configuredSettings,
  }),
  description: 'Chore completion',
});
assert.equal(duplicateChoreAward.applied, false);
assert.equal(duplicateChoreAward.code, 'already_awarded');
assert.equal(duplicateChoreAward.wallet.total_points, 5);
assert.equal(duplicateChoreAward.pointLedgerEntries.length, 1);
assert.equal(state.wallet.total_points, 5);
assert.equal(state.pointLedgerEntries.length, 1);

assert.equal(
  getAwardablePointValueForSource({
    sourceType: PointSourceTypes.ROUTINE_COMPLETION,
    settings: configuredSettings,
    routineTemplate: { counts_toward_points: false },
  }),
  0,
  'routine awards should stay off when the template is not point-eligible'
);
assert.equal(
  getAwardablePointValueForSource({
    sourceType: PointSourceTypes.ROUTINE_COMPLETION,
    settings: {
      ...configuredSettings,
      routine_points_enabled: false,
    },
    routineTemplate: { counts_toward_points: true },
  }),
  0,
  'routine awards should stay off when household settings disable routine points'
);

const routineAwardValue = getAwardablePointValueForSource({
  sourceType: PointSourceTypes.ROUTINE_COMPLETION,
  settings: configuredSettings,
  routineTemplate: { counts_toward_points: true },
});
assert.equal(routineAwardValue, 2);

const routineAward = applyPointLedgerMutation({
  ...state,
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: PointSourceTypes.ROUTINE_COMPLETION,
  sourceId: 'routine_completion_1',
  deltaPoints: routineAwardValue,
  description: 'Routine completion: Morning Routine',
});
assert.equal(routineAward.applied, true);
assert.equal(routineAward.wallet.total_points, 7);
assert.equal(routineAward.pointLedgerEntries.length, 2);
state = routineAward;

const manualPositiveAdjustment = applyPointLedgerMutation({
  ...state,
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: PointSourceTypes.ADJUSTMENT,
  sourceId: 'manual_adjustment_1',
  deltaPoints: 4,
  description: 'Parent bonus',
});
assert.equal(manualPositiveAdjustment.applied, true);
assert.equal(manualPositiveAdjustment.wallet.total_points, 11);
assert.equal(manualPositiveAdjustment.wallet.lifetime_points, 11);
assert.equal(manualPositiveAdjustment.pointLedgerEntries.length, 3);
state = manualPositiveAdjustment;

const manualNegativeAdjustment = applyPointLedgerMutation({
  ...state,
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: PointSourceTypes.ADJUSTMENT,
  sourceId: 'manual_adjustment_2',
  deltaPoints: -3,
  description: 'Correction',
});
assert.equal(manualNegativeAdjustment.applied, true);
assert.equal(manualNegativeAdjustment.wallet.total_points, 8);
assert.equal(
  manualNegativeAdjustment.wallet.lifetime_points,
  11,
  'negative adjustments should not reduce lifetime earned points'
);
assert.equal(manualNegativeAdjustment.pointLedgerEntries.length, 4);
state = manualNegativeAdjustment;

const siblingAward = applyPointLedgerMutation({
  ...state,
  parentId: 'parent_1',
  studentId: 'student_b',
  sourceType: PointSourceTypes.CHORE_COMPLETION,
  sourceId: 'chore_completion_sibling',
  deltaPoints: 5,
  description: 'Sibling chore completion',
});
assert.equal(siblingAward.applied, true);
state = siblingAward;

assert.equal(
  sumPointLedgerEntriesForStudent({
    studentId: 'student_a',
    pointLedgerEntries: state.pointLedgerEntries,
  }),
  8,
  'wallet total should equal the sum of one student ledger deltas'
);
assert.equal(
  state.pointWallets.find((wallet) => wallet.student_id === 'student_a')?.total_points,
  8
);

const studentSafeRewardState = buildStudentSafeRewardState({
  studentId: 'student_a',
  pointWallets: state.pointWallets,
  rewardCatalogItems: [
    {
      id: 'reward_shared',
      type: RewardCatalogItemTypes.PARENT_CREATED,
      title: 'Movie pick',
      description: 'Pick the family movie.',
      point_cost: 10,
      stock_quantity: 1,
      available_quantity: 1,
      eligible_student_ids: [],
      redemption_requires_approval: true,
      is_active: true,
    },
    {
      id: 'reward_sibling_only',
      type: RewardCatalogItemTypes.PARENT_CREATED,
      title: 'Sibling only',
      description: 'Private sibling reward.',
      point_cost: 5,
      stock_quantity: 1,
      available_quantity: 1,
      eligible_student_ids: ['student_b'],
      redemption_requires_approval: true,
      is_active: true,
    },
  ],
  rewardRedemptions: [
    {
      id: 'redemption_a',
      student_id: 'student_a',
      reward_catalog_item_id: 'reward_shared',
      status: RewardRedemptionStatuses.REQUESTED,
      title_snapshot: 'Movie pick',
      point_cost_snapshot: 10,
      requested_at: '2026-05-27T12:00:00.000Z',
    },
    {
      id: 'redemption_b',
      student_id: 'student_b',
      reward_catalog_item_id: 'reward_sibling_only',
      status: RewardRedemptionStatuses.REQUESTED,
      title_snapshot: 'Sibling only',
      point_cost_snapshot: 5,
      requested_at: '2026-05-27T13:00:00.000Z',
    },
  ],
});

assert.equal(studentSafeRewardState.wallet.student_id, 'student_a');
assert.equal(studentSafeRewardState.wallet.total_points, 8);
assert.deepEqual(
  studentSafeRewardState.catalog.map((reward) => reward.id),
  [
    'reward_shared',
    'builtin_avatar_stargazer',
    'builtin_avatar_trailblazer',
    'builtin_badge_comet',
    'builtin_badge_steward',
    'builtin_theme_sunrise',
    'builtin_theme_twilight',
  ]
);
assert.deepEqual(
  studentSafeRewardState.myRedemptions.map((redemption) => redemption.id),
  ['redemption_a']
);
assert.equal(
  studentSafeRewardState.catalog.some((reward) => reward.id === 'reward_sibling_only'),
  false,
  'student-safe reward state should not expose sibling-only reward data'
);

console.log('check-points-ledger: all assertions passed');
