import {
  LAST_BLOCKED_KEY,
  POLICY_KEY,
  SYNC_ALARM_NAME,
  SYNC_INTERVAL_MINUTES,
  buildUrlFilterForOrigin,
  clearPairingSettings,
  findAllowedYoutubeChannel,
  getPairingSettings,
  getPolicy,
  isLegacyPairing,
  isPairingConfigured,
  normalizeDevicePolicyEnvelope,
  normalizePolicy,
  normalizeTrustedEnrollmentMaterial,
  parsePairingCode,
  setPairingSettings,
  setPolicy,
  setSyncState,
} from './policy.js';

const BLOCK_ALL_RULE_ID = 1;
const ALLOW_RULE_START = 100;
const YOUTUBE_ALLOW_RULE_START = 1000;
const YOUTUBE_MAIN_FRAME_FILTERS = [
  '|https://www.youtube.com/watch',
  '|https://www.youtube.com/shorts/',
  '|https://youtube.com/watch',
  '|https://youtube.com/shorts/',
  '|https://m.youtube.com/watch',
  '|https://m.youtube.com/shorts/',
];

function buildAllowRule(origin, index) {
  const urlFilter = buildUrlFilterForOrigin(origin);
  if (!urlFilter) return null;

  return {
    id: ALLOW_RULE_START + index,
    priority: 2,
    action: { type: 'allow' },
    condition: {
      urlFilter,
      resourceTypes: ['main_frame'],
    },
  };
}

function buildBlockRule() {
  return {
    id: BLOCK_ALL_RULE_ID,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        extensionPath: '/blocked.html',
      },
    },
    condition: {
      regexFilter: '^https?://',
      resourceTypes: ['main_frame'],
    },
  };
}

function buildYoutubeAllowRules() {
  return YOUTUBE_MAIN_FRAME_FILTERS.map((urlFilter, index) => ({
    id: YOUTUBE_ALLOW_RULE_START + index,
    priority: 2,
    action: { type: 'allow' },
    condition: {
      urlFilter,
      resourceTypes: ['main_frame'],
    },
  }));
}

export function buildRules(policy) {
  if (!policy.is_enabled) {
    return [];
  }

  const allowRules = policy.allowed_origins
    .map((origin, index) => buildAllowRule(origin, index))
    .filter(Boolean);

  return [...allowRules, ...buildYoutubeAllowRules(), buildBlockRule()];
}

async function updateBadge(policy) {
  if (policy.is_enabled) {
    await chrome.action.setBadgeText({ text: 'ON' });
    await chrome.action.setBadgeBackgroundColor({ color: '#714cb6' });
    await chrome.action.setTitle({ title: 'GridWorkz Lockdown: blocking on' });
    return;
  }

  await chrome.action.setBadgeText({ text: '' });
  await chrome.action.setTitle({ title: 'GridWorkz Lockdown: blocking off' });
}

export async function applyPolicy(policy) {
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: currentRules.map((rule) => rule.id),
    addRules: buildRules(policy),
  });

  await updateBadge(policy);
}

export async function applyCachedPolicy() {
  const policy = await getPolicy();
  await applyPolicy(policy);
}

async function ensureSyncAlarm() {
  await chrome.alarms.clear(SYNC_ALARM_NAME);
  await chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: SYNC_INTERVAL_MINUTES });
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildEnrollmentExchangeError(response, payload) {
  const errorCode = payload?.error?.code || '';
  const errorMessage = payload?.error?.message || '';

  if (errorCode === 'enrollment_consumed') {
    return new Error('This trusted enrollment code was already used. Generate a new code in the parent dashboard.');
  }

  if (errorCode === 'enrollment_expired') {
    return new Error('This trusted enrollment code expired. Generate a new code in the parent dashboard.');
  }

  if (errorCode === 'lockdown_entitlement_inactive') {
    return new Error('The parent account no longer has active Lockdown browser-extension access.');
  }

  if (errorCode === 'enrollment_revoked') {
    return new Error('This trusted enrollment code was revoked. Generate a new code in the parent dashboard.');
  }

  if (errorCode === 'invalid_enrollment_token') {
    return new Error('The trusted enrollment code is invalid. Copy a fresh code from the parent dashboard.');
  }

  return new Error(errorMessage || `Trusted enrollment exchange failed with HTTP ${response.status}.`);
}

