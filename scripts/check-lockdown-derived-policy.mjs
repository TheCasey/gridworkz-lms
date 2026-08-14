#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  WeeklyBlockCategories,
  WeeklyBlockCompletionModes,
  WeeklyPlanStatuses,
} from '../src/constants/schema.js';
import {
  deriveCurrentLockdownPolicyPreview,
  LockdownPolicyStates,
  LockdownProductionPolicyStates,
} from '../src/utils/lockdownPolicyUtils.js';
import {
  derivePublishedWeeklyPlanDevicePolicy,
  LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY as FunctionProductionPolicyStates,
} from '../functions/src/index.js';

process.env.VITE_PUBLIC_APP_HOST ||= 'own-path.com';
process.env.VITE_DASHBOARD_APP_HOST ||= 'dashboard.own-path.com';
process.env.VITE_FIREBASE_PROJECT_ID ||= 'gridworkz-lms-test';
process.env.VITE_FIREBASE_FUNCTIONS_REGION ||= 'us-central1';

const buildStudentRecord = (overrides = {}) => ({
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
        {
          name: 'Crash Course Kids',
          youtube_channel_id: 'UCONtPx56PSebXJOxbFv-2jQ',
          youtube_channel_title: 'Crash Course Kids',
          youtube_channel_handle: '@crashcoursekids',
          url: 'https://www.youtube.com/watch?v=abc123',
        },
        {
          name: 'Missing channel metadata',
          url: 'https://www.youtube.com/watch?v=def456',
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
  status: 'active',
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
      url: 'https://www.youtube.com/@khanacademy',
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
];

const simplifySystemResources = (resources = []) => (
  (Array.isArray(resources) ? resources : []).map((resource) => ({
    resource_type: resource.resource_type,
    name: resource.name,
    allowed: resource.allowed,
    origin: resource.origin,
    url: resource.url,
    decision: resource.decision,
    pages: Array.isArray(resource.pages) ? [...resource.pages] : [],
    urls: Array.isArray(resource.urls) ? [...resource.urls] : [],
  }))
);

const assertMatchingSystemResources = (label, clientPolicy, functionPolicy) => {
  assert.deepEqual(
    simplifySystemResources(clientPolicy.policy.system_resources),
    simplifySystemResources(functionPolicy.policy.system_resources),
    `${label}: system-resource contract diverged between client and function derivation`
  );

  const systemResources = clientPolicy.policy.system_resources || [];
  assert.ok(
    systemResources.some((resource) => resource.resource_type === 'decision' && resource.decision === 'excluded_from_system_allowlist'),
    `${label}: parent dashboard access must stay explicit in the system-resource contract`
  );
  assert.ok(
    systemResources.some((resource) => resource.resource_type === 'origin' && resource.allowed !== false),
    `${label}: system-resource allowlist should include at least one allowed origin`
  );
};

const assertPolicyParity = (label, clientPolicy, functionPolicy) => {
  assert.equal(
    clientPolicy.policy_state_metadata.state,
    functionPolicy.policy_state_metadata.state,
    `${label}: client preview and trusted function state metadata diverged`
  );
  assert.equal(
    clientPolicy.policy_state,
    functionPolicy.policy_state,
    `${label}: legacy compatibility policy_state diverged`
  );
  assertMatchingSystemResources(label, clientPolicy, functionPolicy);
  assert.deepEqual(
    clientPolicy.policy_context.allowed_resource_groups,
    functionPolicy.policy_context.allowed_resource_groups,
    `${label}: allowed-resource source groups diverged`
  );
  assert.deepEqual(
    clientPolicy.policy_context.schedule_summary,
    functionPolicy.policy_context.schedule_summary,
    `${label}: schedule summary diverged`
  );
};

const publishedStudent = buildStudentRecord();
const publishedWeeklyPlan = buildWeeklyPlan();
const activeTimerSession = buildTimerSession();
const pausedTimerSession = buildTimerSession({
  id: 'timer_math_0_paused',
  is_running: false,
  status: 'paused',
  saved_at: 84,
  updated_at: '2026-05-22T08:20:00.000Z',
});
const schoolTime = new Date('2026-05-22T13:00:00.000Z');
const offHoursOpenTime = new Date('2026-05-22T18:30:00.000Z');
const offHoursClosedTime = new Date('2026-05-22T22:30:00.000Z');

const activePreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [activeTimerSession],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

const activeFunctionPolicy = derivePublishedWeeklyPlanDevicePolicy({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [activeTimerSession],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

assertPolicyParity('active block', activePreview, activeFunctionPolicy);
assert.equal(activePreview.policy_state_metadata.state, LockdownProductionPolicyStates.ACTIVE_BLOCK);
assert.deepEqual(activePreview.policy.allowed_origins.sort(), [
  'https://www.desmos.com',
  'https://www.khanacademy.org',
]);
assert.deepEqual(
  activePreview.policy.allowed_youtube_channels.map((channel) => channel.channel_id).sort(),
  [
    'UC4a-Gbdw7vOaccHmFo40b9g',
    'UCONtPx56PSebXJOxbFv-2jQ',
  ]
);
assert.ok(activePreview.policy_context.unsupported_resources.length >= 1);
assert.equal(activePreview.policy_context.unsupported_resources[0].reason, 'youtube_channel_metadata_required');
assert.deepEqual(
  activePreview.policy_context.allowed_resource_groups.map((group) => [group.source_kind, group.items.length]),
  [['system', activePreview.policy.system_resources.length], ['parent_approved', 2], ['active_block', 2]]
);

const pausedPreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [pausedTimerSession],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

const pausedFunctionPolicy = derivePublishedWeeklyPlanDevicePolicy({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [pausedTimerSession],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

assertPolicyParity('school time no active work', pausedPreview, pausedFunctionPolicy);
assert.equal(pausedPreview.policy_state_metadata.state, LockdownProductionPolicyStates.NO_ACTIVE_WORK);
assert.deepEqual(pausedPreview.policy.allowed_origins, ['https://www.desmos.com']);
assert.deepEqual(
  pausedPreview.policy.allowed_youtube_channels.map((channel) => channel.channel_id),
  ['UC4a-Gbdw7vOaccHmFo40b9g']
);

const offHoursOpenPreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: offHoursOpenTime,
});

const offHoursOpenFunctionPolicy = derivePublishedWeeklyPlanDevicePolicy({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: offHoursOpenTime,
});

assertPolicyParity('off-hours open', offHoursOpenPreview, offHoursOpenFunctionPolicy);
assert.equal(offHoursOpenPreview.policy_state_metadata.state, LockdownProductionPolicyStates.OFF_HOURS_CLOSED);
assert.equal(offHoursOpenPreview.policy.is_enabled, false);
assert.deepEqual(offHoursOpenPreview.policy.allowed_origins, []);
assert.deepEqual(offHoursOpenPreview.policy.allowed_youtube_channels, []);
assert.equal(offHoursOpenPreview.policy_context.allowed_resource_groups[0].is_currently_active, false);
assert.equal(offHoursOpenPreview.policy_context.allowed_resource_groups[1].is_currently_active, false);
assert.match(offHoursOpenPreview.policy_context.allowed_resource_groups[1].description, /saved for school time/i);
assert.equal(offHoursOpenPreview.policy_context.schedule_summary.legacy_off_hours_window_count, 1);

const offHoursClosedPreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: true,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [],
  lockdownResourceLibrary,
  referenceDate: offHoursClosedTime,
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

assertPolicyParity('off-hours closed', offHoursClosedPreview, offHoursClosedFunctionPolicy);
assert.equal(offHoursClosedPreview.policy_state_metadata.state, LockdownProductionPolicyStates.OFF_HOURS_CLOSED);
assert.equal(offHoursClosedPreview.policy.is_enabled, false);
assert.equal(offHoursClosedFunctionPolicy.policy.is_enabled, false);
assert.deepEqual(offHoursClosedPreview.policy.allowed_origins, []);
assert.deepEqual(offHoursClosedPreview.policy.allowed_youtube_channels, []);
assert.equal(offHoursClosedPreview.policy_context.allowed_resource_groups[2].items.length, 0);

const entitlementInactivePreview = deriveCurrentLockdownPolicyPreview({
  entitlementActive: false,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [activeTimerSession],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

const entitlementInactiveFunctionPolicy = derivePublishedWeeklyPlanDevicePolicy({
  entitlementActive: false,
  parentId: publishedStudent.parent_id,
  studentRecord: publishedStudent,
  weeklyPlan: publishedWeeklyPlan,
  timerSessions: [activeTimerSession],
  lockdownResourceLibrary,
  referenceDate: schoolTime,
});

assertPolicyParity('entitlement inactive', entitlementInactivePreview, entitlementInactiveFunctionPolicy);
assert.equal(entitlementInactivePreview.policy_state_metadata.state, LockdownProductionPolicyStates.ENTITLEMENT_INACTIVE);
assert.equal(entitlementInactivePreview.policy.allowed_origins.length, 0);
assert.equal(entitlementInactivePreview.policy.allowed_youtube_channels.length, 0);
assert.ok(entitlementInactivePreview.policy_context.local_time);
assert.ok(entitlementInactivePreview.policy_context.local_date);
assert.ok(entitlementInactivePreview.policy_context.system_resources.length > 0);

console.log('Lockdown derived policy checks passed.');
console.log(JSON.stringify({
  activeBlockState: activePreview.policy_state_metadata.state,
  noActiveWorkState: pausedPreview.policy_state_metadata.state,
  offHoursOpenState: offHoursOpenPreview.policy_state_metadata.state,
  offHoursClosedState: offHoursClosedPreview.policy_state_metadata.state,
  entitlementInactiveState: entitlementInactivePreview.policy_state_metadata.state,
  systemResources: simplifySystemResources(activePreview.policy.system_resources),
  legacyPolicyStates: [
    LockdownPolicyStates.ACTIVE_BLOCK,
    LockdownPolicyStates.NO_ACTIVE_BLOCK,
    LockdownPolicyStates.OUTSIDE_SCHOOL_TIME,
    LockdownPolicyStates.ENTITLEMENT_INACTIVE,
  ],
  productionPolicyStates: [
    LockdownProductionPolicyStates.ACTIVE_BLOCK,
    LockdownProductionPolicyStates.NO_ACTIVE_SESSION,
    LockdownProductionPolicyStates.NO_PUBLISHED_PLAN,
    LockdownProductionPolicyStates.NO_ACTIVE_WORK,
    LockdownProductionPolicyStates.OFF_HOURS_OPEN,
    LockdownProductionPolicyStates.OFF_HOURS_CLOSED,
    LockdownProductionPolicyStates.ENTITLEMENT_INACTIVE,
  ],
  functionProductionStates: Object.values(FunctionProductionPolicyStates),
}, null, 2));
