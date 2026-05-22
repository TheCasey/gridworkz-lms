#!/usr/bin/env node

import assert from 'node:assert/strict';
import { normalizeOperatorSessionRecord } from '../functions/src/index.js';

const buildOperatorRecord = (overrides = {}) => ({
  uid: 'operator_123',
  email: 'operator@example.com',
  role: 'support',
  is_active: true,
  secret_token: 'do-not-return',
  provider_config: {
    raw: true,
  },
  created_at: new Date('2026-05-22T00:00:00.000Z'),
  updated_at: new Date('2026-05-22T00:00:00.000Z'),
  ...overrides,
});

const normalize = (operatorRecord, uid = 'operator_123') => (
  normalizeOperatorSessionRecord({ uid, operatorRecord })
);

const supportSession = normalize(buildOperatorRecord({
  email: ' support@example.com ',
  role: 'support',
}));

assert.deepEqual(supportSession, {
  uid: 'operator_123',
  email: 'support@example.com',
  role: 'support',
  is_active: true,
});

const adminSession = normalize(buildOperatorRecord({
  email: 'admin@example.com',
  role: 'admin',
}));

assert.deepEqual(adminSession, {
  uid: 'operator_123',
  email: 'admin@example.com',
  role: 'admin',
  is_active: true,
});

const sessionKeys = Object.keys(adminSession).sort();
assert.deepEqual(sessionKeys, ['email', 'is_active', 'role', 'uid']);
assert.equal(adminSession.secret_token, undefined);
assert.equal(adminSession.provider_config, undefined);
assert.equal(adminSession.created_at, undefined);
assert.equal(adminSession.updated_at, undefined);

const deniedCases = [
  ['missing record', null],
  ['inactive operator', buildOperatorRecord({ is_active: false })],
  ['malformed empty object', {}],
  ['malformed array', []],
  ['malformed uid mismatch', buildOperatorRecord({ uid: 'other_uid' })],
  ['malformed blank email', buildOperatorRecord({ email: ' ' })],
  ['unsupported role', buildOperatorRecord({ role: 'owner' })],
];

for (const [label, operatorRecord] of deniedCases) {
  assert.equal(normalize(operatorRecord), null, label);
}

console.log('Operator session helper checks passed.');
