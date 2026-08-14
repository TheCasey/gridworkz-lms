#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ChoreClaimStatuses,
  ChoreCompletionStatuses,
  ChoreFrequencyPools,
} from '../src/constants/schema.js';
import {
  buildStudentChoreWorkspaceModel,
  buildStudentSafeChoreView,
} from '../src/utils/choreUtils.js';
import {
  CHORE_CLAIM_STATUSES,
  buildTrustedChoreCompletionDecision,
} from '../functions/src/choreTrustedValidators.js';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const WEEK_CONFIG = {
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: 'America/Chicago',
};

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
    id: 'weekly_claimed_by_student',
    title: 'Vacuum stairs',
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
    id: 'weekly_completed_recently',
    title: 'Take out recycling',
    frequency_pool: ChoreFrequencyPools.WEEKLY,
    eligible_student_ids: ['student_a'],
    all_students_eligible: false,
    minimum_cooldown_days: 0,
    is_active: true,
  },
  {
    id: 'monthly_available',
    title: 'Rotate pantry stock',
    frequency_pool: ChoreFrequencyPools.MONTHLY,
    eligible_student_ids: ['student_a'],
    all_students_eligible: false,
    minimum_cooldown_days: 0,
    is_active: true,
  },
  {
    id: 'inactive_hidden',
    title: 'Archived chore',
    frequency_pool: ChoreFrequencyPools.WEEKLY,
    eligible_student_ids: ['student_a'],
    all_students_eligible: false,
    minimum_cooldown_days: 0,
    is_active: false,
  },
  {
    id: 'ineligible_hidden',
    title: 'Sibling-only chore',
    frequency_pool: ChoreFrequencyPools.WEEKLY,
    eligible_student_ids: ['student_b'],
    all_students_eligible: false,
    minimum_cooldown_days: 0,
    is_active: true,
  },
];

const routineTemplates = [
  {
    id: 'routine_morning',
    title: 'Morning Routine',
    student_ids: ['student_a'],
    checklist_items: [
      { id: 'teeth', label: 'Brush teeth' },
      { id: 'bed', label: 'Make bed' },
    ],
    is_active: true,
  },
];

const routineCompletions = [
  {
    id: 'routine_morning_student_a_2026-05-25',
    student_id: 'student_a',
    routine_template_id: 'routine_morning',
    date_key: '2026-05-25',
    completed_item_ids: ['teeth', 'bed'],
    completed_at: new Date('2026-05-25T08:15:00.000-05:00'),
  },
];

const choreClaims = [
  {
    id: 'claim_student_a',
    chore_definition_id: 'weekly_claimed_by_student',
    student_id: 'student_a',
    status: ChoreClaimStatuses.CLAIMED,
    claimed_at: new Date('2026-05-25T08:00:00.000-05:00'),
    expires_at: new Date('2026-05-26T08:00:00.000-05:00'),
  },
  {
    id: 'claim_student_b',
    chore_definition_id: 'weekly_claimed_by_sibling',
    student_id: 'student_b',
    status: ChoreClaimStatuses.CLAIMED,
    claimed_at: new Date('2026-05-25T09:00:00.000-05:00'),
    expires_at: new Date('2026-05-26T09:00:00.000-05:00'),
  },
];

const choreCompletions = [
  {
    id: 'completion_recent',
    chore_definition_id: 'weekly_completed_recently',
    student_id: 'student_a',
    status: ChoreCompletionStatuses.COMPLETED,
    completed_at: new Date('2026-05-25T07:00:00.000-05:00'),
  },
];

const studentSafeView = buildStudentSafeChoreView({
  studentId: 'student_a',
  routineTemplates,
  routineCompletions,
  choreDefinitions,
  choreClaims,
  choreCompletions,
  now,
  weekConfig: WEEK_CONFIG,
  claimExpirationHours: 24,
});

assert.deepEqual(
  studentSafeView.chores.available.map((chore) => chore.id).sort(),
  ['monthly_available', 'weekly_available'],
  'student view should include only eligible available chores'
);

assert.deepEqual(
  studentSafeView.chores.claimed.map((chore) => chore.id),
  ['weekly_claimed_by_student'],
  'student view should include only the verified student’s claimed chores'
);

assert.equal(
  studentSafeView.chores.claimed[0].active_claim_id,
  'claim_student_a',
  'claimed chores should carry the trusted active claim id needed for completion'
);

assert.equal(studentSafeView.routines.length, 1);
assert.equal(studentSafeView.routines[0].is_completed_today, true);
assert.equal(
  studentSafeView.routines[0].checklist_items.length,
  2,
  'daily routines stay grouped under one routine record instead of item-level completions'
);
assert.deepEqual(
  studentSafeView.routines[0].completions[0].completed_item_ids,
  ['teeth', 'bed'],
  'local student-safe routine shape should stay compatible with trusted routine completions'
);

