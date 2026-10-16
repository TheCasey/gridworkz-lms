import assert from 'node:assert/strict';
import { normalizeTrustedSchoolTimer, schoolSafeCompletedBlocks } from '../src/utils/schoolAuthorityUtils.js';
const timer = { session_id: 'issued-session', status: 'running', duration_ms: 60000, elapsed_ms: 10000,
  started_at_ms: 100000, subject_id: 'math', block_index: 7, weekly_block_id: 'stable', weekly_plan_id: 'plan', week_key: '2026-10-12', state_revision: 2 };
const displayed = normalizeTrustedSchoolTimer(timer, { serverNowMs: 115000, localNowMs: 500000 });
assert.equal(displayed.remainingTime, 35000);
assert.equal(displayed.targetEndTime, 535000, 'A skewed device clock still displays the server remaining budget');
assert.equal(displayed.blockId, 'stable');
assert.equal(displayed.blockIndex, 7);
assert.equal(displayed.initialDurationMs, 60000);
const paused = normalizeTrustedSchoolTimer({ ...timer, status: 'paused', elapsed_ms: 30000, started_at_ms: null }, { serverNowMs: 999000, localNowMs: 3000 });
assert.equal(paused.remainingTime, 30000);
assert.equal(paused.targetEndTime, null);
assert.equal(paused.isRunning, false);
const done = normalizeTrustedSchoolTimer(timer, { serverNowMs: 200000, localNowMs: 3000 });
assert.equal(done.remainingTime, 0);
assert.equal(done.isFinished, true);
assert.equal(normalizeTrustedSchoolTimer({ ...timer, status: 'released' }, { serverNowMs: 115000 }), null);
assert.equal(normalizeTrustedSchoolTimer(timer), null, 'Missing clock envelope fails closed');
assert.deepEqual(schoolSafeCompletedBlocks([{ status: 'completed', legacy_subject_id: 'math', legacy_block_index: 7 },
  { status: 'incomplete', legacy_subject_id: 'math', legacy_block_index: 2 }, { status: 'completed' }]), { math: [7] });
console.log('School timer view: server clock offset, pause/finish/identity and safe effective completion projection passed.');
