#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CHORE_CLAIM_STATUSES,
  CHORE_COMPLETION_STATUSES,
  TRUSTED_CHORE_CONTRACT,
  buildTrustedChoreClaimDecision,
  buildTrustedChoreCompletionDecision,
  buildTrustedChoreReviewDecision,
  buildTrustedStudentSafeChoreView,
  normalizeTrustedChoreDefinitionPayload,
  normalizeTrustedChoreSettingsPayload,
  normalizeTrustedRoutineTemplatePayload,
  normalizeTrustedStudentChoreContextPayload,
  resolveTrustedRoutineTemplatesForStudent,
  validateTrustedStudentPinContext,
} from '../functions/src/choreTrustedValidators.js';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const now = new Date('2026-05-25T15:00:00.000Z');
const weekConfig = {
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: 'America/Chicago',
};

const normalizedSettings = normalizeTrustedChoreSettingsPayload({
  claim_expiration_hours: '12',
  week_reset_day: '7',
  week_reset_hour: '-4',
  quotas: {
    student_a: {
      required_routine_days: '5',
      required_weekly_chore_blocks: '2',
      required_monthly_chore_blocks: '1',
    },
  },
});

assert.equal(normalizedSettings.claim_expiration_hours, 12);
assert.equal(normalizedSettings.week_reset_day, 6);
assert.equal(normalizedSettings.week_reset_hour, 0);
assert.deepEqual(normalizedSettings.quotas.student_a, {
  required_routine_days: 5,
  required_weekly_chore_blocks: 2,
  required_monthly_chore_blocks: 1,
});

assert.deepEqual(
  normalizeTrustedRoutineTemplatePayload({
    title: ' Morning ',
    student_ids: ['student_a', 'student_a', ''],
    checklist_items: [
      { id: ' teeth ', label: ' Brush teeth ' },
      { id: 'empty', label: ' ' },
    ],
    counts_toward_allowance: true,
  }),
  {
    id: '',
    title: 'Morning',
    routine_period: '',
    student_ids: ['student_a'],
    checklist_items: [{ id: 'teeth', label: 'Brush teeth' }],
    counts_toward_allowance: true,
    counts_toward_points: false,
    is_active: true,
  },
  'routine setup payload should trim labels and deduplicate student ids'
);

const normalizedDefinition = normalizeTrustedChoreDefinitionPayload({
  title: ' Vacuum ',
  frequency_pool: 'monthly',
  eligible_student_ids: ['student_a', 'student_a'],
  requires_parent_approval: undefined,
  effort_label: 'hard',
});

assert.equal(
  normalizedDefinition.requires_parent_approval,
  false,
  'approval should default to auto-approved unless requires_parent_approval is explicitly true'
);
assert.deepEqual(normalizedDefinition.eligible_student_ids, ['student_a']);

assert.deepEqual(
  resolveTrustedRoutineTemplatesForStudent({
    studentId: 'student_a',
    routineTemplates: [
      {
        id: 'legacy_shared_morning',
        title: 'Morning Routine',
        student_ids: [],
        checklist_items: [{ id: 'legacy', label: 'Legacy item' }],
      },
      {
        id: 'routine_student_a_morning',
        title: 'Morning Routine',
        routine_period: 'morning',
        student_ids: ['student_a'],
        checklist_items: [{ id: 'personal', label: 'Personal item' }],
      },
    ],
  }).map((routine) => routine.id),
  ['routine_student_a_morning'],
  'trusted reads should prefer the canonical per-student routine period over legacy shared data'
);

assert.deepEqual(
  normalizeTrustedStudentChoreContextPayload({
    studentSlug: 'kid-a',
    accessPin: '1234',
  }),
  {
    student_id: '',
    slug: 'kid-a',
    access_pin: '1234',
  },
  'student chore context accepts the public slug portal naming shape'
);

const studentRecord = {
  id: 'student_a',
  parent_id: 'parent_1',
  slug: 'kid-a',
  access_pin: '1234',
};
const pinlessStudentRecord = {
  id: 'student_pinless',
  parent_id: 'parent_1',
  slug: 'kid-pinless',
  access_pin: '',
};

