#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  buildLockdownParentSummaryViewModel,
  LockdownParentSummaryGuidanceKinds,
  LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS,
  LockdownPolicyStates,
} from '../src/utils/lockdownPolicyUtils.js';

const students = [
  { id: 'student_a', name: 'Ada', is_active: true },
  { id: 'student_b', name: 'Bea', is_active: true },
  { id: 'student_c', name: 'Cy', is_active: false },
];

const selectedStudentSchedule = {
  school_days: [1, 3, 5],
  off_hours_resource_windows: [
    {
      id: 'window_1',
      resources: [
        { name: 'Khan Academy', url: 'https://www.khanacademy.org/math' },
        {
          name: 'Crash Course Kids',
          url: 'https://www.youtube.com/@crashcoursekids',
          youtube_channel_handle: '@crashcoursekids',
        },
      ],
    },
    {
      id: 'window_2',
      resources: [
        { name: 'Desmos', url: 'https://www.desmos.com/calculator' },
      ],
    },
  ],
};

const selectedSummary = buildLockdownParentSummaryViewModel({
  referenceNow: Date.parse('2026-05-27T12:00:00.000Z'),
  students,
  selectedStudentId: 'student_a',
  selectedStudent: students[0],
  hasExplicitStudentSelection: true,
  selectedStudentSchedule,
  lockdownResourceLibrary: [
    {
      id: 'resource_desmos_all',
      name: 'Desmos',
      url: 'https://www.desmos.com/calculator',
      assign_to_all_students: true,
    },
    {
      id: 'resource_khan_youtube',
      name: 'Khan Academy',
      url: 'https://www.youtube.com/watch?v=abc123',
      youtube_channel_id: 'UC4a-Gbdw7vOaccHmFo40b9g',
      youtube_channel_title: 'Khan Academy',
      youtube_channel_handle: '@khanacademy',
      student_ids: ['student_a'],
    },
    {
      id: 'resource_bea_only',
      name: 'ReadWorks',
      url: 'https://www.readworks.org/article',
      student_ids: ['student_b'],
    },
    {
      id: 'resource_archived',
      name: 'Archived Resource',
      url: 'https://archived.example.com',
      assign_to_all_students: true,
      is_active: false,
    },
    {
      id: 'resource_inactive_student_only',
      name: 'Inactive Student Resource',
      url: 'https://inactive-student.example.com',
      student_ids: ['student_c'],
    },
  ],
  visibleLockdownDevices: [
    {
      device_id: 'dev_paired',
      status: 'active',
      student_id: 'student_a',
      last_seen_at: '2026-05-25T12:00:00.000Z',
    },
    {
      device_id: 'dev_stale',
      status: 'active',
      student_id: 'student_a',
      last_policy_read_at: '2026-05-20T12:00:00.000Z',
    },
    {
      device_id: 'dev_revoked',
      status: 'revoked',
      student_id: 'student_a',
      last_seen_at: '2026-05-20T12:00:00.000Z',
    },
    {
      device_id: 'dev_inactive',
      status: 'inactive',
      student_id: 'student_a',
      last_seen_at: '2026-05-26T12:00:00.000Z',
    },
  ],
  lockdownAccess: {
    canManagePolicy: true,
    canPairDevices: true,
    isReadOnly: false,
  },
  derivedPolicyPreview: {
    policy_state: LockdownPolicyStates.ACTIVE_BLOCK,
    policy: {
      allowed_origins: ['https://www.khanacademy.org', 'https://www.desmos.com'],
      allowed_youtube_channels: [{ channel_id: 'UCONtPx56PSebXJOxbFv-2jQ' }],
      system_resources: [{ name: 'Own Path student portal' }, { name: 'Own Path extension pages' }],
    },
    policy_context: {
      unsupported_resources: [{ name: 'Mystery Video', reason: 'youtube_channel_metadata_required' }],
    },
  },
});

