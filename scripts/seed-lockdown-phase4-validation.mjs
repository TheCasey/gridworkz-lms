#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import apiv2 from 'firebase-tools/lib/apiv2.js';
import requireAuthMod from 'firebase-tools/lib/requireAuth.js';

const DEFAULT_PROJECT_ID = 'gridworkz-lms';
const DEFAULT_FUNCTIONS_REGION = 'us-central1';
const DEFAULT_TIMEZONE = 'America/Chicago';
const DEFAULT_OUTPUT_PATH = '/tmp/gridworkz-phase4-validation-fixture.json';
const FIREBASE_CONFIGSTORE_PATH = path.join(
  process.env.HOME || '',
  '.config',
  'configstore',
  'firebase-tools.json'
);

const WEEKDAY_NAME_TO_INDEX = Object.freeze({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
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
      const value = line.slice(separatorIndex + 1).trim();
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

const buildGeneratedEmail = () => {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `phase4.lockdown.${timestamp}.${suffix}@example.com`;
};

const buildGeneratedPassword = () => (
  `Gridworkz!${crypto.randomBytes(6).toString('hex')}`
);

const getFirestoreValue = (value) => {
  if (value === null) {
    return { nullValue: null };
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
        values: value.map(getFirestoreValue),
      },
    };
  }

  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nestedValue]) => [key, getFirestoreValue(nestedValue)])
        ),
      },
    };
  }

  throw new Error(`Unsupported Firestore seed value: ${String(value)}`);
};

const getLocalWeekdayInTimeZone = (date, timeZone) => {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date);

  return WEEKDAY_NAME_TO_INDEX[weekday] ?? 1;
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

const signUpWithPassword = async ({ apiKey, email, password }) => {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Auth sign-up failed: ${JSON.stringify(body)}`);
  }

  return body;
};

const signInWithPassword = async ({ apiKey, email, password }) => {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Auth sign-in failed: ${JSON.stringify(body)}`);
  }

  return body;
};

const signUpOrReusePasswordAccount = async ({ apiKey, email, password }) => {
  try {
    const signUpResult = await signUpWithPassword({ apiKey, email, password });
    return {
      ...signUpResult,
      createdNewAuthUser: true,
    };
  } catch (error) {
    if (!String(error.message).includes('EMAIL_EXISTS')) {
      throw error;
    }

    const signInResult = await signInWithPassword({ apiKey, email, password });
    return {
      ...signInResult,
      createdNewAuthUser: false,
    };
  }
};

const patchDocument = async ({ oauthToken, projectId, documentPath, fields }) => {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${oauthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [key, getFirestoreValue(value)])
        ),
      }),
    }
  );
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `Firestore patch failed for ${documentPath}: HTTP ${response.status} ${JSON.stringify(body)}`
    );
  }

  return body;
};

