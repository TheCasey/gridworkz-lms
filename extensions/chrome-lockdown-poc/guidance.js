const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

function normalizeOrigin(value) {
  const trimmed = trimString(value);
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    return parsed.origin;
  } catch {
    return '';
  }
}

export const LOCKDOWN_REQUEST_ACCESS_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  DEFERRED: 'deferred',
  UNAVAILABLE: 'unavailable',
});

export const LOCKDOWN_STATE_GUIDANCE = Object.freeze({
  active_block: {
    label: 'Current block blocked',
    title: 'This site is blocked right now',
    copy: 'The current policy does not allow this destination.',
    next_step: 'Open the allowlist to review the currently approved resources.',
  },
  no_active_session: {
    label: 'No active session',
    title: 'No active work is ready yet',
    copy: 'School time can still stay active with parent-approved resources, but there is not a current block to continue. Start the next published block or ask a parent to publish one.',
    next_step: 'Return to the student portal and start the next available block.',
  },
  no_active_work: {
    label: 'No active work',
    title: 'No active work is published',
    copy: 'School time can still stay active with parent-approved resources, but there is no current work session to continue. Ask a parent to publish or resume work before trying again.',
    next_step: 'Go back to the student portal and start or wait for the next published block.',
  },
  no_published_plan: {
    label: 'No published plan',
    title: 'No published weekly plan is available',
    copy: 'This student does not have a published weekly plan yet. A parent needs to publish one before access can move forward.',
    next_step: 'Ask a parent to publish the weekly plan in the dashboard.',
  },
  off_hours_open: {
    label: 'Outside schedule',
    title: 'Lockdown is off right now',
    copy: 'This browser is outside scheduled school time. Legacy saved off-hours windows do not turn blocking back on in this simplified version.',
    next_step: 'Use Chrome normally, return to Own Path, or ask a parent to adjust the schedule.',
  },
  off_hours_closed: {
    label: 'Outside schedule',
    title: 'Lockdown is off right now',
    copy: 'This browser is outside scheduled school time. Lockdown blocking is off until the next school-time window starts.',
    next_step: 'Use Chrome normally, return to Own Path, or ask a parent to adjust the schedule.',
  },
  entitlement_inactive: {
    label: 'Entitlement inactive',
    title: 'Lockdown access is inactive',
    copy: 'The parent account is not currently entitled to Lockdown browser enforcement.',
    next_step: 'Ask a parent to restore the entitlement before trying again.',
  },
  device_revoked: {
    label: 'Device revoked',
    title: 'This device was revoked',
    copy: 'A parent needs to re-pair or approve a new device credential. Cached policy can remain local, but it will not unlock access here.',
    next_step: 'Ask a parent to pair the browser again from the dashboard.',
  },
  unpaired: {
    label: 'Not paired',
    title: 'This browser is not paired',
    copy: 'Pair this browser with a trusted enrollment code from the parent dashboard. There is no self-serve unlock on this page.',
    next_step: 'Ask a parent to create or repair the pairing.',
  },
  stale_cached_policy: {
    label: 'Cached policy',
    title: 'Using a cached policy',
    copy: 'The last trusted policy is still active locally, but a fresh sync has not completed yet.',
    next_step: 'Wait for secure sync to recover or ask a parent to repair the device.',
  },
});

function normalizeStateKey(value) {
  return trimString(value).toLowerCase();
}