function buildPolicyReadError(response, payload) {
  const errorCode = payload?.error?.code || '';
  const errorMessage = payload?.error?.message || '';

  if (errorCode === 'invalid_device_credential') {
    return new Error('The saved device credential is no longer valid. Pair this browser again with a trusted enrollment code.');
  }

  if (errorCode === 'device_inactive') {
    return new Error('The saved device credential is no longer active. Pair this browser again with a trusted enrollment code.');
  }

  if (errorCode === 'device_not_found') {
    return new Error('The saved device record was not found. Pair this browser again with a trusted enrollment code.');
  }

  if (errorCode === 'lockdown_entitlement_inactive') {
    return new Error('The parent account no longer has active Lockdown browser-extension access.');
  }

  return new Error(errorMessage || `Secure policy sync failed with HTTP ${response.status}.`);
}

function assertTrustedEnrollmentMaterial(enrollmentMaterial) {
  const normalized = normalizeTrustedEnrollmentMaterial(enrollmentMaterial);
  if (!normalized.enrollment_token || !normalized.exchange_url || !normalized.policy_url) {
    throw new Error('Paste a valid trusted enrollment code from the parent dashboard.');
  }

  return normalized;
}

async function buildDeviceMetadata(deviceName = '') {
  let devicePlatform = 'unknown';

  try {
    const platformInfo = await chrome.runtime.getPlatformInfo();
    devicePlatform = [platformInfo.os, platformInfo.arch].filter(Boolean).join('/') || 'unknown';
  } catch {
    devicePlatform = 'unknown';
  }

  const extensionVersion = chrome.runtime.getManifest()?.version || '';
  const trimmedName = typeof deviceName === 'string' ? deviceName.trim() : '';

  return {
    device_name: trimmedName || `GridWorkz ${devicePlatform} browser`,
    device_platform: devicePlatform,
    extension_version: extensionVersion,
  };
}

export async function exchangeTrustedEnrollment(enrollmentMaterial, deviceName = '') {
  const trustedEnrollment = assertTrustedEnrollmentMaterial(enrollmentMaterial);
  const deviceMetadata = await buildDeviceMetadata(deviceName);

  const response = await fetch(trustedEnrollment.exchange_url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      enrollment_token: trustedEnrollment.enrollment_token,
      ...deviceMetadata,
    }),
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw buildEnrollmentExchangeError(response, payload);
  }

  const initialPolicy = normalizeDevicePolicyEnvelope(payload?.initial_policy || {});
  if (!payload?.device_credential || !payload?.device_id) {
    throw new Error('Trusted enrollment exchange succeeded, but the device credential payload was incomplete.');
  }

  return {
    pairing_contract: payload.contract || trustedEnrollment.pairing_contract,
    policy_read_contract: payload.policy_read_contract || initialPolicy.contract,
    device_id: payload.device_id,
    student_id: payload.student_id || initialPolicy.policy.student_id,
    device_credential: payload.device_credential,
    initial_policy: initialPolicy,
    source_policy_kind:
      trustedEnrollment.source_policy_kind || initialPolicy.source_policy.kind || '',
    source_policy_parent_id:
      trustedEnrollment.source_policy_parent_id || initialPolicy.source_policy.parent_id || '',
    exchange_url: trustedEnrollment.exchange_url,
    policy_url: trustedEnrollment.policy_url,
    enrollment_expires_at: trustedEnrollment.enrollment_expires_at,
    ...deviceMetadata,
  };
}

async function persistRemotePolicyEnvelope(envelope) {
  const normalizedEnvelope = normalizeDevicePolicyEnvelope(envelope);
  const persistedPolicy = await setPolicy(normalizedEnvelope.policy, { touchUpdatedAt: false });

  await setSyncState({
    status: 'synced',
    last_sync_at: new Date().toISOString(),
    last_error: '',
    using_cached_policy: false,
    remote_policy_updated_at: persistedPolicy.updated_at || normalizedEnvelope.source_policy_updated_at || null,
    remote_policy_state: normalizedEnvelope.policy_state,
    binding_status: normalizedEnvelope.policy_context.binding_status,
    binding_error: normalizedEnvelope.policy_context.binding_error,
    student_id: normalizedEnvelope.policy.student_id || normalizedEnvelope.policy_context.student_id,
    source_policy_kind: normalizedEnvelope.source_policy.kind,
    fetched_at: normalizedEnvelope.fetched_at,
    device_id: normalizedEnvelope.device_id,
  });

  return {
    envelope: normalizedEnvelope,
    policy: persistedPolicy,
  };
}

