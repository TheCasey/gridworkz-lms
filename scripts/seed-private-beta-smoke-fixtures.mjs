#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import apiv2 from 'firebase-tools/lib/apiv2.js';
import requireAuthMod from 'firebase-tools/lib/requireAuth.js';
import { WeeklyPlanStatuses } from '../src/constants/schema.js';
import { buildWeeklyPlanDocumentId } from '../src/utils/weeklyPlanUtils.js';
import { getCurrentWeekRange, getWeekKey } from '../src/utils/weekUtils.js';

const DEFAULT_OUTPUT_PATH = '/tmp/gridworkz-private-beta-smoke-fixtures.json';
const DEFAULT_PROJECT_ID = 'gridworkz-lms';
const DEFAULT_TIMEZONE = 'America/Chicago';
const DEFAULT_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const DEFAULT_FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const FIREBASE_CONFIGSTORE_PATH = path.join(
  process.env.HOME || '',
  '.config',
  'configstore',
  'firebase-tools.json'
);

const PlanIds = Object.freeze({
  FREE: 'free',
  CORE: 'core',
  LOCKDOWN: 'lockdown',
});

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

const readDotEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .reduce((resolved, line) => {
      const separatorIndex = line.indexOf('=');
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
      resolved[key] = value;
      return resolved;
    }, {});
};

const readFirebaseCliConfig = () => {
  if (!fs.existsSync(FIREBASE_CONFIGSTORE_PATH)) {
    throw new Error(
      `Firebase CLI config was not found at ${FIREBASE_CONFIGSTORE_PATH}. Run "firebase login" first.`
    );
  }

  return JSON.parse(fs.readFileSync(FIREBASE_CONFIGSTORE_PATH, 'utf8'));
};

const ensureDirectory = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const sanitizeIdFragment = (value) => (
  String(value || 'fixture')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'fixture'
);

const buildGeneratedEmail = (prefix) => {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${prefix}.${timestamp}.${suffix}@example.com`;
};

const buildGeneratedPassword = () => (
  `Gridworkz!${crypto.randomBytes(6).toString('hex')}`
);

const normalizePlanId = (value) => (
  Object.values(PlanIds).includes(value) ? value : PlanIds.LOCKDOWN
);

const getFirestoreValue = (value) => {
  if (value === null) {
    return { nullValue: null };
  }

  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(getFirestoreValue).filter(Boolean),
      },
    };
  }

  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .map(([key, nestedValue]) => [key, getFirestoreValue(nestedValue)])
            .filter(([, nestedValue]) => Boolean(nestedValue))
        ),
      },
    };
  }

  throw new Error(`Unsupported Firestore seed value: ${String(value)}`);
};

const toSerializable = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toSerializable(nestedValue)])
    );
  }

  return value;
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Request failed: HTTP ${response.status} ${url} ${JSON.stringify(body)}`);
  }

  return body;
};

const getGoogleOauthToken = async (projectId) => {
  const firebaseCliConfig = readFirebaseCliConfig();
  const options = {
    project: projectId,
    user: firebaseCliConfig.user,
    tokens: firebaseCliConfig.tokens,
  };

  await requireAuthMod.requireAuth(options);
  return apiv2.getAccessToken();
};

const getAuthBaseUrl = ({ target, authEmulatorHost }) => (
  target === 'emulator'
    ? `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1`
    : 'https://identitytoolkit.googleapis.com/v1'
);

const signUpWithPassword = async ({
  authBaseUrl,
  apiKey,
  email,
  password,
}) => fetchJson(`${authBaseUrl}/accounts:signUp?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    password,
    returnSecureToken: true,
  }),
});

const signInWithPassword = async ({
  authBaseUrl,
  apiKey,
  email,
  password,
}) => fetchJson(`${authBaseUrl}/accounts:signInWithPassword?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    password,
    returnSecureToken: true,
  }),
});

