#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { WeeklyPlanStatuses } from '../src/constants/schema.js';
import {
  buildStudentWeeklySnapshot,
  buildWeeklyReportPayload,
  canSaveWeeklyReportSnapshot,
} from '../src/utils/reportUtils.js';
import { buildWeeklyPlanDocumentId } from '../src/utils/weeklyPlanUtils.js';
import { formatWeekRange, getCurrentWeekRange, getWeekKey } from '../src/utils/weekUtils.js';

const DEFAULT_OUTPUT_PATH = '/tmp/gridworkz-reporting-validation-fixture.json';
const DEFAULT_TIMEZONE = 'America/Chicago';

const parseArgs = (argv) => {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
};

const ensureDirectory = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const isoDate = (value) => (
  value instanceof Date
    ? value.toISOString()
    : value
);

const toSerializable = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }

  if (value && typeof value === 'object') {
    if (value._methodName === 'serverTimestamp') {
      return '<serverTimestamp()>';
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toSerializable(nestedValue)])
    );
  }

  return value;
};

const buildSubject = ({ parentId, studentId, id, title, color }) => ({
  id,
  parent_id: parentId,
  student_ids: [studentId],
  student_id: studentId,
  title,
  block_count: 2,
  block_length: 30,
  color,
  require_timer: false,
  require_input: true,
  resources: [
    {
      name: `${title} Resource`,
      url: 'https://example.com/gridworkz-validation-resource',
      lockdown_origin: '',
      youtube_channel_id: '',
      youtube_channel_title: '',
      youtube_channel_handle: '',
    },
  ],
  custom_fields: [
    {
      id: `${id}_reflection`,
      type: 'text',
      label: 'What did you notice?',
      placeholder: 'Short reflection',
      required: false,
    },
  ],
  block_objectives: {
    0: {
      instruction: `Complete the first ${title} validation block.`,
      custom_fields: [],
      student_overrides: {},
    },
    1: {
      instruction: `Complete the second ${title} validation block.`,
      custom_fields: [],
      student_overrides: {},
    },
  },
  is_active: true,
});

const buildStudent = ({ parentId, id, name, slug }) => ({
  id,
  parent_id: parentId,
  name,
  slug,
  access_pin: null,
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: DEFAULT_TIMEZONE,
  is_active: true,
});

const buildWeeklyPlan = ({
  parentId,
  student,
  subject,
  weekStart,
  weekEnd,
  publishedAt,
}) => {
  const weekKey = getWeekKey(weekStart);
  const assignmentId = `legacy-assignment_${student.id}_${subject.id}`;

  return {
    id: buildWeeklyPlanDocumentId({
      parentId,
      studentId: student.id,
      weekKey,
    }),
    parent_id: parentId,
    student_id: student.id,
    week_key: weekKey,
    week_start: weekStart,
    week_end: weekEnd,
    status: WeeklyPlanStatuses.PUBLISHED,
    assignment_ids: [assignmentId],
    weekly_exceptions: [],
    blocks: [0, 1].map((blockIndex) => ({
      id: `${assignmentId}_block_${blockIndex}`,
      assignment_id: assignmentId,
      student_id: student.id,
      title: `${subject.title} Block ${blockIndex + 1}`,
      instruction: subject.block_objectives[blockIndex]?.instruction || '',
      resources: subject.resources,
      custom_fields: subject.custom_fields,
      category: blockIndex === 0 ? 'lesson' : 'practice',
      completion_mode: blockIndex === 0 ? 'time_boxed' : 'task_complete',
      planned_duration_minutes: subject.block_length,
      require_timer: subject.require_timer,
      require_input: subject.require_input,
      legacy_subject_id: subject.id,
      legacy_subject_title: subject.title,
      legacy_block_index: blockIndex,
    })),
    published_at: publishedAt,
    archived_at: null,
  };
};