const postCallable = async ({ url, idToken, data }) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Callable request failed: HTTP ${response.status} ${JSON.stringify(body)}`);
  }

  return body?.result || body?.data || body;
};

const ensureDirectory = (filePath) => {
  const directoryPath = path.dirname(filePath);
  fs.mkdirSync(directoryPath, { recursive: true });
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const envFile = readDotEnvFile(path.join(process.cwd(), '.env.local'));
  const projectId = args.project || process.env.VITE_FIREBASE_PROJECT_ID || envFile.VITE_FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
  const apiKey = args['api-key'] || process.env.VITE_FIREBASE_API_KEY || envFile.VITE_FIREBASE_API_KEY;
  const functionsRegion = args.region || process.env.VITE_FIREBASE_FUNCTIONS_REGION || envFile.VITE_FIREBASE_FUNCTIONS_REGION || DEFAULT_FUNCTIONS_REGION;
  const outputPath = args.output || DEFAULT_OUTPUT_PATH;
  const email = args.email || buildGeneratedEmail();
  const password = args.password || buildGeneratedPassword();
  const studentName = args['student-name'] || 'Phase 4 Validation Student';

  if (!apiKey) {
    throw new Error('A Firebase Web API key is required. Set VITE_FIREBASE_API_KEY or pass --api-key.');
  }

  const oauthToken = await getGoogleOauthToken(projectId);
  const authResult = await signUpOrReusePasswordAccount({ apiKey, email, password });
  const uid = authResult.localId;
  const verifiedSignIn = await signInWithPassword({ apiKey, email, password });
  const now = new Date();
  const localWeekday = getLocalWeekdayInTimeZone(now, DEFAULT_TIMEZONE);
  const nextSchoolDay = (localWeekday + 1) % 7;
  const studentId = args['student-id'] || `ld_phase4_${uid.slice(0, 8)}`;
  const studentSlug = `phase4-validation-${uid.slice(0, 6).toLowerCase()}`;
  const trustedCodeUrl = `https://${functionsRegion}-${projectId}.cloudfunctions.net/issueLockdownEnrollment`;

  await patchDocument({
    oauthToken,
    projectId,
    documentPath: `parents/${uid}`,
    fields: {
      uid,
      email,
      school_name: 'Phase 4 Lockdown Validation',
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
    },
  });

  await patchDocument({
    oauthToken,
    projectId,
    documentPath: `accountEntitlements/${uid}`,
    fields: {
      parent_id: uid,
      plan_id: 'lockdown',
      subscription_status: 'active',
      billing_provider: 'validation_seed',
      feature_overrides: {},
      usage_snapshot: {
        students: 1,
        curriculum_items: 0,
      },
      trial_ends_at: null,
      current_period_end: null,
      updated_at: now,
    },
  });

  await patchDocument({
    oauthToken,
    projectId,
    documentPath: `students/${studentId}`,
    fields: {
      parent_id: uid,
      name: studentName,
      slug: studentSlug,
      access_pin: null,
      week_reset_day: 1,
      week_reset_hour: 0,
      week_reset_minute: 0,
      timezone: DEFAULT_TIMEZONE,
      lockdown_schedule: {
        timezone: DEFAULT_TIMEZONE,
        school_days: [nextSchoolDay],
        school_day_start_time: '08:00',
        school_day_end_time: '15:00',
        off_hours_resource_windows: [
          {
            id: 'phase4_anytime_window',
            label: 'Phase 4 Validation Window',
            days: [localWeekday],
            start_time: '00:00',
            end_time: '23:59',
            resources: [
              {
                name: 'GridWorkz Validation Resource',
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
    },
  });

  const trustedEnrollment = args['no-issue-code']
    ? null
    : await postCallable({
      url: trustedCodeUrl,
      idToken: verifiedSignIn.idToken,
      data: { student_id: studentId },
    });

  const fixture = {
    created_at: now.toISOString(),
    project_id: projectId,
    dashboard_url: 'http://127.0.0.1:3000/dashboard/lockdown',
    account: {
      email,
      password,
      uid,
      created_new_auth_user: authResult.createdNewAuthUser,
      sign_in_verified: true,
    },
    seeded_documents: {
      parent: `parents/${uid}`,
      entitlement: `accountEntitlements/${uid}`,
      student: `students/${studentId}`,
    },
    student: {
      id: studentId,
      name: studentName,
      slug: studentSlug,
      timezone: DEFAULT_TIMEZONE,
      validation_window_id: 'phase4_anytime_window',
      validation_origin: 'https://www.khanacademy.org',
    },
    trusted_enrollment: trustedEnrollment,
    prerequisites: [
      'Run from the repo root with dependencies installed.',
      'The local Firebase CLI account must already be logged in and have admin access to the live project.',
      'The repo must still expose VITE_FIREBASE_API_KEY through .env.local or the shell environment.',
    ],
    command_example: `node scripts/seed-lockdown-phase4-validation.mjs --output ${outputPath}`,
  };

  ensureDirectory(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    output_path: outputPath,
    account_email: email,
    account_uid: uid,
    student_id: studentId,
    trusted_enrollment_expires_at: trustedEnrollment?.expires_at || null,
    created_new_auth_user: authResult.createdNewAuthUser,
  }, null, 2));
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