const signUpOrReusePasswordAccount = async ({
  authBaseUrl,
  apiKey,
  email,
  password,
}) => {
  try {
    const signUpResult = await signUpWithPassword({
      authBaseUrl,
      apiKey,
      email,
      password,
    });

    return {
      ...signUpResult,
      createdNewAuthUser: true,
    };
  } catch (error) {
    if (!String(error.message).includes('EMAIL_EXISTS')) {
      throw error;
    }

    const signInResult = await signInWithPassword({
      authBaseUrl,
      apiKey,
      email,
      password,
    });

    return {
      ...signInResult,
      createdNewAuthUser: false,
    };
  }
};

const getFirestoreBaseUrl = ({ target, projectId, firestoreEmulatorHost }) => (
  target === 'emulator'
    ? `http://${firestoreEmulatorHost}/v1/projects/${projectId}/databases/(default)/documents`
    : `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
);

const patchDocument = async ({
  firestoreBaseUrl,
  documentPath,
  fields,
  authHeader,
}) => fetchJson(`${firestoreBaseUrl}/${documentPath}`, {
  method: 'PATCH',
  headers: {
    Authorization: authHeader,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fields: Object.fromEntries(
      Object.entries(fields)
        .map(([key, value]) => [key, getFirestoreValue(value)])
        .filter(([, value]) => Boolean(value))
    ),
  }),
});

const buildParent = ({
  parentId,
  email,
  now,
}) => ({
  uid: parentId,
  email,
  school_name: 'Private Beta Smoke Household',
  school_year_start: '',
  school_year_end: '',
  week_start_day: 1,
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: DEFAULT_TIMEZONE,
  last_rollover_week_key: '',
  created_at: now,
  updated_at: now,
});

const buildStudent = ({
  parentId,
  id,
  name,
  slug,
  pin,
  now,
}) => ({
  parent_id: parentId,
  name,
  slug,
  access_pin: pin,
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: DEFAULT_TIMEZONE,
  lockdown_schedule: {
    timezone: DEFAULT_TIMEZONE,
    school_days: [1, 2, 3, 4, 5],
    school_day_start_time: '08:00',
    school_day_end_time: '15:00',
    off_hours_resource_windows: [
      {
        id: `${id}_reading_window`,
        label: 'Smoke Reading Window',
        days: [0, 1, 2, 3, 4, 5, 6],
        start_time: '00:00',
        end_time: '23:59',
        resources: [
          {
            name: 'Khan Academy',
            url: 'https://www.khanacademy.org/',
            lockdown_origin: 'https://www.khanacademy.org',
            youtube_channel_id: '',
            youtube_channel_title: '',
            youtube_channel_handle: '',
          },
        ],
      },
    ],
  },
  is_active: true,
  created_at: now,
  updated_at: now,
});

const buildSubject = ({
  parentId,
  studentId,
  id,
  title,
  color,
  now,
  active = true,
}) => ({
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
      name: `${title} resource`,
      url: 'https://example.com/gridworkz-private-beta-smoke',
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
      label: 'Fixture reflection',
      placeholder: 'Short answer',
      required: false,
    },
  ],
  block_objectives: {
    0: {
      instruction: `Complete the first ${title} fixture block.`,
      custom_fields: [],
      student_overrides: {},
    },
    1: {
      instruction: `Complete the second ${title} fixture block.`,
      custom_fields: [],
      student_overrides: {},
    },
  },
  is_active: active,
  created_at: now,
  updated_at: now,
});

const buildWeeklyPlan = ({
  parentId,
  studentId,
  subjectId,
  subjectTitle,
  subject,
  weekStart,
  weekEnd,
  now,
}) => {
  const weekKey = getWeekKey(weekStart);
  const assignmentId = `smoke_assignment_${studentId}_${subjectId}`;

  return {
    parent_id: parentId,
    student_id: studentId,
    week_key: weekKey,
    week_start: weekStart,
    week_end: weekEnd,
    status: WeeklyPlanStatuses.PUBLISHED,
    assignment_ids: [assignmentId],
    weekly_exceptions: [],
    blocks: [0, 1].map((blockIndex) => ({
      id: `${assignmentId}_block_${blockIndex}`,
      assignment_id: assignmentId,
      student_id: studentId,
      title: `${subjectTitle} Block ${blockIndex + 1}`,
      instruction: subject.block_objectives[blockIndex]?.instruction || '',
      resources: subject.resources,
      custom_fields: subject.custom_fields,
      category: blockIndex === 0 ? 'lesson' : 'practice',
      completion_mode: blockIndex === 0 ? 'time_boxed' : 'task_complete',
      planned_duration_minutes: subject.block_length,
      require_timer: subject.require_timer,
      require_input: subject.require_input,
      legacy_subject_id: subjectId,
      legacy_subject_title: subjectTitle,
      legacy_block_index: blockIndex,
    })),
    published_at: now,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };
};

const buildSubmission = ({
  parentId,
  studentId,
  subjectId,
  subjectTitle,
  timestamp,
  blockIndex,
}) => ({
  parent_id: parentId,
  student_id: studentId,
  subject_id: subjectId,
  subject_name: subjectTitle,
  block_index: blockIndex,
  block_duration: 30,
  summary_text: `Private beta smoke completion for ${subjectTitle} block ${blockIndex + 1}.`,
  timestamp,
  manual_override: false,
  resources_used: [],
  custom_field_responses: {},
  created_at: timestamp,
});

const buildEntitlement = ({
  parentId,
  planId,
  usageSnapshot,
  now,
}) => {
  const billingState = {
    plan_id: planId,
    subscription_status: 'active',
    billing_provider: 'stripe',
    feature_overrides: {},
    trial_ends_at: null,
    current_period_end: null,
    updated_at: now,
  };

  return {
    parent_id: parentId,
    plan_id: planId,
    subscription_status: 'active',
    billing_provider: 'stripe',
    feature_overrides: {},
    usage_snapshot: usageSnapshot,
    trial_ends_at: null,
    current_period_end: null,
    resolution_source: 'billing',
    updated_via: 'billing_webhook',
    billing_state: billingState,
    manual_override: null,
    updated_at: now,
  };
};

const buildFixtureDocuments = ({
  parentId,
  parentEmail,
  operatorUid,
  operatorEmail,
  planId,
  now,
  referenceDate,
}) => {
  const idFragment = sanitizeIdFragment(parentId);
  const slugFragment = idFragment.replace(/_/g, '-').replace(/-+$/g, '').slice(0, 14) || 'fixture';
  const parent = buildParent({ parentId, email: parentEmail, now });
  const { weekStart: currentWeekStart, weekEnd: currentWeekEnd } = getCurrentWeekRange(referenceDate, parent);
  const previousReferenceDate = new Date(currentWeekStart.getTime() - 1);
  const { weekStart: previousWeekStart, weekEnd: previousWeekEnd } = getCurrentWeekRange(previousReferenceDate, parent);
  const currentSubmittedAt = new Date(currentWeekStart.getTime() + (36 * 60 * 60 * 1000));
  const previousSubmittedAt = new Date(previousWeekStart.getTime() + (36 * 60 * 60 * 1000));
  const dateKey = referenceDate.toISOString().slice(0, 10);

  const students = [
    {
      id: `pb_${idFragment}_ada`,
      data: buildStudent({
        parentId,
        id: `pb_${idFragment}_ada`,
        name: 'Ada Smoke',
        slug: `private-beta-ada-${slugFragment}`,
        pin: '1111',
        now,
      }),
    },
    {
      id: `pb_${idFragment}_max`,
      data: buildStudent({
        parentId,
        id: `pb_${idFragment}_max`,
        name: 'Max Smoke',
        slug: `private-beta-max-${slugFragment}`,
        pin: '2222',
        now,
      }),
    },
  ];
  const [ada, max] = students;
  const subjects = [
    {
      id: `pb_${idFragment}_ada_math`,
      data: buildSubject({
        parentId,
        studentId: ada.id,
        id: `pb_${idFragment}_ada_math`,
        title: 'Smoke Math',
        color: '#7c3aed',
        now,
      }),
    },
    {
      id: `pb_${idFragment}_max_reading`,
      data: buildSubject({
        parentId,
        studentId: max.id,
        id: `pb_${idFragment}_max_reading`,
        title: 'Smoke Reading',
        color: '#2563eb',
        now,
      }),
    },
    {
      id: `pb_${idFragment}_delete_me`,
      data: buildSubject({
        parentId,
        studentId: ada.id,
        id: `pb_${idFragment}_delete_me`,
        title: 'Disposable Curriculum QA - Delete Me',
        color: '#dc2626',
        now,
      }),
    },
  ];

  const currentPlans = [
    {
      student: ada,
      subject: subjects[0],
      weekStart: currentWeekStart,
      weekEnd: currentWeekEnd,
    },
    {
      student: max,
      subject: subjects[1],
      weekStart: currentWeekStart,
      weekEnd: currentWeekEnd,
    },
    {
      student: ada,
      subject: subjects[0],
      weekStart: previousWeekStart,
      weekEnd: previousWeekEnd,
    },
  ].map(({ student, subject, weekStart, weekEnd }) => {
    const planId = buildWeeklyPlanDocumentId({
      parentId,
      studentId: student.id,
      weekKey: getWeekKey(weekStart),
    });

    return {
      id: planId,
      data: buildWeeklyPlan({
        parentId,
        studentId: student.id,
        subjectId: subject.id,
        subjectTitle: subject.data.title,
        subject: subject.data,
        weekStart,
        weekEnd,
        now,
      }),
    };
  });

  const submissions = [
    {
      id: `pb_${idFragment}_ada_prev_submission`,
      data: buildSubmission({
        parentId,
        studentId: ada.id,
        subjectId: subjects[0].id,
        subjectTitle: subjects[0].data.title,
        timestamp: previousSubmittedAt,
        blockIndex: 0,
      }),
    },
    {
      id: `pb_${idFragment}_max_current_submission`,
      data: buildSubmission({
        parentId,
        studentId: max.id,
        subjectId: subjects[1].id,
        subjectTitle: subjects[1].data.title,
        timestamp: currentSubmittedAt,
        blockIndex: 0,
      }),
    },
  ];

  const routineTemplateId = `pb_${idFragment}_morning_routine`;
  const weeklyChoreId = `pb_${idFragment}_wipe_table`;
  const monthlyChoreId = `pb_${idFragment}_organize_shelf`;
  const choreClaimId = `pb_${idFragment}_ada_wipe_claim`;
  const choreCompletionId = `pb_${idFragment}_max_shelf_completion`;
  const rewardItemId = `pb_${idFragment}_movie_reward`;
  const redemptionId = `pb_${idFragment}_ada_movie_request`;

  const choreDocuments = [
    {
      path: `choreSettings/${parentId}`,
      data: {
        parent_id: parentId,
        claim_expiration_hours: 24,
        timezone: DEFAULT_TIMEZONE,
        week_reset_day: 1,
        week_reset_hour: 0,
        week_reset_minute: 0,
        quotas: {
          [ada.id]: {
            required_routine_days: 3,
            required_weekly_chore_blocks: 1,
            required_monthly_chore_blocks: 1,
          },
          [max.id]: {
            required_routine_days: 3,
            required_weekly_chore_blocks: 1,
            required_monthly_chore_blocks: 1,
          },
        },
        allowance_policy: {
          period_type: 'weekly',
          allowance_amount: 10,
          completion_policy: 'prorated',
          include_routines: true,
        },
        created_at: now,
        updated_at: now,
      },
    },
    {
      path: `routineTemplates/${routineTemplateId}`,
      data: {
        parent_id: parentId,
        title: 'Morning Smoke Routine',
        student_ids: [ada.id, max.id],
        checklist_items: [
          { id: 'brush_teeth', label: 'Brush teeth' },
          { id: 'make_bed', label: 'Make bed' },
          { id: 'start_school_space', label: 'Set up school space' },
        ],
        counts_toward_allowance: true,
        counts_toward_points: true,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    },
    {
      path: `routineCompletions/${routineTemplateId}_${ada.id}_${dateKey}`,
      data: {
        parent_id: parentId,
        student_id: ada.id,
        routine_template_id: routineTemplateId,
        date_key: dateKey,
        completed_item_ids: ['brush_teeth', 'make_bed', 'start_school_space'],
        completed_at: now,
        created_at: now,
        updated_at: now,
      },
    },
    {
      path: `choreDefinitions/${weeklyChoreId}`,
      data: {
        parent_id: parentId,
        title: 'Wipe the school table',
        frequency_pool: 'weekly',
        eligible_student_ids: [],
        all_students_eligible: true,
        instructions: 'Clear books and wipe the table after school work.',
        definition_of_done: 'Table is cleared, wiped, and ready for dinner.',
        proof_requirement: 'Short note is enough for smoke QA.',
        effort_label: 'quick',
        minimum_cooldown_days: 0,
        requires_parent_approval: true,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    },
    {
      path: `choreDefinitions/${monthlyChoreId}`,
      data: {
        parent_id: parentId,
        title: 'Organize the learning shelf',
        frequency_pool: 'monthly',
        eligible_student_ids: [ada.id, max.id],
        all_students_eligible: false,
        instructions: 'Put books and supplies back in their labeled spots.',
        definition_of_done: 'Shelf is tidy and supplies are grouped.',
        proof_requirement: 'Parent inspection required.',
        effort_label: 'medium',
        minimum_cooldown_days: 20,
        requires_parent_approval: true,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    },
    {
      path: `choreClaims/${choreClaimId}`,
      data: {
        parent_id: parentId,
        student_id: ada.id,
        chore_definition_id: weeklyChoreId,
        status: 'claimed',
        claim_expiration_hours: 24,
        claimed_at: now,
        expires_at: new Date(now.getTime() + (24 * 60 * 60 * 1000)),
        released_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      },
    },
    {
      path: `choreCompletions/${choreCompletionId}`,
      data: {
        parent_id: parentId,
        student_id: max.id,
        chore_definition_id: monthlyChoreId,
        claim_id: '',
        status: 'approved',
        completed_at: currentSubmittedAt,
        approved_at: now,
        reviewed_at: now,
        proof_note: 'Shelf is organized for smoke QA.',
        proof_attachments: [],
        quota_blocks: 1,
        created_at: currentSubmittedAt,
        updated_at: now,
      },
    },
    {
      path: `allowancePeriods/${max.id}_${getWeekKey(currentWeekStart)}`,
      data: {
        parent_id: parentId,
        student_id: max.id,
        period_type: 'weekly',
        period_key: getWeekKey(currentWeekStart),
        period_start: currentWeekStart,
        period_end: currentWeekEnd,
        required_counts: {
          routine_days: 3,
          weekly_chore_blocks: 1,
          monthly_chore_blocks: 1,
        },
        completed_counts: {
          routine_days: 0,
          weekly_chore_blocks: 0,
          monthly_chore_blocks: 1,
        },
        calculated_earned_amount: 3.33,
        parent_adjustment_amount: 0,
        paid_amount: 0,
        paid_status: 'unpaid',
        paid_at: null,
        policy_snapshot: {
          period_type: 'weekly',
          allowance_amount: 10,
          completion_policy: 'prorated',
          include_routines: true,
        },
        created_at: now,
        updated_at: now,
      },
    },
    {
      path: `rewardSettings/${parentId}`,
      data: {
        parent_id: parentId,
        school_block_points: 0,
        chore_block_points: 10,
        routine_day_points: 2,
        routine_points_enabled: true,
        created_at: now,
        updated_at: now,
      },
    },
    {
      path: `studentPointWallets/${ada.id}`,
      data: {
        parent_id: parentId,
        student_id: ada.id,
        total_points: 75,
        lifetime_points: 100,
        updated_at: now,
      },
    },
    {
      path: `studentPointWallets/${max.id}`,
      data: {
        parent_id: parentId,
        student_id: max.id,
        total_points: 20,
        lifetime_points: 20,
        updated_at: now,
      },
    },
    {
      path: `rewardCatalogItems/${rewardItemId}`,
      data: {
        parent_id: parentId,
        type: 'parent_created',
        title: 'Movie night pick',
        description: 'Pick the next family movie.',
        point_cost: 25,
        stock_quantity: 3,
        available_quantity: 2,
        eligible_student_ids: [],
        redemption_requires_approval: true,
        fulfillment_terms: 'Parent approves and schedules the movie.',
        built_in_key: '',
        unlock_type: '',
        unlock_key: '',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    },
    {
      path: `rewardRedemptions/${redemptionId}`,
      data: {
        parent_id: parentId,
        student_id: ada.id,
        reward_catalog_item_id: rewardItemId,
        status: 'requested',
        reward_type_snapshot: 'parent_created',
        title_snapshot: 'Movie night pick',
        point_cost_snapshot: 25,
        stock_quantity_snapshot: 3,
        available_quantity_snapshot: 2,
        fulfillment_terms_snapshot: 'Parent approves and schedules the movie.',
        built_in_key_snapshot: '',
        unlock_type_snapshot: '',
        unlock_key_snapshot: '',
        requested_at: now,
        approved_at: null,
        fulfilled_at: null,
        rejected_at: null,
        canceled_at: null,
        created_at: now,
        updated_at: now,
      },
    },
    {
      path: `pointLedgerEntries/${ada.id}_adjustment_smoke_seed`,
      data: {
        parent_id: parentId,
        student_id: ada.id,
        wallet_id: ada.id,
        source_type: 'adjustment',
        source_id: 'smoke_seed_starting_balance',
        delta_points: 100,
        balance_after: 100,
        description: 'Starting smoke QA point balance.',
        metadata: {},
        created_at: now,
      },
    },
    {
      path: `pointLedgerEntries/${ada.id}_reward_reservation_${rewardItemId}`,
      data: {
        parent_id: parentId,
        student_id: ada.id,
        wallet_id: ada.id,
        source_type: 'reward_redemption_reservation',
        source_id: redemptionId,
        delta_points: -25,
        balance_after: 75,
        description: 'Reserved points for smoke reward request.',
        metadata: {
          reward_catalog_item_id: rewardItemId,
          redemption_id: redemptionId,
        },
        created_at: now,
      },
    },
  ];

  const baseDocuments = [
    { path: `parents/${parentId}`, data: parent },
    {
      path: `accountEntitlements/${parentId}`,
      data: buildEntitlement({
        parentId,
        planId,
        usageSnapshot: {
          students: students.length,
          curriculum_items: subjects.filter((subject) => subject.data.is_active !== false).length,
        },
        now,
      }),
    },
    ...students.map((student) => ({ path: `students/${student.id}`, data: student.data })),
    ...subjects.map((subject) => ({ path: `subjects/${subject.id}`, data: subject.data })),
    ...currentPlans.map((plan) => ({ path: `weeklyPlans/${plan.id}`, data: plan.data })),
    ...submissions.map((submission) => ({ path: `submissions/${submission.id}`, data: submission.data })),
    ...choreDocuments,
  ];

  if (operatorUid) {
    baseDocuments.push({
      path: `supportOperators/${operatorUid}`,
      data: {
        uid: operatorUid,
        email: operatorEmail,
        role: 'admin',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    });
  }

  return {
    documents: baseDocuments,
    routes: {
      parent_dashboard: 'http://localhost:3000/dashboard',
      reports: 'http://localhost:3000/dashboard/reports',
      chores: 'http://localhost:3000/dashboard/chores',
      curriculum: 'http://localhost:3000/dashboard/curriculum',
      operator_console: 'http://localhost:3000/ops/entitlements',
      student_portals: students.map((student) => `http://localhost:3000/student/${student.data.slug}`),
    },
    seededIds: {
      parent_id: parentId,
      operator_uid: operatorUid || '',
      student_ids: students.map((student) => student.id),
      student_pins: Object.fromEntries(students.map((student) => [student.id, student.data.access_pin])),
      disposable_subject_id: subjects[2].id,
      routine_template_id: routineTemplateId,
      weekly_chore_id: weeklyChoreId,
      monthly_chore_id: monthlyChoreId,
      reward_catalog_item_id: rewardItemId,
      reward_redemption_id: redemptionId,
    },
  };
};

