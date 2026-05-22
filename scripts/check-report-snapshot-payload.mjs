#!/usr/bin/env node

import assert from 'node:assert/strict';
import { WeeklyPlanStatuses } from '../src/constants/schema.js';
import {
  buildStudentWeeklySnapshot,
  buildWeeklyReportPayload,
} from '../src/utils/reportUtils.js';

const weekStart = new Date('2026-05-18T05:00:00.000Z');
const weekEnd = new Date('2026-05-25T04:59:59.999Z');
const parentId = 'parent_casey';
const student = {
  id: 'student_ada',
  name: 'Ada Lovelace',
};
const subjects = [
  {
    id: 'math',
    title: 'Math & Logic',
    color: '#cbb7fb',
    student_ids: [student.id],
  },
];
const submissions = [
  {
    id: 'submission_fraction_intro',
    parent_id: parentId,
    student_id: student.id,
    subject_id: 'math',
    block_index: 0,
    timestamp: new Date('2026-05-19T15:30:00.000Z'),
    summary_text: 'Finished the fraction intro and showed equivalent fractions.',
    block_duration: 35,
    manual_override: false,
    resources_used: [{ name: 'Workbook page 12', url: '' }],
    custom_field_responses: {
      workedExamples: '6',
    },
  },
];
const weeklyPlan = {
  id: 'parent_casey_student_ada_2026-05-18',
  status: WeeklyPlanStatuses.PUBLISHED,
  blocks: [
    {
      id: 'block_fraction_intro',
      assignment_id: 'assignment_math',
      student_id: student.id,
      title: 'Fraction intro',
      instruction: 'Complete the equivalent fractions lesson.',
      resources: [{ name: 'Workbook page 12', url: '' }],
      category: 'lesson',
      completion_mode: 'task_complete',
      planned_duration_minutes: 30,
      require_timer: true,
      require_input: true,
      legacy_subject_id: 'math',
      legacy_subject_title: 'Math & Logic',
      legacy_block_index: 0,
    },
    {
      id: 'block_word_problems',
      assignment_id: 'assignment_math',
      student_id: student.id,
      title: 'Word problems',
      instruction: 'Solve five mixed-operation word problems.',
      resources: [{ name: 'Problem set A', url: '' }],
      category: 'practice',
      completion_mode: 'hybrid',
      planned_duration_minutes: 25,
      require_timer: false,
      require_input: true,
      legacy_subject_id: 'math',
      legacy_subject_title: 'Math & Logic',
      legacy_block_index: 1,
    },
  ],
};

const weeklyPlanSnapshot = buildStudentWeeklySnapshot({
  student,
  subjects,
  submissions,
  weekStart,
  weekEnd,
  weeklyPlan,
});
const weeklyPlanPayload = buildWeeklyReportPayload({
  student,
  snapshot: weeklyPlanSnapshot,
  weekStart,
  weekEnd,
  parentId,
  parentSettings: {},
  source: 'manual',
});

assert.equal(weeklyPlanPayload.snapshot_model, 'weekly_plan');
assert.equal(weeklyPlanPayload.weekly_plan_id, weeklyPlan.id);
assert.deepEqual(weeklyPlanPayload.attachments, []);
assert.equal(weeklyPlanPayload.assigned_blocks_snapshot.length, 2);

const completedBlock = weeklyPlanPayload.assigned_blocks_snapshot.find(block => block.blockId === 'block_fraction_intro');
assert.ok(completedBlock);
assert.equal(completedBlock.completed, true);
assert.equal(completedBlock.completionStatus, 'completed');
assert.equal(completedBlock.category, 'lesson');
assert.equal(completedBlock.completionMode, 'task_complete');
assert.equal(completedBlock.instruction, 'Complete the equivalent fractions lesson.');
assert.equal(completedBlock.resources[0].name, 'Workbook page 12');
assert.equal(completedBlock.legacySubjectId, 'math');
assert.equal(completedBlock.legacySubjectTitle, 'Math & Logic');
assert.equal(completedBlock.legacyBlockIndex, 0);
assert.equal(
  completedBlock.matchedSubmissionSummary.summaryText,
  'Finished the fraction intro and showed equivalent fractions.'
);
assert.equal(completedBlock.matchedSubmissionSummary.durationMinutes, 35);
assert.equal(completedBlock.matchedSubmissionSummary.resourcesUsed[0].name, 'Workbook page 12');
assert.equal(completedBlock.matchedSubmissionSummary.customFieldResponses.workedExamples, '6');

const incompleteBlock = weeklyPlanPayload.assigned_blocks_snapshot.find(block => block.blockId === 'block_word_problems');
assert.ok(incompleteBlock);
assert.equal(incompleteBlock.completed, false);
assert.equal(incompleteBlock.completionStatus, 'incomplete');
assert.equal(incompleteBlock.matchedSubmissionSummary, null);
assert.equal(incompleteBlock.category, 'practice');
assert.equal(incompleteBlock.completionMode, 'hybrid');

assert.deepEqual(Object.keys(weeklyPlanPayload.subjects_data), ['math']);
assert.deepEqual(weeklyPlanPayload.subjects_data.math, {
  subjectId: 'math',
  subjectTitle: 'Math & Logic',
  totalBlocks: 1,
  goalBlocks: 2,
  totalMinutes: 35,
  summaries: [
    {
      text: 'Finished the fraction intro and showed equivalent fractions.',
      blockNumber: 1,
      date: new Date('2026-05-19T15:30:00.000Z'),
      duration: 35,
      manualOverride: false,
    },
  ],
});

const subjectFallbackSnapshot = buildStudentWeeklySnapshot({
  student,
  subjects,
  submissions,
  weekStart,
  weekEnd,
});
const subjectFallbackPayload = buildWeeklyReportPayload({
  student,
  snapshot: subjectFallbackSnapshot,
  weekStart,
  weekEnd,
  parentId,
  parentSettings: {},
  source: 'manual',
});

assert.equal(subjectFallbackPayload.snapshot_model, 'subjects');
assert.equal(subjectFallbackPayload.weekly_plan_id, '');
assert.deepEqual(subjectFallbackPayload.attachments, []);
assert.deepEqual(subjectFallbackPayload.assigned_blocks_snapshot, []);
assert.deepEqual(Object.keys(subjectFallbackPayload.subjects_data), ['math']);
assert.equal(subjectFallbackPayload.subjects_data.math.totalBlocks, 1);
assert.equal(subjectFallbackPayload.subjects_data.math.goalBlocks, 10);

console.log('Report snapshot payload checks passed.');
console.log(JSON.stringify({
  snapshotModel: weeklyPlanPayload.snapshot_model,
  weeklyPlanId: weeklyPlanPayload.weekly_plan_id,
  assignedBlockCount: weeklyPlanPayload.assigned_blocks_snapshot.length,
  attachmentCount: weeklyPlanPayload.attachments.length,
  completedStatuses: weeklyPlanPayload.assigned_blocks_snapshot.map(block => ({
    blockId: block.blockId,
    completionStatus: block.completionStatus,
    hasMatchedSubmissionSummary: Boolean(block.matchedSubmissionSummary),
  })),
  subjectDataKeys: Object.keys(weeklyPlanPayload.subjects_data),
}, null, 2));