const buildSubmission = ({
  parentId,
  student,
  subject,
  timestamp,
  blockIndex = 0,
  summaryText,
}) => ({
  id: `reporting_validation_submission_${student.id}_${blockIndex}`,
  parent_id: parentId,
  student_id: student.id,
  subject_id: subject.id,
  block_index: blockIndex,
  block_duration: 30,
  summary_text: summaryText,
  timestamp,
  manual_override: false,
  resources_used: subject.resources,
  custom_field_responses: {
    [`${subject.id}_reflection`]: 'Fixture response for reporting validation.',
  },
});

const buildReportCase = ({
  label,
  parentId,
  parentSettings,
  student,
  subject,
  weeklyPlan,
  submissions,
  weekStart,
  weekEnd,
  recordSource,
  shouldArchivePlan,
}) => {
  const snapshot = buildStudentWeeklySnapshot({
    student,
    subjects: [subject],
    submissions,
    weekStart,
    weekEnd,
    weeklyPlan,
  });
  const reportId = `${parentId}_${student.id}_${getWeekKey(weekStart)}`;
  const payload = buildWeeklyReportPayload({
    student,
    snapshot,
    weekStart,
    weekEnd,
    parentId,
    parentSettings,
    source: recordSource,
  });

  return {
    label,
    record_id: reportId,
    student_id: student.id,
    student_name: student.name,
    student_portal_path: `/student/${student.slug}`,
    week_key: getWeekKey(weekStart),
    week_range: formatWeekRange(weekStart, weekEnd),
    weekly_plan_id: weeklyPlan.id,
    snapshot_model: snapshot.snapshotModel,
    assigned_blocks: snapshot.goalBlocks,
    completed_blocks: snapshot.totalBlocks,
    assigned_blocks_snapshot_count: snapshot.assignedBlocksSnapshot.length,
    can_save_official_record: canSaveWeeklyReportSnapshot(snapshot),
    expected_weekly_plan_status_after_rollover: shouldArchivePlan
      ? WeeklyPlanStatuses.ARCHIVED
      : WeeklyPlanStatuses.PUBLISHED,
    firestore_paths: {
      student: `students/${student.id}`,
      subject: `subjects/${subject.id}`,
      weekly_plan: `weeklyPlans/${weeklyPlan.id}`,
      weekly_report: `weeklyReports/${reportId}`,
      submissions: submissions.map((submission) => `submissions/${submission.id}`),
    },
    live_report_expectation: `${snapshot.totalBlocks}/${snapshot.goalBlocks} blocks`,
    saved_report_payload: toSerializable(payload),
  };
};