assert.equal(selectedSummary.guidance.kind, LockdownParentSummaryGuidanceKinds.READY);
assert.equal(selectedSummary.selection.selected_student_name, 'Ada');
assert.equal(selectedSummary.schedule.school_day_count, 3);
assert.equal(selectedSummary.schedule.off_hours_window_count, 2);
assert.equal(selectedSummary.schedule.days_label, 'Mon, Wed, Fri');
assert.equal(selectedSummary.schedule.hours_label, '08:00 - 15:00');
assert.match(selectedSummary.schedule.legacy_off_hours_note, /do not turn on outside-schedule blocking/i);
assert.equal(selectedSummary.off_block_resources.total, 2);
assert.equal(selectedSummary.off_block_resources.websites, 1);
assert.equal(selectedSummary.off_block_resources.youtube_creators, 1);
assert.equal(selectedSummary.off_block_resources.active_library_total, 4);
assert.equal(selectedSummary.off_block_resources.archived_total, 1);
assert.equal(selectedSummary.off_block_resources.assigned_student_count, 2);
assert.equal(selectedSummary.devices.total, 4);
assert.equal(selectedSummary.devices.paired, 1);
assert.equal(selectedSummary.devices.stale, 1);
assert.equal(selectedSummary.devices.active, 1);
assert.equal(selectedSummary.devices.revoked, 1);
assert.equal(selectedSummary.devices.inactive, 1);
assert.equal(selectedSummary.devices.attention_needed, 3);
assert.equal(selectedSummary.devices.stale_threshold_days, LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS);
assert.equal(selectedSummary.allowed_right_now.state_label, 'Active block');
assert.equal(selectedSummary.allowed_right_now.allowed_origin_count, 2);
assert.equal(selectedSummary.allowed_right_now.allowed_creator_count, 1);
assert.equal(selectedSummary.allowed_right_now.source_groups.length, 0);
assert.equal(selectedSummary.actions.edit_schedule_disabled, false);
assert.equal(selectedSummary.actions.manage_resources_disabled, false);
assert.equal(selectedSummary.actions.manage_devices_disabled, false);
assert.equal(selectedSummary.actions.pair_browser_disabled, false);
assert.equal(selectedSummary.actions.allowed_right_now_disabled, false);

const readOnlySummary = buildLockdownParentSummaryViewModel({
  referenceNow: Date.parse('2026-05-27T12:00:00.000Z'),
  students: [students[0]],
  selectedStudentId: 'student_a',
  selectedStudent: students[0],
  selectedStudentSchedule: {
    school_days: [1],
    off_hours_resource_windows: [],
  },
  lockdownAccess: {
    canManagePolicy: false,
    canPairDevices: false,
    isReadOnly: true,
  },
  lockdownResourceLibrary: [
    {
      id: 'resource_single_student',
      name: 'Single Student',
      url: 'https://www.example.com',
      assign_to_all_students: true,
    },
  ],
});

assert.equal(readOnlySummary.permissions.is_read_only, true);
assert.equal(readOnlySummary.actions.edit_schedule_disabled, true);
assert.equal(readOnlySummary.actions.manage_resources_disabled, true);
assert.equal(readOnlySummary.actions.manage_devices_disabled, true);
assert.equal(readOnlySummary.actions.pair_browser_disabled, true);
assert.equal(readOnlySummary.actions.allowed_right_now_disabled, false);

const noStudentSummary = buildLockdownParentSummaryViewModel({
  referenceNow: Date.parse('2026-05-27T12:00:00.000Z'),
  students: [],
  lockdownAccess: {},
});

assert.equal(noStudentSummary.guidance.kind, LockdownParentSummaryGuidanceKinds.NO_STUDENTS);
assert.match(noStudentSummary.guidance.title, /Add a student/i);
assert.equal(noStudentSummary.actions.edit_schedule_disabled, true);
assert.equal(noStudentSummary.actions.pair_browser_disabled, true);

const multiStudentSelectionSummary = buildLockdownParentSummaryViewModel({
  referenceNow: Date.parse('2026-05-27T12:00:00.000Z'),
  students,
  selectedStudentId: '',
  hasExplicitStudentSelection: false,
  lockdownAccess: {
    canManagePolicy: true,
    canPairDevices: true,
  },
});

assert.equal(
  multiStudentSelectionSummary.guidance.kind,
  LockdownParentSummaryGuidanceKinds.EXPLICIT_SELECTION_REQUIRED
);
assert.equal(multiStudentSelectionSummary.selection.has_selected_student, false);
assert.equal(multiStudentSelectionSummary.actions.edit_schedule_disabled, true);
assert.equal(multiStudentSelectionSummary.actions.manage_devices_disabled, true);
assert.equal(multiStudentSelectionSummary.actions.allowed_right_now_disabled, true);

console.log('Lockdown parent summary view-model checks passed.');
