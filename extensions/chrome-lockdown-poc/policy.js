export const POLICY_KEY = 'lockdownPolicy';
export const LAST_BLOCKED_KEY = 'lockdownLastBlockedRequest';
export const PAIRING_KEY = 'lockdownPairing';
export const SYNC_STATE_KEY = 'lockdownSyncState';
export const SYNC_ALARM_NAME = 'lockdownRemotePolicySync';
export const SYNC_INTERVAL_MINUTES = 1;

export const LOCKDOWN_POC_PAIRING_CODE_VERSION = 1;
export const LOCKDOWN_TRUSTED_ENROLLMENT_CODE_VERSION = 1;

export const LOCKDOWN_POC_PAIRING_CONTRACT = 'lockdown_poc_firestore_pairing_v1';
export const LOCKDOWN_TRUSTED_ENROLLMENT_CONTRACT = 'trusted_lockdown_enrollment_v1';
export const LOCKDOWN_TRUSTED_POLICY_READ_CONTRACT = 'trusted_lockdown_device_policy_v1';

export const PAIRING_KINDS = Object.freeze({
  UNPAIRED: 'unpaired',
  TRUSTED_DEVICE: 'trusted_device',
  LEGACY_POC: 'legacy_poc',
});

export const DEFAULT_POLICY = {
  parent_id: '',
  student_id: '',
  is_enabled: false,
  allowed_origins: [
    'https://www.khanacademy.org',
    'https://www.desmos.com',
  ],
  allowed_youtube_channels: [
    {
      channel_id: 'UCONtPx56PSebXJOxbFv-2jQ',
      title: 'Crash Course Kids',
      handle: '@crashcoursekids',
    },
    {
      channel_id: 'UC4a-Gbdw7vOaccHmFo40b9g',
      title: 'Khan Academy',
      handle: '@khanacademy',
    },
  ],
  updated_at: null,
};

export const DEFAULT_PAIRING = {
  pairing_kind: PAIRING_KINDS.UNPAIRED,
  pairing_contract: '',
  policy_read_contract: '',
  exchange_url: '',
  policy_url: '',
  enrollment_expires_at: null,
  source_policy_kind: '',
  source_policy_parent_id: '',
  student_id: '',
  device_id: '',
  device_name: '',
  device_platform: '',
  extension_version: '',
  device_credential: '',
  paired_at: null,
  last_exchange_at: null,
  legacy_policy_id: '',
  legacy_project_id: '',
  legacy_api_key: '',
  migration_required: false,
};

