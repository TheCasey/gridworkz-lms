import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import Stripe from 'stripe';

initializeApp();

const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || 'us-central1';
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const STRIPE_CORE_PRICE_ID = defineSecret('STRIPE_CORE_PRICE_ID');
const STRIPE_LOCKDOWN_PRICE_ID = defineSecret('STRIPE_LOCKDOWN_PRICE_ID');

const COLLECTIONS = Object.freeze({
  ACCOUNT_ENTITLEMENTS: 'accountEntitlements',
  LOCKDOWN_DEVICES: 'lockdownDevices',
  LOCKDOWN_ENROLLMENT_SESSIONS: 'lockdownEnrollmentSessions',
  PARENTS: 'parents',
  STUDENTS: 'students',
  SUBJECTS: 'subjects',
  TIMER_SESSIONS: 'timerSessions',
  WEEKLY_PLANS: 'weeklyPlans',
});

const PLAN_IDS = Object.freeze({
  FREE: 'free',
  CORE: 'core',
  LOCKDOWN: 'lockdown',
});

const SUBSCRIPTION_STATUSES = Object.freeze({
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
});

const PLAN_LIMITS = Object.freeze({
  [PLAN_IDS.FREE]: Object.freeze({
    maxStudents: 2,
    maxActiveSubjects: 3,
    features: Object.freeze({
      can_use_projects: false,
      can_use_lockdown_extension: false,
      can_use_lockdown_kiosk: false,
    }),
  }),
  [PLAN_IDS.CORE]: Object.freeze({
    maxStudents: 10,
    maxActiveSubjects: null,
    features: Object.freeze({
      can_use_projects: true,
      can_use_lockdown_extension: false,
      can_use_lockdown_kiosk: false,
    }),
  }),
  [PLAN_IDS.LOCKDOWN]: Object.freeze({
    maxStudents: 10,
    maxActiveSubjects: null,
    features: Object.freeze({
      can_use_projects: true,
      can_use_lockdown_extension: true,
      can_use_lockdown_kiosk: true,
    }),
  }),
});

const DEFAULT_PARENT_SETTINGS = Object.freeze({
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: 'America/Chicago',
});

const LOCKDOWN_CONTRACTS = Object.freeze({
  TRUSTED_ENROLLMENT: 'trusted_lockdown_enrollment_v1',
  TRUSTED_POLICY_READ: 'trusted_lockdown_device_policy_v1',
  DERIVED_WEEKLY_PLAN_SOURCE: 'published_weekly_plan_derived_policy_v1',
});

const LOCKDOWN_POLICY_STATES = Object.freeze({
  ACTIVE_BLOCK: 'active_block',
  NO_ACTIVE_BLOCK: 'no_active_block',
  OUTSIDE_SCHOOL_TIME: 'outside_school_time',
  ENTITLEMENT_INACTIVE: 'entitlement_inactive',
});

const LOCKDOWN_TOKEN_PREFIXES = Object.freeze({
  ENROLLMENT: 'lde_1',
  DEVICE: 'ldc_1',
});

const LOCKDOWN_ENROLLMENT_TTL_MS = 15 * 60 * 1000;

const LOCKDOWN_DEVICE_STATUSES = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
});

const LOCKDOWN_ENROLLMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  CONSUMED: 'consumed',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
});

const DEFAULT_LOCKDOWN_SCHOOL_DAYS = Object.freeze([1, 2, 3, 4, 5]);
const DEFAULT_LOCKDOWN_SCHOOL_DAY_START_TIME = '08:00';
const DEFAULT_LOCKDOWN_SCHOOL_DAY_END_TIME = '15:00';
const EVERY_DAY = Object.freeze([0, 1, 2, 3, 4, 5, 6]);
const WEEKDAY_NAME_TO_INDEX = Object.freeze({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
});
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const normalizePlanId = (planId) => (
  Object.values(PLAN_IDS).includes(planId) ? planId : PLAN_IDS.FREE
);

const buildFeatureSet = (planId, featureOverrides = {}) => {
  const planFeatures = PLAN_LIMITS[normalizePlanId(planId)].features;

  return Object.keys(planFeatures).reduce((resolved, featureKey) => {
    resolved[featureKey] = typeof featureOverrides?.[featureKey] === 'boolean'
      ? featureOverrides[featureKey]
      : planFeatures[featureKey];
    return resolved;
  }, {});
};

const entitlementRef = (parentId) => (
  db.collection(COLLECTIONS.ACCOUNT_ENTITLEMENTS).doc(parentId)
);

const lockdownEnrollmentRef = (enrollmentId) => (
  db.collection(COLLECTIONS.LOCKDOWN_ENROLLMENT_SESSIONS).doc(enrollmentId)
);

const lockdownDeviceRef = (deviceId) => (
  db.collection(COLLECTIONS.LOCKDOWN_DEVICES).doc(deviceId)
);

const trimString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const timeZoneFormatterCache = new Map();

const buildTimeZoneFormatter = (timeZone) => new Intl.DateTimeFormat('en-US', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

const getTimeZoneFormatter = (timeZone) => {
  if (!timeZoneFormatterCache.has(timeZone)) {
    timeZoneFormatterCache.set(timeZone, buildTimeZoneFormatter(timeZone));
  }

  return timeZoneFormatterCache.get(timeZone);
};

const normalizeOriginEntry = (value) => {
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

const normalizeLockdownChannel = (channel) => {
  if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
    return null;
  }

  const channelId = trimString(channel.channel_id);
  if (!channelId) {
    return null;
  }

  return {
    channel_id: channelId,
    title: trimString(channel.title),
    handle: trimString(channel.handle),
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

  if (typeof value === 'string') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return null;
};

const maxTimestampMillis = (...values) => {
  const validMillis = values
    .map((value) => toTimestampMillis(value))
    .filter((value) => Number.isFinite(value));

  return validMillis.length ? Math.max(...validMillis) : null;
};

const sha256Hex = (value) => (
  createHash('sha256').update(value).digest('hex')
);

const hashLockdownSecret = (secret) => (
  secret ? sha256Hex(secret) : ''
);

const constantTimeHexEquals = (left, right) => {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
};

const buildOpaqueCredential = (prefix, documentId) => {
  const secret = randomBytes(24).toString('hex');

  return {
    secret,
    token: `${prefix}.${documentId}.${secret}`,
    tokenHash: hashLockdownSecret(secret),
  };
};

const parseOpaqueCredential = (rawToken, expectedPrefix) => {
  const token = trimString(rawToken);
  const [prefix, documentId, secret, ...rest] = token.split('.');

  if (!token || rest.length || prefix !== expectedPrefix || !documentId || !secret) {
    return null;
  }

  return {
    documentId,
    secret,
    token,
  };
};

const readJsonBody = (request) => (
  request.body && typeof request.body === 'object' && !Array.isArray(request.body)
    ? request.body
    : {}
);

const readBearerToken = (request) => {
  const authorization = trimString(request.get('authorization'));
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? trimString(match[1]) : '';
};

const setLockdownCorsHeaders = (response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Cache-Control', 'no-store');
};

const maybeHandleLockdownPreflight = (request, response) => {
  setLockdownCorsHeaders(response);
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return true;
  }

  return false;
};

const sendLockdownJson = (response, statusCode, payload) => {
  setLockdownCorsHeaders(response);
  response.status(statusCode).json(payload);
};

const sendLockdownError = (response, statusCode, message, code) => {
  sendLockdownJson(response, statusCode, {
    error: {
      code,
      message,
    },
  });
};

const ensureAuthenticated = (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to perform this action.');
  }

  return request.auth.uid;
};

