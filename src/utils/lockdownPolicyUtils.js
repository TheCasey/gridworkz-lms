import { TrustedFunctionNames, WeeklyPlanStatuses } from '../constants/schema.js';
import { getDashboardHost, getPublicHost } from './appHosts.js';
import { normalizeLockdownSchedule, resolveLockdownTimeContext } from './schoolSettingsUtils.js';

export const LOCKDOWN_POC_POLICY_COLLECTION = 'lockdownPolicies';
export const LOCKDOWN_POLICY_COLLECTION = LOCKDOWN_POC_POLICY_COLLECTION;
export const LOCKDOWN_ENROLLMENT_COLLECTION = 'lockdownEnrollmentSessions';
export const LOCKDOWN_DEVICE_COLLECTION = 'lockdownDevices';

export const LOCKDOWN_POC_PAIRING_CODE_VERSION = 1;
export const LOCKDOWN_TRUSTED_ENROLLMENT_CODE_VERSION = 1;
export const LOCKDOWN_TRUSTED_RECOVERY_CODE_VERSION = 1;

export const LOCKDOWN_POC_PAIRING_CONTRACT = 'lockdown_poc_firestore_pairing_v1';
export const LOCKDOWN_TRUSTED_ENROLLMENT_CONTRACT = 'trusted_lockdown_enrollment_v1';
export const LOCKDOWN_TRUSTED_POLICY_READ_CONTRACT = 'trusted_lockdown_device_policy_v1';
export const LOCKDOWN_TRUSTED_RECOVERY_CONTRACT = 'trusted_lockdown_device_recovery_v1';
export const LOCKDOWN_POC_POLICY_SOURCE_KIND = 'lockdown_policy_poc_document';
export const LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND = 'published_weekly_plan_derived_policy_v1';

export const LockdownProductionPolicyStates = Object.freeze({
  ACTIVE_BLOCK: 'active_block',
  NO_ACTIVE_SESSION: 'no_active_session',
  NO_PUBLISHED_PLAN: 'no_published_plan',
  NO_ACTIVE_WORK: 'no_active_work',
  OFF_HOURS_OPEN: 'off_hours_open',
  OFF_HOURS_CLOSED: 'off_hours_closed',
  ENTITLEMENT_INACTIVE: 'entitlement_inactive',
  DEVICE_REVOKED: 'device_revoked',
  UNPAIRED: 'unpaired',
  STALE_CACHED_POLICY: 'stale_cached_policy',
});

export const LockdownPolicyStates = Object.freeze({
  ACTIVE_BLOCK: 'active_block',
  NO_ACTIVE_BLOCK: 'no_active_block',
  OUTSIDE_SCHOOL_TIME: 'outside_school_time',
  ENTITLEMENT_INACTIVE: 'entitlement_inactive',
});

export const LockdownActiveWorkSessionKinds = Object.freeze({
  TIMER: 'timer',
  TASK_COMPLETE: 'task_complete',
  PROJECT: 'project',
  WORKSHEET: 'worksheet',
});