export const DEFAULT_SYNC_STATE = {
  status: 'unpaired',
  last_attempt_at: null,
  last_sync_at: null,
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
};

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRemoteUrl(value) {
  const trimmed = trimString(value);
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

export function normalizeOriginEntry(value) {
  if (typeof value !== 'string') return null;

  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeChannelEntry(channel) {
  if (!channel || typeof channel !== 'object') return null;

  const channelId = trimString(channel.channel_id);
  if (!channelId) return null;

  return {
    channel_id: channelId,
    title: trimString(channel.title),
    handle: trimString(channel.handle),
  };
}

function normalizeBoolean(value) {
  return Boolean(value);
}

function normalizeTimestampString(value) {
  return typeof value === 'string' ? value : null;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizePolicy(input = {}) {
  const rawOrigins = Array.isArray(input.allowed_origins)
    ? input.allowed_origins
    : DEFAULT_POLICY.allowed_origins;
  const rawChannels = Array.isArray(input.allowed_youtube_channels)
    ? input.allowed_youtube_channels
    : DEFAULT_POLICY.allowed_youtube_channels;

  const dedupedOrigins = Array.from(
    new Set(rawOrigins.map((origin) => normalizeOriginEntry(origin)).filter(Boolean))
  );
  const normalizedChannels = rawChannels
    .map((channel) => normalizeChannelEntry(channel))
    .filter(Boolean);

  return {
    parent_id: trimString(input.parent_id),
    student_id: trimString(input.student_id),
    is_enabled: Boolean(input.is_enabled),
    allowed_origins: dedupedOrigins,
    allowed_youtube_channels: normalizedChannels,
    updated_at: normalizeTimestampString(input.updated_at),
  };
}

export function normalizeTrustedEnrollmentMaterial(input = {}) {
  return {
    pairing_kind: 'trusted_enrollment',
    pairing_contract: trimString(input.contract) || LOCKDOWN_TRUSTED_ENROLLMENT_CONTRACT,
    enrollment_token: trimString(input.enrollment_token),
    enrollment_expires_at:
      normalizeTimestampString(input.enrollment_expires_at)
      || normalizeTimestampString(input.expires_at),
    exchange_url: normalizeRemoteUrl(input.exchange_url),
    policy_url: normalizeRemoteUrl(input.policy_url),
    source_policy_kind: trimString(input.source_policy_kind),
    source_policy_parent_id: trimString(input.source_policy_parent_id),
    student_id: trimString(input.student_id),
  };
}

function normalizeLegacyPairingSettings(input = {}) {
  return {
    ...DEFAULT_PAIRING,
    pairing_kind: PAIRING_KINDS.LEGACY_POC,
    pairing_contract: trimString(input.contract) || LOCKDOWN_POC_PAIRING_CONTRACT,
    legacy_policy_id: trimString(input.legacy_policy_id) || trimString(input.policy_id),
    legacy_project_id: trimString(input.legacy_project_id) || trimString(input.project_id),
    legacy_api_key: trimString(input.legacy_api_key) || trimString(input.api_key),
    paired_at: normalizeTimestampString(input.paired_at),
    migration_required: true,
  };
}

function normalizeTrustedDevicePairing(input = {}) {
  return {
    ...DEFAULT_PAIRING,
    pairing_kind: PAIRING_KINDS.TRUSTED_DEVICE,
    pairing_contract: trimString(input.pairing_contract) || LOCKDOWN_TRUSTED_ENROLLMENT_CONTRACT,
    policy_read_contract:
      trimString(input.policy_read_contract) || LOCKDOWN_TRUSTED_POLICY_READ_CONTRACT,
    exchange_url: normalizeRemoteUrl(input.exchange_url),
    policy_url: normalizeRemoteUrl(input.policy_url),
    enrollment_expires_at: normalizeTimestampString(input.enrollment_expires_at),
    source_policy_kind: trimString(input.source_policy_kind),
    source_policy_parent_id: trimString(input.source_policy_parent_id),
    student_id: trimString(input.student_id),
    device_id: trimString(input.device_id),
    device_name: trimString(input.device_name),
    device_platform: trimString(input.device_platform),
    extension_version: trimString(input.extension_version),
    device_credential: trimString(input.device_credential),
    paired_at: normalizeTimestampString(input.paired_at),
    last_exchange_at: normalizeTimestampString(input.last_exchange_at),
    migration_required: false,
  };
}

export function normalizePairingSettings(input = {}) {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_PAIRING };
  }

  const pairingKind = trimString(input.pairing_kind);
  const hasTrustedCredential = Boolean(
    trimString(input.device_credential)
      && normalizeRemoteUrl(input.policy_url)
  );
  const hasLegacyFields = Boolean(
    trimString(input.policy_id)
      || trimString(input.project_id)
      || trimString(input.api_key)
      || trimString(input.legacy_policy_id)
      || trimString(input.legacy_project_id)
      || trimString(input.legacy_api_key)
  );

  if (pairingKind === PAIRING_KINDS.TRUSTED_DEVICE || hasTrustedCredential) {
    return normalizeTrustedDevicePairing(input);
  }

  if (pairingKind === PAIRING_KINDS.LEGACY_POC || hasLegacyFields) {
    return normalizeLegacyPairingSettings(input);
  }

  return { ...DEFAULT_PAIRING };
}

export function isPairingConfigured(pairing = {}) {
  const normalized = normalizePairingSettings(pairing);
  return Boolean(
    normalized.pairing_kind === PAIRING_KINDS.TRUSTED_DEVICE
      && normalized.device_credential
      && normalized.policy_url
  );
}

export function isLegacyPairing(pairing = {}) {
  return normalizePairingSettings(pairing).pairing_kind === PAIRING_KINDS.LEGACY_POC;
}

function normalizePolicyContext(input = {}) {
  return {
    binding_status: trimString(input.binding_status),
    binding_error: trimString(input.binding_error),
    student_id: trimString(input.student_id),
    in_school_time: normalizeBoolean(input.in_school_time),
    active_block:
      input.active_block && typeof input.active_block === 'object'
        ? {
            id: trimString(input.active_block.id),
            title: trimString(input.active_block.title),
            assignment_id: trimString(input.active_block.assignment_id),
            category: trimString(input.active_block.category),
          }
        : null,
    unsupported_resources: normalizeArray(input.unsupported_resources).map((resource) => ({
      name: trimString(resource?.name),
      url: trimString(resource?.url),
      reason: trimString(resource?.reason),
    })),
  };
}

function normalizeSourcePolicy(input = {}) {
  return {
    kind: trimString(input.kind),
    parent_id: trimString(input.parent_id),
    student_id: trimString(input.student_id),
    weekly_plan_id: trimString(input.weekly_plan_id),
    derived_state: trimString(input.derived_state),
    is_legacy_poc_boundary: Boolean(input.is_legacy_poc_boundary),
    document_exists: Boolean(input.document_exists),
  };
}

export function normalizeDevicePolicyEnvelope(input = {}) {
  return {
    contract: trimString(input.contract) || LOCKDOWN_TRUSTED_POLICY_READ_CONTRACT,
    contract_version: Number.isFinite(Number(input.contract_version))
      ? Number(input.contract_version)
      : 1,
    device_id: trimString(input.device_id),
    policy_state: trimString(input.policy_state),
    policy: normalizePolicy(input.policy || {}),
    policy_context: normalizePolicyContext(input.policy_context || {}),
    source_policy: normalizeSourcePolicy(input.source_policy || {}),
    source_policy_updated_at: normalizeTimestampString(input.source_policy_updated_at),
    fetched_at: normalizeTimestampString(input.fetched_at),
  };
}

export function normalizeSyncState(input = {}) {
  return {
    status: trimString(input.status) || DEFAULT_SYNC_STATE.status,
    last_attempt_at:
      normalizeTimestampString(input.last_attempt_at) || DEFAULT_SYNC_STATE.last_attempt_at,
    last_sync_at:
      normalizeTimestampString(input.last_sync_at) || DEFAULT_SYNC_STATE.last_sync_at,
    last_error: trimString(input.last_error),
    using_cached_policy: Boolean(input.using_cached_policy),
    remote_policy_updated_at:
      normalizeTimestampString(input.remote_policy_updated_at)
      || DEFAULT_SYNC_STATE.remote_policy_updated_at,
    remote_policy_state: trimString(input.remote_policy_state),
    binding_status: trimString(input.binding_status),
    binding_error: trimString(input.binding_error),
    student_id: trimString(input.student_id),
    source_policy_kind: trimString(input.source_policy_kind),
    fetched_at: normalizeTimestampString(input.fetched_at) || DEFAULT_SYNC_STATE.fetched_at,
    device_id: trimString(input.device_id),
  };
}

function encodeBase64Url(value) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseDecodedPairingPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (
    payload.version === LOCKDOWN_TRUSTED_ENROLLMENT_CODE_VERSION
    && trimString(payload.contract) === LOCKDOWN_TRUSTED_ENROLLMENT_CONTRACT
  ) {
    const normalized = normalizeTrustedEnrollmentMaterial(payload);
    return normalized.enrollment_token && normalized.exchange_url && normalized.policy_url
      ? normalized
      : null;
  }

  if (
    payload.version === LOCKDOWN_POC_PAIRING_CODE_VERSION
    && trimString(payload.contract) === LOCKDOWN_POC_PAIRING_CONTRACT
  ) {
    const normalized = normalizeLegacyPairingSettings(payload);
    return normalized.legacy_policy_id && normalized.legacy_project_id && normalized.legacy_api_key
      ? normalized
      : null;
  }

  return null;
}

