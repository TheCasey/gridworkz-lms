#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  ChoreFrequencyPools,
  PointSourceTypes,
  RewardCatalogItemTypes,
  RewardRedemptionStatuses,
} from '../src/constants/schema.js';
import {
  buildStudentSafeChoreView,
  countAvailableChoreBlocksForStudent,
  getClaimExpiresAt,
  getNextEligibleTime,
  getRoutineDateKey,
  isClaimExpired,
} from '../src/utils/choreUtils.js';
import {
  buildDefaultRewardSettings,
  getPointValueForSource,
} from '../src/utils/rewardUtils.js';

const WEEK_CONFIG = {
  week_reset_day: 0,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: 'America/Chicago',
};

const toIsoString = (value) => value?.toISOString?.() || null;

const weeklyCompletion = new Date('2026-05-30T18:00:00-05:00');
const weeklyNextEligible = getNextEligibleTime({
  frequencyPool: ChoreFrequencyPools.WEEKLY,
  completedAt: weeklyCompletion,
  minimumCooldownDays: 2,
  weekConfig: WEEK_CONFIG,
});

assert.equal(
  toIsoString(weeklyNextEligible),
  '2026-06-01T23:00:00.000Z',
  'weekly cooldown keeps the chore unavailable until the cooldown ends after the Sunday reset'
);

const monthlyLateCompletion = new Date('2026-05-29T09:00:00-05:00');
const monthlyLateNextEligible = getNextEligibleTime({
  frequencyPool: ChoreFrequencyPools.MONTHLY,
  completedAt: monthlyLateCompletion,
  minimumCooldownDays: 15,
  weekConfig: WEEK_CONFIG,
});

assert.equal(
  toIsoString(monthlyLateNextEligible),
  '2026-06-13T14:00:00.000Z',
  'late-month completion should wait for the cooldown even after the month boundary passes'
);

const monthlyEarlyCompletion = new Date('2026-05-02T09:00:00-05:00');
const monthlyEarlyNextEligible = getNextEligibleTime({
  frequencyPool: ChoreFrequencyPools.MONTHLY,
  completedAt: monthlyEarlyCompletion,
  minimumCooldownDays: 15,
  weekConfig: WEEK_CONFIG,
});

assert.equal(
  toIsoString(monthlyEarlyNextEligible),
  '2026-06-01T05:00:00.000Z',
  'early-month completion should wait for the next month boundary when cooldown ends first'
);

assert.equal(
  getRoutineDateKey(new Date('2026-05-25T03:30:00.000Z'), 'America/Chicago'),
  '2026-05-24',
  'routine date keys should use the configured local date instead of UTC'
);

const claimCreatedAt = new Date('2026-05-25T08:00:00.000-05:00');
const claimExpiresAt = getClaimExpiresAt({
  claimedAt: claimCreatedAt,
  claimExpirationHours: 12,
});

assert.equal(toIsoString(claimExpiresAt), '2026-05-26T01:00:00.000Z');
assert.equal(
  isClaimExpired({
    claimedAt: claimCreatedAt,
    claimExpirationHours: 12,
    now: new Date('2026-05-25T19:59:59.000-05:00'),
  }),
  false,
  'claim should still be active before the expiration time'
);
assert.equal(
  isClaimExpired({
    claimedAt: claimCreatedAt,
    claimExpirationHours: 12,
    now: new Date('2026-05-25T20:00:00.000-05:00'),
  }),
  true,
  'claim should expire exactly when the window ends'
);

const now = new Date('2026-05-25T10:00:00.000-05:00');
const choreDefinitions = [
  {
    id: 'weekly_available',
    title: 'Wipe counters',
    frequency_pool: ChoreFrequencyPools.WEEKLY,
    eligible_student_ids: ['student_a'],
    all_students_eligible: false,
    minimum_cooldown_days: 0,
    is_active: true,
  },
  {
    id: 'weekly_claimed_by_sibling',
    title: 'Sweep porch',
    frequency_pool: ChoreFrequencyPools.WEEKLY,
    eligible_student_ids: ['student_a', 'student_b'],
    all_students_eligible: false,
    minimum_cooldown_days: 0,
    is_active: true,
  },
  {
    id: 'monthly_cooling_down',
    title: 'Rotate pantry stock',
    frequency_pool: ChoreFrequencyPools.MONTHLY,
    eligible_student_ids: ['student_a'],
    all_students_eligible: false,
    minimum_cooldown_days: 15,
    is_active: true,
  },
  {
    id: 'weekly_inactive',
    title: 'Archived chore',
    frequency_pool: ChoreFrequencyPools.WEEKLY,
    eligible_student_ids: ['student_a'],
    all_students_eligible: false,
    minimum_cooldown_days: 0,
    is_active: false,
  },
  {
    id: 'monthly_available',
    title: 'Dust baseboards',
    frequency_pool: ChoreFrequencyPools.MONTHLY,
    eligible_student_ids: ['student_a'],
    all_students_eligible: false,
    minimum_cooldown_days: 0,
    is_active: true,
  },
];

const choreClaims = [
  {
    id: 'claim_sibling',
    chore_definition_id: 'weekly_claimed_by_sibling',
    student_id: 'student_b',
    status: 'claimed',
    claimed_at: new Date('2026-05-25T08:00:00.000-05:00'),
    expires_at: new Date('2026-05-26T08:00:00.000-05:00'),
  },
];

