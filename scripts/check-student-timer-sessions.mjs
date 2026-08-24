#!/usr/bin/env node

import assert from 'node:assert/strict';
import { WeeklyPlanStatuses } from '../src/constants/schema.js';
import {
  buildPortalTimerBlockContext,
  getPortalTimerInvalidReason,
  partitionPortalTimers,
} from '../src/utils/studentTimerSessionUtils.js';
import { buildPublishedWeeklyPlanPortalWorkItems } from '../src/utils/weeklyPlanUtils.js';
import { buildWorkLauncherTimerSessionPayload } from '../src/utils/workLauncherUtils.js';

const weekStart = new Date('2026-08-24T00:00:00.000Z');
const weeklyPlan = {
  id: 'parent_student_2026-08-24',
  week_key: '2026-08-24',
  status: WeeklyPlanStatuses.PUBLISHED,
  blocks: Array.from({ length: 4 }, (_, blockIndex) => ({
    id: `chess_block_${blockIndex}`,
    title: `Chess block ${blockIndex + 1}`,
    legacy_subject_id: 'chess',
    legacy_subject_title: 'Chess',
    legacy_block_index: blockIndex,
    planned_duration_minutes: 30,
    require_timer: true,
  })),
};
const subjectsById = {
  chess: {
    id: 'chess',
    title: 'Chess',
    block_count: 5,
    block_length: 30,
    require_timer: true,
  },
};
const publishedWorkItems = buildPublishedWeeklyPlanPortalWorkItems({
  weeklyPlan,
  subjectsById,
});
const blockContext = buildPortalTimerBlockContext({
  hasPublishedWeeklyPlan: true,
  publishedWorkItems,
  subjects: Object.values(subjectsById),
});
const baseTimer = {
  blockIndex: 2,
  block_id: 'chess_block_2',
  weekly_plan_id: weeklyPlan.id,
  week_key: weeklyPlan.week_key,
  savedAt: weekStart.getTime() + 60_000,
  remainingTime: 0,
  isRunning: false,
};
const validationContext = {
  blockContext,
  completedBlocks: { chess: [0, 1, 3] },
  weeklyPlanId: weeklyPlan.id,
  weekKey: weeklyPlan.week_key,
  weekStart,
};

assert.equal(publishedWorkItems[0].compatibilitySubject.block_count, 4);
assert.deepEqual(
  publishedWorkItems[0].compatibilitySubject.portal_block_indices,
  [0, 1, 2, 3],
  'published subjects should expose only the blocks actually included in the week'
);
assert.equal(
  getPortalTimerInvalidReason({
    ...validationContext,
    subjectId: 'chess',
    timer: baseTimer,
  }),
  null,
  'a finished timer for an incomplete current block must remain available for submission'
);
assert.equal(
  getPortalTimerInvalidReason({
    ...validationContext,
    subjectId: 'chess',
    timer: { ...baseTimer, blockIndex: 4, block_id: 'chess_block_4' },
  }),
  'block_unavailable',
  'a legacy Block 5 timer must not survive a four-block published week'
);
assert.equal(
  getPortalTimerInvalidReason({
    ...validationContext,
    subjectId: 'chess',
    timer: { ...baseTimer, blockIndex: 3, block_id: 'chess_block_3' },
  }),
  'block_completed',
  'completed blocks must not retain timer locks'
);
assert.equal(
  getPortalTimerInvalidReason({
    ...validationContext,
    subjectId: 'chess',
    timer: { ...baseTimer, weekly_plan_id: 'parent_student_2026-08-17' },
  }),
  'weekly_plan_changed',
  'timers must not cross published weekly plans'
);
assert.equal(
  getPortalTimerInvalidReason({
    ...validationContext,
    subjectId: 'chess',
    timer: { ...baseTimer, block_id: 'removed_chess_block' },
  }),
  'block_changed',
  'timers must not transfer to a replacement block at the same index'
);
assert.equal(
  getPortalTimerInvalidReason({
    ...validationContext,
    subjectId: 'chess',
    timer: {
      blockIndex: 2,
      savedAt: weekStart.getTime() - 1,
      remainingTime: 1000,
      isRunning: true,
    },
  }),
  'week_changed',
  'unscoped legacy timers saved before the current week must be removed'
);

const partition = partitionPortalTimers({
  activeTimers: {
    chess: { ...baseTimer, blockIndex: 4, block_id: 'chess_block_4' },
    math: { ...baseTimer, blockIndex: 0 },
  },
  ...validationContext,
});
assert.deepEqual(Object.keys(partition.currentTimers), []);
assert.equal(partition.staleTimers.chess.reason, 'block_unavailable');
assert.equal(partition.staleTimers.math.reason, 'subject_unavailable');

const timerPayload = buildWorkLauncherTimerSessionPayload({
  studentRecord: {
    id: 'student',
    parent_id: 'parent',
  },
  weeklyPlan,
  workItem: publishedWorkItems[2],
  timer: {
    ...baseTimer,
    startTime: weekStart.getTime() + 60_000,
    durationMs: 30 * 60 * 1000,
    durationMinutes: 30,
    targetEndTime: weekStart.getTime() + (31 * 60_000),
    initialDurationMs: 30 * 60 * 1000,
  },
});
assert.deepEqual(
  {
    block_id: timerPayload.block_id,
    weekly_plan_id: timerPayload.weekly_plan_id,
    week_key: timerPayload.week_key,
  },
  {
    block_id: 'chess_block_2',
    weekly_plan_id: weeklyPlan.id,
    week_key: weeklyPlan.week_key,
  },
  'new timer sessions must persist plan, week, and block identity'
);

console.log('Student timer-session checks passed.');
