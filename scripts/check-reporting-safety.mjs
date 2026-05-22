#!/usr/bin/env node

import assert from 'node:assert/strict';
import { WeeklyPlanStatuses } from '../src/constants/schema.js';
import {
  buildStudentWeeklySnapshot,
  canSaveWeeklyReportSnapshot,
  escapeReportHtml,
} from '../src/utils/reportUtils.js';

const weekStart = new Date('2026-05-18T05:00:00.000Z');
const weekEnd = new Date('2026-05-25T04:59:59.999Z');
const student = {
  id: 'student_ada',
  name: 'Ada <script>alert("x")</script>',
};
const subjects = [
  {
    id: 'math',
    title: 'Math & Logic',
    color: '#cbb7fb',
    student_ids: [student.id],
  },
];

assert.equal(
  escapeReportHtml('<img src=x onerror="alert(1)"> & Casey\'s notes'),
  '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Casey&#39;s notes'
);

const assignedIncompleteSnapshot = buildStudentWeeklySnapshot({
  student,
  subjects,
  submissions: [],
  weekStart,
  weekEnd,
  weeklyPlan: {
    id: 'parent_student_2026-05-18',
    status: WeeklyPlanStatuses.PUBLISHED,
    blocks: [
      {
        legacy_subject_id: 'math',
        legacy_subject_title: 'Math & Logic',
        legacy_block_index: 0,
        title: 'Fractions <intro>',
      },
      {
        legacy_subject_id: 'math',
        legacy_subject_title: 'Math & Logic',
        legacy_block_index: 1,
        title: 'Word problems',
      },
    ],
  },
});

assert.equal(assignedIncompleteSnapshot.snapshotModel, 'weekly_plan');
assert.equal(assignedIncompleteSnapshot.totalBlocks, 0);
assert.equal(assignedIncompleteSnapshot.goalBlocks, 2);
assert.equal(canSaveWeeklyReportSnapshot(assignedIncompleteSnapshot), true);

const emptySnapshot = buildStudentWeeklySnapshot({
  student,
  subjects: [],
  submissions: [],
  weekStart,
  weekEnd,
});

assert.equal(emptySnapshot.totalBlocks, 0);
assert.equal(emptySnapshot.goalBlocks, 0);
assert.equal(canSaveWeeklyReportSnapshot(emptySnapshot), false);

console.log('Reporting safety checks passed.');