const ensureLockdownExtensionEntitlement = (entitlementState) => {
  if (!entitlementState.features.can_use_lockdown_extension) {
    throw new HttpsError(
      'permission-denied',
      'The current account plan cannot manage lockdown browser extension devices.'
    );
  }
};

const slugifyStudentName = (name) => (
  trimString(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    || 'student'
);

const buildStudentSlug = (name) => (
  `${slugifyStudentName(name)}-${randomBytes(4).toString('hex').slice(0, 6)}`
);

const toTimestampOrNull = (seconds) => (
  Number.isFinite(seconds) ? Timestamp.fromMillis(seconds * 1000) : null
);

const getAccountEntitlementState = async (parentId) => {
  const snapshot = await entitlementRef(parentId).get();
  const data = snapshot.exists ? snapshot.data() : {};
  const planId = normalizePlanId(data?.plan_id);

  return {
    exists: snapshot.exists,
    data,
    planId,
    limits: PLAN_LIMITS[planId],
    features: buildFeatureSet(planId, data?.feature_overrides),
  };
};

const isExpiredTimestamp = (timestampValue) => {
  if (!timestampValue || typeof timestampValue.toMillis !== 'function') {
    return false;
  }

  return timestampValue.toMillis() <= Date.now();
};

const countStudentsForParent = async (parentId) => {
  const snapshot = await db.collection(COLLECTIONS.STUDENTS)
    .where('parent_id', '==', parentId)
    .get();

  return snapshot.size;
};

const countActiveSubjectsForParent = async (parentId) => {
  const snapshot = await db.collection(COLLECTIONS.SUBJECTS)
    .where('parent_id', '==', parentId)
    .where('is_active', '==', true)
    .get();

  return snapshot.size;
};

const loadParentSettings = async (parentId) => {
  const snapshot = await db.collection(COLLECTIONS.PARENTS).doc(parentId).get();
  const data = snapshot.exists ? snapshot.data() : {};

  return {
    week_reset_day: Number.isInteger(data?.week_reset_day) ? data.week_reset_day : DEFAULT_PARENT_SETTINGS.week_reset_day,
    week_reset_hour: Number.isInteger(data?.week_reset_hour) ? data.week_reset_hour : DEFAULT_PARENT_SETTINGS.week_reset_hour,
    week_reset_minute: Number.isInteger(data?.week_reset_minute) ? data.week_reset_minute : DEFAULT_PARENT_SETTINGS.week_reset_minute,
    timezone: trimString(data?.timezone) || DEFAULT_PARENT_SETTINGS.timezone,
  };
};

const normalizeDayList = (value, fallback = DEFAULT_LOCKDOWN_SCHOOL_DAYS) => {
  const normalizedDays = Array.from(
    new Set(
      (Array.isArray(value) ? value : fallback)
        .map((dayValue) => Number.parseInt(dayValue, 10))
        .filter((dayValue) => Number.isInteger(dayValue) && dayValue >= 0 && dayValue <= 6)
    )
  );

  return normalizedDays.length ? normalizedDays : [...fallback];
};

const parseDailyTimeValue = (value, fallbackValue = '00:00') => {
  const normalizedValue = trimString(value) || fallbackValue;
  const [rawHour = '0', rawMinute = '0'] = normalizedValue.split(':');
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);
  const safeHour = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 0;
  const safeMinute = Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 0;

  return {
    hour: safeHour,
    minute: safeMinute,
    totalMinutes: (safeHour * 60) + safeMinute,
    value: `${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`,
  };
};

const isMinutesWithinWindow = (value, startMinutes, endMinutes) => {
  if (!Number.isInteger(value) || !Number.isInteger(startMinutes) || !Number.isInteger(endMinutes)) {
    return false;
  }

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return value >= startMinutes && value < endMinutes;
  }

  return value >= startMinutes || value < endMinutes;
};

const resolveDateInput = (value) => {
  const resolvedDate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(resolvedDate.getTime()) ? new Date() : resolvedDate;
};

const buildLocalDateString = (year, month, day) => (
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const shiftLocalDatePartsByDays = (parts, dayOffset) => {
  const shiftedDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + dayOffset);

  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth() + 1,
    day: shiftedDate.getUTCDate(),
  };
};

const getDateTimePartsInTimeZone = (dateInput, timeZone) => {
  const date = resolveDateInput(dateInput);

  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      weekday: date.getDay(),
      localDate: buildLocalDateString(date.getFullYear(), date.getMonth() + 1, date.getDate()),
      localTime: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    };
  }

  try {
    const formatter = getTimeZoneFormatter(timeZone);
    const rawParts = formatter.formatToParts(date).reduce((parts, part) => {
      if (part.type !== 'literal') {
        parts[part.type] = part.value;
      }
      return parts;
    }, {});
    const year = Number.parseInt(rawParts.year, 10);
    const month = Number.parseInt(rawParts.month, 10);
    const day = Number.parseInt(rawParts.day, 10);
    const hour = Number.parseInt(rawParts.hour, 10);
    const minute = Number.parseInt(rawParts.minute, 10);
    const second = Number.parseInt(rawParts.second, 10);

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      weekday: WEEKDAY_NAME_TO_INDEX[rawParts.weekday] ?? date.getDay(),
      localDate: buildLocalDateString(year, month, day),
      localTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
  } catch {
    return getDateTimePartsInTimeZone(date, '');
  }
};

