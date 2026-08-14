#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getLockdownStateGuidance,
  getRequestAccessGuidance,
  getYoutubeBlockedGuidance,
  summarizeAllowedResources,
} from '../extensions/chrome-lockdown-poc/guidance.js';
import {
  LOCKDOWN_SYNC_STATUSES,
  parseRecoveryCode,
} from '../extensions/chrome-lockdown-poc/policy.js';

const blockedSource = readFileSync(
  new URL('../extensions/chrome-lockdown-poc/blocked.js', import.meta.url),
  'utf8'
);
const popupSource = readFileSync(
  new URL('../extensions/chrome-lockdown-poc/popup.js', import.meta.url),
  'utf8'
);
const optionsHtmlSource = readFileSync(
  new URL('../extensions/chrome-lockdown-poc/options.html', import.meta.url),
  'utf8'
);
const optionsSource = readFileSync(
  new URL('../extensions/chrome-lockdown-poc/options.js', import.meta.url),
  'utf8'
);
const backgroundSource = readFileSync(
  new URL('../extensions/chrome-lockdown-poc/background.js', import.meta.url),
  'utf8'
);
const allowlistSource = readFileSync(
  new URL('../extensions/chrome-lockdown-poc/allowlist.js', import.meta.url),
  'utf8'
);
const youtubeSource = readFileSync(
  new URL('../extensions/chrome-lockdown-poc/youtube-content.js', import.meta.url),
  'utf8'
);
const portalSource = readFileSync(
  new URL('../src/pages/StudentPortal.jsx', import.meta.url),
  'utf8'
);

assert.match(blockedSource, /SYNC_STATE_KEY/);
assert.match(blockedSource, /changes\[SYNC_STATE_KEY\]/);
assert.match(allowlistSource, /SYNC_STATE_KEY/);
assert.match(allowlistSource, /changes\[SYNC_STATE_KEY\]/);
assert.match(popupSource, /Managed by parent portal/);
assert.match(popupSource, /Parent recovery pending/);
assert.match(popupSource, /toggleButton\.disabled = paired \|\| legacyPairing \|\| recoveryPending/);
assert.match(optionsHtmlSource, /Parent recovery code/);
assert.match(optionsHtmlSource, /Clear older local pairing/);
assert.match(optionsSource, /clearButton\.hidden = paired/);
assert.match(optionsSource, /Parent recovery code required|recoveryCode/);
assert.match(backgroundSource, /Parent recovery code required before a paired device can clear local pairing/);
assert.match(backgroundSource, /validateTrustedRecovery/);
assert.match(backgroundSource, /status: 'recovery_unpaired'/);
assert.match(backgroundSource, /is_enabled: true/);

const recoveryCode = Buffer.from(JSON.stringify({
  version: 1,
  contract: 'trusted_lockdown_device_recovery_v1',
  recovery_token: 'ldr_1.recoveryDoc.secret',
  recovery_expires_at: '2026-05-28T12:15:00.000Z',
  recovery_url: 'https://us-central1-example.cloudfunctions.net/lockdownRecoverDevicePairing',
  parent_id: 'parent_1',
  student_id: 'student_1',
  device_id: 'device_1',
}), 'utf8').toString('base64url');
const parsedRecovery = parseRecoveryCode(recoveryCode);
assert.equal(parsedRecovery.recovery_kind, 'trusted_recovery');
assert.equal(parsedRecovery.recovery_contract, 'trusted_lockdown_device_recovery_v1');
assert.equal(parsedRecovery.device_id, 'device_1');
assert.equal(
  LOCKDOWN_SYNC_STATUSES.RECOVERY_UNPAIRED,
  'recovery_unpaired',
  'extension has a distinct recovered-unpaired state'
);

for (const importedName of [
  'getLockdownStateGuidance',
  'getRequestAccessGuidance',
  'getYoutubeBlockedGuidance',
  'summarizeAllowedResources',
]) {
  assert.ok(
    blockedSource.includes(importedName)
      || popupSource.includes(importedName)
      || allowlistSource.includes(importedName)
      || youtubeSource.includes(importedName)
      || portalSource.includes(importedName),
    `${importedName} is wired into the Phase 5 guidance surfaces`
  );
}

