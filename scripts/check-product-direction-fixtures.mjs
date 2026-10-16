import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  buildDirectionFixture, DIRECTION_RESET_COLLECTIONS, DIRECTION_SCENARIOS,
} from './product-direction-fixtures.mjs';
import { validatePrivateWeeklyPlanDraft, validateStudentCosmeticState } from '../src/utils/productDirectionContracts.js';

test('scenario identities repeat and contract records validate', () => {
  const referenceDate = new Date('2026-10-12T15:00:00Z');
  for (const scenario of Object.keys(DIRECTION_SCENARIOS)) {
    const first = buildDirectionFixture({ scenario, referenceDate });
    assert.deepEqual(buildDirectionFixture({ scenario, referenceDate }), first);
    assert.ok(first.documents.every((record) => record.data.parent_id === first.parentId));
    for (const record of first.documents) {
      if (record.collection === 'weeklyPlanDrafts') assert.equal(validatePrivateWeeklyPlanDraft(record.data), true);
      if (record.collection === 'studentCosmeticStates') assert.equal(validateStudentCosmeticState(record.data, {
        parentId: first.parentId, studentId: record.data.student_id, catalog: [],
      }), true);
    }
  }
  assert.equal(buildDirectionFixture({ scenario: 'free' }).students.length, 2);
  assert.equal(buildDirectionFixture({ scenario: 'core' }).students.length, 11);
  assert.equal(buildDirectionFixture({ scenario: 'empty' }).students.length, 0);
});

test('reset scope includes effects produced by completion, corrections, and awards', () => {
  for (const name of ['routineCompletions', 'pointLedgerEntries', 'parentCorrectionEvents', 'weeklyReportAmendments', 'submissions', 'timerSessions']) {
    assert.ok(DIRECTION_RESET_COLLECTIONS.includes(name), `${name} must not survive a fresh fixture reset`);
  }
});

test('emulator seeder fails before network access with missing or remote hosts', () => {
  for (const host of ['', 'firestore.googleapis.com:443']) {
    const result = spawnSync(process.execPath, ['scripts/seed-product-direction-fixtures.mjs', '--write'], {
      env: { ...process.env, FIRESTORE_EMULATOR_HOST: host, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must point to a local emulator/);
  }
});