const resolveWeekKeyForDate = (dateInput, weekConfig = {}) => {
  const date = resolveDateInput(dateInput);
  const timezone = trimString(weekConfig.timezone) || DEFAULT_PARENT_SETTINGS.timezone;
  const resetDay = Number.isInteger(weekConfig.week_reset_day)
    ? weekConfig.week_reset_day
    : DEFAULT_PARENT_SETTINGS.week_reset_day;
  const resetHour = Number.isInteger(weekConfig.week_reset_hour)
    ? weekConfig.week_reset_hour
    : DEFAULT_PARENT_SETTINGS.week_reset_hour;
  const resetMinute = Number.isInteger(weekConfig.week_reset_minute)
    ? weekConfig.week_reset_minute
    : DEFAULT_PARENT_SETTINGS.week_reset_minute;
  const localParts = getDateTimePartsInTimeZone(date, timezone);
  const daysSinceReset = (localParts.weekday - resetDay + 7) % 7;
  let boundaryDateParts = shiftLocalDatePartsByDays(localParts, -daysSinceReset);
  const beforeBoundary = daysSinceReset === 0 && (
    localParts.hour < resetHour
    || (localParts.hour === resetHour && localParts.minute < resetMinute)
  );

  if (beforeBoundary) {
    boundaryDateParts = shiftLocalDatePartsByDays(boundaryDateParts, -7);
  }

  return buildLocalDateString(
    boundaryDateParts.year,
    boundaryDateParts.month,
    boundaryDateParts.day
  );
};

const buildWeeklyPlanDocumentId = ({ parentId, studentId, weekKey }) => (
  [parentId, studentId, weekKey].filter(Boolean).join('_')
);

const normalizeLockdownWindow = (windowConfig = {}, index = 0) => {
  const start = parseDailyTimeValue(windowConfig.start_time, '00:00');
  const end = parseDailyTimeValue(windowConfig.end_time, '23:59');

  return {
    id: trimString(windowConfig.id) || `off_hours_window_${index + 1}`,
    label: trimString(windowConfig.label),
    days: normalizeDayList(windowConfig.days, EVERY_DAY),
    start_time: start.value,
    end_time: end.value,
    resources: Array.isArray(windowConfig.resources)
      ? windowConfig.resources.map((resource) => ({ ...resource }))
      : [],
  };
};

const normalizeLockdownSchedule = (studentRecord = {}) => {
  const rawSchedule = studentRecord?.lockdown_schedule
    && typeof studentRecord.lockdown_schedule === 'object'
    && !Array.isArray(studentRecord.lockdown_schedule)
      ? studentRecord.lockdown_schedule
      : {};
  const start = parseDailyTimeValue(
    rawSchedule.school_day_start_time,
    DEFAULT_LOCKDOWN_SCHOOL_DAY_START_TIME
  );
  const end = parseDailyTimeValue(
    rawSchedule.school_day_end_time,
    DEFAULT_LOCKDOWN_SCHOOL_DAY_END_TIME
  );

  return {
    timezone: trimString(rawSchedule.timezone) || trimString(studentRecord.timezone) || DEFAULT_PARENT_SETTINGS.timezone,
    school_days: normalizeDayList(rawSchedule.school_days, DEFAULT_LOCKDOWN_SCHOOL_DAYS),
    school_day_start_time: start.value,
    school_day_end_time: end.value,
    off_hours_resource_windows: (Array.isArray(rawSchedule.off_hours_resource_windows)
      ? rawSchedule.off_hours_resource_windows
      : [])
      .map((windowConfig, index) => normalizeLockdownWindow(windowConfig, index)),
  };
};

const resolveLockdownTimeContext = ({
  referenceDate = new Date(),
  studentRecord = {},
} = {}) => {
  const schedule = normalizeLockdownSchedule(studentRecord);
  const localParts = getDateTimePartsInTimeZone(referenceDate, schedule.timezone);
  const localTimeMinutes = (localParts.hour * 60) + localParts.minute;
  const schoolStart = parseDailyTimeValue(schedule.school_day_start_time);
  const schoolEnd = parseDailyTimeValue(schedule.school_day_end_time);
  const schoolDayActive = schedule.school_days.includes(localParts.weekday);
  const inSchoolTime = schoolDayActive && isMinutesWithinWindow(
    localTimeMinutes,
    schoolStart.totalMinutes,
    schoolEnd.totalMinutes
  );
  const activeOffHoursWindow = inSchoolTime
    ? null
    : schedule.off_hours_resource_windows.find((windowConfig) => (
      windowConfig.days.includes(localParts.weekday)
      && isMinutesWithinWindow(
        localTimeMinutes,
        parseDailyTimeValue(windowConfig.start_time).totalMinutes,
        parseDailyTimeValue(windowConfig.end_time).totalMinutes
      )
    )) || null;

  return {
    schedule,
    timezone: schedule.timezone,
    localDate: localParts.localDate,
    localDay: localParts.weekday,
    localTime: localParts.localTime,
    localTimeMinutes,
    schoolDayActive,
    inSchoolTime,
    activeOffHoursWindow,
  };
};