const choreCompletions = [
  {
    id: 'completion_monthly_recent',
    chore_definition_id: 'monthly_cooling_down',
    student_id: 'student_b',
    status: 'completed',
    completed_at: new Date('2026-05-24T09:00:00.000-05:00'),
  },
];

const availableCounts = countAvailableChoreBlocksForStudent({
  choreDefinitions,
  studentId: 'student_a',
  claims: choreClaims,
  completions: choreCompletions,
  now,
  weekConfig: WEEK_CONFIG,
  claimExpirationHours: 24,
});

assert.deepEqual(availableCounts, {
  total: 2,
  weekly: 1,
  monthly: 1,
});

const studentSafeView = buildStudentSafeChoreView({
  studentId: 'student_a',
  routineTemplates: [
    {
      id: 'routine_morning',
      title: 'Morning Routine',
      student_ids: ['student_a'],
      checklist_items: [
        { id: 'teeth', label: 'Brush teeth' },
        { id: 'bed', label: 'Make bed' },
      ],
      counts_toward_allowance: true,
      counts_toward_points: false,
    },
  ],
  routineCompletions: [
    {
      id: 'routine_morning_student_a_2026-05-25',
      student_id: 'student_a',
      routine_template_id: 'routine_morning',
      date_key: '2026-05-25',
      completed_at: new Date('2026-05-25T08:30:00.000-05:00'),
    },
  ],
  choreDefinitions,
  choreClaims,
  choreCompletions,
  allowancePeriods: [
    {
      id: 'allowance_a',
      student_id: 'student_a',
      period_type: 'weekly',
      period_key: '2026-05-24',
      calculated_earned_amount: 8,
      paid_status: 'unpaid',
    },
    {
      id: 'allowance_b',
      student_id: 'student_b',
      period_type: 'weekly',
      period_key: '2026-05-24',
      calculated_earned_amount: 10,
      paid_status: 'unpaid',
    },
  ],
  pointWallets: [
    {
      id: 'wallet_a',
      student_id: 'student_a',
      total_points: 120,
      lifetime_points: 180,
    },
    {
      id: 'wallet_b',
      student_id: 'student_b',
      total_points: 500,
      lifetime_points: 900,
    },
  ],
  rewardCatalogItems: [
    {
      id: 'reward_shared',
      type: RewardCatalogItemTypes.PARENT_CREATED,
      title: 'Movie night pick',
      description: 'Choose Friday movie night.',
      point_cost: 40,
      stock_quantity: 1,
      available_quantity: 1,
      eligible_student_ids: [],
      redemption_requires_approval: true,
      is_active: true,
    },
    {
      id: 'reward_b_only',
      type: RewardCatalogItemTypes.BUILT_IN,
      title: 'Sibling private reward',
      description: 'Only for sibling.',
      point_cost: 10,
      stock_quantity: 1,
      available_quantity: 1,
      eligible_student_ids: ['student_b'],
      redemption_requires_approval: false,
      is_active: true,
    },
  ],
  rewardRedemptions: [
    {
      id: 'redemption_a',
      student_id: 'student_a',
      reward_catalog_item_id: 'reward_shared',
      status: RewardRedemptionStatuses.REQUESTED,
      title_snapshot: 'Movie night pick',
      point_cost_snapshot: 40,
    },
    {
      id: 'redemption_b',
      student_id: 'student_b',
      reward_catalog_item_id: 'reward_b_only',
      status: RewardRedemptionStatuses.APPROVED,
      title_snapshot: 'Sibling private reward',
      point_cost_snapshot: 10,
    },
  ],
  now,
  weekConfig: {
    ...WEEK_CONFIG,
    timezone: 'America/Chicago',
  },
  claimExpirationHours: 24,
});

assert.equal(studentSafeView.routine_date_key, '2026-05-25');
assert.equal(studentSafeView.routines[0].is_completed_today, true);
assert.deepEqual(
  studentSafeView.chores.available.map((chore) => chore.id).sort(),
  ['monthly_available', 'weekly_available']
);
assert.deepEqual(
  studentSafeView.chores.claimed.map((chore) => chore.id),
  []
);
assert.deepEqual(
  studentSafeView.allowance.periods.map((period) => period.id),
  [],
  'student-safe chore view omits allowance ledger details from public portal state'
);
assert.equal(studentSafeView.rewards.wallet.student_id, 'student_a');
assert.deepEqual(
  studentSafeView.rewards.catalog.map((reward) => reward.id),
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
  studentSafeView.rewards.myRedemptions.map((redemption) => redemption.id),
  ['redemption_a']
);

const safeViewText = JSON.stringify(studentSafeView);
assert.equal(
  safeViewText.includes('student_b'),
  false,
  'student-safe view should not expose sibling allowance, wallet, or redemption state'
);

const defaultRewardSettings = buildDefaultRewardSettings({
  chore_block_points: 5,
  routine_day_points: 2,
});

assert.deepEqual(defaultRewardSettings, {
  school_block_points: 0,
  chore_block_points: 5,
  routine_day_points: 2,
  routine_points_enabled: false,
});
assert.equal(
  getPointValueForSource(PointSourceTypes.CHORE_COMPLETION, defaultRewardSettings),
  5
);
assert.equal(
  getPointValueForSource(PointSourceTypes.ROUTINE_COMPLETION, defaultRewardSettings),
  0,
  'routine point awards should stay off until explicitly enabled'
);

console.log('Chores availability checks passed.');