const printHelp = () => {
  console.log(`Usage:
  node scripts/seed-reporting-validation.mjs --dry-run [--output /tmp/gridworkz-reporting-validation-fixture.json]

Options:
  --dry-run        Build and write a local fixture summary without Firebase credentials.
  --output <path>  JSON artifact path. Defaults to ${DEFAULT_OUTPUT_PATH}.
  --as-of <date>   Reference date for current/previous week math. Defaults to now.
  --help           Show this help text.

Live writes are intentionally not implemented in this script. Use the generated
document paths and payload summaries as the runbook for emulator/staging/live QA.`);
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args['dry-run']) {
    throw new Error('This fixture is dry-run only. Re-run with --dry-run to generate the validation artifact.');
  }

  const referenceDate = args['as-of'] ? new Date(args['as-of']) : new Date();
  if (Number.isNaN(referenceDate.getTime())) {
    throw new Error(`Invalid --as-of date: ${args['as-of']}`);
  }

  const outputPath = args.output || DEFAULT_OUTPUT_PATH;
  const parentId = 'reporting_validation_parent';
  const parentSettings = {
    uid: parentId,
    email: 'reporting.validation@example.com',
    school_name: 'GridWorkz Reporting Validation',
    school_year_start: '',
    school_year_end: '',
    week_reset_day: 1,
    week_reset_hour: 0,
    week_reset_minute: 0,
    timezone: DEFAULT_TIMEZONE,
    last_rollover_week_key: '',
  };
  const { weekStart: currentWeekStart, weekEnd: currentWeekEnd } = getCurrentWeekRange(referenceDate, parentSettings);
  const previousWeekReferenceDate = new Date(currentWeekStart.getTime() - 1);
  const { weekStart: previousWeekStart, weekEnd: previousWeekEnd } = getCurrentWeekRange(
    previousWeekReferenceDate,
    parentSettings
  );

  const createdAt = referenceDate;
  const submittedAt = new Date(currentWeekStart.getTime() + (36 * 60 * 60 * 1000));
  const previousSubmittedAt = new Date(previousWeekStart.getTime() + (36 * 60 * 60 * 1000));
  const zeroStudent = buildStudent({
    parentId,
    id: 'reporting_validation_zero',
    name: 'Reporting Validation Zero',
    slug: 'reporting-validation-zero',
  });
  const submittedStudent = buildStudent({
    parentId,
    id: 'reporting_validation_one',
    name: 'Reporting Validation One',
    slug: 'reporting-validation-one',
  });
  const rolloverStudent = buildStudent({
    parentId,
    id: 'reporting_validation_rollover',
    name: 'Reporting Validation Rollover',
    slug: 'reporting-validation-rollover',
  });
  const zeroSubject = buildSubject({
    parentId,
    studentId: zeroStudent.id,
    id: 'reporting_validation_zero_math',
    title: 'Fixture Math Zero',
    color: '#7c3aed',
  });
  const submittedSubject = buildSubject({
    parentId,
    studentId: submittedStudent.id,
    id: 'reporting_validation_one_reading',
    title: 'Fixture Reading One',
    color: '#2563eb',
  });
  const rolloverSubject = buildSubject({
    parentId,
    studentId: rolloverStudent.id,
    id: 'reporting_validation_rollover_science',
    title: 'Fixture Science Rollover',
    color: '#059669',
  });
  const zeroPlan = buildWeeklyPlan({
    parentId,
    student: zeroStudent,
    subject: zeroSubject,
    weekStart: currentWeekStart,
    weekEnd: currentWeekEnd,
    publishedAt: createdAt,
  });
  const submittedPlan = buildWeeklyPlan({
    parentId,
    student: submittedStudent,
    subject: submittedSubject,
    weekStart: currentWeekStart,
    weekEnd: currentWeekEnd,
    publishedAt: createdAt,
  });
  const rolloverPlan = buildWeeklyPlan({
    parentId,
    student: rolloverStudent,
    subject: rolloverSubject,
    weekStart: previousWeekStart,
    weekEnd: previousWeekEnd,
    publishedAt: previousWeekStart,
  });
  const currentSubmission = buildSubmission({
    parentId,
    student: submittedStudent,
    subject: submittedSubject,
    timestamp: submittedAt,
    summaryText: 'Completed one fixture reading block for the reporting validation run.',
  });
  const previousSubmission = buildSubmission({
    parentId,
    student: rolloverStudent,
    subject: rolloverSubject,
    timestamp: previousSubmittedAt,
    summaryText: 'Completed one previous-week science block before rollover archival.',
  });
  const cases = [
    buildReportCase({
      label: 'current-week published weekly plan with zero submissions',
      parentId,
      parentSettings,
      student: zeroStudent,
      subject: zeroSubject,
      weeklyPlan: zeroPlan,
      submissions: [],
      weekStart: currentWeekStart,
      weekEnd: currentWeekEnd,
      recordSource: 'manual',
      shouldArchivePlan: false,
    }),
    buildReportCase({
      label: 'current-week published weekly plan with one submission',
      parentId,
      parentSettings,
      student: submittedStudent,
      subject: submittedSubject,
      weeklyPlan: submittedPlan,
      submissions: [currentSubmission],
      weekStart: currentWeekStart,
      weekEnd: currentWeekEnd,
      recordSource: 'manual',
      shouldArchivePlan: false,
    }),
    buildReportCase({
      label: 'previous-week published weekly plan for rollover archival',
      parentId,
      parentSettings,
      student: rolloverStudent,
      subject: rolloverSubject,
      weeklyPlan: rolloverPlan,
      submissions: [previousSubmission],
      weekStart: previousWeekStart,
      weekEnd: previousWeekEnd,
      recordSource: 'automatic',
      shouldArchivePlan: true,
    }),
  ];
  const fixture = {
    fixture_name: 'reporting-safety-phase-4-runtime-validation',
    mode: 'dry-run',
    generated_at: new Date().toISOString(),
    reference_date: isoDate(referenceDate),
    live_seed_supported: false,
    live_seed_note: 'This script does not perform Firebase writes. Use the fixture summary as a runbook for emulator/staging/live QA and seed manually or with an intentionally reviewed write script.',
    routes_to_validate: {
      reports: 'http://localhost:3000/dashboard/reports',
      student_portals: cases.map((testCase) => `http://localhost:3000${testCase.student_portal_path}`),
    },
    parent_settings: parentSettings,
    source_documents: {
      parents: [`parents/${parentId}`],
      students: [zeroStudent, submittedStudent, rolloverStudent].map((student) => `students/${student.id}`),
      subjects: [zeroSubject, submittedSubject, rolloverSubject].map((subject) => `subjects/${subject.id}`),
      weekly_plans: [zeroPlan, submittedPlan, rolloverPlan].map((plan) => `weeklyPlans/${plan.id}`),
      submissions: [
        `submissions/${currentSubmission.id}`,
        `submissions/${previousSubmission.id}`,
      ],
    },
    fixture_documents: toSerializable({
      parent: parentSettings,
      students: [zeroStudent, submittedStudent, rolloverStudent],
      subjects: [zeroSubject, submittedSubject, rolloverSubject],
      weeklyPlans: [zeroPlan, submittedPlan, rolloverPlan],
      submissions: [currentSubmission, previousSubmission],
    }),
    validation_cases: cases,
    manual_qa_checklist: [
      'Sign in as the fixture parent in an emulator/staging/live project where these documents have been seeded.',
      'Open /dashboard/reports and verify the current-week zero-submission card shows 0/2 assigned blocks and can save an official record.',
      'Open /dashboard/reports and verify the current-week one-submission card shows 1/2 blocks, one summary, and an assigned block snapshot with one incomplete block.',
      'Save official records for the current-week cases and verify weeklyReports payloads preserve snapshot_model, weekly_plan_id, subjects_data, assigned_blocks_snapshot, and attachments: [].',
      'Open each /student/:slug route and verify the current published plan appears in the portal.',
      'Trigger or wait for weekly rollover, then verify the previous-week report is written with record_source automatic and the previous weekly plan is archived.',
      'Print one live report and one saved official record to verify escaped report output and expected totals.',
    ],
  };

  ensureDirectory(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    output_path: outputPath,
    mode: fixture.mode,
    live_seed_supported: fixture.live_seed_supported,
    reports_route: fixture.routes_to_validate.reports,
    student_portal_routes: fixture.routes_to_validate.student_portals,
    validation_cases: cases.map((testCase) => ({
      label: testCase.label,
      weekly_plan: testCase.firestore_paths.weekly_plan,
      weekly_report: testCase.firestore_paths.weekly_report,
      expected_live_report: testCase.live_report_expectation,
      can_save_official_record: testCase.can_save_official_record,
      expected_weekly_plan_status_after_rollover: testCase.expected_weekly_plan_status_after_rollover,
      assigned_blocks_snapshot_count: testCase.assigned_blocks_snapshot_count,
    })),
    manual_follow_up_required: [
      'emulator/staging/live document seeding',
      'authenticated Reports save and print check',
      'Student Portal published-plan check',
      'previous-week rollover archival check',
    ],
  }, null, 2));
};

main();