export function buildTrustedEnrollmentCode(input = {}) {
  const material = normalizeTrustedEnrollmentMaterial(input);
  if (!material.enrollment_token || !material.exchange_url || !material.policy_url) {
    return '';
  }

  return encodeBase64Url(JSON.stringify({
    version: LOCKDOWN_TRUSTED_ENROLLMENT_CODE_VERSION,
    contract: material.pairing_contract,
    enrollment_token: material.enrollment_token,
    enrollment_expires_at: material.enrollment_expires_at,
    exchange_url: material.exchange_url,
    policy_url: material.policy_url,
  }));
}

export function parsePairingCode(value) {
  const trimmed = trimString(value);
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(trimmed));
    return parseDecodedPairingPayload(parsed);
  } catch {
    return null;
  }
}

export function buildUrlFilterForOrigin(origin) {
  const normalizedOrigin = normalizeOriginEntry(origin);
  return normalizedOrigin ? `|${normalizedOrigin}/` : null;
}

export function findAllowedYoutubeChannel(policy, channelId) {
  if (!channelId || !Array.isArray(policy?.allowed_youtube_channels)) {
    return null;
  }

  return (
    policy.allowed_youtube_channels.find((channel) => channel.channel_id === channelId) || null
  );
}

export async function getPolicy() {
  const stored = await chrome.storage.local.get([POLICY_KEY]);
  const existingPolicy = stored[POLICY_KEY];

  if (!existingPolicy) {
    return setPolicy(DEFAULT_POLICY);
  }

  const normalized = normalizePolicy(existingPolicy);
  if (JSON.stringify(normalized) !== JSON.stringify(existingPolicy)) {
    await chrome.storage.local.set({ [POLICY_KEY]: normalized });
  }

  return normalized;
}

