#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_FIXTURE_PATH = '/tmp/gridworkz-private-beta-smoke-fixtures.json';
const DEFAULT_PROJECT_ID = 'gridworkz-lms';
const DEFAULT_REGION = 'us-central1';
const DEFAULT_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const DEFAULT_FUNCTIONS_EMULATOR_HOST = '127.0.0.1:5001';

const CallableNames = Object.freeze({
  GET_OPERATOR_SESSION: 'getOperatorSession',
  SEARCH_PARENT_ACCOUNTS: 'searchParentAccounts',
  GET_OPERATOR_ENTITLEMENT_RECORD: 'getOperatorEntitlementRecord',
  READ_STUDENT_CHORE_STATE: 'readStudentChoreState',
  LIST_LOCKDOWN_DEVICES: 'listLockdownDevices',
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

const readFixture = (fixturePath) => {
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture artifact not found: ${fixturePath}`);
  }

  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Request failed: HTTP ${response.status} ${url} ${JSON.stringify(body)}`);
  }

  return body;
};

const getAuthBaseUrl = ({ target, authEmulatorHost }) => (
  target === 'emulator'
    ? `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1`
    : 'https://identitytoolkit.googleapis.com/v1'
);

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

const getCallableUrl = ({
  target,
  projectId,
  region,
  functionsEmulatorHost,
  functionName,
}) => (
  target === 'emulator'
    ? `http://${functionsEmulatorHost}/${projectId}/${region}/${functionName}`
    : `https://${region}-${projectId}.cloudfunctions.net/${functionName}`
);