const workspace = buildStudentChoreWorkspaceModel({
  choreState: {
    routines: studentSafeView.routines,
    chores: studentSafeView.chores,
  },
  enabled: true,
  hasStudentContext: true,
  now,
  weekConfig: WEEK_CONFIG,
});

assert.equal(workspace.accessState, 'ready');
assert.deepEqual(workspace.counts.remaining, {
  total: 3,
  weekly: 2,
  monthly: 1,
});

const trustedRoutineOnlyWorkspace = buildStudentChoreWorkspaceModel({
  choreState: {
    routines: [
      {
        id: 'routine_morning',
        title: 'Morning Routine',
        checklist_items: [
          { id: 'teeth', label: 'Brush teeth' },
          { id: 'bed', label: 'Make bed' },
        ],
        completions: [
          {
            id: 'routine_morning_student_a_2026-05-25',
            date_key: '2026-05-25',
            completed_item_ids: ['teeth', 'bed'],
            completed_at: '2026-05-25T13:15:00.000Z',
          },
        ],
      },
    ],
    chores: {
      available: [],
      claimed: [],
    },
  },
  enabled: true,
  hasStudentContext: true,
  now,
  weekConfig: WEEK_CONFIG,
});

assert.equal(
  trustedRoutineOnlyWorkspace.routines[0].is_completed_today,
  true,
  'completed routine data returned by the trusted callable should render completed after reload'
);
assert.deepEqual(
  trustedRoutineOnlyWorkspace.routines[0].completed_item_ids,
  ['teeth', 'bed'],
  'trusted routine completion item checks remain UI guidance attached to one daily completion'
);
assert.equal(
  trustedRoutineOnlyWorkspace.accessState,
  'all_done',
  'a completed routine with no available or claimed chores should use the all-done workspace state'
);

const hiddenWorkspace = buildStudentChoreWorkspaceModel({
  enabled: false,
  hasStudentContext: true,
  now,
  weekConfig: WEEK_CONFIG,
});

assert.equal(hiddenWorkspace.accessState, 'hidden');
assert.equal(hiddenWorkspace.canShowArea, false);

const lockedWorkspace = buildStudentChoreWorkspaceModel({
  enabled: true,
  hasStudentContext: false,
  now,
  weekConfig: WEEK_CONFIG,
});

assert.equal(lockedWorkspace.accessState, 'locked');
assert.equal(lockedWorkspace.canShowArea, true);
assert.equal(lockedWorkspace.canInteract, false);

const pinlessWorkspace = buildStudentChoreWorkspaceModel({
  enabled: true,
  hasStudentContext: false,
  now,
  weekConfig: WEEK_CONFIG,
});

assert.equal(
  pinlessWorkspace.canInteract,
  false,
  'pinless public student chore context should stay locked instead of exposing chore actions'
);

const laterView = buildStudentSafeChoreView({
  studentId: 'student_a',
  choreDefinitions,
  choreClaims,
  choreCompletions,
  now: new Date('2026-06-02T10:00:00.000-05:00'),
  weekConfig: WEEK_CONFIG,
  claimExpirationHours: 24,
});

assert.equal(
  laterView.chores.available.some((chore) => chore.id === 'weekly_completed_recently'),
  true,
  'completed chores should return to the available pool only after the period helper marks them eligible again'
);

const siblingCompletionDecision = buildTrustedChoreCompletionDecision({
  claim: {
    id: 'claim_student_b',
    chore_definition_id: 'weekly_claimed_by_sibling',
    student_id: 'student_b',
    status: CHORE_CLAIM_STATUSES.CLAIMED,
    claimed_at: new Date('2026-05-25T09:00:00.000-05:00'),
    expires_at: new Date('2026-05-26T09:00:00.000-05:00'),
  },
  choreDefinition: choreDefinitions.find((chore) => chore.id === 'weekly_claimed_by_sibling'),
  studentId: 'student_a',
  now,
});

assert.equal(siblingCompletionDecision.ok, false);
assert.equal(
  siblingCompletionDecision.code,
  'student_mismatch',
  'trusted completion should reject a sibling trying to finish another student’s claimed chore'
);

const useStudentChoresSource = await readSource('src/hooks/useStudentChores.js');

assert.ok(
  useStudentChoresSource.includes('student?.id && student?.access_pin && isAuthenticated'),
  'useStudentChores should require an access PIN and authenticated student session before trusted reads'
);
assert.ok(
  useStudentChoresSource.includes("access_pin: hasVerifiedStudentContext ? pin : ''"),
  'useStudentChores should omit PIN payloads when the session is not verified'
);

console.log('Student chores view checks passed.');