const LOCKDOWN_PRODUCTION_POLICY_STATE_VALUES = new Set(Object.values(LockdownProductionPolicyStates));
const LOCKDOWN_ACTIVE_WORK_SESSION_KIND_VALUES = new Set(Object.values(LockdownActiveWorkSessionKinds));
const LOCKDOWN_ACTIVE_WORK_STATE_VALUES = new Set([
  LockdownProductionPolicyStates.ACTIVE_BLOCK,
  LockdownProductionPolicyStates.NO_ACTIVE_SESSION,
  LockdownProductionPolicyStates.NO_PUBLISHED_PLAN,
  LockdownProductionPolicyStates.NO_ACTIVE_WORK,
]);

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

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_OFF_HOURS_START_TIME = '18:00';
const DEFAULT_OFF_HOURS_END_TIME = '20:00';
const LOCKDOWN_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const trimString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toUniqueStringArray = (value) => Array.from(
  new Set(
    (Array.isArray(value) ? value : [])
      .map((entry) => trimString(entry))
      .filter(Boolean)
  )
);

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const YOUTUBE_CHANNEL_PATH_PATTERN = /^\/channel\/([^/?#]+)/i;
const YOUTUBE_HANDLE_PATH_PATTERN = /^\/@([^/?#]+)/i;
const YOUTUBE_SHORTS_PATH_PATTERN = /^\/shorts\/([^/?#]+)/i;
const YOUTUBE_EMBED_PATH_PATTERN = /^\/embed\/([^/?#]+)/i;
const YOUTUBE_PLAYLIST_PATH_PATTERN = /^\/playlist(?:\/|$)/i;
const YOUTUBE_BARE_HANDLE_PATTERN = /^@[^\s/?#]+$/;
const YOUTUBE_BARE_CHANNEL_ID_PATTERN = /^UC[a-zA-Z0-9_-]{10,}$/;

export const LockdownResourceTestDecisions = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
  UNSUPPORTED: 'unsupported',
  METADATA_NEEDED: 'metadata-needed',
});

const DEFAULT_EXTENSION_PAGE_NAMES = Object.freeze([
  'allowlist.html',
  'blocked.html',
  'popup.html',
  'options.html',
]);

const resolveAbsoluteUrl = (value = '') => {
  const trimmedValue = trimString(value);

  if (!trimmedValue) {
    return '';
  }

  try {
    return new URL(trimmedValue).toString();
  } catch {
    try {
      return new URL(`https://${trimmedValue}`).toString();
    } catch {
      return '';
    }
  }
};

const resolveOriginFromHost = (host = '') => {
  const resolvedUrl = resolveAbsoluteUrl(host);
  if (!resolvedUrl) {
    return '';
  }

  try {
    return new URL(resolvedUrl).origin;
  } catch {
    return '';
  }
};

const resolveHttpOriginFromValue = (value = '') => {
  const trimmedValue = trimString(value);

  if (!trimmedValue) {
    return '';
  }

  let parsedUrl = null;

  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    try {
      parsedUrl = new URL(`https://${trimmedValue}`);
    } catch {
      return '';
    }
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return '';
  }

  return parsedUrl.origin;
};

const buildUrlFromOrigin = (origin = '', path = '') => {
  const trimmedOrigin = resolveOriginFromHost(origin);
  if (!trimmedOrigin) {
    return '';
  }

  const normalizedPath = trimString(path).replace(/^\/+/, '');
  return normalizedPath ? `${trimmedOrigin}/${normalizedPath}` : trimmedOrigin;
};

const buildOwnPathPublicOrigins = () => {
  const publicOrigin = resolveOriginFromHost(getPublicHost());
  const origins = [publicOrigin].filter(Boolean);

  try {
    const parsedOrigin = new URL(publicOrigin);
    const hasOwnPathHost = parsedOrigin.hostname === 'own-path.com'
      || parsedOrigin.hostname === 'www.own-path.com';

    if (hasOwnPathHost) {
      const alternateHost = parsedOrigin.hostname === 'own-path.com'
        ? 'www.own-path.com'
        : 'own-path.com';
      const alternateOrigin = `${parsedOrigin.protocol}//${alternateHost}${parsedOrigin.port ? `:${parsedOrigin.port}` : ''}`;
      origins.push(alternateOrigin);
    }
  } catch {
    // Ignore malformed config; the primary resolved origin is already validated above.
  }

  return Array.from(new Set(origins));
};

const normalizeSystemResourceEntry = (resource = {}) => {
  if (!isPlainObject(resource)) {
    return null;
  }

  const resourceType = trimString(resource.resource_type || resource.type);
  const name = trimString(resource.name || resource.label);
  const origin = resolveOriginFromHost(resource.origin || resource.url);
  const url = resolveAbsoluteUrl(resource.url);
  const allowed = resource.allowed !== false;
  const decision = trimString(resource.decision);
  const scope = trimString(resource.scope);
  const page = trimString(resource.page);
  const pages = Array.isArray(resource.pages)
    ? resource.pages.map((value) => trimString(value)).filter(Boolean)
    : [];
  const urls = Array.isArray(resource.urls)
    ? resource.urls.map((value) => resolveAbsoluteUrl(value)).filter(Boolean)
    : [];

  if (!resourceType && !name && !origin && !url && !page && !pages.length && !urls.length && !decision) {
    return null;
  }

  return {
    resource_type: resourceType || (decision ? 'decision' : origin ? 'origin' : page ? 'page_group' : ''),
    name,
    label: name,
    origin,
    url,
    allowed,
    decision,
    scope,
    page,
    pages,
    urls,
  };
};

export const describeLockdownSystemResource = (resource = {}) => {
  const normalizedResource = normalizeSystemResourceEntry(resource);
  const resourceType = normalizedResource?.resource_type || normalizedResource?.type || '';

  if (resourceType === 'decision') {
    return 'Deliberately excluded from the student Lockdown allowlist.';
  }

  if (resourceType === 'page_group') {
    const pages = Array.isArray(normalizedResource?.pages)
      ? normalizedResource.pages.filter(Boolean)
      : [];
    return pages.length ? `Pages: ${pages.join(', ')}` : 'Extension pages are modeled separately.';
  }

  if (resourceType === 'origin') {
    return normalizedResource?.url || normalizedResource?.origin || 'System origin';
  }

  return normalizedResource?.url || normalizedResource?.origin || normalizedResource?.page || 'System resource';
};

export const buildOwnPathSystemResourceAllowlist = ({
  studentRecord = null,
  parentId = '',
} = {}) => {
  const publicOrigins = buildOwnPathPublicOrigins();
  const dashboardOrigin = resolveOriginFromHost(getDashboardHost());
  const enrollmentUrl = buildTrustedLockdownFunctionUrl(
    TrustedFunctionNames.EXCHANGE_LOCKDOWN_ENROLLMENT
  );
  const policyUrl = buildTrustedLockdownFunctionUrl(
    TrustedFunctionNames.READ_LOCKDOWN_DEVICE_POLICY
  );
  const trustedEndpointsOrigin = resolveOriginFromHost(policyUrl || enrollmentUrl);
  const publicStudentPath = trimString(studentRecord?.slug)
    ? `student/${studentRecord.slug}`
    : 'student';

  const publicSystemResources = publicOrigins.map((origin, index) => normalizeSystemResourceEntry({
    resource_type: 'origin',
    name: index === 0 ? 'Own Path student portal' : 'Own Path public app alias',
    label: index === 0 ? 'Own Path student portal' : 'Own Path public app alias',
    origin,
    url: buildUrlFromOrigin(origin, publicStudentPath),
    allowed: true,
    scope: index === 0 ? 'student_portal' : 'public_app_alias',
  }));

  return [
    ...publicSystemResources,
    normalizeSystemResourceEntry({
      resource_type: 'origin',
      name: 'Own Path trusted policy endpoints',
      label: 'Own Path trusted policy endpoints',
      origin: trustedEndpointsOrigin,
      url: policyUrl || enrollmentUrl,
      allowed: true,
      scope: 'trusted_policy_endpoints',
      urls: [enrollmentUrl, policyUrl],
    }),
    normalizeSystemResourceEntry({
      resource_type: 'page_group',
      name: 'Own Path extension pages',
      label: 'Own Path extension pages',
      allowed: true,
      scope: 'extension_pages',
      pages: DEFAULT_EXTENSION_PAGE_NAMES,
    }),
    normalizeSystemResourceEntry({
      resource_type: 'decision',
      name: 'Parent dashboard access',
      label: 'Parent dashboard access',
      origin: dashboardOrigin,
      url: buildUrlFromOrigin(dashboardOrigin, 'dashboard'),
      allowed: false,
      decision: 'excluded_from_system_allowlist',
      scope: 'parent_dashboard_access',
      parent_id: trimString(parentId),
    }),
  ].filter(Boolean);
};

export const getLockdownSystemResourceOrigins = (resources = []) => {
  const originSet = new Set();
  const origins = [];

  (Array.isArray(resources) ? resources : []).forEach((resource) => {
    const normalizedResource = normalizeSystemResourceEntry(resource);
    const origin = normalizedResource?.allowed === false
      ? ''
      : normalizedResource?.origin;

    if (origin && !originSet.has(origin)) {
      originSet.add(origin);
      origins.push(origin);
    }
  });

  return origins;
};

export const buildDefaultLockdownPolicy = (parentId = '') => ({
  parent_id: parentId,
  is_enabled: false,
  allowed_origins: [...DEFAULT_ALLOWED_ORIGINS],
  allowed_youtube_channels: DEFAULT_ALLOWED_YOUTUBE_CHANNELS.map((channel) => ({ ...channel })),
  system_resources: [],
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

const normalizeYoutubeHandle = (value = '') => {
  const trimmedValue = trimString(value).replace(/^@+/, '');
  return trimmedValue ? `@${trimmedValue}` : '';
};

const getYoutubeChannelMetadata = (source = {}) => ({
  channel_id: trimString(source.youtube_channel_id),
  title: trimString(source.youtube_channel_title) || trimString(source.name),
  handle: normalizeYoutubeHandle(source.youtube_channel_handle),
});

const getYoutubePolicyChannelMatch = (channel = {}, policyChannels = []) => {
  if (!isPlainObject(channel) || !Array.isArray(policyChannels)) {
    return null;
  }

  const normalizedChannelId = trimString(channel.channel_id);
  const normalizedHandle = normalizeYoutubeHandle(channel.handle).toLowerCase();

  if (normalizedChannelId) {
    const channelMatch = policyChannels.find((candidate) => (
      trimString(candidate?.channel_id) === normalizedChannelId
    ));

    if (channelMatch) {
      return normalizeChannelEntry(channelMatch);
    }
  }

  if (normalizedHandle) {
    const handleMatch = policyChannels.find((candidate) => (
      normalizeYoutubeHandle(candidate?.handle).toLowerCase() === normalizedHandle
    ));

    if (handleMatch) {
      return normalizeChannelEntry(handleMatch);
    }
  }

  return null;
};

const parseYouTubeResourceReference = (value = '') => {
  const rawValue = trimString(value);

  if (!rawValue) {
    return null;
  }

  if (YOUTUBE_BARE_HANDLE_PATTERN.test(rawValue)) {
    return {
      source: 'bare_handle',
      reference_type: 'handle',
      handle: normalizeYoutubeHandle(rawValue),
      channel_id: '',
      video_id: '',
      playlist_id: '',
      normalized_url: `https://www.youtube.com/${normalizeYoutubeHandle(rawValue)}`,
    };
  }

  if (YOUTUBE_BARE_CHANNEL_ID_PATTERN.test(rawValue)) {
    return {
      source: 'bare_channel_id',
      reference_type: 'channel',
      handle: '',
      channel_id: rawValue,
      video_id: '',
      playlist_id: '',
      normalized_url: `https://www.youtube.com/channel/${rawValue}`,
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawValue);
  } catch {
    try {
      parsedUrl = new URL(`https://${rawValue}`);
    } catch {
      return null;
    }
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(hostname)) {
    return null;
  }

  const pathname = parsedUrl.pathname || '/';
  const playlistId = trimString(parsedUrl.searchParams.get('list'));
  const videoId = trimString(parsedUrl.searchParams.get('v') || parsedUrl.searchParams.get('vi'));
  const channelPathMatch = pathname.match(YOUTUBE_CHANNEL_PATH_PATTERN);
  const handlePathMatch = pathname.match(YOUTUBE_HANDLE_PATH_PATTERN);
  const shortsPathMatch = pathname.match(YOUTUBE_SHORTS_PATH_PATTERN);
  const embedPathMatch = pathname.match(YOUTUBE_EMBED_PATH_PATTERN);
  const youtuBeVideoId = hostname.endsWith('youtu.be')
    ? trimString(pathname.replace(/^\/+/, '').split('/')[0])
    : '';

  if (pathname.match(YOUTUBE_PLAYLIST_PATH_PATTERN) || (playlistId && !videoId && !channelPathMatch && !handlePathMatch)) {
    return {
      source: 'url',
      reference_type: 'playlist',
      handle: '',
      channel_id: trimString(channelPathMatch?.[1] || ''),
      video_id: '',
      playlist_id: playlistId || trimString(parsedUrl.searchParams.get('list')),
      normalized_url: `https://www.youtube.com/playlist?list=${playlistId || trimString(parsedUrl.searchParams.get('list'))}`,
    };
  }

  const resolvedVideoId = videoId || shortsPathMatch?.[1] || embedPathMatch?.[1] || youtuBeVideoId;

  if (channelPathMatch) {
    const channelId = trimString(channelPathMatch[1]);
    return {
      source: 'url',
      reference_type: 'channel',
      handle: '',
      channel_id: channelId,
      video_id: '',
      playlist_id: '',
      normalized_url: `https://www.youtube.com/channel/${channelId}`,
    };
  }

  if (handlePathMatch) {
    const handle = normalizeYoutubeHandle(handlePathMatch[1]);
    return {
      source: 'url',
      reference_type: 'handle',
      handle,
      channel_id: '',
      video_id: '',
      playlist_id: '',
      normalized_url: `https://www.youtube.com/${handle}`,
    };
  }

  if (resolvedVideoId) {
    return {
      source: 'url',
      reference_type: 'video',
      handle: '',
      channel_id: '',
      video_id: resolvedVideoId,
      playlist_id: '',
      normalized_url: `https://www.youtube.com/watch?v=${resolvedVideoId}`,
    };
  }

  return {
    source: 'url',
    reference_type: 'unsupported',
    handle: '',
    channel_id: '',
    video_id: '',
    playlist_id: playlistId,
    normalized_url: parsedUrl.toString(),
  };
};

export const normalizeLockdownResourceReference = (resource = {}, {
  policyChannels = [],
  allowHandleFallback = false,
} = {}) => {
  const source = isPlainObject(resource) ? resource : { url: resource };
  const rawValue = trimString(source.lockdown_origin || source.url || source.value || source.text);
  const youtubeMetadata = getYoutubeChannelMetadata(source);
  const hasExplicitYoutubeMetadata = Boolean(
    youtubeMetadata.channel_id || youtubeMetadata.title || youtubeMetadata.handle
  );
  const parseResult = parseYouTubeResourceReference(rawValue);

  if (parseResult?.reference_type === 'playlist') {
    return {
      status: LockdownResourceTestDecisions.UNSUPPORTED,
      reason: 'youtube_playlist_unsupported',
      resource_type: 'youtube',
      url: parseResult.normalized_url,
      origin: '',
      normalized_origin: '',
      youtube: {
        ...youtubeMetadata,
        reference_type: 'playlist',
        video_id: '',
        playlist_id: parseResult.playlist_id,
        normalized_url: parseResult.normalized_url,
      },
    };
  }

  if (parseResult?.reference_type === 'channel') {
    const channel = normalizeChannelEntry({
      channel_id: parseResult.channel_id || youtubeMetadata.channel_id,
      title: youtubeMetadata.title,
      handle: youtubeMetadata.handle,
    });

    if (!channel?.channel_id) {
      return {
        status: hasExplicitYoutubeMetadata
          ? LockdownResourceTestDecisions.METADATA_NEEDED
          : LockdownResourceTestDecisions.UNSUPPORTED,
        reason: hasExplicitYoutubeMetadata
          ? 'youtube_channel_metadata_required'
          : 'invalid_youtube_channel_reference',
        resource_type: 'youtube',
        url: parseResult.normalized_url,
        origin: '',
        normalized_origin: '',
        youtube: {
          ...youtubeMetadata,
          reference_type: 'channel',
          video_id: '',
          playlist_id: '',
          normalized_url: parseResult.normalized_url,
        },
      };
    }

    return {
      status: LockdownResourceTestDecisions.ALLOW,
      reason: 'youtube_channel_identifier_resolved',
      resource_type: 'youtube',
      url: `https://www.youtube.com/channel/${channel.channel_id}`,
      origin: '',
      normalized_origin: '',
      youtube: {
        ...channel,
        reference_type: 'channel',
        video_id: '',
        playlist_id: '',
        normalized_url: `https://www.youtube.com/channel/${channel.channel_id}`,
      },
    };
  }

  if (parseResult?.reference_type === 'handle') {
    const normalizedHandle = normalizeYoutubeHandle(parseResult.handle || youtubeMetadata.handle);
    const resolvedChannel = getYoutubePolicyChannelMatch({
      channel_id: youtubeMetadata.channel_id,
      handle: normalizedHandle,
    }, policyChannels);

    if (resolvedChannel && allowHandleFallback) {
      return {
        status: LockdownResourceTestDecisions.ALLOW,
        reason: 'youtube_handle_resolved_from_policy',
        resource_type: 'youtube',
        url: `https://www.youtube.com/channel/${resolvedChannel.channel_id}`,
        origin: '',
        normalized_origin: '',
        youtube: {
          ...resolvedChannel,
          reference_type: 'channel',
          video_id: '',
          playlist_id: '',
          normalized_url: `https://www.youtube.com/channel/${resolvedChannel.channel_id}`,
        },
      };
    }

    if (youtubeMetadata.channel_id) {
      return {
        status: LockdownResourceTestDecisions.ALLOW,
        reason: 'youtube_handle_resolved_from_metadata',
        resource_type: 'youtube',
        url: `https://www.youtube.com/channel/${youtubeMetadata.channel_id}`,
        origin: '',
        normalized_origin: '',
        youtube: {
          ...normalizeChannelEntry({
            channel_id: youtubeMetadata.channel_id,
            title: youtubeMetadata.title,
            handle: normalizedHandle,
          }),
          reference_type: 'channel',
          video_id: '',
          playlist_id: '',
          normalized_url: `https://www.youtube.com/channel/${youtubeMetadata.channel_id}`,
        },
      };
    }

    return {
      status: LockdownResourceTestDecisions.METADATA_NEEDED,
      reason: 'youtube_channel_metadata_required',
      resource_type: 'youtube',
      url: parseResult.normalized_url,
      origin: '',
      normalized_origin: '',
      youtube: {
        ...youtubeMetadata,
        reference_type: 'handle',
        handle: normalizedHandle,
        video_id: '',
        playlist_id: '',
        normalized_url: parseResult.normalized_url,
      },
    };
  }

  if (parseResult?.reference_type === 'video') {
    const resolvedChannel = getYoutubePolicyChannelMatch(youtubeMetadata, policyChannels);
    const effectiveChannel = resolvedChannel || normalizeChannelEntry(youtubeMetadata);

    if (effectiveChannel?.channel_id) {
      return {
        status: LockdownResourceTestDecisions.ALLOW,
        reason: resolvedChannel
          ? 'youtube_video_resolved_from_policy'
          : 'youtube_video_resolved_from_metadata',
        resource_type: 'youtube',
        url: `https://www.youtube.com/channel/${effectiveChannel.channel_id}`,
        origin: '',
        normalized_origin: '',
        youtube: {
          ...effectiveChannel,
          reference_type: 'channel',
          video_id: parseResult.video_id,
          playlist_id: '',
          normalized_url: `https://www.youtube.com/channel/${effectiveChannel.channel_id}`,
        },
      };
    }

    return {
      status: LockdownResourceTestDecisions.METADATA_NEEDED,
      reason: 'youtube_channel_metadata_required',
      resource_type: 'youtube',
      url: parseResult.normalized_url,
      origin: '',
      normalized_origin: '',
      youtube: {
        ...youtubeMetadata,
        reference_type: 'video',
        video_id: parseResult.video_id,
        playlist_id: '',
        normalized_url: parseResult.normalized_url,
      },
    };
  }

  if (parseResult?.reference_type === 'unsupported') {
    return {
      status: LockdownResourceTestDecisions.UNSUPPORTED,
      reason: rawValue ? 'invalid_youtube_reference' : 'empty_resource',
      resource_type: 'youtube',
      url: parseResult.normalized_url || rawValue,
      origin: '',
      normalized_origin: '',
      youtube: {
        ...youtubeMetadata,
        reference_type: 'unsupported',
        video_id: '',
        playlist_id: '',
        normalized_url: parseResult.normalized_url || rawValue,
      },
    };
  }

  const normalizedOrigin = resolveHttpOriginFromValue(rawValue);
  if (!normalizedOrigin) {
    if (!rawValue) {
      return {
        status: LockdownResourceTestDecisions.UNSUPPORTED,
        reason: 'empty_resource',
        resource_type: 'website',
        url: '',
        origin: '',
        normalized_origin: '',
      };
    }

    try {
      const parsedUrl = new URL(rawValue);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          status: LockdownResourceTestDecisions.UNSUPPORTED,
          reason: 'unsupported_scheme',
          resource_type: 'website',
          url: rawValue,
          origin: '',
          normalized_origin: '',
        };
      }
    } catch {
      return {
        status: LockdownResourceTestDecisions.UNSUPPORTED,
        reason: 'invalid_url',
        resource_type: 'website',
        url: rawValue,
        origin: '',
        normalized_origin: '',
      };
    }
  }

  return {
    status: LockdownResourceTestDecisions.ALLOW,
    reason: 'origin_normalized',
    resource_type: 'website',
    url: normalizedOrigin,
    origin: normalizedOrigin,
    normalized_origin: normalizedOrigin,
  };
};

export const normalizeLockdownResourceAssignment = (resource = {}) => {
  const source = isPlainObject(resource) ? resource : {};
  const assignmentSource = isPlainObject(source.assignment) ? source.assignment : {};

  return {
    assign_to_all_students: Boolean(
      source.assign_to_all_students === true
      || source.all_students === true
      || source.all_students_eligible === true
      || assignmentSource.assign_to_all_students === true
      || assignmentSource.all_students === true
      || assignmentSource.all_students_eligible === true
    ),
    student_ids: toUniqueStringArray(
      source.student_ids
      || source.assigned_student_ids
      || source.eligible_student_ids
      || assignmentSource.student_ids
      || assignmentSource.assigned_student_ids
      || assignmentSource.eligible_student_ids
    ),
  };
};

export const normalizeLockdownResourceLibraryEntry = (resource = {}) => {
  const source = isPlainObject(resource) ? resource : { url: resource };
  const resourceSource = isPlainObject(source.resource) ? source.resource : source;
  const assignment = normalizeLockdownResourceAssignment(source);
  const explicitIsActive = source.is_active ?? resourceSource.is_active;

  return {
    id: trimString(source.id || resourceSource.id),
    name: trimString(resourceSource.name || resourceSource.label),
    url: trimString(resourceSource.url || resourceSource.value || resourceSource.text),
    lockdown_origin: trimString(resourceSource.lockdown_origin),
    youtube_channel_id: trimString(resourceSource.youtube_channel_id),
    youtube_channel_title: trimString(resourceSource.youtube_channel_title),
    youtube_channel_handle: normalizeYoutubeHandle(resourceSource.youtube_channel_handle),
    assign_to_all_students: assignment.assign_to_all_students,
    student_ids: assignment.student_ids,
    assignment,
    is_active: explicitIsActive !== false,
  };
};

const buildLockdownResourceFromLibraryEntry = (resource = {}) => ({
  id: trimString(resource.id),
  name: trimString(resource.name),
  url: trimString(resource.url),
  lockdown_origin: trimString(resource.lockdown_origin),
  youtube_channel_id: trimString(resource.youtube_channel_id),
  youtube_channel_title: trimString(resource.youtube_channel_title),
  youtube_channel_handle: normalizeYoutubeHandle(resource.youtube_channel_handle),
});

const isLockdownResourceAssignedToStudent = (resource = {}, studentId = '') => {
  const normalizedStudentId = trimString(studentId);

  if (!normalizedStudentId) {
    return false;
  }

  return resource.assign_to_all_students === true || resource.student_ids.includes(normalizedStudentId);
};

export const getActiveLockdownStudents = (students = []) => (
  (Array.isArray(students) ? students : []).filter((student) => (
    trimString(student?.id) && student?.is_active !== false
  ))
);

export const resolveAssignedLockdownStudentIds = ({
  resource = {},
  students = [],
} = {}) => {
  const normalizedResource = normalizeLockdownResourceLibraryEntry(resource);
  const activeStudents = getActiveLockdownStudents(students);
  const activeStudentIds = new Set(activeStudents.map((student) => trimString(student.id)));

  if (normalizedResource.assign_to_all_students) {
    return activeStudents.map((student) => trimString(student.id));
  }

  return normalizedResource.student_ids.filter((studentId) => activeStudentIds.has(studentId));
};

export const buildLockdownResourceAssignmentSummary = ({
  resource = {},
  students = [],
} = {}) => {
  const assignedStudentIds = resolveAssignedLockdownStudentIds({ resource, students });
  const activeStudentMap = new Map(
    getActiveLockdownStudents(students).map((student) => [trimString(student.id), trimString(student.name)])
  );
  const names = assignedStudentIds
    .map((studentId) => activeStudentMap.get(studentId) || studentId)
    .filter(Boolean);
  const normalizedResource = normalizeLockdownResourceLibraryEntry(resource);

  return {
    assign_to_all_students: normalizedResource.assign_to_all_students,
    student_ids: assignedStudentIds,
    student_names: names,
    count: assignedStudentIds.length,
    label: normalizedResource.assign_to_all_students
      ? (assignedStudentIds.length === 1 ? 'All active students (1)' : `All active students (${assignedStudentIds.length})`)
      : (names.length ? names.join(', ') : 'No active students assigned'),
  };
};

export const selectAssignedLockdownResources = ({
  resourceLibrary = [],
  studentId = '',
} = {}) => (
  (Array.isArray(resourceLibrary) ? resourceLibrary : [])
    .map((resource) => normalizeLockdownResourceLibraryEntry(resource))
    .filter((resource) => resource.is_active && isLockdownResourceAssignedToStudent(resource, studentId))
    .map((resource) => buildLockdownResourceFromLibraryEntry(resource))
);

export const buildLockdownResourceLibrarySummary = ({
  resourceLibrary = [],
  students = [],
  studentId = '',
} = {}) => {
  const normalizedStudentId = trimString(studentId);
  const normalizedResources = (Array.isArray(resourceLibrary) ? resourceLibrary : [])
    .map((resource) => normalizeLockdownResourceLibraryEntry(resource));
  const activeResources = normalizedResources.filter((resource) => resource.is_active);
  const archivedCount = normalizedResources.length - activeResources.length;
  const resourcesForStudent = normalizedStudentId
    ? activeResources.filter((resource) => isLockdownResourceAssignedToStudent(resource, normalizedStudentId))
    : [];
  const coveredStudentIds = new Set();

  activeResources.forEach((resource) => {
    resolveAssignedLockdownStudentIds({ resource, students }).forEach((assignedStudentId) => {
      coveredStudentIds.add(assignedStudentId);
    });
  });

  return resourcesForStudent.reduce((summary, resource) => {
    const normalizedReference = normalizeLockdownResourceReference(resource, {
      allowHandleFallback: false,
    });

    summary.total += 1;

    if (normalizedReference.resource_type === 'youtube') {
      summary.youtube_creators += 1;
    } else if (normalizedReference.normalized_origin) {
      summary.websites += 1;
    }

    return summary;
  }, {
    total: 0,
    websites: 0,
    youtube_creators: 0,
    assigned_student_count: coveredStudentIds.size,
    active_library_total: activeResources.length,
    archived_total: archivedCount,
  });
};

export const evaluateLockdownResourceAgainstPolicy = ({
  resource = {},
  policy = {},
  allowHandleFallback = true,
} = {}) => {
  const allowedOrigins = new Set(
    Array.isArray(policy.allowed_origins)
      ? policy.allowed_origins.map((origin) => normalizeOriginEntry(origin)).filter(Boolean)
      : []
  );
  const allowedYoutubeChannels = Array.isArray(policy.allowed_youtube_channels)
    ? policy.allowed_youtube_channels.map((channel) => normalizeChannelEntry(channel)).filter(Boolean)
    : [];
  const normalizedResource = normalizeLockdownResourceReference(resource, {
    policyChannels: allowedYoutubeChannels,
    allowHandleFallback,
  });

  if (normalizedResource.resource_type === 'website') {
    if (normalizedResource.status !== LockdownResourceTestDecisions.ALLOW) {
      return {
        ...normalizedResource,
        decision: normalizedResource.status,
      };
    }

    const isAllowed = normalizedResource.normalized_origin
      ? allowedOrigins.has(normalizedResource.normalized_origin)
      : false;

    return {
      ...normalizedResource,
      decision: isAllowed ? LockdownResourceTestDecisions.ALLOW : LockdownResourceTestDecisions.DENY,
      reason: isAllowed ? 'origin_in_allowlist' : 'origin_not_in_allowlist',
    };
  }

  if (normalizedResource.resource_type === 'youtube') {
    if (normalizedResource.status !== LockdownResourceTestDecisions.ALLOW) {
      return {
        ...normalizedResource,
        decision: normalizedResource.status,
      };
    }

    const resourceChannelId = trimString(normalizedResource.youtube?.channel_id);
    const resourceHandle = normalizeYoutubeHandle(normalizedResource.youtube?.handle).toLowerCase();
    const matchedChannel = allowedYoutubeChannels.find((channel) => (
      (resourceChannelId && trimString(channel.channel_id) === resourceChannelId)
      || (resourceHandle && normalizeYoutubeHandle(channel.handle).toLowerCase() === resourceHandle)
    ));

    return {
      ...normalizedResource,
      decision: matchedChannel ? LockdownResourceTestDecisions.ALLOW : LockdownResourceTestDecisions.DENY,
      reason: matchedChannel ? 'youtube_creator_in_allowlist' : 'youtube_creator_not_in_allowlist',
      matched_channel: matchedChannel || null,
    };
  }

  return {
    ...normalizedResource,
    decision: normalizedResource.status || LockdownResourceTestDecisions.UNSUPPORTED,
  };
};

const toTimestampMillis = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
  }

  return null;
};

const toIntegerOrNull = (value) => {
  if (Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isNaN(parsedValue) ? null : parsedValue;
  }

  return null;
};

const toFiniteNumberOrNull = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
};

const maxTimestampMillis = (...values) => {
  const validMillis = values
    .map((value) => toTimestampMillis(value))
    .filter((value) => Number.isFinite(value));

  return validMillis.length ? Math.max(...validMillis) : null;
};

const normalizeTimerSessionCandidate = (timerSession = {}) => ({
  ...timerSession,
  saved_at: Number.isFinite(timerSession?.saved_at) ? timerSession.saved_at : 0,
  block_index: Number.isInteger(timerSession?.block_index)
    ? timerSession.block_index
    : Number.parseInt(timerSession?.block_index, 10),
});

const buildOffHoursWindowId = (index = 0) => (
  `off_hours_window_${Date.now()}_${index + 1}_${Math.random().toString(36).slice(2, 8)}`
);

const normalizeProductionPolicyState = (value) => {
  const trimmedValue = trimString(value);

  if (!trimmedValue) {
    return '';
  }

  if (LOCKDOWN_PRODUCTION_POLICY_STATE_VALUES.has(trimmedValue)) {
    return trimmedValue;
  }

  return '';
};

const normalizeActiveWorkSessionKind = (value) => {
  const trimmedValue = trimString(value);

  if (LOCKDOWN_ACTIVE_WORK_SESSION_KIND_VALUES.has(trimmedValue)) {
    return trimmedValue;
  }

  if (trimmedValue === 'project_work') {
    return LockdownActiveWorkSessionKinds.PROJECT;
  }

  if (trimmedValue === 'worksheet_work') {
    return LockdownActiveWorkSessionKinds.WORKSHEET;
  }

  if (trimmedValue === 'time_boxed') {
    return LockdownActiveWorkSessionKinds.TIMER;
  }

  return '';
};

const isInactiveActiveWorkStatus = (status) => (
  status === 'paused'
  || status === 'completed'
  || status === 'archived'
  || status === 'inactive'
);

export const normalizeLockdownActiveWorkSession = (input = {}) => {
  if (!isPlainObject(input)) {
    return null;
  }

  const normalizedBlockIndex = toIntegerOrNull(input.block_index);
  const normalizedLegacyBlockIndex = toIntegerOrNull(input.legacy_block_index);
  const normalizedKind = (() => {
    const explicitKind = normalizeActiveWorkSessionKind(
      input.kind
      || input.session_kind
      || input.work_kind
      || input.work_session_type
      || input.session_type
      || input.type
      || input.completion_mode
    );

    if (explicitKind) {
      return explicitKind;
    }

    if (trimString(input.project_id) || trimString(input.project_title) || trimString(input.project_work_id)) {
      return LockdownActiveWorkSessionKinds.PROJECT;
    }

    if (trimString(input.worksheet_id) || trimString(input.worksheet_title) || trimString(input.worksheet_work_id)) {
      return LockdownActiveWorkSessionKinds.WORKSHEET;
    }

    if (
      trimString(input.assignment_id)
      || trimString(input.block_id)
      || normalizedBlockIndex !== null
      || trimString(input.timer_session_id)
    ) {
      return LockdownActiveWorkSessionKinds.TIMER;
    }

    return '';
  })();
  const normalizedId = trimString(input.id)
    || trimString(input.session_id)
    || trimString(input.active_work_session_id)
    || trimString(input.timer_session_id);
  const hasSessionIdentity = Boolean(
    normalizedId
    || normalizedKind
    || trimString(input.assignment_id)
    || trimString(input.block_id)
    || normalizedBlockIndex !== null
    || trimString(input.project_id)
    || trimString(input.project_title)
    || trimString(input.project_work_id)
    || trimString(input.worksheet_id)
    || trimString(input.worksheet_title)
    || trimString(input.worksheet_work_id)
  );

  if (!hasSessionIdentity) {
    return null;
  }

  const normalizedStatus = trimString(input.status)
    || trimString(input.session_state)
    || (input.is_running === false ? 'paused' : input.is_running === true || input.is_active === true ? 'active' : '');

  return {
    ...input,
    id: normalizedId,
    kind: normalizedKind,
    session_kind: normalizedKind,
    status: normalizedStatus,
    source_kind: trimString(input.source_kind) || trimString(input.sourceKind),
    parent_id: trimString(input.parent_id),
    student_id: trimString(input.student_id),
    subject_id: trimString(input.subject_id),
    subject_title: trimString(input.subject_title) || trimString(input.legacy_subject_title),
    assignment_id: trimString(input.assignment_id),
    weekly_plan_id: trimString(input.weekly_plan_id),
    block_id: trimString(input.block_id),
    block_index: normalizedBlockIndex,
    block_title: trimString(input.block_title) || trimString(input.title),
    legacy_subject_id: trimString(input.legacy_subject_id),
    legacy_subject_title: trimString(input.legacy_subject_title),
    legacy_block_index: normalizedLegacyBlockIndex,
    project_id: trimString(input.project_id),
    project_title: trimString(input.project_title),
    project_work_id: trimString(input.project_work_id),
    worksheet_id: trimString(input.worksheet_id),
    worksheet_title: trimString(input.worksheet_title),
    worksheet_work_id: trimString(input.worksheet_work_id),
    timer_session_id: trimString(input.timer_session_id) || (
      normalizedKind === LockdownActiveWorkSessionKinds.TIMER ? normalizedId : ''
    ),
    started_at: input.started_at ?? null,
    updated_at: input.updated_at ?? null,
    completed_at: input.completed_at ?? null,
    target_end_time: toFiniteNumberOrNull(input.target_end_time),
    duration_ms: toFiniteNumberOrNull(input.duration_ms),
    remaining_time: toFiniteNumberOrNull(input.remaining_time),
    is_running: input.is_running === true,
    resource_ids: Array.isArray(input.resource_ids) ? [...input.resource_ids] : [],
    metadata: isPlainObject(input.metadata) ? { ...input.metadata } : {},
  };
};

export const normalizeLockdownPolicyStateMetadata = (input = {}) => {
  const normalizedActiveWorkSession = input.active_work_session
    ? normalizeLockdownActiveWorkSession(input.active_work_session)
    : null;

  const explicitState = normalizeProductionPolicyState(input.state)
    || (input.legacy_policy_state ? '' : normalizeProductionPolicyState(input.policy_state));
  const normalizedLegacyPolicyState = trimString(input.legacy_policy_state) || trimString(input.policy_state) || '';
  const normalizedSchoolTimeState = trimString(input.school_time_state)
    || (input.in_school_time === false ? 'off_hours' : input.in_school_time === true ? 'school_time' : '');
  const normalizedOffHoursWindowState = trimString(input.off_hours_window_state)
    || (input.off_hours_window ? 'open' : '');
  const normalizedEntitlementState = trimString(input.entitlement_state)
    || (input.entitlement_active === false ? 'inactive' : input.entitlement_active === true ? 'active' : '');
  const normalizedDeviceState = trimString(input.device_state)
    || (input.device_revoked === true ? 'revoked' : input.device_unpaired === true ? 'unpaired' : '');
  const normalizedCacheState = trimString(input.cache_state)
    || (input.has_stale_cached_policy === true ? 'stale' : '');
  const normalizedActiveWorkState = normalizeProductionPolicyState(input.active_work_state);
  const weeklyPlanStatus = trimString(input.weekly_plan_status);
  const weeklyPlanExists = weeklyPlanStatus
    ? weeklyPlanStatus === WeeklyPlanStatuses.PUBLISHED
    : (input.published_weekly_plan_exists === true || input.weekly_plan_exists === true);
  const weeklyPlanExistsKnown = input.weekly_plan_exists === true
    || input.weekly_plan_exists === false
    || input.published_weekly_plan_exists === true
    || input.published_weekly_plan_exists === false
    || Boolean(weeklyPlanStatus);

  const derivedState = explicitState || (() => {
    if (normalizedDeviceState === 'revoked') {
      return LockdownProductionPolicyStates.DEVICE_REVOKED;
    }

    if (
      normalizedDeviceState === 'unpaired'
      || input.binding_status === 'binding_required'
      || input.binding_status === 'student_binding_required'
      || input.binding_status === 'no_active_students'
      || input.binding_status === 'unpaired'
    ) {
      return LockdownProductionPolicyStates.UNPAIRED;
    }

    if (normalizedCacheState === 'stale') {
      return LockdownProductionPolicyStates.STALE_CACHED_POLICY;
    }

    if (
      normalizedEntitlementState === 'inactive'
      || normalizedLegacyPolicyState === LockdownPolicyStates.ENTITLEMENT_INACTIVE
    ) {
      return LockdownProductionPolicyStates.ENTITLEMENT_INACTIVE;
    }

    if (normalizedSchoolTimeState === 'off_hours') {
      return LockdownProductionPolicyStates.OFF_HOURS_CLOSED;
    }

    if (weeklyPlanExistsKnown && !weeklyPlanExists) {
      return LockdownProductionPolicyStates.NO_PUBLISHED_PLAN;
    }

    if (normalizedActiveWorkState === LockdownProductionPolicyStates.NO_ACTIVE_WORK) {
      return LockdownProductionPolicyStates.NO_ACTIVE_WORK;
    }

    if (normalizedActiveWorkSession) {
      return isInactiveActiveWorkStatus(normalizedActiveWorkSession.status)
        ? LockdownProductionPolicyStates.NO_ACTIVE_WORK
        : LockdownProductionPolicyStates.ACTIVE_BLOCK;
    }

    if (
      input.has_active_work === true
      || normalizedActiveWorkState === LockdownProductionPolicyStates.ACTIVE_BLOCK
      || normalizedLegacyPolicyState === LockdownPolicyStates.ACTIVE_BLOCK
    ) {
      return LockdownProductionPolicyStates.ACTIVE_BLOCK;
    }

    return LockdownProductionPolicyStates.NO_ACTIVE_SESSION;
  })();

  return {
    state: derivedState,
    policy_state: derivedState,
    legacy_policy_state: normalizedLegacyPolicyState,
    school_time_state: normalizedSchoolTimeState,
    off_hours_window_state: normalizedOffHoursWindowState,
    entitlement_state: normalizedEntitlementState || 'active',
    device_state: normalizedDeviceState || (
      derivedState === LockdownProductionPolicyStates.UNPAIRED ? 'unpaired' : 'active'
    ),
    cache_state: normalizedCacheState || 'fresh',
    active_work_state: normalizedActiveWorkState
      || (LOCKDOWN_ACTIVE_WORK_STATE_VALUES.has(derivedState) ? derivedState : ''),
    active_work_session: normalizedActiveWorkSession,
    weekly_plan_exists: weeklyPlanExistsKnown ? weeklyPlanExists : null,
    published_weekly_plan_exists: weeklyPlanExistsKnown ? weeklyPlanExists : null,
    weekly_plan_id: trimString(input.weekly_plan_id),
    weekly_plan_status: weeklyPlanStatus || null,
  };
};

export const buildDefaultLockdownResource = () => ({
  name: '',
  url: '',
  lockdown_origin: '',
  youtube_channel_id: '',
  youtube_channel_title: '',
  youtube_channel_handle: '',
});

export const buildDefaultLockdownResourceLibraryEntry = ({
  selectedStudentId = '',
  assignToAllStudents = false,
} = {}) => ({
  id: '',
  ...buildDefaultLockdownResource(),
  assign_to_all_students: Boolean(assignToAllStudents),
  student_ids: assignToAllStudents ? [] : toUniqueStringArray([selectedStudentId]),
  is_active: true,
});

export const buildDefaultLockdownWindow = (index = 0) => ({
  id: buildOffHoursWindowId(index),
  label: '',
  days: [...EVERY_DAY],
  start_time: DEFAULT_OFF_HOURS_START_TIME,
  end_time: DEFAULT_OFF_HOURS_END_TIME,
  resources: [],
});

const formatLockdownScheduleDayList = (days = []) => {
  const labels = (Array.isArray(days) ? days : [])
    .map((dayValue) => LOCKDOWN_DAY_LABELS[dayValue])
    .filter(Boolean);

  return labels.length ? labels.join(', ') : 'No days selected';
};

export const buildLockdownScheduleSummary = (schedule = {}, fallbackTimezone = '') => {
  const normalizedSchedule = normalizeLockdownSchedule(schedule, fallbackTimezone);
  const legacyOffHoursWindowCount = normalizedSchedule.off_hours_resource_windows.length;

  return {
    school_day_count: normalizedSchedule.school_days.length,
    days_label: formatLockdownScheduleDayList(normalizedSchedule.school_days),
    hours_label: `${normalizedSchedule.school_day_start_time} - ${normalizedSchedule.school_day_end_time}`,
    summary_line: `${formatLockdownScheduleDayList(normalizedSchedule.school_days)} · ${normalizedSchedule.school_day_start_time} - ${normalizedSchedule.school_day_end_time}`,
    legacy_off_hours_window_count: legacyOffHoursWindowCount,
    legacy_off_hours_note: legacyOffHoursWindowCount
      ? `${legacyOffHoursWindowCount} saved legacy off-hours ${legacyOffHoursWindowCount === 1 ? 'window remains' : 'windows remain'} in the record for compatibility, but they do not turn on outside-schedule blocking in this phase.`
      : 'Outside scheduled school time, Lockdown network blocking is off.',
  };
};

export const normalizeLockdownResourceInput = (resource = {}) => ({
  name: trimString(resource?.name),
  url: trimString(resource?.url),
  lockdown_origin: trimString(resource?.lockdown_origin),
  youtube_channel_id: trimString(resource?.youtube_channel_id),
  youtube_channel_title: trimString(resource?.youtube_channel_title),
  youtube_channel_handle: trimString(resource?.youtube_channel_handle),
});

export const validateLockdownResourceInput = (resource = {}) => {
  const normalizedResource = normalizeLockdownResourceInput(resource);
  const normalizedReference = normalizeLockdownResourceReference(normalizedResource, {
    allowHandleFallback: false,
  });

  if (!normalizedResource.name) {
    return {
      resource: normalizedResource,
      error: 'Each approved resource needs a parent-facing name.',
    };
  }

  if (!normalizedResource.url && !normalizedResource.lockdown_origin && !normalizedResource.youtube_channel_id) {
    return {
      resource: normalizedResource,
      error: 'Add a URL, an origin override, or YouTube channel metadata for each approved resource.',
    };
  }

  if (normalizedReference.status === LockdownResourceTestDecisions.UNSUPPORTED) {
    return {
      resource: normalizedResource,
      error: normalizedReference.reason === 'unsupported_scheme'
        ? 'Only http and https resources are supported.'
        : normalizedReference.reason === 'empty_resource'
          ? 'Add a valid website URL or YouTube creator URL.'
          : 'This resource type is not supported in the first production Lockdown scope.',
    };
  }

  if (normalizedReference.status === LockdownResourceTestDecisions.METADATA_NEEDED) {
    return {
      resource: normalizedResource,
      error: 'Add YouTube channel metadata or paste a channel URL so Lockdown can resolve the creator locally.',
    };
  }

  if (normalizedReference.resource_type === 'website' && normalizedReference.normalized_origin) {
    normalizedResource.url = normalizedReference.normalized_origin;
    normalizedResource.lockdown_origin = normalizedReference.normalized_origin;
  }

  if (normalizedReference.resource_type === 'youtube' && normalizedReference.youtube?.channel_id) {
    normalizedResource.url = normalizedReference.youtube.normalized_url || normalizedResource.url;
    normalizedResource.youtube_channel_id = normalizedReference.youtube.channel_id;
    normalizedResource.youtube_channel_title = normalizedReference.youtube.title || normalizedResource.youtube_channel_title;
    normalizedResource.youtube_channel_handle = normalizedReference.youtube.handle || normalizedResource.youtube_channel_handle;
  }

  if (normalizedResource.lockdown_origin) {
    const { origin, error } = validateOriginInput(normalizedResource.lockdown_origin);

    if (error) {
      return {
        resource: normalizedResource,
        error: `Origin override error: ${error}`,
      };
    }

    normalizedResource.lockdown_origin = origin;
  }

  return {
    resource: normalizedResource,
    error: null,
  };
};

export const validateLockdownResourceLibraryEntryInput = (resource = {}) => {
  const normalizedEntry = normalizeLockdownResourceLibraryEntry(resource);
  const { resource: sanitizedResource, error } = validateLockdownResourceInput(normalizedEntry);

  if (error) {
    return {
      resource: normalizedEntry,
      error,
    };
  }

  if (!normalizedEntry.assign_to_all_students && normalizedEntry.student_ids.length === 0) {
    return {
      resource: normalizedEntry,
      error: 'Choose at least one student or assign the resource to all students.',
    };
  }

  return {
    resource: {
      ...normalizedEntry,
      ...sanitizedResource,
      assign_to_all_students: normalizedEntry.assign_to_all_students,
      student_ids: normalizedEntry.assign_to_all_students ? [] : normalizedEntry.student_ids,
      is_active: normalizedEntry.is_active !== false,
    },
    error: null,
  };
};

export const sanitizeLockdownWindowResources = (resources = []) => {
  const sanitizedResources = [];

  for (const resource of Array.isArray(resources) ? resources : []) {
    const { resource: sanitizedResource, error } = validateLockdownResourceInput(resource);

    if (error) {
      return {
        resources: [],
        error,
      };
    }

    sanitizedResources.push(sanitizedResource);
  }

  return {
    resources: sanitizedResources,
    error: null,
  };
};

export const deriveLockdownTargetsFromResources = (resources = []) => {
  const originSet = new Set();
  const channelSet = new Set();
  const allowedOrigins = [];
  const allowedYoutubeChannels = [];
  const unsupportedResources = [];

  (Array.isArray(resources) ? resources : []).forEach((resource) => {
    const normalizedReference = normalizeLockdownResourceReference(resource, {
      allowHandleFallback: false,
    });

    if (normalizedReference.resource_type === 'website' && normalizedReference.status === LockdownResourceTestDecisions.ALLOW) {
      if (normalizedReference.normalized_origin && !originSet.has(normalizedReference.normalized_origin)) {
        originSet.add(normalizedReference.normalized_origin);
        allowedOrigins.push(normalizedReference.normalized_origin);
      }
      return;
    }

    if (
      normalizedReference.resource_type === 'youtube'
      && normalizedReference.status === LockdownResourceTestDecisions.ALLOW
      && normalizedReference.youtube?.channel_id
    ) {
      const normalizedChannel = normalizeChannelEntry({
        channel_id: normalizedReference.youtube.channel_id,
        title: normalizedReference.youtube.title || trimString(resource?.youtube_channel_title) || trimString(resource?.name),
        handle: normalizedReference.youtube.handle || trimString(resource?.youtube_channel_handle),
      });

      if (normalizedChannel && !channelSet.has(normalizedChannel.channel_id)) {
        channelSet.add(normalizedChannel.channel_id);
        allowedYoutubeChannels.push(normalizedChannel);
      }
      return;
    }

    if (
      normalizedReference.status === LockdownResourceTestDecisions.METADATA_NEEDED
      || normalizedReference.status === LockdownResourceTestDecisions.UNSUPPORTED
    ) {
      unsupportedResources.push({
        name: trimString(resource?.name) || normalizedReference.url || trimString(resource?.url),
        url: normalizedReference.url || trimString(resource?.url),
        reason: normalizedReference.reason || 'unsupported_resource',
      });
    }
  });

  return {
    allowed_origins: allowedOrigins,
    allowed_youtube_channels: allowedYoutubeChannels,
    unsupported_resources: unsupportedResources,
  };
};

const buildAllowedResourceItems = (resources = []) => {
  const seenKeys = new Set();
  const items = [];

  (Array.isArray(resources) ? resources : []).forEach((resource) => {
    const normalizedReference = normalizeLockdownResourceReference(resource, {
      allowHandleFallback: false,
    });

    if (
      normalizedReference.resource_type === 'website'
      && normalizedReference.status === LockdownResourceTestDecisions.ALLOW
      && normalizedReference.normalized_origin
    ) {
      const key = `website:${normalizedReference.normalized_origin}`;
      if (seenKeys.has(key)) {
        return;
      }

      seenKeys.add(key);
      items.push({
        key,
        resource_type: 'website',
        title: trimString(resource?.name) || normalizedReference.normalized_origin,
        detail: normalizedReference.normalized_origin,
      });
      return;
    }

    if (
      normalizedReference.resource_type === 'youtube'
      && normalizedReference.status === LockdownResourceTestDecisions.ALLOW
      && normalizedReference.youtube?.channel_id
    ) {
      const channelId = trimString(normalizedReference.youtube.channel_id);
      const key = `youtube:${channelId}`;
      if (seenKeys.has(key)) {
        return;
      }

      seenKeys.add(key);
      items.push({
        key,
        resource_type: 'youtube',
        title: normalizedReference.youtube.title || trimString(resource?.youtube_channel_title) || trimString(resource?.name) || channelId,
        detail: [
          trimString(normalizedReference.youtube.handle || resource?.youtube_channel_handle),
          channelId,
        ].filter(Boolean).join(' · '),
      });
    }
  });

  return items;
};

const buildSystemResourceItems = (resources = []) => (
  (Array.isArray(resources) ? resources : [])
    .map((resource) => normalizeSystemResourceEntry(resource))
    .filter(Boolean)
    .map((resource) => ({
      key: `${resource.resource_type || 'system'}:${resource.name || resource.label || resource.origin || resource.page || resource.url}`,
      resource_type: resource.resource_type || resource.type || 'system',
      title: resource.name || resource.label || resource.origin || resource.page || resource.url || 'System resource',
      detail: describeLockdownSystemResource(resource),
      allowed: resource.allowed !== false,
    }))
);

export const buildLockdownAllowedResourceGroups = ({
  policyState = '',
  systemResources = [],
  parentApprovedResources = [],
  activeBlockResources = [],
  legacyOffHoursWindowCount = 0,
} = {}) => {
  const normalizedPolicyState = trimString(policyState);
  const inSchoolTime = normalizedPolicyState === LockdownPolicyStates.ACTIVE_BLOCK
    || normalizedPolicyState === LockdownPolicyStates.NO_ACTIVE_BLOCK;
  const outsideSchedule = normalizedPolicyState === LockdownPolicyStates.OUTSIDE_SCHOOL_TIME;
  const activeBlockState = normalizedPolicyState === LockdownPolicyStates.ACTIVE_BLOCK;
  const legacyWindowNote = legacyOffHoursWindowCount
    ? 'Saved legacy off-hours window data is preserved for compatibility, but it does not turn on outside-schedule blocking right now.'
    : 'Outside scheduled school time, Lockdown network blocking is off.';

  return [
    {
      id: 'system',
      source_kind: 'system',
      label: 'Own Path system resources',
      is_currently_active: inSchoolTime,
      description: inSchoolTime
        ? 'These stay available while Lockdown is enforcing.'
        : 'These stay modeled in the contract, but Lockdown network blocking is off outside the schedule.',
      items: buildSystemResourceItems(systemResources),
    },
    {
      id: 'parent_approved',
      source_kind: 'parent_approved',
      label: 'Parent-approved school-time resources',
      is_currently_active: inSchoolTime,
      description: outsideSchedule
        ? `These household-library resources stay saved for school time. ${legacyWindowNote}`
        : 'These come from the household resource library and are assigned to the selected student.',
      items: buildAllowedResourceItems(parentApprovedResources),
    },
    {
      id: 'active_block',
      source_kind: 'active_block',
      label: 'Current block resources',
      is_currently_active: activeBlockState,
      description: activeBlockState
        ? 'These are attached to the running published weekly-plan block.'
        : (outsideSchedule
          ? 'Block-specific resources only turn on during school time when a block is running.'
          : 'Start or resume a published block to add block-specific resources.'),
      items: buildAllowedResourceItems(activeBlockResources),
    },
  ];
};

export const selectActiveLockdownWeeklyPlanBlock = ({ weeklyPlan, timerSessions = [] } = {}) => {
  const blocks = Array.isArray(weeklyPlan?.blocks) ? weeklyPlan.blocks : [];

  const matchingCandidates = (Array.isArray(timerSessions) ? timerSessions : []).reduce((candidates, timerSession) => {
    const normalizedTimer = normalizeTimerSessionCandidate(timerSession);
    const matchingBlock = blocks.find((block) => (
      trimString(block?.legacy_subject_id) === trimString(normalizedTimer?.subject_id)
      && Number.isInteger(block?.legacy_block_index)
      && block.legacy_block_index === normalizedTimer.block_index
    )) || null;

    if (!matchingBlock) {
      return candidates;
    }

    candidates.push({
      block: matchingBlock,
      timerSession: normalizedTimer,
    });
    return candidates;
  }, []);

  if (!matchingCandidates.length) {
    return {
      activeBlock: null,
      activeTimerSession: null,
    };
  }

  matchingCandidates.sort((left, right) => {
    const runningDelta = Number(Boolean(right.timerSession?.is_running)) - Number(Boolean(left.timerSession?.is_running));
    if (runningDelta !== 0) {
      return runningDelta;
    }

    const savedAtDelta = (right.timerSession?.saved_at || 0) - (left.timerSession?.saved_at || 0);
    if (savedAtDelta !== 0) {
      return savedAtDelta;
    }

    return (toTimestampMillis(right.timerSession?.updated_at) || 0) - (toTimestampMillis(left.timerSession?.updated_at) || 0);
  });

  return {
    activeBlock: matchingCandidates[0].block,
    activeTimerSession: matchingCandidates[0].timerSession,
  };
};

const buildTrustedPolicySourceMetadata = ({
  parentId,
  studentId,
  weeklyPlan,
  policyState,
  activeTimerSession,
  policyStateMetadata = null,
  activeWorkSession = null,
} = {}) => ({
  kind: LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND,
  parent_id: parentId,
  student_id: studentId,
  weekly_plan_id: weeklyPlan?.id || '',
  published_weekly_plan_exists: policyStateMetadata?.published_weekly_plan_exists ?? Boolean(weeklyPlan),
  weekly_plan_status: trimString(weeklyPlan?.status) || null,
  active_timer_session_id: activeTimerSession?.id || '',
  active_work_session_id: activeWorkSession?.id || '',
  active_work_session_kind: activeWorkSession?.kind || '',
  derived_state: policyState,
  state_context: policyStateMetadata,
  active_work_session: activeWorkSession,
  is_legacy_poc_boundary: false,
  document_exists: true,
});

export const deriveCurrentLockdownPolicyPreview = ({
  entitlementActive = false,
  parentId = '',
  studentRecord = null,
  weeklyPlan = null,
  timerSessions = [],
  lockdownResourceLibrary = [],
  referenceDate = new Date(),
} = {}) => {
  const normalizedParentId = trimString(parentId) || trimString(studentRecord?.parent_id);
  const normalizedStudentId = trimString(studentRecord?.id);
  const timeContext = resolveLockdownTimeContext({
    referenceDate,
    schedule: studentRecord?.lockdown_schedule,
    timezone: studentRecord?.timezone,
  });
  const { activeBlock, activeTimerSession } = selectActiveLockdownWeeklyPlanBlock({
    weeklyPlan,
    timerSessions,
  });
  const assignedOffBlockResources = selectAssignedLockdownResources({
    resourceLibrary: lockdownResourceLibrary,
    studentId: normalizedStudentId,
  });
  const blockResources = Array.isArray(activeBlock?.resources) ? activeBlock.resources : [];

  let policyState = LockdownPolicyStates.NO_ACTIVE_BLOCK;
  let policyResources = [];
  const activeTimerSessionIsInactive = activeTimerSession
    ? isInactiveActiveWorkStatus(activeTimerSession.status)
    : false;

  if (!entitlementActive) {
    policyState = LockdownPolicyStates.ENTITLEMENT_INACTIVE;
  } else if (!timeContext.inSchoolTime) {
    policyState = LockdownPolicyStates.OUTSIDE_SCHOOL_TIME;
  } else if (activeTimerSessionIsInactive) {
    policyState = LockdownPolicyStates.NO_ACTIVE_BLOCK;
    policyResources = assignedOffBlockResources;
  } else if (activeBlock) {
    policyState = LockdownPolicyStates.ACTIVE_BLOCK;
    policyResources = [
      ...assignedOffBlockResources,
      ...blockResources,
    ];
  } else {
    policyResources = assignedOffBlockResources;
  }

  const policyEnforcementEnabled = Boolean(entitlementActive && timeContext.inSchoolTime);
  const derivedTargets = deriveLockdownTargetsFromResources(policyResources);
  const systemResources = buildOwnPathSystemResourceAllowlist({
    studentRecord,
    parentId: normalizedParentId,
  });
  const allowedResourceGroups = buildLockdownAllowedResourceGroups({
    policyState,
    systemResources,
    parentApprovedResources: assignedOffBlockResources,
    activeBlockResources: blockResources,
    legacyOffHoursWindowCount: timeContext.schedule?.off_hours_resource_windows?.length || 0,
  });
  const scheduleSummary = buildLockdownScheduleSummary(
    timeContext.schedule,
    timeContext.timezone
  );
  const effectiveActiveBlock = policyState === LockdownPolicyStates.ACTIVE_BLOCK
    ? activeBlock
    : null;
  const effectiveActiveTimerSession = policyState === LockdownPolicyStates.ACTIVE_BLOCK
    ? activeTimerSession
    : null;
  const derivedUpdatedAtMillis = maxTimestampMillis(
    weeklyPlan?.updated_at,
    studentRecord?.updated_at,
    activeTimerSession?.updated_at,
    activeTimerSession?.saved_at
  );
  const derivedUpdatedAt = derivedUpdatedAtMillis != null
    ? new Date(derivedUpdatedAtMillis).toISOString()
    : null;
  const activeWorkSession = (activeBlock || activeTimerSession)
    ? normalizeLockdownActiveWorkSession({
        id: activeTimerSession?.id || activeBlock?.id || '',
        kind: activeTimerSession
          ? (trimString(activeBlock?.completion_mode) === 'task_complete'
            ? LockdownActiveWorkSessionKinds.TASK_COMPLETE
            : LockdownActiveWorkSessionKinds.TIMER)
          : '',
        status: activeTimerSession?.is_running === false
          ? 'paused'
          : activeTimerSession
            ? 'active'
            : '',
        source_kind: LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND,
        parent_id: normalizedParentId,
        student_id: normalizedStudentId,
        subject_id: trimString(activeTimerSession?.subject_id) || trimString(activeBlock?.legacy_subject_id),
        subject_title: trimString(activeBlock?.title) || trimString(activeBlock?.legacy_subject_title),
        assignment_id: trimString(activeBlock?.assignment_id),
        weekly_plan_id: weeklyPlan?.id || '',
        block_id: trimString(activeBlock?.id),
        block_index: activeBlock?.legacy_block_index,
        block_title: trimString(activeBlock?.title) || trimString(activeBlock?.legacy_subject_title),
        legacy_subject_id: trimString(activeBlock?.legacy_subject_id),
        legacy_subject_title: trimString(activeBlock?.legacy_subject_title),
        legacy_block_index: activeBlock?.legacy_block_index,
        timer_session_id: activeTimerSession?.id || '',
        started_at: activeTimerSession?.start_time ?? null,
        updated_at: activeTimerSession?.updated_at ?? null,
        completed_at: activeTimerSession?.completed_at ?? null,
        target_end_time: toFiniteNumberOrNull(activeTimerSession?.target_end_time),
        duration_ms: toFiniteNumberOrNull(activeTimerSession?.duration_ms),
        remaining_time: toFiniteNumberOrNull(activeTimerSession?.remaining_time),
        is_running: Boolean(activeTimerSession?.is_running),
        metadata: {
          source: activeTimerSession ? 'timer_session' : 'weekly_plan_block',
        },
      })
    : null;
  const policyStateMetadata = normalizeLockdownPolicyStateMetadata({
    state: !timeContext.inSchoolTime
      ? LockdownProductionPolicyStates.OFF_HOURS_CLOSED
      : undefined,
    policy_state: policyState,
    legacy_policy_state: policyState,
    in_school_time: timeContext.inSchoolTime,
    school_time_state: timeContext.inSchoolTime ? 'school_time' : 'off_hours',
    entitlement_active: Boolean(entitlementActive),
    published_weekly_plan_exists: trimString(weeklyPlan?.status) === WeeklyPlanStatuses.PUBLISHED,
    weekly_plan_exists: Boolean(weeklyPlan),
    weekly_plan_id: weeklyPlan?.id || '',
    weekly_plan_status: trimString(weeklyPlan?.status) || null,
    active_work_session: activeWorkSession,
    has_active_work: Boolean(activeBlock || activeTimerSession),
    off_hours_window_state: timeContext.activeOffHoursWindow ? 'open' : 'closed',
    active_work_state: activeTimerSessionIsInactive
      ? LockdownProductionPolicyStates.NO_ACTIVE_WORK
      : (activeBlock || activeTimerSession
        ? LockdownProductionPolicyStates.ACTIVE_BLOCK
        : ''),
  });

  return {
    contract: LOCKDOWN_TRUSTED_POLICY_READ_CONTRACT,
    contract_version: 1,
    policy_state: policyState,
    policy_state_metadata: policyStateMetadata,
    policy: {
      parent_id: normalizedParentId,
      student_id: normalizedStudentId,
      is_enabled: policyEnforcementEnabled,
      allowed_origins: entitlementActive ? derivedTargets.allowed_origins : [],
      allowed_youtube_channels: entitlementActive ? derivedTargets.allowed_youtube_channels : [],
      system_resources: systemResources,
      updated_at: derivedUpdatedAt,
    },
    policy_context: {
      binding_status: normalizedStudentId ? 'bound' : 'binding_required',
      student_id: normalizedStudentId,
      timezone: timeContext.timezone,
      local_date: timeContext.localDate,
      local_day: timeContext.localDay,
      local_time: timeContext.localTime,
      in_school_time: timeContext.inSchoolTime,
      school_day_active: timeContext.schoolDayActive,
      school_schedule: timeContext.schedule,
      schedule_summary: scheduleSummary,
      active_work_session: activeWorkSession,
      active_block: effectiveActiveBlock
        ? {
            id: trimString(effectiveActiveBlock.id),
            assignment_id: trimString(effectiveActiveBlock.assignment_id),
            title: trimString(effectiveActiveBlock.title) || trimString(effectiveActiveBlock.legacy_subject_title),
            category: trimString(effectiveActiveBlock.category),
            legacy_subject_id: trimString(effectiveActiveBlock.legacy_subject_id),
            legacy_block_index: effectiveActiveBlock.legacy_block_index,
          }
        : null,
      active_timer_session_id: effectiveActiveTimerSession?.id || '',
      off_hours_window: timeContext.activeOffHoursWindow
        ? {
            id: timeContext.activeOffHoursWindow.id,
            label: timeContext.activeOffHoursWindow.label,
            days: [...timeContext.activeOffHoursWindow.days],
            start_time: timeContext.activeOffHoursWindow.start_time,
            end_time: timeContext.activeOffHoursWindow.end_time,
          }
        : null,
      allowed_resource_groups: allowedResourceGroups,
      weekly_plan_id: weeklyPlan?.id || '',
      weekly_plan_status: trimString(weeklyPlan?.status) || null,
      unsupported_resources: derivedTargets.unsupported_resources,
      system_resources: systemResources,
    },
    source_policy: buildTrustedPolicySourceMetadata({
      parentId: normalizedParentId,
      studentId: normalizedStudentId,
      weeklyPlan,
      policyState,
      activeTimerSession: effectiveActiveTimerSession,
      policyStateMetadata,
      activeWorkSession,
    }),
    source_policy_updated_at: derivedUpdatedAt,
  };
};

export const normalizeLockdownPolicy = (input = {}, parentId = '') => {
  const rawOrigins = Array.isArray(input.allowed_origins)
    ? input.allowed_origins
    : DEFAULT_ALLOWED_ORIGINS;
  const rawChannels = Array.isArray(input.allowed_youtube_channels)
    ? input.allowed_youtube_channels
    : DEFAULT_ALLOWED_YOUTUBE_CHANNELS;
  const rawSystemResources = Array.isArray(input.system_resources)
    ? input.system_resources
    : [];

  const allowedOrigins = Array.from(
    new Set(rawOrigins.map((origin) => normalizeOriginEntry(origin)).filter(Boolean))
  );
  const allowedYoutubeChannels = rawChannels
    .map((channel) => normalizeChannelEntry(channel))
    .filter(Boolean);
  const systemResources = rawSystemResources
    .map((resource) => normalizeSystemResourceEntry(resource))
    .filter(Boolean);

  return {
    parent_id: typeof input.parent_id === 'string' && input.parent_id.trim()
      ? input.parent_id.trim()
      : parentId,
    is_enabled: Boolean(input.is_enabled),
    allowed_origins: allowedOrigins,
    allowed_youtube_channels: allowedYoutubeChannels,
    system_resources: systemResources,
    updated_at: input.updated_at ?? null,
  };
};

export const LockdownParentSummaryGuidanceKinds = Object.freeze({
  READY: 'ready',
  NO_STUDENTS: 'no_students',
  EXPLICIT_SELECTION_REQUIRED: 'explicit_selection_required',
});

export const LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS = 7;
export const LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_MS = (
  LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
);

const LOCKDOWN_INACTIVE_DEVICE_STATUSES = new Set([
  'inactive',
  'invalid_credential',
  'network_error',
]);

export const LockdownDeviceSummaryStates = Object.freeze({
  PAIRED: 'paired',
  STALE: 'stale',
  REVOKED: 'revoked',
  INACTIVE: 'inactive',
});

export const buildLockdownDeviceSummaryState = (device = {}, { referenceNow = Date.now() } = {}) => {
  const normalizedDeviceStatus = trimString(device?.status) || 'active';
  const normalizedReferenceNow = toTimestampMillis(referenceNow);
  const lastSeenAtMillis = toTimestampMillis(device?.last_seen_at);
  const lastPolicyReadAtMillis = toTimestampMillis(device?.last_policy_read_at);
  const lastActivityAtMillis = maxTimestampMillis(lastSeenAtMillis, lastPolicyReadAtMillis);
  const staleCutoffMillis = Number.isFinite(normalizedReferenceNow)
    ? normalizedReferenceNow - LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_MS
    : null;
  const isStale = normalizedDeviceStatus === 'active'
    && Number.isFinite(lastActivityAtMillis)
    && Number.isFinite(staleCutoffMillis)
    && lastActivityAtMillis <= staleCutoffMillis;

  let summaryState = LockdownDeviceSummaryStates.PAIRED;

  if (normalizedDeviceStatus === 'revoked') {
    summaryState = LockdownDeviceSummaryStates.REVOKED;
  } else if (LOCKDOWN_INACTIVE_DEVICE_STATUSES.has(normalizedDeviceStatus)) {
    summaryState = LockdownDeviceSummaryStates.INACTIVE;
  } else if (isStale) {
    summaryState = LockdownDeviceSummaryStates.STALE;
  }

  return {
    device_id: trimString(device?.device_id),
    status: normalizedDeviceStatus,
    summary_state: summaryState,
    is_stale: summaryState === LockdownDeviceSummaryStates.STALE,
    last_seen_at_millis: lastSeenAtMillis,
    last_policy_read_at_millis: lastPolicyReadAtMillis,
    last_activity_at_millis: lastActivityAtMillis,
    stale_threshold_days: LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS,
  };
};

export const buildLockdownDeviceSummary = (devices = [], { referenceNow = Date.now() } = {}) => {
  const records = Array.isArray(devices) ? devices : [];
  const total = records.length;
  const deviceStates = records.map((device) => buildLockdownDeviceSummaryState(device, { referenceNow }));
  const paired = deviceStates.filter((device) => (
    device.summary_state === LockdownDeviceSummaryStates.PAIRED
  )).length;
  const stale = deviceStates.filter((device) => (
    device.summary_state === LockdownDeviceSummaryStates.STALE
  )).length;
  const revoked = deviceStates.filter((device) => (
    device.summary_state === LockdownDeviceSummaryStates.REVOKED
  )).length;
  const inactive = deviceStates.filter((device) => (
    device.summary_state === LockdownDeviceSummaryStates.INACTIVE
  )).length;

  return {
    total,
    paired,
    active: paired,
    stale,
    revoked,
    inactive,
    attention_needed: stale + revoked + inactive,
    stale_threshold_days: LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS,
  };
};

const getLockdownPolicyStateLabel = (policyState = '') => {
  switch (trimString(policyState)) {
    case LockdownPolicyStates.ACTIVE_BLOCK:
      return 'Active block';
    case LockdownPolicyStates.NO_ACTIVE_BLOCK:
      return 'No active block';
    case LockdownPolicyStates.OUTSIDE_SCHOOL_TIME:
      return 'Outside school time';
    case LockdownPolicyStates.ENTITLEMENT_INACTIVE:
      return 'Entitlement inactive';
    default:
      return 'Not available';
  }
};

export const buildLockdownParentSummaryViewModel = ({
  students = [],
  selectedStudentId = '',
  selectedStudent = null,
  hasExplicitStudentSelection = false,
  selectedStudentSchedule = null,
  lockdownResourceLibrary = [],
  visibleLockdownDevices = [],
  lockdownAccess = {},
  derivedPolicyPreview = null,
  referenceNow = Date.now(),
} = {}) => {
  const studentRecords = Array.isArray(students) ? students : [];
  const studentCount = studentRecords.length;
  const isMultiStudentAccount = studentCount > 1;
  const resolvedSelectedStudent = selectedStudent
    || studentRecords.find((student) => trimString(student?.id) === trimString(selectedStudentId))
    || null;
  const hasSelectedStudent = Boolean(resolvedSelectedStudent?.id);
  const hasExplicitSelection = Boolean(hasExplicitStudentSelection || selectedStudentId);
  const resourceSummary = buildLockdownResourceLibrarySummary({
    resourceLibrary: lockdownResourceLibrary,
    students: studentRecords,
    studentId: resolvedSelectedStudent?.id || '',
  });
  const scheduleSummary = buildLockdownScheduleSummary(
    selectedStudentSchedule || {},
    resolvedSelectedStudent?.timezone || ''
  );
  const deviceSummary = buildLockdownDeviceSummary(visibleLockdownDevices, { referenceNow });
  const canManagePolicy = Boolean(lockdownAccess?.canManagePolicy);
  const canPairDevices = Boolean(lockdownAccess?.canPairDevices);
  const isReadOnly = Boolean(lockdownAccess?.isReadOnly);
  const guidance = studentCount === 0
    ? {
        kind: LockdownParentSummaryGuidanceKinds.NO_STUDENTS,
        title: 'Add a student before pairing a browser.',
        description: 'Lockdown setup begins from a student record because schedule rules, published weekly plans, and trusted pairing all resolve per student.',
      }
    : (isMultiStudentAccount && !hasSelectedStudent && !hasExplicitSelection)
      ? {
          kind: LockdownParentSummaryGuidanceKinds.EXPLICIT_SELECTION_REQUIRED,
          title: 'Choose a student to review Lockdown.',
          description: 'Multi-student households must explicitly choose the student before pairing, schedule edits, or allowed-right-now review become actionable.',
        }
      : {
          kind: LockdownParentSummaryGuidanceKinds.READY,
          title: resolvedSelectedStudent?.name || 'Student selected',
          description: 'Summary cards stay pinned to the selected student so pairing, schedule changes, and policy review do not drift across siblings.',
        };

  return {
    guidance,
    selection: {
      student_count: studentCount,
      is_multi_student_account: isMultiStudentAccount,
      has_selected_student: hasSelectedStudent,
      selected_student_id: trimString(resolvedSelectedStudent?.id),
      selected_student_name: trimString(resolvedSelectedStudent?.name),
    },
    permissions: {
      can_manage_policy: canManagePolicy,
      can_pair_devices: canPairDevices,
      is_read_only: isReadOnly,
    },
    actions: {
      edit_schedule_disabled: !hasSelectedStudent || !canManagePolicy,
      manage_resources_disabled: !hasSelectedStudent || !canManagePolicy,
      manage_devices_disabled: !hasSelectedStudent || !canManagePolicy,
      pair_browser_disabled: !hasSelectedStudent || !canPairDevices,
      allowed_right_now_disabled: !hasSelectedStudent,
      advanced_diagnostics_disabled: !hasSelectedStudent && studentCount > 0,
    },
    schedule: {
      school_day_count: scheduleSummary.school_day_count,
      days_label: scheduleSummary.days_label,
      hours_label: scheduleSummary.hours_label,
      summary_line: scheduleSummary.summary_line,
      off_hours_window_count: Array.isArray(selectedStudentSchedule?.off_hours_resource_windows)
        ? selectedStudentSchedule.off_hours_resource_windows.length
        : 0,
      legacy_off_hours_window_count: scheduleSummary.legacy_off_hours_window_count,
      legacy_off_hours_note: scheduleSummary.legacy_off_hours_note,
    },
    off_block_resources: resourceSummary,
    devices: deviceSummary,
    allowed_right_now: {
      state: trimString(derivedPolicyPreview?.policy_state),
      state_label: getLockdownPolicyStateLabel(derivedPolicyPreview?.policy_state),
      allowed_origin_count: Array.isArray(derivedPolicyPreview?.policy?.allowed_origins)
        ? derivedPolicyPreview.policy.allowed_origins.length
        : 0,
      allowed_creator_count: Array.isArray(derivedPolicyPreview?.policy?.allowed_youtube_channels)
        ? derivedPolicyPreview.policy.allowed_youtube_channels.length
        : 0,
      unsupported_resource_count: Array.isArray(derivedPolicyPreview?.policy_context?.unsupported_resources)
        ? derivedPolicyPreview.policy_context.unsupported_resources.length
        : 0,
      system_resource_count: Array.isArray(derivedPolicyPreview?.policy?.system_resources)
        ? derivedPolicyPreview.policy.system_resources.length
        : 0,
      source_groups: Array.isArray(derivedPolicyPreview?.policy_context?.allowed_resource_groups)
        ? derivedPolicyPreview.policy_context.allowed_resource_groups
        : [],
    },
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
    return Buffer.from(value, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  return '';
};

const readFirebaseEnvironment = () => {
  const firebaseEnv = import.meta.env || {};
  const processEnv = typeof globalThis !== 'undefined' && globalThis.process
    ? globalThis.process.env || {}
    : {};
  const readEnvValue = (key) => (
    trimString(firebaseEnv?.[key])
    || trimString(processEnv?.[key])
  );

  return {
    apiKey: readEnvValue('VITE_FIREBASE_API_KEY'),
    projectId: readEnvValue('VITE_FIREBASE_PROJECT_ID'),
    functionsRegion: readEnvValue('VITE_FIREBASE_FUNCTIONS_REGION') || 'us-central1',
  };
};

export const buildTrustedLockdownFunctionUrl = (functionName = '') => {
  const trimmedFunctionName = trimString(functionName);
  const { projectId, functionsRegion } = readFirebaseEnvironment();

  if (!trimmedFunctionName || !projectId) {
    return '';
  }

  return `https://${functionsRegion}-${projectId}.cloudfunctions.net/${trimmedFunctionName}`;
};

export const normalizeTrustedLockdownEnrollmentMaterial = (input = {}) => ({
  contract: trimString(input.contract) || LOCKDOWN_TRUSTED_ENROLLMENT_CONTRACT,
  enrollment_token: trimString(input.enrollment_token),
  expires_at: trimString(input.expires_at),
  source_policy_kind: trimString(input.source_policy_kind) || LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND,
  source_policy_parent_id: trimString(input.source_policy_parent_id),
  student_id: trimString(input.student_id),
});

export const buildTrustedLockdownEnrollmentCode = (input = {}) => {
  const material = normalizeTrustedLockdownEnrollmentMaterial(input);
  const exchangeUrl = buildTrustedLockdownFunctionUrl(TrustedFunctionNames.EXCHANGE_LOCKDOWN_ENROLLMENT);
  const policyUrl = buildTrustedLockdownFunctionUrl(TrustedFunctionNames.READ_LOCKDOWN_DEVICE_POLICY);

  if (!material.enrollment_token || !exchangeUrl || !policyUrl) {
    return '';
  }

  return encodeBase64Url(JSON.stringify({
    version: LOCKDOWN_TRUSTED_ENROLLMENT_CODE_VERSION,
    contract: material.contract,
    enrollment_token: material.enrollment_token,
    enrollment_expires_at: material.expires_at,
    exchange_url: exchangeUrl,
    policy_url: policyUrl,
  }));
};

export const normalizeTrustedLockdownRecoveryMaterial = (input = {}) => ({
  contract: trimString(input.contract) || LOCKDOWN_TRUSTED_RECOVERY_CONTRACT,
  recovery_token: trimString(input.recovery_token),
  expires_at: trimString(input.expires_at),
  parent_id: trimString(input.parent_id),
  student_id: trimString(input.student_id),
  device_id: trimString(input.device_id),
});

export const buildTrustedLockdownRecoveryCode = (input = {}) => {
  const material = normalizeTrustedLockdownRecoveryMaterial(input);
  const recoveryUrl = buildTrustedLockdownFunctionUrl(
    TrustedFunctionNames.RECOVER_LOCKDOWN_DEVICE_PAIRING
  );

  if (!material.recovery_token || !material.device_id || !recoveryUrl) {
    return '';
  }

  return encodeBase64Url(JSON.stringify({
    version: LOCKDOWN_TRUSTED_RECOVERY_CODE_VERSION,
    contract: material.contract,
    recovery_token: material.recovery_token,
    recovery_expires_at: material.expires_at,
    recovery_url: recoveryUrl,
    parent_id: material.parent_id,
    student_id: material.student_id,
    device_id: material.device_id,
  }));
};

export const buildLockdownPocPairingCode = (parentId = '') => {
  const policyId = typeof parentId === 'string' ? parentId.trim() : '';
  const { apiKey, projectId } = readFirebaseEnvironment();

  if (!policyId || !projectId || !apiKey) {
    return '';
  }

  return encodeBase64Url(JSON.stringify({
    version: LOCKDOWN_POC_PAIRING_CODE_VERSION,
    contract: LOCKDOWN_POC_PAIRING_CONTRACT,
    policy_id: policyId,
    project_id: projectId,
    api_key: apiKey,
  }));
};

// Compatibility alias until the PoC-only pairing path is fully removed in Phase 4.
export const buildLockdownPairingCode = buildLockdownPocPairingCode;
