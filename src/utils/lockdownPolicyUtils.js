import { TrustedFunctionNames } from '../constants/schema.js';
import { resolveLockdownTimeContext } from './schoolSettingsUtils.js';

export const LOCKDOWN_POC_POLICY_COLLECTION = 'lockdownPolicies';
export const LOCKDOWN_POLICY_COLLECTION = LOCKDOWN_POC_POLICY_COLLECTION;
export const LOCKDOWN_ENROLLMENT_COLLECTION = 'lockdownEnrollmentSessions';
export const LOCKDOWN_DEVICE_COLLECTION = 'lockdownDevices';

export const LOCKDOWN_POC_PAIRING_CODE_VERSION = 1;
export const LOCKDOWN_TRUSTED_ENROLLMENT_CODE_VERSION = 1;

export const LOCKDOWN_POC_PAIRING_CONTRACT = 'lockdown_poc_firestore_pairing_v1';
export const LOCKDOWN_TRUSTED_ENROLLMENT_CONTRACT = 'trusted_lockdown_enrollment_v1';
export const LOCKDOWN_TRUSTED_POLICY_READ_CONTRACT = 'trusted_lockdown_device_policy_v1';
export const LOCKDOWN_POC_POLICY_SOURCE_KIND = 'lockdown_policy_poc_document';
export const LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND = 'published_weekly_plan_derived_policy_v1';

export const LockdownPolicyStates = Object.freeze({
  ACTIVE_BLOCK: 'active_block',
  NO_ACTIVE_BLOCK: 'no_active_block',
  OUTSIDE_SCHOOL_TIME: 'outside_school_time',
  ENTITLEMENT_INACTIVE: 'entitlement_inactive',
});

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

const trimString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

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

export const buildDefaultLockdownResource = () => ({
  name: '',
  url: '',
  lockdown_origin: '',
  youtube_channel_id: '',
  youtube_channel_title: '',
  youtube_channel_handle: '',
});

export const buildDefaultLockdownWindow = (index = 0) => ({
  id: buildOffHoursWindowId(index),
  label: '',
  days: [...EVERY_DAY],
  start_time: DEFAULT_OFF_HOURS_START_TIME,
  end_time: DEFAULT_OFF_HOURS_END_TIME,
  resources: [],
});

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

  if (!normalizedResource.name) {
    return {
      resource: normalizedResource,
      error: 'Each approved resource needs a parent-facing name.',
    };
  }

  if (
    !normalizedResource.url
    && !normalizedResource.lockdown_origin
    && !normalizedResource.youtube_channel_id
  ) {
    return {
      resource: normalizedResource,
      error: 'Add a URL, an origin override, or YouTube channel metadata for each approved resource.',
    };
  }

  if (normalizedResource.url) {
    try {
      const parsedUrl = new URL(normalizedResource.url);
      normalizedResource.url = parsedUrl.toString();
    } catch {
      return {
        resource: normalizedResource,
        error: 'Resource URLs must be valid absolute links such as https://www.khanacademy.org.',
      };
    }
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

export const isYoutubeUrl = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(value.trim());
    return YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const normalizeResourceYoutubeChannel = (resource) => {
  if (!resource || typeof resource !== 'object') {
    return null;
  }

  return normalizeChannelEntry({
    channel_id: trimString(resource.youtube_channel_id),
    title: trimString(resource.youtube_channel_title) || trimString(resource.name),
    handle: trimString(resource.youtube_channel_handle),
  });
};

export const deriveLockdownTargetsFromResources = (resources = []) => {
  const originSet = new Set();
  const channelSet = new Set();
  const allowedOrigins = [];
  const allowedYoutubeChannels = [];
  const unsupportedResources = [];

  (Array.isArray(resources) ? resources : []).forEach((resource) => {
    const normalizedChannel = normalizeResourceYoutubeChannel(resource);

    if (normalizedChannel && !channelSet.has(normalizedChannel.channel_id)) {
      channelSet.add(normalizedChannel.channel_id);
      allowedYoutubeChannels.push(normalizedChannel);
    }

    const explicitOrigin = trimString(resource?.lockdown_origin);
    const candidateUrl = explicitOrigin || trimString(resource?.url);
    const normalizedOrigin = normalizeOriginEntry(candidateUrl);

    if (normalizedOrigin) {
      if (isYoutubeUrl(candidateUrl) || isYoutubeUrl(normalizedOrigin)) {
        if (!normalizedChannel) {
          unsupportedResources.push({
            name: trimString(resource?.name) || candidateUrl,
            url: candidateUrl,
            reason: 'youtube_channel_metadata_required',
          });
        }

        return;
      }

      if (!originSet.has(normalizedOrigin)) {
        originSet.add(normalizedOrigin);
        allowedOrigins.push(normalizedOrigin);
      }
    }
  });

  return {
    allowed_origins: allowedOrigins,
    allowed_youtube_channels: allowedYoutubeChannels,
    unsupported_resources: unsupportedResources,
  };
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
} = {}) => ({
  kind: LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND,
  parent_id: parentId,
  student_id: studentId,
  weekly_plan_id: weeklyPlan?.id || '',
  published_weekly_plan_exists: Boolean(weeklyPlan),
  weekly_plan_status: trimString(weeklyPlan?.status) || null,
  active_timer_session_id: activeTimerSession?.id || '',
  derived_state: policyState,
  is_legacy_poc_boundary: false,
  document_exists: true,
});