const printHelp = () => {
  console.log(`Usage:
  node scripts/seed-private-beta-smoke-fixtures.mjs --dry-run
  node scripts/seed-private-beta-smoke-fixtures.mjs --write --target emulator
  node scripts/seed-private-beta-smoke-fixtures.mjs --write --target staging --confirm-staging-write

Options:
  --dry-run                 Write a JSON fixture artifact only. This is the default when --write is omitted.
  --write                   Create/update Firebase Auth users and Firestore fixture documents.
  --target <emulator|staging>
                            Write target. Required with --write.
  --confirm-staging-write   Required with --write --target staging.
  --project <id>            Firebase project id. Defaults to env or ${DEFAULT_PROJECT_ID}.
  --api-key <key>           Firebase Web API key. Defaults to VITE_FIREBASE_API_KEY env/.env.local.
  --plan <free|core|lockdown>
                            Parent starting entitlement. Defaults to lockdown.
  --parent-email <email>    Parent login email. Defaults to generated example.com email.
  --parent-password <pass>  Parent login password. Defaults to generated password.
  --operator-email <email>  Operator login email. Defaults to generated example.com email in write mode.
  --operator-password <pass>
                            Operator login password. Defaults to generated password.
  --operator-uid <uid>      Existing operator uid to allowlist instead of creating/reusing operator auth.
  --auth-emulator-host <host>
                            Auth emulator host. Defaults to env or ${DEFAULT_AUTH_EMULATOR_HOST}.
  --firestore-emulator-host <host>
                            Firestore emulator host. Defaults to env or ${DEFAULT_FIRESTORE_EMULATOR_HOST}.
  --output <path>           JSON artifact path. Defaults to ${DEFAULT_OUTPUT_PATH}.
  --as-of <date>            Reference date for week math. Defaults to now.
  --help                    Show this help text.

The staging write path uses the Firebase CLI account for Firestore REST writes.
Use only disposable/staging projects or explicitly disposable fixture accounts.`);
};