export async function fetchRemotePolicy(pairing) {
  if (!isPairingConfigured(pairing)) {
    throw new Error('Trusted device pairing is incomplete.');
  }

  const response = await fetch(pairing.policy_url, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${pairing.device_credential}`,
    },
    cache: 'no-store',
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw buildPolicyReadError(response, payload);
  }

  return normalizeDevicePolicyEnvelope(payload || {});
}

export async function pairTrustedEnrollment(enrollmentMaterial, deviceName = '') {
  const trustedEnrollment = assertTrustedEnrollmentMaterial(enrollmentMaterial);

  await setSyncState({
    status: 'syncing',
    last_attempt_at: new Date().toISOString(),
    last_error: '',
    using_cached_policy: false,
  });

  const exchangeResult = await exchangeTrustedEnrollment(trustedEnrollment, deviceName);
  const pairing = await setPairingSettings({
    pairing_kind: 'trusted_device',
    pairing_contract: exchangeResult.pairing_contract,
    policy_read_contract: exchangeResult.policy_read_contract,
    exchange_url: exchangeResult.exchange_url,
    policy_url: exchangeResult.policy_url,
    enrollment_expires_at: exchangeResult.enrollment_expires_at,
    source_policy_kind: exchangeResult.source_policy_kind,
    source_policy_parent_id: exchangeResult.source_policy_parent_id,
    student_id: exchangeResult.student_id,
    device_id: exchangeResult.device_id,
    device_name: exchangeResult.device_name,
    device_platform: exchangeResult.device_platform,
    extension_version: exchangeResult.extension_version,
    device_credential: exchangeResult.device_credential,
    paired_at: new Date().toISOString(),
    last_exchange_at: new Date().toISOString(),
  });

  await persistRemotePolicyEnvelope(exchangeResult.initial_policy);

  return {
    status: 'synced',
    pairing,
    device_id: exchangeResult.device_id,
    student_id: exchangeResult.student_id,
  };
}

async function setUnpairedSyncState() {
  await setSyncState({
    status: 'unpaired',
    last_attempt_at: new Date().toISOString(),
    last_error: '',
    using_cached_policy: false,
    remote_policy_updated_at: null,
    remote_policy_state: '',
    binding_status: '',
    binding_error: '',
    student_id: '',
    source_policy_kind: '',
    fetched_at: null,
    device_id: '',
  });
}

async function setMigrationRequiredSyncState(pairing) {
  await setSyncState({
    status: 'migration_required',
    last_attempt_at: new Date().toISOString(),
    last_error: 'Legacy PoC pairing detected. Pair this browser again with a trusted enrollment code.',
    using_cached_policy: true,
    remote_policy_updated_at: null,
    remote_policy_state: '',
    binding_status: '',
    binding_error: '',
    student_id: '',
    source_policy_kind: '',
    fetched_at: null,
    device_id: pairing?.device_id || '',
  });
}

export async function syncRemotePolicy(reason = 'manual') {
  const pairing = await getPairingSettings();

  if (isLegacyPairing(pairing)) {
    await applyCachedPolicy();
    await setMigrationRequiredSyncState(pairing);
    return { status: 'migration_required', reason };
  }

  if (!isPairingConfigured(pairing)) {
    await setUnpairedSyncState();
    return { status: 'unpaired', reason };
  }

  await setSyncState({
    status: 'syncing',
    last_attempt_at: new Date().toISOString(),
    last_error: '',
    using_cached_policy: false,
  });

  try {
    const remotePolicy = await fetchRemotePolicy(pairing);
    await persistRemotePolicyEnvelope(remotePolicy);
    return { status: 'synced', reason };
  } catch (error) {
    await applyCachedPolicy();
    await setSyncState({
      status: 'error',
      last_error: error instanceof Error ? error.message : String(error),
      using_cached_policy: true,
    });

    return {
      status: 'error',
      reason,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function clearTrustedPairing() {
  await clearPairingSettings();
  await setUnpairedSyncState();
  return { status: 'unpaired' };
}

async function resolveYoutubePageContext(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      const playerResponse = window.ytInitialPlayerResponse;
      const videoDetails = playerResponse?.videoDetails || null;
      const microformat = playerResponse?.microformat?.playerMicroformatRenderer || null;
      const ownerProfileUrl =
        typeof microformat?.ownerProfileUrl === 'string' ? microformat.ownerProfileUrl : '';
      const handleMatch = ownerProfileUrl.match(/\/(@[^/?]+)/i);

      return {
        channelId: typeof videoDetails?.channelId === 'string' ? videoDetails.channelId : '',
        title:
          typeof videoDetails?.author === 'string'
            ? videoDetails.author
            : typeof microformat?.ownerChannelName === 'string'
              ? microformat.ownerChannelName
              : '',
        handle: handleMatch ? handleMatch[1] : '',
        href: window.location.href,
        pathname: window.location.pathname,
      };
    },
  });

  return result?.result || null;
}

async function initializeRuntime(reason) {
  await ensureSyncAlarm();
  await applyCachedPolicy();
  await syncRemotePolicy(reason);
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeRuntime('install').catch((error) => {
    console.error('Failed to initialize lockdown policy:', error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  void initializeRuntime('startup').catch((error) => {
    console.error('Failed to sync lockdown policy on startup:', error);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SYNC_ALARM_NAME) {
    return;
  }

  void syncRemotePolicy('alarm').catch((error) => {
    console.error('Failed to sync lockdown policy on interval:', error);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (changes[POLICY_KEY]?.newValue) {
    void applyPolicy(normalizePolicy(changes[POLICY_KEY].newValue)).catch((error) => {
      console.error('Failed to apply updated lockdown policy:', error);
    });
  }
});

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((details) => {
    if (details.rule.ruleId !== BLOCK_ALL_RULE_ID) {
      return;
    }

    void chrome.storage.local.set({
      [LAST_BLOCKED_KEY]: {
        url: details.request.url,
        blocked_at: new Date().toISOString(),
      },
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'lockdown:pair-device') {
    void pairTrustedEnrollment(message.enrollmentMaterial, message.deviceName)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return true;
  }

  if (message?.type === 'lockdown:clear-pairing') {
    void clearTrustedPairing()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return true;
  }

  if (message?.type === 'lockdown:sync-now') {
    void syncRemotePolicy('manual').then(sendResponse).catch((error) => {
      sendResponse({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return true;
  }

  if (message?.type === 'lockdown:pair-code-preview') {
    try {
      const parsed = parsePairingCode(message.pairingCode);
      sendResponse({ status: parsed ? 'ok' : 'invalid', pairing: parsed });
    } catch (error) {
      sendResponse({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return false;
  }

  if (message?.type !== 'lockdown:resolve-youtube-access') {
    return false;
  }

  void (async () => {
    try {
      const policy = await getPolicy();
      if (!policy.is_enabled) {
        sendResponse({ status: 'disabled' });
        return;
      }

      const tabId = sender.tab?.id;
      if (typeof tabId !== 'number') {
        sendResponse({ status: 'error', reason: 'missing_tab_id' });
        return;
      }

      const creator = await resolveYoutubePageContext(tabId);
      if (!creator?.channelId) {
        sendResponse({ status: 'pending', creator });
        return;
      }

      const allowedChannel = findAllowedYoutubeChannel(policy, creator.channelId);
      sendResponse({
        status: allowedChannel ? 'allowed' : 'blocked',
        creator,
        allowedChannel,
      });
    } catch (error) {
      console.error('Failed to resolve YouTube creator access:', error);
      sendResponse({
        status: 'error',
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return true;
});

void ensureSyncAlarm().catch((error) => {
  console.error('Failed to schedule lockdown sync alarm:', error);
});

void applyCachedPolicy().catch((error) => {
  console.error('Failed to apply cached lockdown policy:', error);
});