export const deriveCurrentLockdownPolicyPreview = ({
  entitlementActive = false,
  parentId = '',
  studentRecord = null,
  weeklyPlan = null,
  timerSessions = [],
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

  let policyState = LockdownPolicyStates.NO_ACTIVE_BLOCK;
  let policyResources = [];

  if (!entitlementActive) {
    policyState = LockdownPolicyStates.ENTITLEMENT_INACTIVE;
  } else if (!timeContext.inSchoolTime) {
    policyState = LockdownPolicyStates.OUTSIDE_SCHOOL_TIME;
    policyResources = Array.isArray(timeContext.activeOffHoursWindow?.resources)
      ? timeContext.activeOffHoursWindow.resources
      : [];
  } else if (activeBlock) {
    policyState = LockdownPolicyStates.ACTIVE_BLOCK;
    policyResources = Array.isArray(activeBlock?.resources) ? activeBlock.resources : [];
  }

  const derivedTargets = deriveLockdownTargetsFromResources(policyResources);
  const effectiveActiveBlock = policyState === LockdownPolicyStates.ACTIVE_BLOCK
    ? activeBlock
    : null;
  const effectiveActiveTimerSession = policyState === LockdownPolicyStates.ACTIVE_BLOCK
    ? activeTimerSession
    : null;
  const derivedUpdatedAtMillis = maxTimestampMillis(
    weeklyPlan?.updated_at,
    studentRecord?.updated_at,
    effectiveActiveTimerSession?.updated_at,
    effectiveActiveTimerSession?.saved_at
  );
  const derivedUpdatedAt = derivedUpdatedAtMillis != null
    ? new Date(derivedUpdatedAtMillis).toISOString()
    : null;

  return {
    contract: LOCKDOWN_TRUSTED_POLICY_READ_CONTRACT,
    contract_version: 1,
    policy_state: policyState,
    policy: {
      parent_id: normalizedParentId,
      student_id: normalizedStudentId,
      is_enabled: Boolean(entitlementActive),
      allowed_origins: entitlementActive ? derivedTargets.allowed_origins : [],
      allowed_youtube_channels: entitlementActive ? derivedTargets.allowed_youtube_channels : [],
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
      weekly_plan_id: weeklyPlan?.id || '',
      weekly_plan_status: trimString(weeklyPlan?.status) || null,
      unsupported_resources: derivedTargets.unsupported_resources,
    },
    source_policy: buildTrustedPolicySourceMetadata({
      parentId: normalizedParentId,
      studentId: normalizedStudentId,
      weeklyPlan,
      policyState,
      activeTimerSession: effectiveActiveTimerSession,
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

  return {
    apiKey: trimString(firebaseEnv.VITE_FIREBASE_API_KEY),
    projectId: trimString(firebaseEnv.VITE_FIREBASE_PROJECT_ID),
    functionsRegion: trimString(firebaseEnv.VITE_FIREBASE_FUNCTIONS_REGION) || 'us-central1',
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