assert.equal(
  validateTrustedStudentPinContext({
    payload: { student_id: 'student_pinless', slug: 'kid-pinless', access_pin: '1234' },
    studentRecord: pinlessStudentRecord,
  }).ok,
  false,
  'pinless student records should not be accepted for trusted public chore access'
);
assert.equal(
  validateTrustedStudentPinContext({
    payload: { student_id: 'student_pinless', slug: 'kid-pinless', access_pin: '1234' },
    studentRecord: pinlessStudentRecord,
  }).code,
  'missing_pin',
  'pinless student records should fail with the same locked chore access code as missing PIN context'
);

assert.equal(
  validateTrustedStudentPinContext({
    payload: { slug: 'kid-a' },
    studentRecord,
  }).ok,
  false,
  'student-safe chore context requires a PIN'
);
assert.equal(
  validateTrustedStudentPinContext({
    payload: { slug: 'kid-a', access_pin: '9999' },
    studentRecord,
  }).ok,
  false,
  'student-safe chore context rejects wrong PINs'
);
assert.equal(
  validateTrustedStudentPinContext({
    payload: { slug: 'kid-a', access_pin: '9999' },
    studentRecord,
  }).code,
  'pin_mismatch',
  'student-safe chore context rejects mismatched PINs'
);
assert.equal(
  validateTrustedStudentPinContext({
    payload: { slug: 'kid-a', access_pin: '1234' },
    studentRecord,
  }).ok,
  true,
  'student-safe chore context accepts matching slug and PIN'
);

const availableChore = {
  id: 'chore_available',
  title: 'Wipe counters',
  frequency_pool: 'weekly',
  eligible_student_ids: ['student_a'],
  all_students_eligible: false,
  is_active: true,
  minimum_cooldown_days: 0,
};
const ineligibleDecision = buildTrustedChoreClaimDecision({
  choreDefinition: {
    ...availableChore,
    id: 'chore_ineligible',
    eligible_student_ids: ['student_b'],
  },
  studentId: 'student_a',
  now,
  weekConfig,
});

assert.equal(ineligibleDecision.ok, false);
assert.equal(ineligibleDecision.code, 'ineligible');

const cooldownDecision = buildTrustedChoreClaimDecision({
  choreDefinition: {
    ...availableChore,
    id: 'chore_cooldown',
    minimum_cooldown_days: 2,
  },
  studentId: 'student_a',
  completions: [
    {
      id: 'completion_recent',
      chore_definition_id: 'chore_cooldown',
      student_id: 'student_b',
      status: CHORE_COMPLETION_STATUSES.APPROVED,
      completed_at: new Date('2026-05-24T15:00:00.000Z'),
    },
  ],
  now,
  weekConfig,
});

assert.equal(cooldownDecision.ok, false);
assert.equal(cooldownDecision.code, 'cooldown');

const expiredSiblingClaimDecision = buildTrustedChoreClaimDecision({
  choreDefinition: availableChore,
  studentId: 'student_a',
  claims: [
    {
      id: 'claim_expired_sibling',
      chore_definition_id: 'chore_available',
      student_id: 'student_b',
      status: CHORE_CLAIM_STATUSES.CLAIMED,
      claimed_at: new Date('2026-05-23T15:00:00.000Z'),
      expires_at: new Date('2026-05-24T15:00:00.000Z'),
    },
  ],
  now,
  weekConfig,
  claimExpirationHours: 24,
});

assert.equal(
  expiredSiblingClaimDecision.ok,
  true,
  'expired sibling claims should be released consistently instead of blocking a new claim'
);
assert.deepEqual(expiredSiblingClaimDecision.expired_claim_ids, ['claim_expired_sibling']);

const siblingCompletionDecision = buildTrustedChoreCompletionDecision({
  claim: {
    id: 'claim_student_b',
    chore_definition_id: 'chore_available',
    student_id: 'student_b',
    status: CHORE_CLAIM_STATUSES.CLAIMED,
    claimed_at: new Date('2026-05-25T14:00:00.000Z'),
    expires_at: new Date('2026-05-26T14:00:00.000Z'),
  },
  choreDefinition: availableChore,
  studentId: 'student_a',
  now,
});

assert.equal(siblingCompletionDecision.ok, false);
assert.equal(siblingCompletionDecision.code, 'student_mismatch');

