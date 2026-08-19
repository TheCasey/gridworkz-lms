#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  WeeklyBlockCategories,
  WeeklyBlockCompletionModes,
  WeeklyPlanStatuses,
} from '../src/constants/schema.js';
import {
  deriveCurrentLockdownPolicyPreview,
  LockdownActiveWorkSessionKinds,
  LockdownPolicyStates,
  LockdownProductionPolicyStates,
  normalizeLockdownActiveWorkSession,
  normalizeLockdownPolicyStateMetadata,
} from '../src/utils/lockdownPolicyUtils.js';
import {
  derivePublishedWeeklyPlanDevicePolicy,
  LOCKDOWN_ACTIVE_WORK_SESSION_KINDS as FunctionActiveWorkSessionKinds,
  LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY as FunctionProductionPolicyStates,
  normalizeLockdownActiveWorkSession as normalizeFunctionActiveWorkSession,
  normalizeLockdownPolicyStateContext,
} from '../functions/src/index.js';

const buildStudentRecord = (overrides = {}) => ({
  id: 'student_ada',
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
            name: 'ReadWorks',
            url: 'https://www.readworks.org/article',
          },
        ],
      },
    ],
  },
  updated_at: '2026-05-22T08:00:00.000Z',
  ...overrides,
});

const buildWeeklyPlan = (overrides = {}) => ({
  id: 'parent_lockdown_student_ada_2026-05-18',
  parent_id: 'parent_lockdown',
  student_id: 'student_ada',
  week_key: '2026-05-18',
  status: WeeklyPlanStatuses.PUBLISHED,
  updated_at: '2026-05-22T08:10:00.000Z',
  blocks: [
    {
      id: 'block_math_0',
      assignment_id: 'assignment_math',
      student_id: 'student_ada',
      title: 'Math block',
      instruction: 'Complete the lesson and the follow-up practice.',
      resources: [
        {
          name: 'Khan Academy',
          url: 'https://www.khanacademy.org/math',
        },
      ],
      category: WeeklyBlockCategories.LESSON,
      completion_mode: WeeklyBlockCompletionModes.TIME_BOXED,
      planned_duration_minutes: 30,
      require_timer: true,
      require_input: true,
      legacy_subject_id: 'math',
      legacy_subject_title: 'Math',
      legacy_block_index: 0,
    },
  ],
  ...overrides,
});

const buildTimerSession = (overrides = {}) => ({
  id: 'timer_math_0',
  student_id: 'student_ada',
  parent_id: 'parent_lockdown',
  subject_id: 'math',
  block_index: 0,
  is_running: true,
  saved_at: 42,
  updated_at: '2026-05-22T08:15:00.000Z',
  ...overrides,
});

const lockdownResourceLibrary = [
  {
    id: 'resource_desmos_all',
    name: 'Desmos',
    url: 'https://www.desmos.com/calculator',
    assign_to_all_students: true,
  },
  {
    id: 'resource_khan_youtube',
    resource: {
      name: 'Khan Academy',
      url: 'https://www.youtube.com/watch?v=abc123',
      youtube_channel_id: 'UC4a-Gbdw7vOaccHmFo40b9g',
      youtube_channel_title: 'Khan Academy',
      youtube_channel_handle: '@khanacademy',
    },
    assignment: {
      student_ids: ['student_ada'],
    },
  },
  {
    id: 'resource_other_student',
    name: 'Other Student Resource',
    url: 'https://other.example.com/lesson',
    student_ids: ['student_grace'],
  },
  {
    id: 'resource_inactive_ada',
    name: 'Inactive Ada Resource',
    url: 'https://inactive.example.com/lesson',
    student_ids: ['student_ada'],
    is_active: false,
  },
];

const publishedStudent = buildStudentRecord();
const publishedWeeklyPlan = buildWeeklyPlan();
const activeTimerSession = buildTimerSession();
const schoolTime = new Date('2026-05-22T13:00:00.000Z');
const offHoursOpenTime = new Date('2026-05-22T18:30:00.000Z');
const offHoursClosedTime = new Date('2026-05-22T22:30:00.000Z');

assert.deepEqual(
  Object.values(FunctionProductionPolicyStates).sort(),
  Object.values(LockdownProductionPolicyStates).sort()
);
assert.deepEqual(
  Object.values(FunctionActiveWorkSessionKinds).sort(),
  Object.values(LockdownActiveWorkSessionKinds).sort()
);

const activePreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [activeTimerSession],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

