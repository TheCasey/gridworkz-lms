#!/usr/bin/env node

import assert from 'node:assert/strict';
import { WeeklyPlanStatuses } from '../src/constants/schema.js';
import {
  deriveCurrentLockdownPolicyPreview,
} from '../src/utils/lockdownPolicyUtils.js';
import {
  buildPublishedWeeklyPlanWorkLauncherContract,
  buildWorkLauncherActiveWorkSession,
  buildWorkLauncherTimerSessionPayload,
  getPublishedWeeklyPlanBlockLaunchState,
} from '../src/utils/workLauncherUtils.js';
import { summarizeAllowedResources } from '../extensions/chrome-lockdown-poc/guidance.js';

process.env.VITE_PUBLIC_APP_HOST ||= 'own-path.com';
process.env.VITE_DASHBOARD_APP_HOST ||= 'dashboard.own-path.com';
process.env.VITE_FIREBASE_PROJECT_ID ||= 'gridworkz-lms-test';
process.env.VITE_FIREBASE_FUNCTIONS_REGION ||= 'us-central1';

const studentRecord = {
  id: 'student_ada',
  slug: 'student-ada-9f3a',
  parent_id: 'parent_lockdown',
  timezone: 'UTC',
  lockdown_schedule: {
    timezone: 'UTC',
    school_days: [1, 2, 3, 4, 5],
    school_day_start_time: '08:00',
    school_day_end_time: '15:00',
    off_hours_resource_windows: [
      {
        id: 'window_evening_open',
        label: 'Evening open',
        days: [5],
        start_time: '18:00',
        end_time: '20:00',
        resources: [
          {
            name: 'Desmos',
            url: 'https://www.desmos.com/calculator',
          },
        ],
      },
    ],
  },
  updated_at: '2026-05-22T08:00:00.000Z',
};

const weeklyPlan = {
  id: 'parent_lockdown_student_ada_2026-05-18',
  parent_id: 'parent_lockdown',
  student_id: 'student_ada',
  week_key: '2026-05-18',
  status: WeeklyPlanStatuses.PUBLISHED,
  updated_at: '2026-05-22T08:10:00.000Z',
  blocks: [
    {
      id: 'block_reading_0',
      assignment_id: 'assignment_reading',
      student_id: 'student_ada',
      title: 'Reading block',
      instruction: 'Read the passage and answer the prompts.',
      resources: [
        {
          name: 'Khan Academy',
          url: 'https://www.khanacademy.org/reading',
        },
      ],
      planned_duration_minutes: 25,
      require_timer: true,
      require_input: true,
      legacy_subject_id: 'reading',
      legacy_subject_title: 'Reading',
      legacy_block_index: 0,
    },
    {
      id: 'block_math_0',
      assignment_id: 'assignment_math',
      student_id: 'student_ada',
      title: 'Math block',
      instruction: 'Complete the lesson and practice set.',
      resources: [
        {
          name: 'Crash Course Kids',
          youtube_channel_id: 'UCONtPx56PSebXJOxbFv-2jQ',
          youtube_channel_title: 'Crash Course Kids',
          youtube_channel_handle: '@crashcoursekids',
          url: 'https://www.youtube.com/watch?v=abc123',
        },
      ],
      planned_duration_minutes: 30,
      require_timer: true,
      require_input: true,
      legacy_subject_id: 'math',
      legacy_subject_title: 'Math',
      legacy_block_index: 0,
    },
  ],
};

const subjectsById = {
  reading: {
    id: 'reading',
    parent_id: 'parent_lockdown',
    student_id: 'student_ada',
    student_ids: ['student_ada'],
    title: 'Reading',
    block_count: 1,
    block_length: 25,
    color: '#714cb6',
    require_timer: true,
    require_input: true,
    resources: [],
    custom_fields: [],
    block_objectives: {},
    is_active: true,
  },
  math: {
    id: 'math',
    parent_id: 'parent_lockdown',
    student_id: 'student_ada',
    student_ids: ['student_ada'],
    title: 'Math',
    block_count: 1,
    block_length: 30,
    color: '#714cb6',
    require_timer: true,
    require_input: true,
    resources: [],
    custom_fields: [],
    block_objectives: {},
    is_active: true,
  },
};

const schoolTime = new Date('2026-05-22T13:00:00.000Z');
const completedBlocks = {
  reading: [0],
  math: [],
};

const launcherContract = buildPublishedWeeklyPlanWorkLauncherContract({
  studentRecord,
  weeklyPlan,
  subjectsById,
  completedBlocks,
  timerSessions: [],
  entitlementActive: true,
  referenceDate: schoolTime,
});

assert.equal(launcherContract.source_kind, 'published_weekly_plan');
assert.equal(launcherContract.bridge_kind, 'legacy_subject_bridge');
assert.deepEqual(
  launcherContract.blocks.map((block) => block.id),
  ['block_reading_0', 'block_math_0'],
  'published weekly-plan blocks should preserve stable plan order'
);

const completedLaunchState = getPublishedWeeklyPlanBlockLaunchState({
  workItem: launcherContract.blocks[0],
  completedBlocks,
  timerSessions: [],
});

assert.equal(completedLaunchState.completed, true);
assert.equal(completedLaunchState.can_start, false);