const expiredCompletionDecision = buildTrustedChoreCompletionDecision({
  claim: {
    id: 'claim_expired_own',
    chore_definition_id: 'chore_available',
    student_id: 'student_a',
    status: CHORE_CLAIM_STATUSES.CLAIMED,
    claimed_at: new Date('2026-05-23T15:00:00.000Z'),
    expires_at: new Date('2026-05-24T15:00:00.000Z'),
  },
  choreDefinition: availableChore,
  studentId: 'student_a',
  now,
});

assert.equal(expiredCompletionDecision.ok, false);
assert.equal(expiredCompletionDecision.code, 'claim_expired');
assert.deepEqual(expiredCompletionDecision.expired_claim_ids, ['claim_expired_own']);

const pendingCompletionDecision = buildTrustedChoreCompletionDecision({
  claim: {
    id: 'claim_parent_review',
    chore_definition_id: 'chore_available',
    student_id: 'student_a',
    status: CHORE_CLAIM_STATUSES.CLAIMED,
    claimed_at: new Date('2026-05-25T14:00:00.000Z'),
    expires_at: new Date('2026-05-26T14:00:00.000Z'),
  },
  choreDefinition: {
    ...availableChore,
    requires_parent_approval: true,
  },
  studentId: 'student_a',
  now,
});

assert.equal(pendingCompletionDecision.ok, true);
assert.equal(pendingCompletionDecision.status, CHORE_COMPLETION_STATUSES.COMPLETED);
assert.equal(pendingCompletionDecision.final, false);
assert.equal(pendingCompletionDecision.approved_at, null);

const autoApprovedCompletionDecision = buildTrustedChoreCompletionDecision({
  claim: {
    id: 'claim_auto',
    chore_definition_id: 'chore_available',
    student_id: 'student_a',
    status: CHORE_CLAIM_STATUSES.CLAIMED,
    claimed_at: new Date('2026-05-25T14:00:00.000Z'),
    expires_at: new Date('2026-05-26T14:00:00.000Z'),
  },
  choreDefinition: {
    ...availableChore,
    effort_label: 'high',
  },
  studentId: 'student_a',
  now,
});

assert.equal(autoApprovedCompletionDecision.status, CHORE_COMPLETION_STATUSES.APPROVED);
assert.equal(
  autoApprovedCompletionDecision.final,
  true,
  'effort labels should not imply parent approval requirements'
);

assert.deepEqual(
  buildTrustedChoreReviewDecision({
    completion: {
      id: 'completion_pending',
      status: CHORE_COMPLETION_STATUSES.COMPLETED,
    },
    reviewPayload: {
      completion_id: 'completion_pending',
      action: 'approve',
    },
  }),
  {
    ok: true,
    code: 'review_approve',
    status: CHORE_COMPLETION_STATUSES.APPROVED,
    review_note: '',
  },
  'parent review should approve only pending completed records'
);

const studentSafeView = buildTrustedStudentSafeChoreView({
  studentId: 'student_a',
  routineTemplates: [],
  choreDefinitions: [availableChore],
  choreClaims: [],
  choreCompletions: [],
  allowancePeriods: [
    {
      id: 'allowance_a',
      student_id: 'student_a',
      calculated_earned_amount: 8,
      paid_status: 'unpaid',
    },
    {
      id: 'allowance_b',
      student_id: 'student_b',
      calculated_earned_amount: 100,
      paid_status: 'unpaid',
    },
  ],
  pointWallets: [
    {
      id: 'wallet_a',
      student_id: 'student_a',
      total_points: 10,
      lifetime_points: 20,
    },
    {
      id: 'wallet_b',
      student_id: 'student_b',
      total_points: 999,
      lifetime_points: 1000,
    },
  ],
  rewardCatalogItems: [
    {
      id: 'shared_reward',
      title: 'Movie pick',
      point_cost: 10,
      is_active: true,
      eligible_student_ids: [],
    },
    {
      id: 'sibling_private_reward',
      title: 'Sibling only',
      point_cost: 5,
      is_active: true,
      eligible_student_ids: ['student_b'],
    },
  ],
  rewardRedemptions: [
    {
      id: 'redemption_a',
      student_id: 'student_a',
      reward_catalog_item_id: 'shared_reward',
    },
    {
      id: 'redemption_b',
      student_id: 'student_b',
      reward_catalog_item_id: 'sibling_private_reward',
      title_snapshot: 'Sibling only',
    },
  ],
  now,
  weekConfig,
});

