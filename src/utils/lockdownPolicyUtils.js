export const LOCKDOWN_POLICY_COLLECTION = 'lockdownPolicies';
export const LOCKDOWN_PAIRING_CODE_VERSION = 1;

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.khanacademy.org',
  'https://www.desmos.com',
];

export const DEFAULT_ALLOWED_YOUTUBE_CHANNELS = [
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
];

export const buildDefaultLockdownPolicy = (parentId = '') => ({
  parent_id: parentId,
  is_enabled: false,
  allowed_origins: [...DEFAULT_ALLOWED_ORIGINS],
  allowed_youtube_channels: DEFAULT_ALLOWED_YOUTUBE_CHANNELS.map((channel) => ({ ...channel })),
  updated_at: null,
});

export const normalizeOriginEntry = (value) => {
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
};

export const validateOriginInput = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return { origin: null, error: 'Enter a website origin to allow.' };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { origin: null, error: 'Enter a valid URL origin such as https://www.khanacademy.org.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { origin: null, error: 'Only http and https origins are supported.' };
  }

  if (parsed.username || parsed.password) {
    return { origin: null, error: 'Website entries cannot include usernames or passwords.' };
  }

  if (parsed.pathname && parsed.pathname !== '/') {
    return { origin: null, error: 'Use the site origin only. Remove any path after the domain.' };
  }

  if (parsed.search || parsed.hash) {
    return { origin: null, error: 'Remove query strings or hashes and save only the site origin.' };
  }

  return { origin: parsed.origin, error: null };
};

const normalizeChannelEntry = (channel) => {
  if (!channel || typeof channel !== 'object') return null;

  const channelId = typeof channel.channel_id === 'string' ? channel.channel_id.trim() : '';
  if (!channelId) return null;

  return {
    channel_id: channelId,
    title: typeof channel.title === 'string' ? channel.title.trim() : '',
    handle: typeof channel.handle === 'string' ? channel.handle.trim() : '',
  };
};

export const normalizeLockdownPolicy = (input = {}, parentId = '') => {
  const rawOrigins = Array.isArray(input.allowed_origins)
    ? input.allowed_origins
    : DEFAULT_ALLOWED_ORIGINS;
  const rawChannels = Array.isArray(input.allowed_youtube_channels)
    ? input.allowed_youtube_channels
    : DEFAULT_ALLOWED_YOUTUBE_CHANNELS;

  const allowedOrigins = Array.from(
    new Set(rawOrigins.map((origin) => normalizeOriginEntry(origin)).filter(Boolean))
  );
  const allowedYoutubeChannels = rawChannels
    .map((channel) => normalizeChannelEntry(channel))
    .filter(Boolean);

  return {
    parent_id: typeof input.parent_id === 'string' && input.parent_id.trim()
      ? input.parent_id.trim()
      : parentId,
    is_enabled: Boolean(input.is_enabled),
    allowed_origins: allowedOrigins,
    allowed_youtube_channels: allowedYoutubeChannels,
    updated_at: input.updated_at ?? null,
  };
};

const encodeBase64Url = (value) => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    const utf8 = new TextEncoder().encode(value);
    let binary = '';
    utf8.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  return '';
};

export const buildLockdownPairingCode = (parentId = '') => {
  const policyId = typeof parentId === 'string' ? parentId.trim() : '';
  const firebaseEnv = import.meta.env || {};
  const projectId = typeof firebaseEnv.VITE_FIREBASE_PROJECT_ID === 'string'
    ? firebaseEnv.VITE_FIREBASE_PROJECT_ID.trim()
    : '';
  const apiKey = typeof firebaseEnv.VITE_FIREBASE_API_KEY === 'string'
    ? firebaseEnv.VITE_FIREBASE_API_KEY.trim()
    : '';

  if (!policyId || !projectId || !apiKey) {
    return '';
  }

  return encodeBase64Url(JSON.stringify({
    version: LOCKDOWN_PAIRING_CODE_VERSION,
    policy_id: policyId,
    project_id: projectId,
    api_key: apiKey,
  }));
};