const noActiveWork = getLockdownStateGuidance({ stateKey: 'no_active_work' });
assert.equal(noActiveWork.stateKey, 'no_active_work');
assert.match(noActiveWork.title, /active work/i);
assert.match(noActiveWork.copy, /publish|resume/i);
assert.match(noActiveWork.copy, /parent-approved/i);
assert.match(noActiveWork.next_step, /student portal/i);

const offHoursClosed = getLockdownStateGuidance({ stateKey: 'off_hours_closed' });
assert.equal(offHoursClosed.stateKey, 'off_hours_closed');
assert.match(offHoursClosed.title, /lockdown is off/i);
assert.match(offHoursClosed.copy, /blocking is off/i);
assert.match(offHoursClosed.next_step, /schedule/i);

const offHoursOpen = getLockdownStateGuidance({
  syncState: {
    remote_policy_state: 'off_hours_open',
  },
});
assert.equal(offHoursOpen.stateKey, 'off_hours_closed');
assert.match(offHoursOpen.copy, /legacy saved off-hours windows|blocking is off/i);

const staleCachedPolicy = getLockdownStateGuidance({
  syncState: {
    remote_policy_state: 'stale_cached_policy',
  },
});
assert.equal(staleCachedPolicy.stateKey, 'stale_cached_policy');
assert.match(staleCachedPolicy.title, /cached policy/i);
assert.match(staleCachedPolicy.copy, /trusted policy is still active locally/i);
assert.match(staleCachedPolicy.next_step, /sync|repair/i);

const revokedDevice = getLockdownStateGuidance({
  syncState: {
    status: 'revoked',
  },
});
assert.equal(revokedDevice.stateKey, 'device_revoked');
assert.match(revokedDevice.title, /revoked/i);
assert.match(revokedDevice.copy, /re-pair|new device credential/i);
assert.match(revokedDevice.next_step, /pair the browser again/i);

const youtubeBlocked = getYoutubeBlockedGuidance({
  creator: {
    title: 'Crash Course Kids',
    handle: '@crashcoursekids',
    channelId: 'UCONtPx56PSebXJOxbFv-2jQ',
  },
});
assert.match(youtubeBlocked.title, /Crash Course Kids/i);
assert.match(youtubeBlocked.copy, /@crashcoursekids/i);
assert.match(youtubeBlocked.copy, /UCONtPx56PSebXJOxbFv-2jQ/i);
assert.match(youtubeBlocked.requestAccess.copy, /no self-serve unlock/i);

const cachedRequestAccess = getRequestAccessGuidance();
assert.equal(cachedRequestAccess.status, 'deferred');
assert.match(cachedRequestAccess.copy, /parent still has to approve/i);
assert.match(cachedRequestAccess.next_step, /update the schedule|plan|device pairing/i);

const allowedResources = summarizeAllowedResources({
  allowed_origins: [
    'https://www.khanacademy.org',
    'https://www.khanacademy.org/',
    'https://www.desmos.com',
  ],
  allowed_youtube_channels: [
    {
      channel_id: 'UCONtPx56PSebXJOxbFv-2jQ',
      title: 'Crash Course Kids',
      handle: '@crashcoursekids',
    },
    {
      channel_id: '',
      title: 'Ignore me',
      handle: '@ignore',
    },
  ],
  system_resources: [
    {
      resource_type: 'origin',
      name: 'Own Path student portal',
      origin: 'https://own-path.com',
      allowed: true,
    },
    {
      resource_type: 'decision',
      name: 'Parent dashboard access',
      origin: 'https://dashboard.own-path.com',
      allowed: false,
    },
  ],
});
assert.deepEqual(allowedResources.allowedOrigins, [
  'https://www.khanacademy.org',
  'https://www.desmos.com',
]);
assert.equal(allowedResources.allowedCreators.length, 1);
assert.equal(allowedResources.allowedSystemResources.length, 1);
assert.equal(allowedResources.allowedSystemResources[0].name, 'Own Path student portal');

console.log('Lockdown extension state checks passed.');