assert.equal(activePreview.policy_state, LockdownPolicyStates.ACTIVE_BLOCK);
assert.equal(activePreview.policy_state_metadata.state, LockdownProductionPolicyStates.ACTIVE_BLOCK);
assert.equal(activePreview.policy_state_metadata.legacy_policy_state, LockdownPolicyStates.ACTIVE_BLOCK);
assert.equal(activePreview.policy_context.active_work_session.kind, LockdownActiveWorkSessionKinds.TIMER);
assert.equal(activePreview.policy_context.active_work_session.timer_session_id, 'timer_math_0');
assert.deepEqual(activePreview.policy.allowed_origins.sort(), [
  'https://www.desmos.com',
  'https://www.khanacademy.org',
]);
assert.deepEqual(
  activePreview.policy.allowed_youtube_channels.map((channel) => channel.channel_id),
  ['UC4a-Gbdw7vOaccHmFo40b9g']
);
assert.equal(
  activePreview.policy.allowed_origins.includes('https://inactive.example.com'),
  false
);

const activeFunctionPolicy = derivePublishedWeeklyPlanDevicePolicy({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [activeTimerSession],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

assert.equal(activeFunctionPolicy.policy_state, LockdownPolicyStates.ACTIVE_BLOCK);
assert.equal(activeFunctionPolicy.policy_state_metadata.state, FunctionProductionPolicyStates.ACTIVE_BLOCK);
assert.equal(activeFunctionPolicy.policy_context.state_context.state, activeFunctionPolicy.policy_state_metadata.state);
assert.equal(activeFunctionPolicy.policy_context.active_work_session.kind, FunctionActiveWorkSessionKinds.TIMER);
assert.equal(
  activeFunctionPolicy.policy.allowed_origins.includes('https://inactive.example.com'),
  false
);

const noActiveSessionPreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

assert.equal(noActiveSessionPreview.policy_state, LockdownPolicyStates.NO_ACTIVE_BLOCK);
assert.equal(noActiveSessionPreview.policy_state_metadata.state, LockdownProductionPolicyStates.NO_ACTIVE_SESSION);
assert.equal(noActiveSessionPreview.policy_state_metadata.active_work_session, null);
assert.deepEqual(noActiveSessionPreview.policy.allowed_origins, ['https://www.desmos.com']);
assert.deepEqual(
  noActiveSessionPreview.policy.allowed_youtube_channels.map((channel) => channel.channel_id),
  ['UC4a-Gbdw7vOaccHmFo40b9g']
);
assert.deepEqual(
  noActiveSessionPreview.policy_context.allowed_resource_groups.map((group) => group.source_kind),
  ['system', 'parent_approved', 'active_block']
);
assert.equal(noActiveSessionPreview.policy_context.allowed_resource_groups[1].is_currently_active, true);
assert.equal(noActiveSessionPreview.policy_context.allowed_resource_groups[1].items.length, 2);
assert.equal(noActiveSessionPreview.policy_context.allowed_resource_groups[2].items.length, 0);
assert.equal(noActiveSessionPreview.policy_context.schedule_summary.days_label, 'Mon, Tue, Wed, Thu, Fri');
assert.equal(noActiveSessionPreview.policy_context.schedule_summary.hours_label, '08:00 - 15:00');
assert.equal(noActiveSessionPreview.policy_context.schedule_summary.legacy_off_hours_window_count, 1);

const noActiveSessionFunctionPolicy = derivePublishedWeeklyPlanDevicePolicy({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

assert.equal(noActiveSessionFunctionPolicy.policy_state_metadata.state, FunctionProductionPolicyStates.NO_ACTIVE_SESSION);
assert.equal(noActiveSessionFunctionPolicy.policy_state_metadata.active_work_session, null);
assert.deepEqual(noActiveSessionFunctionPolicy.policy.allowed_origins, ['https://www.desmos.com']);

const noPublishedPlanPreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: null,
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

assert.equal(noPublishedPlanPreview.policy_state, LockdownPolicyStates.NO_ACTIVE_BLOCK);
assert.equal(noPublishedPlanPreview.policy_state_metadata.state, LockdownProductionPolicyStates.NO_PUBLISHED_PLAN);
assert.equal(noPublishedPlanPreview.policy_state_metadata.weekly_plan_exists, false);
assert.deepEqual(noPublishedPlanPreview.policy.allowed_origins, ['https://www.desmos.com']);

const draftPlanPreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: buildWeeklyPlan({ status: WeeklyPlanStatuses.DRAFT }),
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

assert.equal(draftPlanPreview.policy_state_metadata.state, LockdownProductionPolicyStates.NO_PUBLISHED_PLAN);
assert.equal(draftPlanPreview.policy_state_metadata.weekly_plan_exists, false);

const noPublishedPlanFunctionPolicy = derivePublishedWeeklyPlanDevicePolicy({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: null,
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

assert.equal(noPublishedPlanFunctionPolicy.policy_state_metadata.state, FunctionProductionPolicyStates.NO_PUBLISHED_PLAN);
assert.notEqual(noPublishedPlanFunctionPolicy.policy_state_metadata.state, noActiveSessionFunctionPolicy.policy_state_metadata.state);
assert.deepEqual(noPublishedPlanFunctionPolicy.policy.allowed_origins, ['https://www.desmos.com']);

const offHoursOpenPreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: offHoursOpenTime,
});

const offHoursClosedPreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: offHoursClosedTime,
});

assert.equal(offHoursOpenPreview.policy_state, LockdownPolicyStates.OUTSIDE_SCHOOL_TIME);
assert.equal(offHoursClosedPreview.policy_state, LockdownPolicyStates.OUTSIDE_SCHOOL_TIME);
assert.equal(offHoursOpenPreview.policy_state_metadata.state, LockdownProductionPolicyStates.OFF_HOURS_CLOSED);
assert.equal(offHoursClosedPreview.policy_state_metadata.state, LockdownProductionPolicyStates.OFF_HOURS_CLOSED);
assert.equal(offHoursOpenPreview.policy_state_metadata.state, offHoursClosedPreview.policy_state_metadata.state);
assert.equal(offHoursOpenPreview.policy.is_enabled, false);
assert.equal(offHoursClosedPreview.policy.is_enabled, false);
assert.deepEqual(offHoursOpenPreview.policy.allowed_origins, []);
assert.deepEqual(offHoursClosedPreview.policy.allowed_origins, []);
assert.ok(offHoursOpenPreview.policy_context.off_hours_window);
assert.equal(offHoursOpenPreview.policy_context.allowed_resource_groups[1].is_currently_active, false);
assert.match(
  offHoursOpenPreview.policy_context.allowed_resource_groups[1].description,
  /does not turn on outside-schedule blocking/i
);
assert.equal(
  offHoursOpenPreview.policy_context.allowed_resource_groups[2].description,
  'Block-specific resources only turn on during school time when a block is running.'
);

const offHoursOpenFunctionPolicy = derivePublishedWeeklyPlanDevicePolicy({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: offHoursOpenTime,
});

const offHoursClosedFunctionPolicy = derivePublishedWeeklyPlanDevicePolicy({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: offHoursClosedTime,
});

assert.equal(offHoursOpenFunctionPolicy.policy_state_metadata.state, FunctionProductionPolicyStates.OFF_HOURS_CLOSED);
assert.equal(offHoursClosedFunctionPolicy.policy_state_metadata.state, FunctionProductionPolicyStates.OFF_HOURS_CLOSED);
assert.equal(offHoursOpenFunctionPolicy.policy.is_enabled, false);
assert.equal(offHoursClosedFunctionPolicy.policy.is_enabled, false);
assert.deepEqual(offHoursOpenFunctionPolicy.policy.allowed_origins, []);
assert.deepEqual(offHoursClosedFunctionPolicy.policy.allowed_origins, []);
assert.equal(offHoursOpenFunctionPolicy.policy_context.allowed_resource_groups[1].is_currently_active, false);
assert.equal(offHoursOpenFunctionPolicy.policy_context.schedule_summary.legacy_off_hours_window_count, 1);

const clientNoActiveWorkState = normalizeLockdownPolicyStateMetadata({
  entitlement_active: true,
  in_school_time: true,
  weekly_plan_exists: true,
  active_work_state: LockdownProductionPolicyStates.NO_ACTIVE_WORK,
});
const functionNoActiveWorkState = normalizeLockdownPolicyStateContext({
  entitlementActive: true,
  weeklyPlan: publishedWeeklyPlan,
  timeContext: {
    inSchoolTime: true,
    schoolDayActive: true,
    localDate: '2026-05-22',
    localDay: 'Fri',
    localTime: '13:00',
  },
  activeWorkSession: {
    id: 'timer_paused',
    kind: FunctionActiveWorkSessionKinds.TIMER,
    status: 'paused',
    is_running: false,
  },
});

assert.equal(clientNoActiveWorkState.state, LockdownProductionPolicyStates.NO_ACTIVE_WORK);
assert.equal(functionNoActiveWorkState.state, FunctionProductionPolicyStates.NO_ACTIVE_WORK);
assert.notEqual(clientNoActiveWorkState.state, noPublishedPlanPreview.policy_state_metadata.state);

assert.equal(
  normalizeLockdownPolicyStateMetadata({ device_state: 'revoked' }).state,
  LockdownProductionPolicyStates.DEVICE_REVOKED
);
assert.equal(
  normalizeLockdownPolicyStateMetadata({ binding_status: 'binding_required' }).state,
  LockdownProductionPolicyStates.UNPAIRED
);
assert.equal(
  normalizeLockdownPolicyStateMetadata({ cache_state: 'stale' }).state,
  LockdownProductionPolicyStates.STALE_CACHED_POLICY
);
assert.equal(
  normalizeLockdownPolicyStateContext({
    entitlementActive: true,
    weeklyPlan: publishedWeeklyPlan,
    timeContext: { inSchoolTime: true },
    deviceStatus: 'revoked',
  }).state,
  FunctionProductionPolicyStates.DEVICE_REVOKED
);
assert.equal(
  normalizeLockdownPolicyStateContext({
    entitlementActive: true,
    weeklyPlan: publishedWeeklyPlan,
    timeContext: { inSchoolTime: true },
    bindingStatus: 'binding_required',
  }).state,
  FunctionProductionPolicyStates.UNPAIRED
);
assert.equal(
  normalizeLockdownPolicyStateContext({
    entitlementActive: true,
    weeklyPlan: publishedWeeklyPlan,
    timeContext: { inSchoolTime: true },
    cacheStatus: 'stale',
  }).state,
  FunctionProductionPolicyStates.STALE_CACHED_POLICY
);

const projectActiveWorkSession = normalizeLockdownActiveWorkSession({
  work_session_type: 'project_work',
  session_state: 'active',
  parent_id: 'parent_lockdown',
  student_id: 'student_ada',
  project_id: 'project_reading',
  project_work_id: 'project_reading_block_1',
  assignment_id: 'assignment_science',
  subject_id: 'science',
  block_index: 2,
  legacy_subject_id: 'science',
  legacy_block_index: 2,
  resource_ids: ['resource_1'],
  metadata: {
    source: 'project-launcher',
  },
});

const worksheetActiveWorkSession = normalizeFunctionActiveWorkSession({
  work_session_type: 'worksheet_work',
  session_state: 'active',
  parent_id: 'parent_lockdown',
  student_id: 'student_ada',
  worksheet_id: 'worksheet_algebra_1',
  worksheet_work_id: 'worksheet_algebra_1_response',
  assignment_id: 'assignment_math',
  subject_id: 'math',
  block_index: 3,
  legacy_subject_id: 'math',
  legacy_block_index: 3,
  resource_ids: ['resource_2'],
  metadata: {
    source: 'worksheet-launcher',
  },
});

assert.equal(projectActiveWorkSession.kind, LockdownActiveWorkSessionKinds.PROJECT);
assert.equal(projectActiveWorkSession.project_id, 'project_reading');
assert.equal(projectActiveWorkSession.project_work_id, 'project_reading_block_1');
assert.equal(projectActiveWorkSession.legacy_subject_id, 'science');
assert.equal(projectActiveWorkSession.legacy_block_index, 2);
assert.equal(projectActiveWorkSession.resource_ids[0], 'resource_1');
assert.equal(projectActiveWorkSession.metadata.source, 'project-launcher');
assert.notEqual(projectActiveWorkSession.project_id, projectActiveWorkSession.legacy_subject_id);

assert.equal(worksheetActiveWorkSession.kind, FunctionActiveWorkSessionKinds.WORKSHEET);
assert.equal(worksheetActiveWorkSession.worksheet_id, 'worksheet_algebra_1');
assert.equal(worksheetActiveWorkSession.worksheet_work_id, 'worksheet_algebra_1_response');
assert.equal(worksheetActiveWorkSession.legacy_subject_id, 'math');
assert.equal(worksheetActiveWorkSession.legacy_block_index, 3);
assert.equal(worksheetActiveWorkSession.resource_ids[0], 'resource_2');
assert.equal(worksheetActiveWorkSession.metadata.source, 'worksheet-launcher');
assert.notEqual(worksheetActiveWorkSession.worksheet_id, worksheetActiveWorkSession.legacy_subject_id);

console.log('Lockdown policy state checks passed.');
console.log(JSON.stringify({
  activeBlockState: activePreview.policy_state_metadata.state,
  schoolTimeNoWorkState: noActiveSessionPreview.policy_state_metadata.state,
  noPublishedPlanState: noPublishedPlanPreview.policy_state_metadata.state,
  noActiveWorkState: clientNoActiveWorkState.state,
  offHoursOpenState: offHoursOpenPreview.policy_state_metadata.state,
  offHoursClosedState: offHoursClosedPreview.policy_state_metadata.state,
  metadataStates: [
    LockdownProductionPolicyStates.DEVICE_REVOKED,
    LockdownProductionPolicyStates.UNPAIRED,
    LockdownProductionPolicyStates.STALE_CACHED_POLICY,
  ],
  activeWorkSessionKinds: [
    projectActiveWorkSession.kind,
    worksheetActiveWorkSession.kind,
  ],
}, null, 2));