const writeFixtureDocuments = async ({
  target,
  projectId,
  firestoreEmulatorHost,
  documents,
}) => {
  const firestoreBaseUrl = getFirestoreBaseUrl({
    target,
    projectId,
    firestoreEmulatorHost,
  });
  const authHeader = target === 'emulator'
    ? 'Bearer owner'
    : `Bearer ${await getGoogleOauthToken(projectId)}`;

  for (const document of documents) {
    await patchDocument({
      firestoreBaseUrl,
      authHeader,
      documentPath: document.path,
      fields: document.data,
    });
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const target = args.target || '';

  if (args.write && !['emulator', 'staging'].includes(target)) {
    throw new Error('Use --target emulator or --target staging with --write.');
  }

  if (args.write && target === 'staging' && !args['confirm-staging-write']) {
    throw new Error('Refusing staging writes without --confirm-staging-write.');
  }

  const envFile = readDotEnvFile(path.join(process.cwd(), '.env.local'));
  const projectId = args.project
    || process.env.VITE_FIREBASE_PROJECT_ID
    || envFile.VITE_FIREBASE_PROJECT_ID
    || DEFAULT_PROJECT_ID;
  const apiKey = args['api-key']
    || process.env.VITE_FIREBASE_API_KEY
    || envFile.VITE_FIREBASE_API_KEY
    || (target === 'emulator' ? 'emulator-api-key' : '');
  const authEmulatorHost = args['auth-emulator-host']
    || process.env.FIREBASE_AUTH_EMULATOR_HOST
    || DEFAULT_AUTH_EMULATOR_HOST;
  const firestoreEmulatorHost = args['firestore-emulator-host']
    || process.env.FIRESTORE_EMULATOR_HOST
    || DEFAULT_FIRESTORE_EMULATOR_HOST;
  const outputPath = args.output || DEFAULT_OUTPUT_PATH;
  const planId = normalizePlanId(args.plan || PlanIds.LOCKDOWN);
  const referenceDate = args['as-of'] ? new Date(args['as-of']) : new Date();

  if (Number.isNaN(referenceDate.getTime())) {
    throw new Error(`Invalid --as-of date: ${args['as-of']}`);
  }

  if (args.write && !apiKey) {
    throw new Error('A Firebase Web API key is required for --write. Set VITE_FIREBASE_API_KEY or pass --api-key.');
  }

  const now = new Date();
  const parentEmail = args['parent-email'] || buildGeneratedEmail('private.beta.parent');
  const parentPassword = args['parent-password'] || buildGeneratedPassword();
  const operatorEmail = args['operator-email'] || (args.write ? buildGeneratedEmail('private.beta.operator') : 'private.beta.operator@example.com');
  const operatorPassword = args['operator-password'] || buildGeneratedPassword();
  let parentId = 'private_beta_parent';
  let operatorUid = args['operator-uid'] || 'private_beta_operator';
  let createdParentAuthUser = false;
  let createdOperatorAuthUser = false;

  if (args.write) {
    const authBaseUrl = getAuthBaseUrl({ target, authEmulatorHost });
    const parentAuth = await signUpOrReusePasswordAccount({
      authBaseUrl,
      apiKey,
      email: parentEmail,
      password: parentPassword,
    });
    parentId = parentAuth.localId;
    createdParentAuthUser = parentAuth.createdNewAuthUser;

    if (!args['operator-uid']) {
      const operatorAuth = await signUpOrReusePasswordAccount({
        authBaseUrl,
        apiKey,
        email: operatorEmail,
        password: operatorPassword,
      });
      operatorUid = operatorAuth.localId;
      createdOperatorAuthUser = operatorAuth.createdNewAuthUser;
    }
  }

  const fixture = buildFixtureDocuments({
    parentId,
    parentEmail,
    operatorUid,
    operatorEmail,
    planId,
    now,
    referenceDate,
  });

  if (args.write) {
    await writeFixtureDocuments({
      target,
      projectId,
      firestoreEmulatorHost,
      documents: fixture.documents,
    });
  }

  const artifact = {
    fixture_name: 'private-beta-smoke-fixtures',
    generated_at: now.toISOString(),
    mode: args.write ? `write:${target}` : 'dry-run',
    project_id: projectId,
    plan_id: planId,
    parent_account: {
      email: parentEmail,
      password: args.write ? parentPassword : '<generated on write>',
      uid: parentId,
      created_new_auth_user: args.write ? createdParentAuthUser : false,
    },
    operator_account: operatorUid ? {
      email: operatorEmail,
      password: args.write && !args['operator-uid'] ? operatorPassword : '<existing or generated on write>',
      uid: operatorUid,
      created_new_auth_user: args.write && !args['operator-uid'] ? createdOperatorAuthUser : false,
    } : null,
    seeded_ids: fixture.seededIds,
    routes_to_validate: fixture.routes,
    firestore_document_paths: fixture.documents.map((document) => document.path),
    fixture_documents: toSerializable(Object.fromEntries(
      fixture.documents.map((document) => [document.path, document.data])
    )),
    manual_qa_checklist: [
      'Sign in as the seeded parent and open /dashboard/reports. Save/print the current-week report cases and verify assigned weekly-plan blocks are preserved.',
      'Open both seeded /student/:slug routes with PINs 1111 and 2222. Confirm published school work appears and student-specific chore/reward state is scoped.',
      'Open /dashboard/chores. Confirm Free/Core/Lockdown switching through the operator console locks and unlocks routine-only versus paid chores/rewards behavior.',
      'Open /ops/entitlements as the seeded support operator. Search the parent email, apply Free/Core/Lockdown overrides, clear the override, and confirm audit timeline updates.',
      'Open /dashboard/curriculum. Use only the Disposable Curriculum QA subject for create/save/reopen/archive/delete destructive checks.',
      'If Lockdown is in scope for this smoke pass, pair a clean unpacked extension profile against the seeded Lockdown-capable parent after confirming the account remains on the Lockdown plan.',
    ],
  };

  ensureDirectory(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    output_path: outputPath,
    mode: artifact.mode,
    project_id: projectId,
    parent_email: parentEmail,
    parent_uid: parentId,
    operator_email: operatorEmail,
    operator_uid: operatorUid,
    document_count: fixture.documents.length,
    student_portals: fixture.routes.student_portals,
    caveats: [
      'Use only disposable accounts or emulator/staging projects.',
      'The script seeds fixture documents; it does not run browser interactions or callable smoke by itself.',
      'Use the operator console to switch the seeded parent between Free, Core, and Lockdown during manual QA.',
    ],
  }, null, 2));
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