const unavailableLaunchState = getPublishedWeeklyPlanBlockLaunchState({
  workItem: {
    id: 'missing_block',
    title: 'Missing block',
    legacySubjectId: 'math',
    legacySubjectTitle: 'Math',
    compatibilityBlockIndex: 99,
    compatibilitySubject: null,
  },
  completedBlocks: {},
  timerSessions: [],
});

assert.equal(unavailableLaunchState.unavailable, true);
assert.equal(unavailableLaunchState.can_start, false);

const timerConfig = {
  startTime: Date.parse('2026-05-22T13:05:00.000Z'),
  durationMs: 30 * 60 * 1000,
  targetEndTime: Date.parse('2026-05-22T13:35:00.000Z'),
  durationMinutes: 30,
  initialDurationMs: 30 * 60 * 1000,
  remainingTime: 18 * 60 * 1000,
  isRunning: true,
  blockIndex: 0,
};

const timerSessionPayload = buildWorkLauncherTimerSessionPayload({
  studentRecord,
  workItem: launcherContract.blocks[1],
  timer: timerConfig,
});

const timerSessionRecord = {
  id: 'timer_math_0',
  ...timerSessionPayload,
  status: 'active',
  saved_at: 42,
  updated_at: '2026-05-22T08:15:00.000Z',
};

const activeLauncherContract = buildPublishedWeeklyPlanWorkLauncherContract({
  studentRecord,
  weeklyPlan,
  subjectsById,
  completedBlocks,
  timerSessions: [timerSessionRecord],
  entitlementActive: true,
  referenceDate: schoolTime,
});

assert.deepEqual(
  {
    student_id: timerSessionPayload.student_id,
    parent_id: timerSessionPayload.parent_id,
    subject_id: timerSessionPayload.subject_id,
    block_index: timerSessionPayload.block_index,
    start_time: timerSessionPayload.start_time,
    duration_ms: timerSessionPayload.duration_ms,
    duration_minutes: timerSessionPayload.duration_minutes,
    target_end_time: timerSessionPayload.target_end_time,
    initial_duration_ms: timerSessionPayload.initial_duration_ms,
    remaining_time: timerSessionPayload.remaining_time,
    is_running: timerSessionPayload.is_running,
    paused_at: timerSessionPayload.paused_at,
    resumed_at: timerSessionPayload.resumed_at,
    completed_at: timerSessionPayload.completed_at,
  },
  {
    student_id: 'student_ada',
    parent_id: 'parent_lockdown',
    subject_id: 'math',
    block_index: 0,
    start_time: timerConfig.startTime,
    duration_ms: timerConfig.durationMs,
    duration_minutes: timerConfig.durationMinutes,
    target_end_time: timerConfig.targetEndTime,
    initial_duration_ms: timerConfig.initialDurationMs,
    remaining_time: timerConfig.remainingTime,
    is_running: true,
    paused_at: null,
    resumed_at: null,
    completed_at: null,
  },
  'starting a block should emit the timer-session contract shape'
);

const activeWorkSession = buildWorkLauncherActiveWorkSession({
  studentRecord,
  weeklyPlan,
  workItem: launcherContract.blocks[1],
  timerSession: timerSessionRecord,
});

const derivedPreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: true,
  parentId: studentRecord.parent_id,
  studentRecord,
  weeklyPlan,
  timerSessions: [timerSessionRecord],
  referenceDate: schoolTime,
});

assert.deepEqual(
  activeWorkSession,
  derivedPreview.policy_context.active_work_session,
  'launcher work-session shape should match trusted policy derivation'
);

assert.ok(activeLauncherContract.active_block, 'launcher contract should expose an active block for the running timer-backed weekly-plan block');
assert.equal(
  activeLauncherContract.active_block.id,
  launcherContract.blocks[1].id,
  'launcher contract should resolve the active weekly-plan block at the top level'
);

assert.deepEqual(
  activeLauncherContract.active_work_session,
  derivedPreview.policy_context.active_work_session,
  'launcher top-level active work-session should match trusted policy derivation'
);

assert.deepEqual(
  activeLauncherContract.allowed_resources,
  summarizeAllowedResources(derivedPreview.policy),
  'launcher resource mapping should include system resources and match policy display mapping'
);

assert.ok(
  activeLauncherContract.allowed_resources.allowedSystemResources.some((resource) => resource.name === 'Own Path student portal'),
  'system resources should include the student portal entry'
);
assert.ok(
  activeLauncherContract.allowed_resources.allowedSystemResources.some((resource) => resource.name === 'Own Path extension pages'),
  'system resources should include extension pages'
);

const legacyBridgeContract = buildPublishedWeeklyPlanWorkLauncherContract({
  studentRecord,
  weeklyPlan: null,
  subjectsById,
  timerSessions: [],
  completedBlocks: {},
  entitlementActive: true,
  referenceDate: schoolTime,
});

assert.equal(legacyBridgeContract.source_kind, 'legacy_subject_bridge');
assert.ok(legacyBridgeContract.blocks.length > 0, 'legacy bridge should still surface fallback work');
assert.ok(legacyBridgeContract.bridge_subjects.length > 0, 'legacy bridge should still expose compatibility subjects');

console.log('Lockdown work-launcher checks passed.');