export async function setPolicy(nextPolicy, options = {}) {
  const normalized = normalizePolicy(nextPolicy);
  const { touchUpdatedAt = true } = options;
  const persisted = {
    ...normalized,
    updated_at: touchUpdatedAt
      ? new Date().toISOString()
      : normalized.updated_at,
  };

  await chrome.storage.local.set({ [POLICY_KEY]: persisted });
  return persisted;
}

export async function getPairingSettings() {
  const stored = await chrome.storage.local.get([PAIRING_KEY]);
  return normalizePairingSettings(stored[PAIRING_KEY] || DEFAULT_PAIRING);
}

export async function setPairingSettings(nextPairing) {
  const normalized = normalizePairingSettings(nextPairing);
  await chrome.storage.local.set({ [PAIRING_KEY]: normalized });
  return normalized;
}

export async function clearPairingSettings() {
  await chrome.storage.local.remove([PAIRING_KEY]);
}

export async function getSyncState() {
  const stored = await chrome.storage.local.get([SYNC_STATE_KEY]);
  return normalizeSyncState(stored[SYNC_STATE_KEY] || DEFAULT_SYNC_STATE);
}

export async function setSyncState(nextSyncState) {
  const current = await getSyncState();
  const merged = normalizeSyncState({
    ...current,
    ...nextSyncState,
  });

  await chrome.storage.local.set({ [SYNC_STATE_KEY]: merged });
  return merged;
}

export async function getLastBlockedRequest() {
  const stored = await chrome.storage.local.get([LAST_BLOCKED_KEY]);
  return stored[LAST_BLOCKED_KEY] || null;
}
