import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DIRECTION_PROJECT_ID } from './product-direction-fixtures.mjs';

export const requireDirectionEmulators = () => {
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!/^127\.0\.0\.1:\d+$/.test(process.env[name] || '')) throw new Error(`${name} must point to a local emulator.`);
  }
};
export const createDirectionAdmin = () => {
  requireDirectionEmulators();
  const require = createRequire(new URL('../functions/package.json', import.meta.url));
  const { initializeApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const app = initializeApp({ projectId: DIRECTION_PROJECT_ID }, 'direction-tests');
  return { app, db: getFirestore(app) };
};
export const callDirectionFunction = async (name, data, token = '') => {
  requireDirectionEmulators();
  const response = await fetch(`http://127.0.0.1:5001/${DIRECTION_PROJECT_ID}/us-central1/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return response.json();
};
export const directionStudentContext = (student) => ({ student_id: student.id, slug: student.slug, access_pin: student.access_pin });
export const signInDirectionParent = async (fixture) => {
  requireDirectionEmulators();
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fixture.auth.email, password: fixture.auth.password, returnSecureToken: true }),
  });
  const body = await response.json();
  assert.ok(response.ok && body.idToken, 'Emulator fixture parent must authenticate');
  return body.idToken;
};
