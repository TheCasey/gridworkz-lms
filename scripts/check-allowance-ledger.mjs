import assert from 'node:assert/strict';
import {
  buildAllowanceLedgerEntry,
  resolveAllowancePeriod,
} from '../src/utils/allowanceUtils.js';

const weekConfig = {
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: 'America/Chicago',
};

const choreDefinitions = [
  { id: 'weekly-1', frequency_pool: 'weekly' },
  { id: 'monthly-1', frequency_pool: 'monthly' },
];

const buildWeeklyCompletions = (count, completedAt = '2026-05-06T15:00:00.000Z') => (
  Array.from({ length: count }, (_, index) => ({
    id: `weekly-${index + 1}`,
    student_id: 'student-1',
    chore_definition_id: 'weekly-1',
    status: 'approved',
    quota_blocks: 1,
    completed_at: completedAt,
  }))
);

const buildMonthlyCompletions = (count, completedAt = '2026-05-07T15:00:00.000Z') => (
  Array.from({ length: count }, (_, index) => ({
    id: `monthly-${index + 1}`,
    student_id: 'student-1',
    chore_definition_id: 'monthly-1',
    status: 'approved',
    quota_blocks: 1,
    completed_at: completedAt,
  }))
);

const routineTemplates = [
  {
    id: 'routine-1',
    title: 'Morning Routine',
    student_ids: ['student-1'],
    checklist_items: [{ id: 'make-bed', label: 'Make bed' }],
    counts_toward_allowance: true,
  },
];

const routineCompletions = [
  {
    id: 'routine-completion-1',
    student_id: 'student-1',
    routine_template_id: 'routine-1',
    date_key: '2026-05-05',
    completed_at: '2026-05-05T13:00:00.000Z',
  },
];

const fullRoutineDayTemplates = [
  {
    id: 'routine-morning',
    title: 'Morning Routine',
    routine_period: 'morning',
    student_ids: ['student-1'],
    checklist_items: [{ id: 'make-bed', label: 'Make bed' }],
  },
  {
    id: 'routine-evening',
    title: 'Evening Routine',
    routine_period: 'evening',
    student_ids: ['student-1'],
    checklist_items: [{ id: 'brush-teeth', label: 'Brush teeth' }],
  },
];

const buildRoutineOnlyLedger = ({ templates, completions }) => buildAllowanceLedgerEntry({
  studentId: 'student-1',
  quota: { required_routine_days: 1 },
  allowancePolicy: {
    period_type: 'weekly',
    allowance_amount: 10,
    completion_policy: 'all_or_nothing',
    include_routines: true,
    include_weekly_chores: false,
    include_monthly_chores: false,
  },
  weekConfig,
  routineTemplates: templates,
  routineCompletions: completions,
  referenceDate: '2026-05-07T12:00:00.000Z',
});

const partialRoutineDay = buildRoutineOnlyLedger({
  templates: fullRoutineDayTemplates,
  completions: [{
    student_id: 'student-1',
    routine_template_id: 'routine-morning',
    date_key: '2026-05-05',
    completed_at: '2026-05-05T13:00:00.000Z',
  }],
});
assert.equal(partialRoutineDay.completed_counts.routine_days, 0);

const completeRoutineDay = buildRoutineOnlyLedger({
  templates: fullRoutineDayTemplates,
  completions: [
    {
      student_id: 'student-1',
      routine_template_id: 'routine-morning',
      date_key: '2026-05-05',
      completed_at: '2026-05-05T13:00:00.000Z',
    },
    {
      student_id: 'student-1',
      routine_template_id: 'routine-evening',
      date_key: '2026-05-05',
      completed_at: '2026-05-05T23:00:00.000Z',
    },
  ],
});
assert.equal(completeRoutineDay.completed_counts.routine_days, 1);
assert.equal(completeRoutineDay.calculated_earned_amount, 10);

const emptyCanonicalPeriodSuppressesLegacy = buildRoutineOnlyLedger({
  templates: [
    {
      id: 'legacy-shared-morning',
      title: 'Morning Routine',
      student_ids: [],
      checklist_items: [{ id: 'legacy-item', label: 'Legacy item' }],
    },
    {
      id: 'routine_student-1_morning',
      title: 'Morning Routine',
      routine_period: 'morning',
      student_ids: ['student-1'],
      checklist_items: [],
    },
  ],
  completions: [{
    student_id: 'student-1',
    routine_template_id: 'legacy-shared-morning',
    date_key: '2026-05-05',
    completed_at: '2026-05-05T13:00:00.000Z',
  }],
});
assert.equal(emptyCanonicalPeriodSuppressesLegacy.completed_counts.routine_days, 0);

const halfCompleteAllOrNothing = buildAllowanceLedgerEntry({
  studentId: 'student-1',
  quota: {
    required_weekly_chore_blocks: 2,
  },
  allowancePolicy: {
    period_type: 'weekly',
    allowance_amount: 10,
    completion_policy: 'all_or_nothing',
    include_routines: false,
  },
  weekConfig,
  choreDefinitions,
  choreCompletions: buildWeeklyCompletions(1),
  referenceDate: '2026-05-07T12:00:00.000Z',
});
assert.equal(halfCompleteAllOrNothing.completed_counts.completion_ratio, 0.5);
assert.equal(halfCompleteAllOrNothing.calculated_earned_amount, 0);