const postCallable = async ({
  target,
  projectId,
  region,
  functionsEmulatorHost,
  functionName,
  idToken = '',
  data = {},
}) => {
  const response = await fetch(getCallableUrl({
    target,
    projectId,
    region,
    functionsEmulatorHost,
    functionName,
  }), {
    method: 'POST',
    headers: {
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Callable ${functionName} failed: HTTP ${response.status} ${JSON.stringify(body)}`);
  }

  return body?.result || body?.data || body;
};

const isUsablePassword = (password) => (
  typeof password === 'string' &&
  password.length > 0 &&
  !password.startsWith('<')
);

const buildPlannedCalls = (fixture) => {
  const firstStudentId = fixture.seeded_ids?.student_ids?.[0] || '';
  const firstStudentPin = fixture.seeded_ids?.student_pins?.[firstStudentId] || '';

  return [
    {
      label: 'student chore state',
      callable: CallableNames.READ_STUDENT_CHORE_STATE,
      auth: 'none',
      payload: {
        student_id: firstStudentId,
        access_pin: firstStudentPin,
      },
    },
    {
      label: 'operator session',
      callable: CallableNames.GET_OPERATOR_SESSION,
      auth: 'operator',
      payload: {},
    },
    {
      label: 'operator parent search',
      callable: CallableNames.SEARCH_PARENT_ACCOUNTS,
      auth: 'operator',
      payload: {
        query: fixture.parent_account?.email || fixture.seeded_ids?.parent_id || '',
      },
    },
    {
      label: 'operator entitlement detail',
      callable: CallableNames.GET_OPERATOR_ENTITLEMENT_RECORD,
      auth: 'operator',
      payload: {
        parent_id: fixture.seeded_ids?.parent_id || fixture.parent_account?.uid || '',
      },
    },
    {
      label: 'lockdown device list',
      callable: CallableNames.LIST_LOCKDOWN_DEVICES,
      auth: 'parent',
      payload: {},
    },
  ];
};

const printHelp = () => {
  console.log(`Usage:
  node scripts/smoke-private-beta-callables.mjs --dry-run
  node scripts/smoke-private-beta-callables.mjs --run --target emulator
  node scripts/smoke-private-beta-callables.mjs --run --target staging --confirm-staging-run

Options:
  --fixture <path>           Fixture artifact from seed-private-beta-smoke-fixtures. Defaults to ${DEFAULT_FIXTURE_PATH}.
  --dry-run                  Print planned callable smoke without making network calls. Default when --run is omitted.
  --run                      Execute callable smoke against emulator or staging.
  --target <emulator|staging>
                            Required with --run.
  --confirm-staging-run      Required with --run --target staging.
  --project <id>             Firebase project id. Defaults to env or ${DEFAULT_PROJECT_ID}.
  --api-key <key>            Firebase Web API key. Defaults to VITE_FIREBASE_API_KEY env/.env.local.
  --region <region>          Cloud Functions region. Defaults to env or ${DEFAULT_REGION}.
  --auth-emulator-host <host>
                            Auth emulator host. Defaults to env or ${DEFAULT_AUTH_EMULATOR_HOST}.
  --functions-emulator-host <host>
                            Functions emulator host. Defaults to env or ${DEFAULT_FUNCTIONS_EMULATOR_HOST}.
  --help                     Show this help text.`);
};

const assertRunnableFixture = (fixture) => {
  if (!isUsablePassword(fixture.parent_account?.password)) {
    throw new Error('Fixture parent password is not runnable. Generate it with seed-private-beta-smoke-fixtures --write.');
  }

  if (!isUsablePassword(fixture.operator_account?.password)) {
    throw new Error(
      'Fixture operator password is not runnable. Generate operator auth with seed-private-beta-smoke-fixtures --write or run operator calls manually.'
    );
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const fixturePath = args.fixture || DEFAULT_FIXTURE_PATH;
  const fixture = readFixture(fixturePath);
  const plannedCalls = buildPlannedCalls(fixture);

  if (!args.run || args['dry-run']) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      fixture_path: fixturePath,
      project_id: fixture.project_id,
      parent_uid: fixture.parent_account?.uid,
      operator_uid: fixture.operator_account?.uid,
      planned_calls: plannedCalls,
      runnable: (
        isUsablePassword(fixture.parent_account?.password) &&
        isUsablePassword(fixture.operator_account?.password)
      ),
    }, null, 2));
    return;
  }

  const target = args.target || '';
  if (!['emulator', 'staging'].includes(target)) {
    throw new Error('Use --target emulator or --target staging with --run.');
  }

  if (target === 'staging' && !args['confirm-staging-run']) {
    throw new Error('Refusing staging callable smoke without --confirm-staging-run.');
  }

  assertRunnableFixture(fixture);

  const envFile = readDotEnvFile(path.join(process.cwd(), '.env.local'));
  const projectId = args.project
    || fixture.project_id
    || process.env.VITE_FIREBASE_PROJECT_ID
    || envFile.VITE_FIREBASE_PROJECT_ID
    || DEFAULT_PROJECT_ID;
  const apiKey = args['api-key']
    || process.env.VITE_FIREBASE_API_KEY
    || envFile.VITE_FIREBASE_API_KEY
    || (target === 'emulator' ? 'emulator-api-key' : '');
  const region = args.region
    || process.env.VITE_FIREBASE_FUNCTIONS_REGION
    || envFile.VITE_FIREBASE_FUNCTIONS_REGION
    || DEFAULT_REGION;
  const authEmulatorHost = args['auth-emulator-host']
    || process.env.FIREBASE_AUTH_EMULATOR_HOST
    || DEFAULT_AUTH_EMULATOR_HOST;
  const functionsEmulatorHost = args['functions-emulator-host']
    || process.env.FUNCTIONS_EMULATOR_HOST
    || DEFAULT_FUNCTIONS_EMULATOR_HOST;

  if (!apiKey) {
    throw new Error('A Firebase Web API key is required. Set VITE_FIREBASE_API_KEY or pass --api-key.');
  }

  const authBaseUrl = getAuthBaseUrl({ target, authEmulatorHost });
  const parentSignIn = await signInWithPassword({
    authBaseUrl,
    apiKey,
    email: fixture.parent_account.email,
    password: fixture.parent_account.password,
  });
  const operatorSignIn = await signInWithPassword({
    authBaseUrl,
    apiKey,
    email: fixture.operator_account.email,
    password: fixture.operator_account.password,
  });
  const idTokens = {
    parent: parentSignIn.idToken,
    operator: operatorSignIn.idToken,
    none: '',
  };
  const results = [];

  for (const plannedCall of plannedCalls) {
    const result = await postCallable({
      target,
      projectId,
      region,
      functionsEmulatorHost,
      functionName: plannedCall.callable,
      idToken: idTokens[plannedCall.auth],
      data: plannedCall.payload,
    });

    results.push({
      label: plannedCall.label,
      callable: plannedCall.callable,
      auth: plannedCall.auth,
      ok: true,
      summary: {
        contract: result?.contract || '',
        result_keys: result && typeof result === 'object' ? Object.keys(result).slice(0, 12) : [],
        result_count: Array.isArray(result?.results) ? result.results.length : undefined,
        plan_id: result?.entitlement?.plan_id || result?.plan_id || undefined,
      },
    });
  }

  console.log(JSON.stringify({
    mode: `run:${target}`,
    fixture_path: fixturePath,
    project_id: projectId,
    region,
    results,
  }, null, 2));
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