assert.equal(studentSafeView.contract, TRUSTED_CHORE_CONTRACT);
assert.deepEqual(
  studentSafeView.allowance.periods,
  [],
  'student-safe read output should omit allowance ledger details entirely during Phase 6'
);
assert.equal(studentSafeView.rewards.wallet.student_id, 'student_a');
assert.deepEqual(
  studentSafeView.rewards.catalog.map((reward) => reward.id),
  [
    'shared_reward',
    'builtin_avatar_stargazer',
    'builtin_avatar_trailblazer',
    'builtin_badge_comet',
    'builtin_badge_steward',
    'builtin_theme_sunrise',
    'builtin_theme_twilight',
  ],
  'student-safe reward catalog should include eligible parent rewards plus built-in cosmetic placeholders'
);
assert.deepEqual(studentSafeView.rewards.myRedemptions.map((redemption) => redemption.id), ['redemption_a']);
assert.equal(
  JSON.stringify(studentSafeView).includes('student_b'),
  false,
  'student-safe read output should exclude sibling allowance, wallet, reward catalog, and redemption data'
);

const [
  rulesSource,
  schemaSource,
  trustedOperationsSource,
  functionsSource,
  firebaseConfigSource,
] = await Promise.all([
  readSource('firestore.rules'),
  readSource('src/constants/schema.js'),
  readSource('src/firebase/trustedOperations.js'),
  readSource('functions/src/index.js'),
  readSource('firebase.json'),
]);

const callableNames = [
  'upsertChoreSettings',
  'upsertRoutineTemplate',
  'upsertChoreDefinition',
  'upsertRewardSettings',
  'upsertRewardCatalogItem',
  'readStudentChoreState',
  'claimChore',
  'completeChore',
  'completeRoutine',
  'reviewChoreCompletion',
];

callableNames.forEach((functionName) => {
  assert.ok(
    schemaSource.includes(`"${functionName}"`),
    `${functionName} should be exported in TrustedFunctionNames`
  );
  assert.ok(
    functionsSource.includes(`export const ${functionName} = onCall`),
    `${functionName} should be implemented as a callable Cloud Function`
  );
});

[
  'upsertTrustedChoreSettings',
  'upsertTrustedRoutineTemplate',
  'upsertTrustedChoreDefinition',
  'upsertTrustedRewardSettings',
  'upsertTrustedRewardCatalogItem',
  'readTrustedStudentChoreState',
  'claimTrustedChore',
  'completeTrustedChore',
  'completeTrustedRoutine',
  'reviewTrustedChoreCompletion',
].forEach((wrapperName) => {
  assert.ok(
    trustedOperationsSource.includes(`export const ${wrapperName}`),
    `${wrapperName} should be exported by trustedOperations.js`
  );
});

[
  'choreSettings',
  'routineTemplates',
  'routineCompletions',
  'choreDefinitions',
  'choreClaims',
  'choreCompletions',
  'allowancePeriods',
  'rewardSettings',
  'pointLedgerEntries',
  'studentPointWallets',
  'rewardCatalogItems',
  'rewardRedemptions',
].forEach((collectionName) => {
  const matchBlockStart = rulesSource.indexOf(`match /${collectionName}/`);
  assert.notEqual(matchBlockStart, -1, `${collectionName} must have explicit rules`);

  const matchBlockEnd = rulesSource.indexOf('\n    match /', matchBlockStart + 1);
  const matchBlock = rulesSource.slice(
    matchBlockStart,
    matchBlockEnd === -1 ? rulesSource.length : matchBlockEnd
  );

  assert.equal(
    matchBlock.includes('allow read: if true'),
    false,
    `${collectionName} must not allow public reads`
  );
  assert.ok(
    matchBlock.includes('allow write: if false'),
    `${collectionName} must close direct client writes`
  );
});

const emulatorConfig = JSON.parse(firebaseConfigSource).emulators;
assert.equal(emulatorConfig?.auth?.port, 9099, 'Auth emulator should use the documented seed-script port');
assert.equal(emulatorConfig?.firestore?.port, 8080, 'Firestore emulator should use the documented seed-script port');
assert.equal(emulatorConfig?.functions?.port, 5001, 'Functions emulator should use the documented callable-smoke port');

console.log('Chores trusted contract checks passed.');
console.log('Callable emulator harness: Auth, Firestore, and Functions ports are configured in firebase.json.');