const halfCompleteProrated = buildAllowanceLedgerEntry({
  studentId: 'student-1',
  quota: {
    required_weekly_chore_blocks: 2,
  },
  allowancePolicy: {
    period_type: 'weekly',
    allowance_amount: 10,
    completion_policy: 'prorated',
    include_routines: false,
  },
  weekConfig,
  choreDefinitions,
  choreCompletions: buildWeeklyCompletions(1),
  referenceDate: '2026-05-07T12:00:00.000Z',
});
assert.equal(halfCompleteProrated.completed_counts.completion_ratio, 0.5);
assert.equal(halfCompleteProrated.calculated_earned_amount, 5);

const overCompleted = buildAllowanceLedgerEntry({
  studentId: 'student-1',
  quota: {
    required_weekly_chore_blocks: 1,
  },
  allowancePolicy: {
    period_type: 'weekly',
    allowance_amount: 12,
    completion_policy: 'prorated',
    include_routines: false,
  },
  weekConfig,
  choreDefinitions,
  choreCompletions: buildWeeklyCompletions(2),
  referenceDate: '2026-05-07T12:00:00.000Z',
});
assert.equal(overCompleted.completed_counts.total_blocks, 2);
assert.equal(overCompleted.completed_counts.completion_ratio, 1);
assert.equal(overCompleted.calculated_earned_amount, 12);

const monthlyEarly = resolveAllowancePeriod({
  referenceDate: '2026-05-03T12:00:00.000Z',
  allowancePolicy: { period_type: 'monthly' },
  weekConfig,
});
const monthlyLate = resolveAllowancePeriod({
  referenceDate: '2026-05-10T12:00:00.000Z',
  allowancePolicy: { period_type: 'monthly' },
  weekConfig,
});
assert.equal(monthlyEarly.period_key, monthlyLate.period_key);
assert.equal(monthlyEarly.period_start.toISOString(), monthlyLate.period_start.toISOString());

const biweeklyFirstWeek = resolveAllowancePeriod({
  referenceDate: '2026-05-11T12:00:00.000Z',
  allowancePolicy: { period_type: 'biweekly' },
  weekConfig,
});
const biweeklySecondWeek = resolveAllowancePeriod({
  referenceDate: '2026-05-18T12:00:00.000Z',
  allowancePolicy: { period_type: 'biweekly' },
  weekConfig,
});
assert.equal(biweeklyFirstWeek.period_key, biweeklySecondWeek.period_key);
assert.equal(biweeklyFirstWeek.period_start.toISOString(), biweeklySecondWeek.period_start.toISOString());

const flooredByNegativeAdjustment = buildAllowanceLedgerEntry({
  studentId: 'student-1',
  quota: {
    required_weekly_chore_blocks: 1,
  },
  allowancePolicy: {
    period_type: 'weekly',
    allowance_amount: 6,
    completion_policy: 'all_or_nothing',
    include_routines: false,
  },
  weekConfig,
  choreDefinitions,
  choreCompletions: buildWeeklyCompletions(1),
  overrides: {
    parent_adjustment_amount: -10,
  },
  referenceDate: '2026-05-07T12:00:00.000Z',
});
assert.equal(flooredByNegativeAdjustment.parent_adjustment_amount, -10);
assert.equal(flooredByNegativeAdjustment.adjusted_earned_amount, 0);
assert.equal(flooredByNegativeAdjustment.remaining_amount, 0);

const paidMarkerPreserved = buildAllowanceLedgerEntry({
  studentId: 'student-1',
  quota: {
    required_routine_days: 1,
    required_weekly_chore_blocks: 1,
    required_monthly_chore_blocks: 1,
  },
  allowancePolicy: {
    period_type: 'monthly',
    allowance_amount: 20,
    completion_policy: 'prorated',
    include_routines: true,
  },
  weekConfig,
  routineTemplates,
  routineCompletions,
  choreDefinitions,
  choreCompletions: [
    ...buildWeeklyCompletions(1),
    ...buildMonthlyCompletions(1),
  ],
  existingRecord: {
    id: 'ledger-1',
    parent_adjustment_amount: 1.25,
    paid_amount: 8.5,
    paid_at: new Date('2026-05-20T15:30:00.000Z'),
  },
  referenceDate: '2026-05-21T12:00:00.000Z',
});
assert.equal(paidMarkerPreserved.calculated_earned_amount, 20);
assert.equal(paidMarkerPreserved.parent_adjustment_amount, 1.25);
assert.equal(paidMarkerPreserved.paid_amount, 8.5);
assert.equal(paidMarkerPreserved.paid_status, 'partially_paid');
assert.equal(paidMarkerPreserved.paid_at.toISOString(), '2026-05-20T15:30:00.000Z');

const overPaidFloorsRemainingBalance = buildAllowanceLedgerEntry({
  studentId: 'student-1',
  quota: {
    required_weekly_chore_blocks: 1,
  },
  allowancePolicy: {
    period_type: 'weekly',
    allowance_amount: 5,
    completion_policy: 'all_or_nothing',
    include_routines: false,
  },
  weekConfig,
  choreDefinitions,
  choreCompletions: buildWeeklyCompletions(1),
  overrides: {
    parent_adjustment_amount: -1,
    paid_amount: 10,
    paid_at: new Date('2026-05-07T18:00:00.000Z'),
  },
  referenceDate: '2026-05-07T12:00:00.000Z',
});
assert.equal(overPaidFloorsRemainingBalance.adjusted_earned_amount, 4);
assert.equal(overPaidFloorsRemainingBalance.remaining_amount, 0);
assert.equal(overPaidFloorsRemainingBalance.paid_status, 'paid');
assert.equal(overPaidFloorsRemainingBalance.paid_at.toISOString(), '2026-05-07T18:00:00.000Z');

console.log('check-allowance-ledger: all assertions passed');
