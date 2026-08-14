#!/usr/bin/env node

import assert from 'node:assert/strict';
import { ChoreCompletionStatuses, ChoreFrequencyPools } from '../src/constants/schema.js';
import {
  buildParentChoreViewModel,
  normalizeRoutineTemplateDraft,
} from '../src/utils/choreParentViewModel.js';

const students = [
  { id: 'student_a', name: 'Ada' },
  { id: 'student_b', name: 'Bea' },
];

const parentSettings = {
  timezone: 'America/Chicago',
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
};

const routinePayload = normalizeRoutineTemplateDraft({
  title: ' Morning Routine ',
  assign_to_all_students: true,
  student_ids: ['student_a'],
  checklist_items: [
    { id: 'teeth', label: ' Brush teeth ' },
    { id: 'bed', label: ' ' },
  ],
});

assert.deepEqual(
  routinePayload,
  {
    id: '',
    title: 'Morning Routine',
    student_ids: [],
    checklist_items: [{ id: 'teeth', label: 'Brush teeth' }],
    counts_toward_allowance: false,
    counts_toward_points: false,
    is_active: true,
  },
  'routine normalization should keep all-student routines household-wide by default'
);

const now = new Date('2026-05-25T14:00:00.000-05:00');

const shortageViewModel = buildParentChoreViewModel({
  students,
  parentSettings,
  choreSettings: {
    claim_expiration_hours: 24,
    quotas: {
      student_a: {
        required_routine_days: 0,
        required_weekly_chore_blocks: 1,
        required_monthly_chore_blocks: 0,
      },
      student_b: {
        required_routine_days: 0,
        required_weekly_chore_blocks: 1,
        required_monthly_chore_blocks: 0,
      },
    },
  },
  choreDefinitions: [
    {
      id: 'shared_weekly',
      title: 'Wipe counters',
      frequency_pool: ChoreFrequencyPools.WEEKLY,
      all_students_eligible: true,
      eligible_student_ids: [],
      minimum_cooldown_days: 0,
      is_active: true,
      requires_parent_approval: false,
    },
  ],
  now,
});

assert.equal(
  shortageViewModel.quota_warnings.some((warning) => warning.type === 'shared_capacity'),
  true,
  'quota warnings should flag when shared pool capacity cannot satisfy all students'
);

const archivedViewModel = buildParentChoreViewModel({
  students,
  parentSettings,
  choreSettings: {},
  choreDefinitions: [
    {
      id: 'archived_weekly',
      title: 'Sweep porch',
      frequency_pool: ChoreFrequencyPools.WEEKLY,
      all_students_eligible: true,
      eligible_student_ids: [],
      minimum_cooldown_days: 0,
      is_active: false,
      requires_parent_approval: false,
    },
    {
      id: 'active_monthly',
      title: 'Rotate pantry stock',
      frequency_pool: ChoreFrequencyPools.MONTHLY,
      all_students_eligible: true,
      eligible_student_ids: [],
      minimum_cooldown_days: 0,
      is_active: true,
      requires_parent_approval: false,
    },
  ],
  now,
});

assert.equal(
  archivedViewModel.chores.weekly.active.some((chore) => chore.id === 'archived_weekly'),
  false,
  'archived chores should be hidden from active pools'
);
assert.equal(
  archivedViewModel.chores.weekly.archived.some((chore) => chore.id === 'archived_weekly'),
  true,
  'archived chores should still be preserved in archived history'
);

const pendingReviewViewModel = buildParentChoreViewModel({
  students,
  parentSettings,
  choreSettings: {},
  choreDefinitions: [
    {
      id: 'approval_chore',
      title: 'Clean bathroom mirror',
      frequency_pool: ChoreFrequencyPools.WEEKLY,
      all_students_eligible: false,
      eligible_student_ids: ['student_a'],
      minimum_cooldown_days: 0,
      is_active: true,
      requires_parent_approval: true,
    },
  ],
  choreCompletions: [
    {
      id: 'completion_pending',
      student_id: 'student_a',
      chore_definition_id: 'approval_chore',
      status: ChoreCompletionStatuses.COMPLETED,
      completed_at: new Date('2026-05-25T09:30:00.000-05:00'),
      quota_blocks: 1,
      proof_note: 'Mirror and sink both done.',
    },
  ],
  now,
});

assert.equal(pendingReviewViewModel.pending_review.length, 1);
assert.equal(
  pendingReviewViewModel.pending_review[0].chore_title,
  'Clean bathroom mirror',
  'approval-required completions should appear in Pending Review'
);

const lockedViewModel = buildParentChoreViewModel({
  students,
  parentSettings,
  choreSettings: {},
  routineTemplates: [
    {
      id: 'routine_evening',
      title: 'Evening Routine',
      student_ids: [],
      checklist_items: [{ id: 'tidy', label: 'Tidy bedroom' }],
      is_active: true,
    },
  ],
  choreDefinitions: [
    {
      id: 'locked_visible',
      title: 'Take out recycling',
      frequency_pool: ChoreFrequencyPools.WEEKLY,
      all_students_eligible: true,
      eligible_student_ids: [],
      minimum_cooldown_days: 0,
      is_active: true,
      requires_parent_approval: false,
    },
  ],
  isLocked: true,
  now,
});

assert.deepEqual(
  lockedViewModel.permissions,
  {
    is_read_only: true,
    can_create: false,
    can_edit: false,
    can_review: false,
  },
  'locked entitlement state should disable create/edit/review actions'
);
assert.equal(lockedViewModel.routines.active.length, 1);
assert.equal(lockedViewModel.chores.weekly.active.length, 1);

console.log('Chores parent view-model checks passed.');
