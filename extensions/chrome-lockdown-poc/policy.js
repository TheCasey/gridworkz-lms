export const POLICY_KEY = 'lockdownPolicy';
export const LAST_BLOCKED_KEY = 'lockdownLastBlockedRequest';
export const PAIRING_KEY = 'lockdownPairing';
export const SYNC_STATE_KEY = 'lockdownSyncState';
export const SYNC_ALARM_NAME = 'lockdownRemotePolicySync';
export const SYNC_INTERVAL_MINUTES = 1;

export const DEFAULT_POLICY = {
  parent_id: '',
  is_enabled: false,
  allowed_origins: [
    'https://www.khanacademy.org',
    'https://www.desmos.com'
  ],
  allowed_youtube_channels: [
    {
      channel_id: 'UCONtPx56PSebXJOxbFv-2jQ',
      title: 'Crash Course Kids',
      handle: '@crashcoursekids'
    },
    {
      channel_id: 'UC4a-Gbdw7vOaccHmFo40b9g',
      title: 'Khan Academy',
      handle: '@khanacademy'
    }
  ],
  updated_at: null
};

export const DEFAULT_PAIRING = {
  policy_id: '',
  project_id: '',
  api_key: '',
  paired_at: null
};

export const DEFAULT_SYNC_STATE = {
  status: 'unpaired',
  last_attempt_at: null,
  last_sync_at: null,
  last_error: '',
  using_cached_policy: false,
  remote_policy_updated_at: null
};

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

  const channelId = typeof channel.channel_id === 'string' ? channel.channel_id.trim() : '';
  if (!channelId) return null;

  return {
    channel_id: channelId,
    title: typeof channel.title === 'string' ? channel.title.trim() : '',
    handle: typeof channel.handle === 'string' ? channel.handle.trim() : ''
  };
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
    parent_id: typeof input.parent_id === 'string' ? input.parent_id.trim() : '',
    is_enabled: Boolean(input.is_enabled),
    allowed_origins: dedupedOrigins,
    allowed_youtube_channels: normalizedChannels,
    updated_at: typeof input.updated_at === 'string' ? input.updated_at : null
  };
}

export function normalizePairingSettings(input = {}) {
  return {
    policy_id: typeof input.policy_id === 'string' ? input.policy_id.trim() : '',
    project_id: typeof input.project_id === 'string' ? input.project_id.trim() : '',
    api_key: typeof input.api_key === 'string' ? input.api_key.trim() : '',
    paired_at: typeof input.paired_at === 'string' ? input.paired_at : null
  };
}

export function isPairingConfigured(pairing = {}) {
  const normalized = normalizePairingSettings(pairing);
  return Boolean(normalized.policy_id && normalized.project_id && normalized.api_key);
}

export function normalizeSyncState(input = {}) {
  return {
    status: typeof input.status === 'string' ? input.status : DEFAULT_SYNC_STATE.status,
    last_attempt_at:
      typeof input.last_attempt_at === 'string' ? input.last_attempt_at : DEFAULT_SYNC_STATE.last_attempt_at,
    last_sync_at:
      typeof input.last_sync_at === 'string' ? input.last_sync_at : DEFAULT_SYNC_STATE.last_sync_at,
    last_error: typeof input.last_error === 'string' ? input.last_error : DEFAULT_SYNC_STATE.last_error,
    using_cached_policy: Boolean(input.using_cached_policy),
    remote_policy_updated_at:
      typeof input.remote_policy_updated_at === 'string'
        ? input.remote_policy_updated_at
        : DEFAULT_SYNC_STATE.remote_policy_updated_at
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
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function buildPairingCode(input = {}) {
  const pairing = normalizePairingSettings(input);
  if (!isPairingConfigured(pairing)) {
    return '';
  }

  return encodeBase64Url(JSON.stringify({
    version: 1,
    policy_id: pairing.policy_id,
    project_id: pairing.project_id,
    api_key: pairing.api_key
  }));
}

export function parsePairingCode(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(value.trim()));
    if (parsed?.version !== 1) {
      return null;
    }

    const normalized = normalizePairingSettings(parsed);
    return isPairingConfigured(normalized) ? normalized : null;
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
      : normalized.updated_at
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
  const persisted = {
    ...normalized,
    paired_at: new Date().toISOString()
  };

  await chrome.storage.local.set({ [PAIRING_KEY]: persisted });
  return persisted;
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
    ...nextSyncState
  });

  await chrome.storage.local.set({ [SYNC_STATE_KEY]: merged });
  return merged;
}

function readFirestoreField(fieldValue) {
  if (!fieldValue || typeof fieldValue !== 'object') {
    return null;
  }

  if ('stringValue' in fieldValue) return fieldValue.stringValue;
  if ('booleanValue' in fieldValue) return Boolean(fieldValue.booleanValue);
  if ('timestampValue' in fieldValue) return fieldValue.timestampValue;
  if ('integerValue' in fieldValue) return Number(fieldValue.integerValue);
  if ('doubleValue' in fieldValue) return Number(fieldValue.doubleValue);
  if ('nullValue' in fieldValue) return null;

  if ('arrayValue' in fieldValue) {
    return Array.isArray(fieldValue.arrayValue?.values)
      ? fieldValue.arrayValue.values.map((entry) => readFirestoreField(entry))
      : [];
  }

  if ('mapValue' in fieldValue) {
    return Object.fromEntries(
      Object.entries(fieldValue.mapValue?.fields || {}).map(([key, value]) => [key, readFirestoreField(value)])
    );
  }

  return null;
}

export function parseFirestorePolicyDocument(document, fallbackPolicyId = '') {
  const fields = document?.fields || {};
  return normalizePolicy({
    parent_id: readFirestoreField(fields.parent_id) || fallbackPolicyId,
    is_enabled: readFirestoreField(fields.is_enabled),
    allowed_origins: readFirestoreField(fields.allowed_origins),
    allowed_youtube_channels: readFirestoreField(fields.allowed_youtube_channels),
    updated_at: readFirestoreField(fields.updated_at)
  });
}

export function buildFirestorePolicyUrl(pairing) {
  const normalized = normalizePairingSettings(pairing);
  if (!isPairingConfigured(normalized)) {
    return '';
  }

  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(normalized.project_id)}/databases/(default)/documents/lockdownPolicies/${encodeURIComponent(normalized.policy_id)}?key=${encodeURIComponent(normalized.api_key)}`;
}

export async function getLastBlockedRequest() {
  const stored = await chrome.storage.local.get([LAST_BLOCKED_KEY]);
  return stored[LAST_BLOCKED_KEY] || null;
}