export function resolveLockdownStateKey({
  stateKey = '',
  policy = {},
  syncState = {},
} = {}) {
  const normalizedStateKey = normalizeStateKey(stateKey);
  if (normalizedStateKey && LOCKDOWN_STATE_GUIDANCE[normalizedStateKey]) {
    return normalizedStateKey;
  }

  const remoteState = normalizeStateKey(syncState.remote_policy_state);
  const syncStatus = normalizeStateKey(syncState.status);

  if (syncStatus === 'revoked' || remoteState === 'device_revoked') return 'device_revoked';
  if (syncStatus === 'unpaired' || remoteState === 'unpaired') return 'unpaired';
  if (remoteState === 'stale_cached_policy' || (syncState.using_cached_policy === true && syncStatus === 'network_error')) {
    return 'stale_cached_policy';
  }
  if (remoteState === 'off_hours_closed' || remoteState === 'off_hours_open') return 'off_hours_closed';
  if (remoteState === 'no_active_work' || remoteState === 'no_active_session') return remoteState;
  if (remoteState === 'no_published_plan') return 'no_published_plan';
  if (remoteState === 'entitlement_inactive') return 'entitlement_inactive';
  if (remoteState === 'active_block') return 'active_block';

  if (policy?.is_enabled === false) {
    return 'unpaired';
  }

  return 'active_block';
}

export function getLockdownStateGuidance(input = {}) {
  const stateKey = resolveLockdownStateKey(input);
  return {
    stateKey,
    ...LOCKDOWN_STATE_GUIDANCE[stateKey],
  };
}

export function getRequestAccessGuidance({ acceptedProductDecision = false } = {}) {
  if (acceptedProductDecision) {
    return {
      status: LOCKDOWN_REQUEST_ACCESS_STATUS.ACCEPTED,
      title: 'Request help is available',
      copy: 'Request help or access can be routed through the accepted product flow.',
      next_step: 'Use the configured request workflow.',
    };
  }

  return {
    status: LOCKDOWN_REQUEST_ACCESS_STATUS.DEFERRED,
    title: 'Request help is deferred',
    copy: 'No self-serve unlock is available in this build. A parent still has to approve any change.',
    next_step: 'Ask a parent to update the schedule, plan, or device pairing instead.',
  };
}

export function formatCreatorMetadata(creator = {}) {
  const title = trimString(
    creator.title
    || creator.youtube_channel_title
    || creator.channel_id
    || creator.channelId
  ) || 'Unknown creator';
  const handle = trimString(creator.handle || creator.youtube_channel_handle);
  const channelId = trimString(creator.channelId || creator.youtube_channel_id || creator.channel_id);

  return {
    title,
    handle,
    channelId,
    metadataLine: [handle, channelId].filter(Boolean).join(' • '),
  };
}

export function getYoutubeBlockedGuidance({
  policy = {},
  syncState = {},
  creator = {},
} = {}) {
  const stateGuidance = getLockdownStateGuidance({ policy, syncState });
  const metadata = formatCreatorMetadata(creator);

  return {
    ...stateGuidance,
    title: metadata.title === 'Unknown creator'
      ? stateGuidance.title
      : `${metadata.title} is blocked right now`,
    copy: [
      metadata.metadataLine ? `${metadata.metadataLine} is not approved by the current policy.` : '',
      stateGuidance.copy,
    ].filter(Boolean).join(' '),
    creatorMetadata: metadata,
    requestAccess: getRequestAccessGuidance(),
  };
}

export function summarizeAllowedResources(policy = {}) {
  const allowedOrigins = Array.from(new Set(
    Array.isArray(policy.allowed_origins)
      ? policy.allowed_origins.map((origin) => normalizeOrigin(origin)).filter(Boolean)
      : []
  ));

  const allowedCreators = Array.isArray(policy.allowed_youtube_channels)
    ? policy.allowed_youtube_channels
      .map((creator) => ({
        channel_id: trimString(creator?.channel_id),
        title: trimString(creator?.title),
        handle: trimString(creator?.handle),
      }))
      .filter((creator) => creator.channel_id)
    : [];

  const allowedSystemResources = Array.isArray(policy.system_resources)
    ? policy.system_resources
      .filter((resource) => resource && resource.allowed !== false)
      .map((resource) => ({
        resource_type: trimString(resource.resource_type || resource.type),
        name: trimString(resource.name || resource.label || resource.origin || resource.url || resource.page),
        origin: trimString(resource.origin),
        url: trimString(resource.url),
        page: trimString(resource.page),
      }))
    : [];

  return {
    allowedOrigins,
    allowedCreators,
    allowedSystemResources,
  };
}