const isYoutubeUrl = (value) => {
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

const normalizeDevicePolicyYoutubeChannel = (resource) => (
  normalizeLockdownChannel({
    channel_id: trimString(resource?.youtube_channel_id),
    title: trimString(resource?.youtube_channel_title) || trimString(resource?.name),
    handle: trimString(resource?.youtube_channel_handle),
  })
);

const deriveLockdownTargetsFromResources = (resources = []) => {
  const allowedOrigins = [];
  const allowedYoutubeChannels = [];
  const unsupportedResources = [];
  const seenOrigins = new Set();
  const seenChannels = new Set();

  (Array.isArray(resources) ? resources : []).forEach((resource) => {
    const normalizedChannel = normalizeDevicePolicyYoutubeChannel(resource);

    if (normalizedChannel && !seenChannels.has(normalizedChannel.channel_id)) {
      seenChannels.add(normalizedChannel.channel_id);
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

      if (!seenOrigins.has(normalizedOrigin)) {
        seenOrigins.add(normalizedOrigin);
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

const normalizeTimerSessionCandidate = (timerSnapshot) => {
  const timerRecord = timerSnapshot.data();

  return {
    id: timerSnapshot.id,
    ...timerRecord,
    saved_at: Number.isFinite(timerRecord?.saved_at) ? timerRecord.saved_at : 0,
    block_index: Number.isInteger(timerRecord?.block_index)
      ? timerRecord.block_index
      : Number.parseInt(timerRecord?.block_index, 10),
  };
};

const selectActiveWeeklyPlanBlock = ({ weeklyPlan, timerSessions = [] }) => {
  const blocks = Array.isArray(weeklyPlan?.blocks) ? weeklyPlan.blocks : [];

  const matchingCandidates = (Array.isArray(timerSessions) ? timerSessions : []).reduce((candidates, timerSession) => {
    const matchingBlock = blocks.find((block) => (
      trimString(block?.legacy_subject_id) === trimString(timerSession?.subject_id)
      && Number.isInteger(block?.legacy_block_index)
      && block.legacy_block_index === timerSession?.block_index
    )) || null;

    if (!matchingBlock) {
      return candidates;
    }

    candidates.push({
      block: matchingBlock,
      timerSession,
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
  kind: LOCKDOWN_CONTRACTS.DERIVED_WEEKLY_PLAN_SOURCE,
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

export const derivePublishedWeeklyPlanDevicePolicy = ({
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
    studentRecord: studentRecord || {},
  });
  const { activeBlock, activeTimerSession } = selectActiveWeeklyPlanBlock({
    weeklyPlan,
    timerSessions,
  });

  let policyState = LOCKDOWN_POLICY_STATES.NO_ACTIVE_BLOCK;
  let policyResources = [];

  if (!entitlementActive) {
    policyState = LOCKDOWN_POLICY_STATES.ENTITLEMENT_INACTIVE;
  } else if (!timeContext.inSchoolTime) {
    policyState = LOCKDOWN_POLICY_STATES.OUTSIDE_SCHOOL_TIME;
    policyResources = Array.isArray(timeContext.activeOffHoursWindow?.resources)
      ? timeContext.activeOffHoursWindow.resources
      : [];
  } else if (activeBlock) {
    policyState = LOCKDOWN_POLICY_STATES.ACTIVE_BLOCK;
    policyResources = Array.isArray(activeBlock.resources) ? activeBlock.resources : [];
  }

  const derivedTargets = deriveLockdownTargetsFromResources(policyResources);
  const effectiveActiveBlock = policyState === LOCKDOWN_POLICY_STATES.ACTIVE_BLOCK
    ? activeBlock
    : null;
  const effectiveActiveTimerSession = policyState === LOCKDOWN_POLICY_STATES.ACTIVE_BLOCK
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

  return {
    contract: LOCKDOWN_CONTRACTS.TRUSTED_POLICY_READ,
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

const loadLockdownStudentBinding = async ({
  parentId,
  requestedStudentId = '',
  allowImplicitSingleStudent = true,
  allowUnboundFallback = false,
} = {}) => {
  const normalizedStudentId = trimString(requestedStudentId);

  if (normalizedStudentId) {
    const studentSnapshot = await db.collection(COLLECTIONS.STUDENTS).doc(normalizedStudentId).get();

    if (!studentSnapshot.exists || trimString(studentSnapshot.data()?.parent_id) !== parentId) {
      throw new HttpsError(
        'invalid-argument',
        'The requested student binding does not belong to the signed-in parent.'
      );
    }

    return {
      studentId: studentSnapshot.id,
      studentRecord: {
        id: studentSnapshot.id,
        ...studentSnapshot.data(),
      },
      bindingError: '',
    };
  }

  if (!allowImplicitSingleStudent) {
    return {
      studentId: '',
      studentRecord: null,
      bindingError: 'student_binding_required',
    };
  }

  const studentSnapshot = await db.collection(COLLECTIONS.STUDENTS)
    .where('parent_id', '==', parentId)
    .where('is_active', '==', true)
    .get();

  if (studentSnapshot.size === 1) {
    const onlyStudent = studentSnapshot.docs[0];
    return {
      studentId: onlyStudent.id,
      studentRecord: {
        id: onlyStudent.id,
        ...onlyStudent.data(),
      },
      bindingError: '',
    };
  }

  if (studentSnapshot.empty) {
    if (allowUnboundFallback) {
      return {
        studentId: '',
        studentRecord: null,
        bindingError: 'no_active_students',
      };
    }

    throw new HttpsError(
      'failed-precondition',
      'At least one active student is required before a trusted lockdown device can be paired.'
    );
  }

  if (allowUnboundFallback) {
    return {
      studentId: '',
      studentRecord: null,
      bindingError: 'student_binding_required',
    };
  }

  throw new HttpsError(
    'failed-precondition',
    'Trusted lockdown pairing now requires a student binding when multiple active students exist.'
  );
};

const loadPublishedWeeklyPlanForStudent = async ({
  parentId,
  studentRecord,
  referenceDate = new Date(),
} = {}) => {
  if (!studentRecord?.id) {
    return null;
  }

  const weekKey = resolveWeekKeyForDate(referenceDate, studentRecord);
  const weeklyPlanId = buildWeeklyPlanDocumentId({
    parentId,
    studentId: studentRecord.id,
    weekKey,
  });
  const weeklyPlanSnapshot = await db.collection(COLLECTIONS.WEEKLY_PLANS).doc(weeklyPlanId).get();

  if (!weeklyPlanSnapshot.exists) {
    return null;
  }

  const weeklyPlanRecord = {
    id: weeklyPlanSnapshot.id,
    ...weeklyPlanSnapshot.data(),
  };

  return trimString(weeklyPlanRecord.status) === 'published'
    ? weeklyPlanRecord
    : null;
};

const loadStudentTimerSessions = async (studentId) => {
  if (!trimString(studentId)) {
    return [];
  }

  const timerSnapshot = await db.collection(COLLECTIONS.TIMER_SESSIONS)
    .where('student_id', '==', studentId)
    .get();

  return timerSnapshot.docs.map((timerDoc) => normalizeTimerSessionCandidate(timerDoc));
};

const buildTrustedDevicePolicyResponse = async ({ deviceRecord, deviceId }) => {
  const entitlementState = await getAccountEntitlementState(deviceRecord.parent_id);
  const binding = await loadLockdownStudentBinding({
    parentId: deviceRecord.parent_id,
    requestedStudentId: deviceRecord.student_id,
    allowImplicitSingleStudent: true,
    allowUnboundFallback: true,
  });
  const weeklyPlan = await loadPublishedWeeklyPlanForStudent({
    parentId: deviceRecord.parent_id,
    studentRecord: binding.studentRecord,
    referenceDate: new Date(),
  });
  const timerSessions = await loadStudentTimerSessions(binding.studentId);
  const derivedPolicy = derivePublishedWeeklyPlanDevicePolicy({
    entitlementActive: entitlementState.features.can_use_lockdown_extension,
    parentId: deviceRecord.parent_id,
    studentRecord: binding.studentRecord,
    weeklyPlan,
    timerSessions,
    referenceDate: new Date(),
  });

  return {
    contract: LOCKDOWN_CONTRACTS.TRUSTED_POLICY_READ,
    contract_version: 1,
    device_id: deviceId,
    ...derivedPolicy,
    policy_context: {
      ...derivedPolicy.policy_context,
      binding_error: binding.bindingError || '',
    },
    fetched_at: new Date().toISOString(),
  };
};

const validateAccessPin = (accessPin) => {
  if (accessPin == null || accessPin === '') {
    return null;
  }

  const normalized = trimString(accessPin);
  if (!/^\d{4}$/.test(normalized)) {
    throw new HttpsError('invalid-argument', 'Access PINs must be 4 numeric digits.');
  }

  return normalized;
};

const normalizeResourceList = (resources = []) => {
  if (!Array.isArray(resources)) {
    throw new HttpsError('invalid-argument', 'Resources must be an array.');
  }

  return resources
    .map((resource) => ({
      name: trimString(resource?.name),
      url: trimString(resource?.url),
      lockdown_origin: trimString(resource?.lockdown_origin),
      youtube_channel_id: trimString(resource?.youtube_channel_id),
      youtube_channel_title: trimString(resource?.youtube_channel_title),
      youtube_channel_handle: trimString(resource?.youtube_channel_handle),
    }))
    .filter((resource) => resource.name);
};

const normalizeCustomFields = (customFields = []) => {
  if (!Array.isArray(customFields)) {
    throw new HttpsError('invalid-argument', 'Custom fields must be an array.');
  }

  return customFields
    .map((field) => ({
      id: trimString(field?.id) || randomBytes(6).toString('hex'),
      type: trimString(field?.type) || 'text',
      label: trimString(field?.label),
      placeholder: trimString(field?.placeholder),
      required: Boolean(field?.required),
    }))
    .filter((field) => field.label);
};

const normalizeBlockObjectives = (blockObjectives = {}) => {
  if (!blockObjectives || typeof blockObjectives !== 'object' || Array.isArray(blockObjectives)) {
    throw new HttpsError('invalid-argument', 'Block objectives must be an object map.');
  }

  return Object.fromEntries(
    Object.entries(blockObjectives).flatMap(([blockIndex, objective]) => {
      const instruction = trimString(objective?.instruction);
      const customFields = normalizeCustomFields(objective?.custom_fields || []);
      const studentOverrides = Object.fromEntries(
        Object.entries(objective?.student_overrides || {}).flatMap(([studentId, override]) => {
          const overrideInstruction = trimString(override?.instruction);
          const overrideFields = normalizeCustomFields(override?.custom_fields || []);
          if (!overrideInstruction && !overrideFields.length) {
            return [];
          }

          return [[studentId, {
            instruction: overrideInstruction,
            custom_fields: overrideFields,
          }]];
        })
      );

      if (!instruction && !customFields.length && !Object.keys(studentOverrides).length) {
        return [];
      }

      return [[blockIndex, {
        instruction,
        custom_fields: customFields,
        student_overrides: studentOverrides,
      }]];
    })
  );
};

const assertParentOwnsStudents = async (parentId, studentIds) => {
  const uniqueStudentIds = Array.from(new Set(studentIds));
  const studentSnapshots = await Promise.all(
    uniqueStudentIds.map((studentId) => db.collection(COLLECTIONS.STUDENTS).doc(studentId).get())
  );

  const allOwned = studentSnapshots.every((snapshot) => (
    snapshot.exists &&
    snapshot.data()?.parent_id === parentId
  ));

  if (!allOwned) {
    throw new HttpsError(
      'failed-precondition',
      'Every assigned student must exist and belong to the current parent account.'
    );
  }
};

const getStripeClient = () => {
  const apiKey = trimString(STRIPE_SECRET_KEY.value());
  if (!apiKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
  }

  return new Stripe(apiKey);
};

const resolveStripePlanIdFromPriceId = (priceId) => {
  const lockdownPriceIds = new Set([trimString(STRIPE_LOCKDOWN_PRICE_ID.value())].filter(Boolean));
  const corePriceIds = new Set([trimString(STRIPE_CORE_PRICE_ID.value())].filter(Boolean));

  if (!priceId) return null;
  if (lockdownPriceIds.has(priceId)) return PLAN_IDS.LOCKDOWN;
  if (corePriceIds.has(priceId)) return PLAN_IDS.CORE;
  return null;
};

const resolveStripePlanIdFromSubscription = (subscription) => {
  const metadataPlanId = normalizePlanId(
    trimString(subscription?.metadata?.plan_id || subscription?.metadata?.gridworkz_plan_id)
  );

  if (metadataPlanId !== PLAN_IDS.FREE || trimString(subscription?.metadata?.plan_id || subscription?.metadata?.gridworkz_plan_id)) {
    return metadataPlanId;
  }

  const priceId = trimString(subscription?.items?.data?.[0]?.price?.id);
  return resolveStripePlanIdFromPriceId(priceId);
};

const resolveStripeParentIdFromObject = (stripeObject) => {
  const metadataParentId = trimString(
    stripeObject?.metadata?.parent_id ||
    stripeObject?.metadata?.parentId ||
    stripeObject?.metadata?.uid
  );

  if (metadataParentId) {
    return metadataParentId;
  }

  const clientReferenceId = trimString(stripeObject?.client_reference_id);
  return clientReferenceId || '';
};

const resolveStripeParentIdFromSubscription = async (stripe, subscription) => {
  const directParentId = resolveStripeParentIdFromObject(subscription);
  if (directParentId) {
    return directParentId;
  }

  const customerId = trimString(subscription?.customer);
  if (!customerId) {
    return '';
  }

  const customer = await stripe.customers.retrieve(customerId);
  if (customer?.deleted) {
    return '';
  }

  return resolveStripeParentIdFromObject(customer);
};

const mapStripeSubscriptionStatus = (stripeStatus) => {
  switch (stripeStatus) {
    case 'trialing':
      return SUBSCRIPTION_STATUSES.TRIALING;
    case 'active':
      return SUBSCRIPTION_STATUSES.ACTIVE;
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return SUBSCRIPTION_STATUSES.PAST_DUE;
    case 'canceled':
    case 'incomplete_expired':
      return SUBSCRIPTION_STATUSES.CANCELED;
    default:
      return SUBSCRIPTION_STATUSES.CANCELED;
  }
};

const buildEntitlementDocument = ({
  parentId,
  existingEntitlement = {},
  planId,
  subscriptionStatus,
  trialEndsAt,
  currentPeriodEnd,
}) => ({
  parent_id: parentId,
  plan_id: planId,
  subscription_status: subscriptionStatus,
  billing_provider: 'stripe',
  feature_overrides: existingEntitlement?.feature_overrides || {},
  usage_snapshot: existingEntitlement?.usage_snapshot || {
    students: 0,
    curriculum_items: 0,
  },
  trial_ends_at: trialEndsAt,
  current_period_end: currentPeriodEnd,
  updated_at: FieldValue.serverTimestamp(),
});

const syncEntitlementFromSubscription = async (stripe, subscription) => {
  const parentId = await resolveStripeParentIdFromSubscription(stripe, subscription);
  if (!parentId) {
    throw new Error('Stripe subscription is missing parent_id metadata or customer metadata.');
  }

  const rawPlanId = resolveStripePlanIdFromSubscription(subscription);
  if (!rawPlanId) {
    throw new Error('Stripe subscription is missing plan_id metadata and no known price mapping matched.');
  }

  const subscriptionStatus = mapStripeSubscriptionStatus(subscription.status);
  const planId = subscriptionStatus === SUBSCRIPTION_STATUSES.CANCELED
    ? PLAN_IDS.FREE
    : rawPlanId;

  const existingSnapshot = await entitlementRef(parentId).get();
  const entitlementDoc = buildEntitlementDocument({
    parentId,
    existingEntitlement: existingSnapshot.exists ? existingSnapshot.data() : {},
    planId,
    subscriptionStatus,
    trialEndsAt: toTimestampOrNull(subscription.trial_end),
    currentPeriodEnd: toTimestampOrNull(subscription.current_period_end),
  });

  await entitlementRef(parentId).set(entitlementDoc, { merge: true });
};

export const createStudent = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  const name = trimString(request.data?.name);

  if (!name) {
    throw new HttpsError('invalid-argument', 'Student name is required.');
  }

  const accessPin = validateAccessPin(request.data?.accessPin);
  const entitlementState = await getAccountEntitlementState(parentId);
  const currentStudentCount = await countStudentsForParent(parentId);

  if (
    entitlementState.limits.maxStudents != null &&
    currentStudentCount >= entitlementState.limits.maxStudents
  ) {
    throw new HttpsError(
      'resource-exhausted',
      'This account has reached the current plan student limit.'
    );
  }

  const parentSettings = await loadParentSettings(parentId);
  const slug = buildStudentSlug(name);
  const studentDoc = {
    name,
    slug,
    access_pin: accessPin,
    parent_id: parentId,
    week_reset_day: parentSettings.week_reset_day,
    week_reset_hour: parentSettings.week_reset_hour,
    week_reset_minute: parentSettings.week_reset_minute,
    timezone: parentSettings.timezone,
    lockdown_schedule: {
      timezone: parentSettings.timezone,
      school_days: [...DEFAULT_LOCKDOWN_SCHOOL_DAYS],
      school_day_start_time: DEFAULT_LOCKDOWN_SCHOOL_DAY_START_TIME,
      school_day_end_time: DEFAULT_LOCKDOWN_SCHOOL_DAY_END_TIME,
      off_hours_resource_windows: [],
    },
    is_active: true,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const createdRef = await db.collection(COLLECTIONS.STUDENTS).add(studentDoc);

  return {
    id: createdRef.id,
    slug,
  };
});

export const createSubject = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  const title = trimString(request.data?.title);
  const studentIds = Array.isArray(request.data?.student_ids)
    ? request.data.student_ids.map((studentId) => trimString(studentId)).filter(Boolean)
    : [];
  const blockCount = Number.parseInt(request.data?.block_count, 10);
  const blockLength = Number.parseInt(request.data?.block_length, 10);

  if (!title) {
    throw new HttpsError('invalid-argument', 'Subject title is required.');
  }

  if (!studentIds.length) {
    throw new HttpsError('invalid-argument', 'At least one assigned student is required.');
  }

  if (!Number.isInteger(blockCount) || blockCount < 1 || blockCount > 20) {
    throw new HttpsError('invalid-argument', 'Block count must be an integer between 1 and 20.');
  }

  if (!Number.isInteger(blockLength) || blockLength < 5 || blockLength > 120) {
    throw new HttpsError('invalid-argument', 'Block length must be an integer between 5 and 120 minutes.');
  }

  const entitlementState = await getAccountEntitlementState(parentId);
  const currentActiveSubjectCount = await countActiveSubjectsForParent(parentId);

  if (
    entitlementState.limits.maxActiveSubjects != null &&
    currentActiveSubjectCount >= entitlementState.limits.maxActiveSubjects
  ) {
    throw new HttpsError(
      'resource-exhausted',
      'This account has reached the current plan active subject limit.'
    );
  }

  await assertParentOwnsStudents(parentId, studentIds);

  const subjectDoc = {
    student_ids: Array.from(new Set(studentIds)),
    parent_id: parentId,
    title,
    block_count: blockCount,
    block_length: blockLength,
    color: trimString(request.data?.color) || '#3B82F6',
    resources: normalizeResourceList(request.data?.resources || []),
    require_input: Boolean(request.data?.require_input),
    custom_fields: normalizeCustomFields(request.data?.custom_fields || []),
    require_timer: Boolean(request.data?.require_timer),
    block_objectives: normalizeBlockObjectives(request.data?.block_objectives || {}),
    is_active: true,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const createdRef = await db.collection(COLLECTIONS.SUBJECTS).add(subjectDoc);

  return {
    id: createdRef.id,
  };
});

export const issueLockdownEnrollment = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  const entitlementState = await getAccountEntitlementState(parentId);

  ensureLockdownExtensionEntitlement(entitlementState);

  const binding = await loadLockdownStudentBinding({
    parentId,
    requestedStudentId: request.data?.student_id,
    allowImplicitSingleStudent: true,
    allowUnboundFallback: false,
  });
  const enrollmentId = randomBytes(12).toString('hex');
  const enrollmentCredential = buildOpaqueCredential(
    LOCKDOWN_TOKEN_PREFIXES.ENROLLMENT,
    enrollmentId
  );
  const expiresAt = Timestamp.fromMillis(Date.now() + LOCKDOWN_ENROLLMENT_TTL_MS);

  await lockdownEnrollmentRef(enrollmentId).set({
    parent_id: parentId,
    student_id: binding.studentId,
    source_policy_parent_id: parentId,
    source_policy_kind: LOCKDOWN_CONTRACTS.DERIVED_WEEKLY_PLAN_SOURCE,
    token_hash: enrollmentCredential.tokenHash,
    status: LOCKDOWN_ENROLLMENT_STATUSES.PENDING,
    consumed_device_id: '',
    consumed_at: null,
    expires_at: expiresAt,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  return {
    contract: LOCKDOWN_CONTRACTS.TRUSTED_ENROLLMENT,
    enrollment_token: enrollmentCredential.token,
    expires_at: expiresAt.toDate().toISOString(),
    source_policy_kind: LOCKDOWN_CONTRACTS.DERIVED_WEEKLY_PLAN_SOURCE,
    source_policy_parent_id: parentId,
    student_id: binding.studentId,
  };
});

export const lockdownExchangeEnrollment = onRequest({
  region: REGION,
  invoker: 'public',
}, async (request, response) => {
  if (maybeHandleLockdownPreflight(request, response)) {
    return;
  }

  if (request.method !== 'POST') {
    sendLockdownError(response, 405, 'Use POST to exchange enrollment material.', 'method_not_allowed');
    return;
  }

  const body = readJsonBody(request);
  const parsedEnrollment = parseOpaqueCredential(
    body.enrollment_token,
    LOCKDOWN_TOKEN_PREFIXES.ENROLLMENT
  );

  if (!parsedEnrollment) {
    sendLockdownError(response, 400, 'Enrollment token is invalid.', 'invalid_enrollment_token');
    return;
  }

  const enrollmentSnapshot = await lockdownEnrollmentRef(parsedEnrollment.documentId).get();
  if (!enrollmentSnapshot.exists) {
    sendLockdownError(response, 404, 'Enrollment ticket was not found.', 'enrollment_not_found');
    return;
  }

  const enrollmentRecord = enrollmentSnapshot.data();
  if (enrollmentRecord.status === LOCKDOWN_ENROLLMENT_STATUSES.REVOKED) {
    sendLockdownError(response, 403, 'Enrollment ticket was revoked.', 'enrollment_revoked');
    return;
  }

  if (enrollmentRecord.status === LOCKDOWN_ENROLLMENT_STATUSES.CONSUMED) {
    sendLockdownError(response, 409, 'Enrollment ticket has already been used.', 'enrollment_consumed');
    return;
  }

  if (isExpiredTimestamp(enrollmentRecord.expires_at)) {
    await enrollmentSnapshot.ref.set({
      status: LOCKDOWN_ENROLLMENT_STATUSES.EXPIRED,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    sendLockdownError(response, 410, 'Enrollment ticket expired.', 'enrollment_expired');
    return;
  }

  if (!constantTimeHexEquals(enrollmentRecord.token_hash, hashLockdownSecret(parsedEnrollment.secret))) {
    sendLockdownError(response, 403, 'Enrollment token is invalid.', 'invalid_enrollment_token');
    return;
  }

  const entitlementState = await getAccountEntitlementState(enrollmentRecord.parent_id);
  if (!entitlementState.features.can_use_lockdown_extension) {
    sendLockdownError(
      response,
      403,
      'Lockdown browser-extension access is not active for this account.',
      'lockdown_entitlement_inactive'
    );
    return;
  }

  const deviceId = randomBytes(12).toString('hex');
  const deviceCredential = buildOpaqueCredential(LOCKDOWN_TOKEN_PREFIXES.DEVICE, deviceId);
  const deviceName = trimString(body.device_name) || 'Unlabeled device';
  const devicePlatform = trimString(body.device_platform);
  const extensionVersion = trimString(body.extension_version);

  try {
    await db.runTransaction(async (transaction) => {
      const freshEnrollmentSnapshot = await transaction.get(lockdownEnrollmentRef(parsedEnrollment.documentId));
      if (!freshEnrollmentSnapshot.exists) {
        const error = new Error('enrollment_not_found');
        error.code = 'enrollment_not_found';
        throw error;
      }

      const freshEnrollmentRecord = freshEnrollmentSnapshot.data();
      if (freshEnrollmentRecord.status === LOCKDOWN_ENROLLMENT_STATUSES.CONSUMED) {
        const error = new Error('enrollment_consumed');
        error.code = 'enrollment_consumed';
        throw error;
      }

      if (freshEnrollmentRecord.status === LOCKDOWN_ENROLLMENT_STATUSES.REVOKED) {
        const error = new Error('enrollment_revoked');
        error.code = 'enrollment_revoked';
        throw error;
      }

      if (isExpiredTimestamp(freshEnrollmentRecord.expires_at)) {
        const error = new Error('enrollment_expired');
        error.code = 'enrollment_expired';
        throw error;
      }

      transaction.set(lockdownDeviceRef(deviceId), {
        parent_id: freshEnrollmentRecord.parent_id,
        student_id: trimString(freshEnrollmentRecord.student_id),
        source_policy_parent_id: freshEnrollmentRecord.source_policy_parent_id,
        source_policy_kind: freshEnrollmentRecord.source_policy_kind,
        pairing_contract: LOCKDOWN_CONTRACTS.TRUSTED_ENROLLMENT,
        policy_read_contract: LOCKDOWN_CONTRACTS.TRUSTED_POLICY_READ,
        credential_hash: deviceCredential.tokenHash,
        status: LOCKDOWN_DEVICE_STATUSES.ACTIVE,
        device_name: deviceName,
        device_platform: devicePlatform,
        extension_version: extensionVersion,
        paired_at: FieldValue.serverTimestamp(),
        last_seen_at: FieldValue.serverTimestamp(),
        last_policy_read_at: null,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      transaction.set(freshEnrollmentSnapshot.ref, {
        status: LOCKDOWN_ENROLLMENT_STATUSES.CONSUMED,
        consumed_device_id: deviceId,
        consumed_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  } catch (error) {
    if (error?.code === 'enrollment_expired') {
      await enrollmentSnapshot.ref.set({
        status: LOCKDOWN_ENROLLMENT_STATUSES.EXPIRED,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      sendLockdownError(response, 410, 'Enrollment ticket expired.', 'enrollment_expired');
      return;
    }

    if (error?.code === 'enrollment_consumed') {
      sendLockdownError(response, 409, 'Enrollment ticket has already been used.', 'enrollment_consumed');
      return;
    }

    if (error?.code === 'enrollment_revoked') {
      sendLockdownError(response, 403, 'Enrollment ticket was revoked.', 'enrollment_revoked');
      return;
    }

    if (error?.code === 'enrollment_not_found') {
      sendLockdownError(response, 404, 'Enrollment ticket was not found.', 'enrollment_not_found');
      return;
    }

    console.error('Trusted lockdown enrollment exchange failed:', error);
    sendLockdownError(response, 500, 'Enrollment exchange failed.', 'internal');
    return;
  }

  let trustedPolicyResponse;

  try {
    trustedPolicyResponse = await buildTrustedDevicePolicyResponse({
      deviceRecord: {
        parent_id: enrollmentRecord.parent_id,
        student_id: trimString(enrollmentRecord.student_id),
        source_policy_parent_id: enrollmentRecord.source_policy_parent_id,
      },
      deviceId,
    });
  } catch (error) {
    console.error('Trusted lockdown initial policy derivation failed:', error);
    sendLockdownError(response, 500, 'Initial device policy derivation failed.', 'internal');
    return;
  }

  sendLockdownJson(response, 200, {
    contract: LOCKDOWN_CONTRACTS.TRUSTED_ENROLLMENT,
    device_id: deviceId,
    student_id: trimString(enrollmentRecord.student_id),
    device_credential: deviceCredential.token,
    policy_read_contract: LOCKDOWN_CONTRACTS.TRUSTED_POLICY_READ,
    initial_policy: trustedPolicyResponse,
  });
});

export const readLockdownDevicePolicy = onRequest({
  region: REGION,
  invoker: 'public',
}, async (request, response) => {
  if (maybeHandleLockdownPreflight(request, response)) {
    return;
  }

  if (!['GET', 'POST'].includes(request.method)) {
    sendLockdownError(response, 405, 'Use GET or POST to read device policy.', 'method_not_allowed');
    return;
  }

  const body = readJsonBody(request);
  const rawCredential = readBearerToken(request) || trimString(body.device_credential);
  const parsedCredential = parseOpaqueCredential(rawCredential, LOCKDOWN_TOKEN_PREFIXES.DEVICE);

  if (!parsedCredential) {
    sendLockdownError(response, 401, 'Device credential is missing or invalid.', 'invalid_device_credential');
    return;
  }

  const deviceSnapshot = await lockdownDeviceRef(parsedCredential.documentId).get();
  if (!deviceSnapshot.exists) {
    sendLockdownError(response, 404, 'Device record was not found.', 'device_not_found');
    return;
  }

  const deviceRecord = deviceSnapshot.data();
  if (deviceRecord.status !== LOCKDOWN_DEVICE_STATUSES.ACTIVE) {
    sendLockdownError(response, 403, 'Device credential is not active.', 'device_inactive');
    return;
  }

  if (!constantTimeHexEquals(deviceRecord.credential_hash, hashLockdownSecret(parsedCredential.secret))) {
    sendLockdownError(response, 401, 'Device credential is invalid.', 'invalid_device_credential');
    return;
  }

  let trustedPolicyResponse;

  try {
    trustedPolicyResponse = await buildTrustedDevicePolicyResponse({
      deviceRecord,
      deviceId: parsedCredential.documentId,
    });
  } catch (error) {
    console.error('Trusted lockdown policy read failed:', error);
    sendLockdownError(response, 500, 'Device policy could not be derived.', 'internal');
    return;
  }

  await deviceSnapshot.ref.set({
    last_seen_at: FieldValue.serverTimestamp(),
    last_policy_read_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  sendLockdownJson(response, 200, trustedPolicyResponse);
});

export const billingWebhook = onRequest({
  region: REGION,
  invoker: 'public',
  secrets: [
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    STRIPE_CORE_PRICE_ID,
    STRIPE_LOCKDOWN_PRICE_ID,
  ],
}, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).send('Method Not Allowed');
    return;
  }

  const webhookSecret = trimString(STRIPE_WEBHOOK_SECRET.value());
  const signature = request.get('stripe-signature');

  if (!webhookSecret || !signature) {
    response.status(500).send('Stripe webhook is not configured.');
    return;
  }

  try {
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscriptionId = trimString(session.subscription);
        if (!subscriptionId) {
          throw new Error('checkout.session.completed is missing a subscription id.');
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const hydratedSubscription = {
          ...subscription,
          metadata: {
            ...(session.metadata || {}),
            ...(subscription.metadata || {}),
          },
          client_reference_id: session.client_reference_id || subscription.client_reference_id,
        };
        await syncEntitlementFromSubscription(stripe, hydratedSubscription);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncEntitlementFromSubscription(stripe, event.data.object);
        break;
      }
      default:
        break;
    }

    response.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe entitlement webhook failed:', error);
    response.status(400).send(error.message || 'Webhook processing failed.');
  }
});
