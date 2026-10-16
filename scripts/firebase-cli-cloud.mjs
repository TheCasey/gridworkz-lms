import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import cliAuth from 'firebase-tools/lib/requireAuth.js';
import api from 'firebase-tools/lib/api.js';

// Use the signed-in CLI's OAuth client in memory. Admin SDK custom credentials
// work for Auth but are not accepted by its Firestore wrapper.
export const createCliFirestore = async (projectId) => {
  if (!projectId || projectId.startsWith('demo-') || process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Cloud Firestore requires an explicit non-emulator project.');
  }
  const config = JSON.parse(await fs.readFile(`${process.env.HOME}/.config/configstore/firebase-tools.json`, 'utf8'));
  await cliAuth.requireAuth({ project: projectId, user: config.user, tokens: config.tokens });
  if (!config.tokens?.refresh_token) throw new Error('Local Firebase CLI sign-in is required.');
  const require = createRequire(new URL('../functions/package.json', import.meta.url));
  const { Firestore } = require('@google-cloud/firestore');
  const { GoogleAuth, OAuth2Client } = require('google-auth-library');
  const client = new OAuth2Client(api.clientId(), api.clientSecret());
  client.setCredentials({ refresh_token: config.tokens.refresh_token });
  try {
    await client.getAccessToken();
  } catch {
    // Do not expose OAuth request details in an unattended migration failure.
    throw new Error('Local Firebase CLI credentials could not be refreshed. Sign in locally again.');
  }
  return new Firestore({ projectId, auth: new GoogleAuth({ projectId, authClient: client }) });
};
