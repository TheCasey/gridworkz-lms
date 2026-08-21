import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import Stripe from 'stripe';
import {
  buildAllowanceLedgerEntry,
  resolveAllowancePeriod,
} from './allowanceUtils.js';
import {
  applyPointLedgerMutation,
  buildPointLedgerEntryId,
  getPointValueForSource,
  normalizePointSettings,
  normalizePointWallet,
  POINT_SOURCE_TYPES,
  DEFAULT_POINT_SETTINGS,
} from './pointLedgerUtils.js';
import {
  CHORE_CLAIM_STATUSES,
  CHORE_COMPLETION_STATUSES,
  DEFAULT_TRUSTED_CHORE_SETTINGS,
  TRUSTED_CHORE_CONTRACT,
  buildTrustedChoreClaimDecision,
  buildTrustedChoreCompletionDecision,
  buildTrustedChoreReviewDecision,
  buildTrustedStudentSafeChoreView,
  collectReferencedStudentIdsFromSetup,
  normalizeTrustedAllowanceLedgerPayload,
  normalizeTrustedChoreClaimPayload,
  normalizeTrustedChoreCompletionPayload,
  normalizeTrustedChoreDefinitionPayload,
  normalizeTrustedChoreReviewPayload,
  normalizeTrustedChoreSettingsPayload,
  normalizeTrustedRewardCatalogItemPayload,
  normalizeTrustedRewardSettingsPayload,
  normalizeTrustedRoutineCompletionPayload,
  normalizeTrustedRoutineTemplatePayload,
  normalizeTrustedStudentChoreContextPayload,
  normalizeTrustedChoreWeekConfig,
  validateRequiredTrustedFields,
  validateTrustedStudentPinContext,
} from './choreTrustedValidators.js';
import {
  REWARD_CATALOG_ITEM_TYPES,
  REWARD_REDEMPTION_STATUSES,
  buildRewardCatalogItemUpdate,
  buildRewardRedemptionWrite,
  buildRewardRequestDecision,
  buildRewardStatusTransition,
  normalizeRewardCatalogItemRecord,
} from './rewardRedemptionUtils.js';

initializeApp();

const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || 'us-central1';
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const STRIPE_CORE_PRICE_ID = defineSecret('STRIPE_CORE_PRICE_ID');
const STRIPE_LOCKDOWN_PRICE_ID = defineSecret('STRIPE_LOCKDOWN_PRICE_ID');

const COLLECTIONS = Object.freeze({
  ACCOUNT_ENTITLEMENTS: 'accountEntitlements',
  ALLOWANCE_PERIODS: 'allowancePeriods',
  CHORE_CLAIMS: 'choreClaims',
  CHORE_COMPLETIONS: 'choreCompletions',
  CHORE_DEFINITIONS: 'choreDefinitions',
  CHORE_SETTINGS: 'choreSettings',
  ENTITLEMENT_AUDIT_LOGS: 'entitlementAuditLogs',
  LOCKDOWN_DEVICES: 'lockdownDevices',
  LOCKDOWN_ENROLLMENT_SESSIONS: 'lockdownEnrollmentSessions',
  LOCKDOWN_RECOVERY_SESSIONS: 'lockdownRecoverySessions',
  LOCKDOWN_POLICIES: 'lockdownPolicies',
  LOCKDOWN_RESOURCE_LIBRARY: 'lockdownResourceLibrary',
  PARENTS: 'parents',
  POINT_LEDGER_ENTRIES: 'pointLedgerEntries',
  REWARD_CATALOG_ITEMS: 'rewardCatalogItems',
  REWARD_REDEMPTIONS: 'rewardRedemptions',
  REWARD_SETTINGS: 'rewardSettings',
  ROUTINE_COMPLETIONS: 'routineCompletions',
  ROUTINE_TEMPLATES: 'routineTemplates',
  STUDENTS: 'students',
  STUDENT_POINT_WALLETS: 'studentPointWallets',
  SUBMISSIONS: 'submissions',
  SUBJECTS: 'subjects',
  SUPPORT_OPERATORS: 'supportOperators',
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

const BILLING_PROVIDERS = Object.freeze({
  STRIPE: 'stripe',
});

const ENTITLEMENT_RESOLUTION_SOURCES = Object.freeze({
  BILLING: 'billing',
  MANUAL_OVERRIDE: 'manual_override',
  FALLBACK_INITIALIZED: 'fallback_initialized',
});

const ENTITLEMENT_UPDATED_VIA = Object.freeze({
  BILLING_WEBHOOK: 'billing_webhook',
  OPERATOR_CONSOLE: 'operator_console',
  OPERATOR_CLEAR_OVERRIDE: 'operator_clear_override',
});

const ENTITLEMENT_AUDIT_EVENT_TYPES = Object.freeze({
  BILLING_WEBHOOK_SYNC: 'billing_webhook_sync',
  OVERRIDE_APPLIED: 'override_applied',
  OVERRIDE_CLEARED: 'override_cleared',
  RECORD_INITIALIZED: 'record_initialized',
  OVERRIDE_EXPIRED: 'override_expired',
});

const OPERATOR_ROLES = Object.freeze({
  SUPPORT: 'support',
  ADMIN: 'admin',
});

const SUPPORTED_OPERATOR_ROLES = new Set(Object.values(OPERATOR_ROLES));

const PLAN_LIMITS = Object.freeze({
  [PLAN_IDS.FREE]: Object.freeze({
    maxStudents: 2,
    maxActiveSubjects: 3,
    features: Object.freeze({
      can_use_projects: false,
      can_use_daily_routines: true,
      can_use_chores: false,
      can_use_rewards: false,
      can_use_lockdown_extension: false,
      can_use_lockdown_kiosk: false,
    }),
  }),
  [PLAN_IDS.CORE]: Object.freeze({
    maxStudents: 10,
    maxActiveSubjects: null,
    features: Object.freeze({
      can_use_projects: true,
      can_use_daily_routines: true,
      can_use_chores: true,
      can_use_rewards: true,
      can_use_lockdown_extension: false,
      can_use_lockdown_kiosk: false,
    }),
  }),
  [PLAN_IDS.LOCKDOWN]: Object.freeze({
    maxStudents: 10,
    maxActiveSubjects: null,
    features: Object.freeze({
      can_use_projects: true,
      can_use_daily_routines: true,
      can_use_chores: true,
      can_use_rewards: true,
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

const DEFAULT_USAGE_SNAPSHOT = Object.freeze({
  students: 0,
  curriculum_items: 0,
});

const OPERATOR_PARENT_SEARCH_LIMIT = 10;
const OPERATOR_AUDIT_ENTRY_LIMIT = 10;
const SCHOOL_NAME_PREFIX_SUFFIX = '\uf8ff';

const LOCKDOWN_CONTRACTS = Object.freeze({
  TRUSTED_ENROLLMENT: 'trusted_lockdown_enrollment_v1',
  TRUSTED_POLICY_READ: 'trusted_lockdown_device_policy_v1',
  TRUSTED_RECOVERY: 'trusted_lockdown_device_recovery_v1',
  DERIVED_WEEKLY_PLAN_SOURCE: 'published_weekly_plan_derived_policy_v1',
});

const LOCKDOWN_POLICY_STATES = Object.freeze({
  ACTIVE_BLOCK: 'active_block',
  NO_ACTIVE_BLOCK: 'no_active_block',
  OUTSIDE_SCHOOL_TIME: 'outside_school_time',
  ENTITLEMENT_INACTIVE: 'entitlement_inactive',
});

export const LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY = Object.freeze({
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

export const LockdownProductionPolicyStates = LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY;

const LOCKDOWN_PRODUCTION_POLICY_STATE_VALUES = new Set(
  Object.values(LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY)
);

export const LOCKDOWN_ACTIVE_WORK_SESSION_KINDS = Object.freeze({
  TIMER: 'timer',
  TASK_COMPLETE: 'task_complete',
  PROJECT: 'project',
  WORKSHEET: 'worksheet',
});

const LOCKDOWN_ACTIVE_WORK_SESSION_KIND_VALUES = new Set(
  Object.values(LOCKDOWN_ACTIVE_WORK_SESSION_KINDS)
);
const LOCKDOWN_ACTIVE_WORK_STATE_VALUES = new Set([
  LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.ACTIVE_BLOCK,
  LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.NO_ACTIVE_SESSION,
  LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.NO_PUBLISHED_PLAN,
  LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.NO_ACTIVE_WORK,
]);

const LOCKDOWN_TOKEN_PREFIXES = Object.freeze({
  ENROLLMENT: 'lde_1',
  DEVICE: 'ldc_1',
  RECOVERY: 'ldr_1',
});

const LOCKDOWN_ENROLLMENT_TTL_MS = 15 * 60 * 1000;
const LOCKDOWN_RECOVERY_TTL_MS = 15 * 60 * 1000;

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

const LOCKDOWN_RECOVERY_STATUSES = Object.freeze({
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

const YOUTUBE_CHANNEL_PATH_PATTERN = /^\/channel\/([^/?#]+)/i;
const YOUTUBE_HANDLE_PATH_PATTERN = /^\/@([^/?#]+)/i;
const YOUTUBE_SHORTS_PATH_PATTERN = /^\/shorts\/([^/?#]+)/i;
const YOUTUBE_EMBED_PATH_PATTERN = /^\/embed\/([^/?#]+)/i;
const YOUTUBE_PLAYLIST_PATH_PATTERN = /^\/playlist(?:\/|$)/i;
const YOUTUBE_BARE_HANDLE_PATTERN = /^@[^\s/?#]+$/;
const YOUTUBE_BARE_CHANNEL_ID_PATTERN = /^UC[a-zA-Z0-9_-]{10,}$/;

const LOCKDOWN_RESOURCE_TEST_DECISIONS = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
  UNSUPPORTED: 'unsupported',
  METADATA_NEEDED: 'metadata-needed',
});

const DEFAULT_PUBLIC_APP_HOST = 'own-path.com';
const DEFAULT_DASHBOARD_APP_HOST = 'dashboard.own-path.com';
const DEFAULT_EXTENSION_PAGE_NAMES = Object.freeze([
  'allowlist.html',
  'blocked.html',
  'popup.html',
  'options.html',
]);

const resolveHostValue = (value, fallback) => {
  const trimmedValue = trimString(value);
  return trimmedValue || fallback;
};

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

const resolveOriginFromValue = (value = '') => {
  const resolvedUrl = resolveAbsoluteUrl(value);
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

  let parsedUrl;
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

const buildAbsoluteUrlFromOrigin = (origin = '', path = '') => {
  const resolvedOrigin = resolveOriginFromValue(origin);
  if (!resolvedOrigin) {
    return '';
  }

  const normalizedPath = trimString(path).replace(/^\/+/, '');
  return normalizedPath ? `${resolvedOrigin}/${normalizedPath}` : resolvedOrigin;
};

const getPublicAppHost = () => resolveHostValue(process.env.VITE_PUBLIC_APP_HOST, DEFAULT_PUBLIC_APP_HOST);
const getDashboardAppHost = () => resolveHostValue(process.env.VITE_DASHBOARD_APP_HOST, DEFAULT_DASHBOARD_APP_HOST);
const getTrustedFunctionUrl = (functionName = '') => {
  const projectId = trimString(
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.FIREBASE_PROJECT_ID
  );

  if (!trimString(functionName) || !projectId) {
    return '';
  }

  return `https://${REGION}-${projectId}.cloudfunctions.net/${functionName}`;
};

const buildOwnPathPublicOrigins = () => {
  const publicOrigin = resolveOriginFromValue(getPublicAppHost());
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

const normalizeSystemResource = (resource = {}) => {
  if (!isPlainObject(resource)) {
    return null;
  }

  const resourceType = trimString(resource.resource_type || resource.type);
  const name = trimString(resource.name || resource.label);
  const origin = resolveOriginFromValue(resource.origin || resource.url);
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

const buildOwnPathSystemResourceAllowlist = ({
  studentRecord = null,
  parentId = '',
} = {}) => {
  const publicOrigins = buildOwnPathPublicOrigins();
  const dashboardOrigin = resolveOriginFromValue(getDashboardAppHost());
  const enrollmentUrl = getTrustedFunctionUrl('lockdownExchangeEnrollment');
  const policyUrl = getTrustedFunctionUrl('readLockdownDevicePolicy');
  const recoveryUrl = getTrustedFunctionUrl('lockdownRecoverDevicePairing');
  const trustedEndpointsOrigin = resolveOriginFromValue(policyUrl || enrollmentUrl || recoveryUrl);
  const publicStudentPath = trimString(studentRecord?.slug)
    ? `student/${studentRecord.slug}`
    : 'student';

  const publicSystemResources = publicOrigins.map((origin, index) => normalizeSystemResource({
    resource_type: 'origin',
    name: index === 0 ? 'Own Path student portal' : 'Own Path public app alias',
    label: index === 0 ? 'Own Path student portal' : 'Own Path public app alias',
    origin,
    url: buildAbsoluteUrlFromOrigin(origin, publicStudentPath),
    allowed: true,
    scope: index === 0 ? 'student_portal' : 'public_app_alias',
  }));

  return [
    ...publicSystemResources,
    normalizeSystemResource({
      resource_type: 'origin',
      name: 'Own Path trusted policy endpoints',
      label: 'Own Path trusted policy endpoints',
      origin: trustedEndpointsOrigin,
      url: policyUrl || enrollmentUrl,
      allowed: true,
      scope: 'trusted_policy_endpoints',
      urls: [enrollmentUrl, policyUrl],
    }),
    normalizeSystemResource({
      resource_type: 'page_group',
      name: 'Own Path extension pages',
      label: 'Own Path extension pages',
      allowed: true,
      scope: 'extension_pages',
      pages: DEFAULT_EXTENSION_PAGE_NAMES,
    }),
    normalizeSystemResource({
      resource_type: 'decision',
      name: 'Parent dashboard access',
      label: 'Parent dashboard access',
      origin: dashboardOrigin,
      url: buildAbsoluteUrlFromOrigin(dashboardOrigin, 'dashboard'),
      allowed: false,
      decision: 'excluded_from_system_allowlist',
      scope: 'parent_dashboard_access',
      parent_id: trimString(parentId),
    }),
  ].filter(Boolean);
};

const normalizePlanId = (planId) => (
  Object.values(PLAN_IDS).includes(planId) ? planId : PLAN_IDS.FREE
);

export const buildFeatureSet = (planId, featureOverrides = {}) => {
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

const entitlementAuditLogRef = () => (
  db.collection(COLLECTIONS.ENTITLEMENT_AUDIT_LOGS).doc()
);

const supportOperatorRef = (operatorId) => (
  db.collection(COLLECTIONS.SUPPORT_OPERATORS).doc(operatorId)
);

const lockdownEnrollmentRef = (enrollmentId) => (
  db.collection(COLLECTIONS.LOCKDOWN_ENROLLMENT_SESSIONS).doc(enrollmentId)
);

const lockdownRecoveryRef = (recoveryId) => (
  db.collection(COLLECTIONS.LOCKDOWN_RECOVERY_SESSIONS).doc(recoveryId)
);

const lockdownDeviceRef = (deviceId) => (
  db.collection(COLLECTIONS.LOCKDOWN_DEVICES).doc(deviceId)
);

const lockdownResourceLibraryRef = (resourceId) => (
  db.collection(COLLECTIONS.LOCKDOWN_RESOURCE_LIBRARY).doc(resourceId)
);

const trimString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const isPlainObject = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const toUniqueStringArray = (value) => Array.from(
  new Set(
    (Array.isArray(value) ? value : [])
      .map((entry) => trimString(entry))
      .filter(Boolean)
  )
);

const hasOwn = (value, key) => (
  isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, key)
);

const normalizeSubscriptionStatus = (subscriptionStatus) => (
  Object.values(SUBSCRIPTION_STATUSES).includes(subscriptionStatus)
    ? subscriptionStatus
    : null
);

const normalizeBillingProvider = (billingProvider) => {
  const normalizedProvider = trimString(billingProvider);
  return normalizedProvider === BILLING_PROVIDERS.STRIPE ? BILLING_PROVIDERS.STRIPE : null;
};

const normalizeIntegerLike = (value) => {
  if (Number.isInteger(value)) {
    return value;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) ? parsedValue : null;
};

const normalizeFiniteNumberLike = (value) => {
  if (Number.isFinite(value)) {
    return value;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeLockdownProductionStateValue = (
  value,
  fallback = LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.NO_ACTIVE_SESSION
) => {
  const normalizedValue = trimString(value);
  return LOCKDOWN_PRODUCTION_POLICY_STATE_VALUES.has(normalizedValue) ? normalizedValue : fallback;
};

export const normalizeEntitlementFeatureOverrides = (featureOverrides = {}) => {
  const source = isPlainObject(featureOverrides) ? featureOverrides : {};
  const knownFeatureKeys = Object.keys(PLAN_LIMITS[PLAN_IDS.FREE].features);

  return knownFeatureKeys.reduce((normalized, featureKey) => {
    if (typeof source[featureKey] === 'boolean') {
      normalized[featureKey] = source[featureKey];
    }

    return normalized;
  }, {});
};

const normalizeUsageSnapshot = (usageSnapshot = {}) => {
  const source = isPlainObject(usageSnapshot) ? usageSnapshot : {};
  const students = Number.isFinite(source.students) ? source.students : DEFAULT_USAGE_SNAPSHOT.students;
  const curriculumItems = Number.isFinite(source.curriculum_items)
    ? source.curriculum_items
    : DEFAULT_USAGE_SNAPSHOT.curriculum_items;

  return {
    students,
    curriculum_items: curriculumItems,
  };
};

const normalizeLockdownActiveWorkSessionKind = (value) => {
  const normalizedValue = trimString(value);

  if (LOCKDOWN_ACTIVE_WORK_SESSION_KIND_VALUES.has(normalizedValue)) {
    return normalizedValue;
  }

  if (normalizedValue === 'project_work') {
    return LOCKDOWN_ACTIVE_WORK_SESSION_KINDS.PROJECT;
  }

  if (normalizedValue === 'worksheet_work') {
    return LOCKDOWN_ACTIVE_WORK_SESSION_KINDS.WORKSHEET;
  }

  if (normalizedValue === 'time_boxed') {
    return LOCKDOWN_ACTIVE_WORK_SESSION_KINDS.TIMER;
  }

  return '';
};

const isInactiveActiveWorkStatus = (status) => (
  status === 'paused' ||
  status === 'completed' ||
  status === 'archived' ||
  status === 'inactive'
);

export const normalizeLockdownActiveWorkSession = (input = {}) => {
  if (!isPlainObject(input)) {
    return null;
  }

  const normalizedBlockIndex = normalizeIntegerLike(input.block_index);
  const normalizedLegacyBlockIndex = normalizeIntegerLike(input.legacy_block_index);
  const sessionKind = normalizeLockdownActiveWorkSessionKind(
    input.kind ||
    input.session_kind ||
    input.work_kind ||
    input.work_session_type ||
    input.session_type ||
    input.type ||
    input.completion_mode
  );
  const sourceKind = trimString(
    input.source_kind ||
    input.source_policy_kind ||
    input.source_type
  );
  const inferredSessionKind = sessionKind || (() => {
    if (trimString(input.project_id) || trimString(input.project_title) || trimString(input.project_work_id)) {
      return LOCKDOWN_ACTIVE_WORK_SESSION_KINDS.PROJECT;
    }

    if (trimString(input.worksheet_id) || trimString(input.worksheet_title) || trimString(input.worksheet_work_id)) {
      return LOCKDOWN_ACTIVE_WORK_SESSION_KINDS.WORKSHEET;
    }

    if (
      trimString(input.assignment_id) ||
      trimString(input.block_id) ||
      normalizedBlockIndex !== null ||
      trimString(input.timer_session_id)
    ) {
      return LOCKDOWN_ACTIVE_WORK_SESSION_KINDS.TIMER;
    }

    return '';
  })();
  const normalizedId = trimString(input.id || input.session_id || input.active_work_session_id || input.timer_session_id);
  const hasSessionIdentity = Boolean(
    normalizedId ||
    inferredSessionKind ||
    trimString(input.assignment_id) ||
    trimString(input.block_id) ||
    normalizedBlockIndex !== null ||
    trimString(input.project_id) ||
    trimString(input.project_title) ||
    trimString(input.project_work_id) ||
    trimString(input.worksheet_id) ||
    trimString(input.worksheet_title) ||
    trimString(input.worksheet_work_id)
  );

  if (!hasSessionIdentity) {
    return null;
  }

  const normalizedStatus = trimString(input.status) ||
    trimString(input.session_state) ||
    (input.is_running === false ? 'paused' : input.is_running === true || input.is_active === true ? 'active' : '');

  return {
    ...input,
    id: normalizedId,
    kind: inferredSessionKind,
    session_kind: inferredSessionKind,
    source_kind: sourceKind,
    source_policy_kind: sourceKind,
    student_id: trimString(input.student_id),
    parent_id: trimString(input.parent_id),
    weekly_plan_id: trimString(input.weekly_plan_id),
    assignment_id: trimString(input.assignment_id),
    subject_id: trimString(input.subject_id),
    subject_title: trimString(input.subject_title || input.legacy_subject_title),
    block_id: trimString(input.block_id),
    block_index: normalizedBlockIndex,
    block_title: trimString(input.block_title || input.title),
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
      inferredSessionKind === LOCKDOWN_ACTIVE_WORK_SESSION_KINDS.TIMER ? normalizedId : ''
    ),
    title: trimString(input.title),
    label: trimString(input.label),
    category: trimString(input.category),
    status: normalizedStatus,
    is_active: typeof input.is_active === 'boolean'
      ? input.is_active
      : (typeof input.is_running === 'boolean' ? input.is_running : null),
    is_running: input.is_running === true,
    planned_duration_minutes: Number.isFinite(input.planned_duration_minutes)
      ? input.planned_duration_minutes
      : normalizeIntegerLike(input.planned_duration_minutes),
    require_timer: typeof input.require_timer === 'boolean' ? input.require_timer : null,
    require_input: typeof input.require_input === 'boolean' ? input.require_input : null,
    started_at: input.started_at ?? null,
    paused_at: input.paused_at ?? null,
    resumed_at: input.resumed_at ?? null,
    completed_at: input.completed_at ?? null,
    target_end_time: normalizeFiniteNumberLike(input.target_end_time),
    duration_ms: normalizeFiniteNumberLike(input.duration_ms),
    remaining_time: normalizeFiniteNumberLike(input.remaining_time),
    saved_at: Number.isFinite(input.saved_at) ? input.saved_at : 0,
    updated_at: input.updated_at ?? null,
    resource_ids: Array.isArray(input.resource_ids) ? [...input.resource_ids] : [],
    metadata: isPlainObject(input.metadata) ? { ...input.metadata } : {},
  };
};

const buildLegacyLockdownActiveWorkSession = ({
  activeBlock = null,
  activeTimerSession = null,
  weeklyPlan = null,
  studentRecord = null,
} = {}) => {
  if (!activeBlock || !activeTimerSession) {
    return null;
  }

  return normalizeLockdownActiveWorkSession({
    id: activeTimerSession.id,
    kind: LOCKDOWN_ACTIVE_WORK_SESSION_KINDS.TIMER,
    source_kind: LOCKDOWN_CONTRACTS.DERIVED_WEEKLY_PLAN_SOURCE,
    source_policy_kind: LOCKDOWN_CONTRACTS.DERIVED_WEEKLY_PLAN_SOURCE,
    student_id: trimString(studentRecord?.id) || trimString(activeTimerSession.student_id),
    parent_id: trimString(studentRecord?.parent_id) || trimString(activeTimerSession.parent_id),
    weekly_plan_id: weeklyPlan?.id || '',
    assignment_id: trimString(activeBlock.assignment_id),
    subject_id: trimString(activeTimerSession.subject_id),
    subject_title: trimString(activeBlock.legacy_subject_title) || trimString(activeBlock.title),
    block_id: trimString(activeBlock.id),
    block_index: activeTimerSession.block_index,
    block_title: trimString(activeBlock.title) || trimString(activeBlock.legacy_subject_title),
    legacy_subject_id: trimString(activeBlock.legacy_subject_id),
    legacy_subject_title: trimString(activeBlock.legacy_subject_title),
    legacy_block_index: activeBlock.legacy_block_index,
    timer_session_id: activeTimerSession.id,
    title: trimString(activeBlock.title) || trimString(activeBlock.legacy_subject_title),
    category: trimString(activeBlock.category),
    is_active: true,
    is_running: Boolean(activeTimerSession.is_running),
    planned_duration_minutes: Number.isFinite(activeBlock.planned_duration_minutes)
      ? activeBlock.planned_duration_minutes
      : null,
    require_timer: typeof activeBlock.require_timer === 'boolean' ? activeBlock.require_timer : null,
    require_input: typeof activeBlock.require_input === 'boolean' ? activeBlock.require_input : null,
    resources: Array.isArray(activeBlock.resources) ? [...activeBlock.resources] : [],
    started_at: activeTimerSession.started_at || activeTimerSession.start_time || null,
    paused_at: activeTimerSession.paused_at || null,
    resumed_at: activeTimerSession.resumed_at || null,
    completed_at: activeTimerSession.completed_at || null,
    target_end_time: activeTimerSession.target_end_time || null,
    saved_at: activeTimerSession.saved_at || 0,
    updated_at: activeTimerSession.updated_at || null,
  });
};

export const normalizeLockdownPolicyStateContext = ({
  policyState = LOCKDOWN_POLICY_STATES.NO_ACTIVE_BLOCK,
  entitlementActive = false,
  weeklyPlan = null,
  timeContext = null,
  activeWorkSession = null,
  activeBlock = null,
  deviceStatus = '',
  bindingStatus = '',
  cacheStatus = '',
} = {}) => {
  const normalizedActiveWorkSession = normalizeLockdownActiveWorkSession(activeWorkSession);
  const normalizedDeviceStatus = trimString(deviceStatus);
  const normalizedBindingStatus = trimString(bindingStatus);
  const normalizedCacheStatus = trimString(cacheStatus);
  const normalizedCacheState = normalizedCacheStatus === LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.STALE_CACHED_POLICY
    ? 'stale'
    : normalizedCacheStatus;
  const normalizedWeeklyPlanStatus = trimString(weeklyPlan?.status) || null;
  const hasPublishedWeeklyPlan = Boolean(weeklyPlan) && (
    !normalizedWeeklyPlanStatus ||
    normalizedWeeklyPlanStatus === 'published'
  );
  const hasOffHoursWindow = Boolean(timeContext?.activeOffHoursWindow);
  const hasActiveWorkSession = Boolean(
    normalizedActiveWorkSession &&
    (
      normalizedActiveWorkSession.is_active === true ||
      normalizedActiveWorkSession.is_running === true ||
      normalizedActiveWorkSession.kind ||
      normalizedActiveWorkSession.session_kind
    )
  );

  let state = normalizeLockdownProductionStateValue(policyState, '');

  if (normalizedDeviceStatus === LOCKDOWN_DEVICE_STATUSES.REVOKED) {
    state = LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.DEVICE_REVOKED;
  } else if (
    normalizedBindingStatus === 'student_binding_required' ||
    normalizedBindingStatus === 'no_active_students' ||
    normalizedBindingStatus === 'binding_required' ||
    normalizedBindingStatus === 'unpaired'
  ) {
    state = LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.UNPAIRED;
  } else if (normalizedCacheState === 'stale') {
    state = LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.STALE_CACHED_POLICY;
  } else if (!entitlementActive) {
    state = LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.ENTITLEMENT_INACTIVE;
  } else if (!timeContext?.inSchoolTime) {
    state = LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.OFF_HOURS_CLOSED;
  } else if (!hasPublishedWeeklyPlan) {
    state = LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.NO_PUBLISHED_PLAN;
  } else if (hasActiveWorkSession) {
    state = isInactiveActiveWorkStatus(normalizedActiveWorkSession.status)
      ? LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.NO_ACTIVE_WORK
      : LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.ACTIVE_BLOCK;
  } else if (activeBlock) {
    state = LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.ACTIVE_BLOCK;
  } else if (policyState === LOCKDOWN_POLICY_STATES.NO_ACTIVE_BLOCK) {
    state = LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.NO_ACTIVE_SESSION;
  }

  const activeWorkState = LOCKDOWN_ACTIVE_WORK_STATE_VALUES.has(state) ? state : '';

  return {
    state,
    policy_state: state,
    legacy_policy_state: policyState,
    school_time_state: timeContext?.inSchoolTime ? 'school_time' : 'off_hours',
    off_hours_window_state: hasOffHoursWindow ? 'open' : 'closed',
    entitlement_state: entitlementActive ? 'active' : 'inactive',
    device_state: normalizedDeviceStatus === LOCKDOWN_DEVICE_STATUSES.REVOKED
      ? 'revoked'
      : (
        normalizedBindingStatus === 'student_binding_required' ||
        normalizedBindingStatus === 'no_active_students' ||
        normalizedBindingStatus === 'binding_required' ||
        normalizedBindingStatus === 'unpaired'
          ? 'unpaired'
          : (normalizedDeviceStatus || 'active')
      ),
    cache_state: normalizedCacheState === 'stale' ? 'stale' : (normalizedCacheState || 'fresh'),
    active_work_state: activeWorkState,
    active_work_session: normalizedActiveWorkSession,
    weekly_plan_exists: hasPublishedWeeklyPlan,
    entitlement_active: Boolean(entitlementActive),
    published_weekly_plan_exists: hasPublishedWeeklyPlan,
    weekly_plan_id: weeklyPlan?.id || '',
    weekly_plan_status: normalizedWeeklyPlanStatus,
    school_time_active: Boolean(timeContext?.inSchoolTime),
    school_day_active: Boolean(timeContext?.schoolDayActive),
    local_date: trimString(timeContext?.localDate),
    local_day: trimString(timeContext?.localDay),
    local_time: trimString(timeContext?.localTime),
    active_off_hours_window: timeContext?.activeOffHoursWindow
      ? {
          id: timeContext.activeOffHoursWindow.id,
          label: timeContext.activeOffHoursWindow.label,
          days: Array.isArray(timeContext.activeOffHoursWindow.days)
            ? [...timeContext.activeOffHoursWindow.days]
            : [],
          start_time: timeContext.activeOffHoursWindow.start_time,
          end_time: timeContext.activeOffHoursWindow.end_time,
        }
      : null,
    active_work_session_id: normalizedActiveWorkSession?.id || '',
    active_work_session_kind: normalizedActiveWorkSession?.kind || '',
    active_work_session_status: normalizedActiveWorkSession?.status || '',
    active_work_session_source_kind: normalizedActiveWorkSession?.source_kind || '',
    active_block: activeBlock
      ? {
          id: trimString(activeBlock.id),
          assignment_id: trimString(activeBlock.assignment_id),
          title: trimString(activeBlock.title) || trimString(activeBlock.legacy_subject_title),
          category: trimString(activeBlock.category),
          legacy_subject_id: trimString(activeBlock.legacy_subject_id),
          legacy_block_index: activeBlock.legacy_block_index,
        }
      : null,
    device_status: normalizedDeviceStatus,
    binding_status: normalizedBindingStatus,
    cache_status: normalizedCacheState || 'fresh',
  };
};

const timestampToMillis = (value) => {
  if (!value) return null;

  if (typeof value.toMillis === 'function') {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }

  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isFinite(millis) ? millis : null;
  }

  if (Number.isFinite(value)) {
    return value;
  }

  if (isPlainObject(value)) {
    const seconds = Number.isFinite(value.seconds)
      ? value.seconds
      : value._seconds;
    const nanoseconds = Number.isFinite(value.nanoseconds)
      ? value.nanoseconds
      : (value._nanoseconds || 0);

    if (Number.isFinite(seconds)) {
      return (seconds * 1000) + Math.floor(nanoseconds / 1_000_000);
    }
  }

  if (typeof value === 'string') {
    const millis = Date.parse(value);
    return Number.isFinite(millis) ? millis : null;
  }

  return null;
};

export const isEntitlementManualOverrideActive = (manualOverride, nowMillis = Date.now()) => {
  if (!isPlainObject(manualOverride) || manualOverride.is_active !== true) {
    return false;
  }

  const expiresAtMillis = timestampToMillis(manualOverride.expires_at);
  return expiresAtMillis === null || expiresAtMillis > nowMillis;
};

export const isEntitlementManualOverrideExpired = (manualOverride, nowMillis = Date.now()) => {
  if (!isPlainObject(manualOverride) || manualOverride.is_active !== true) {
    return false;
  }

  const expiresAtMillis = timestampToMillis(manualOverride.expires_at);
  return expiresAtMillis !== null && expiresAtMillis <= nowMillis;
};

export const buildEntitlementBillingState = ({
  planId = PLAN_IDS.FREE,
  subscriptionStatus = null,
  billingProvider = null,
  featureOverrides = {},
  trialEndsAt = null,
  currentPeriodEnd = null,
  updatedAt = null,
} = {}) => ({
  plan_id: normalizePlanId(planId),
  subscription_status: normalizeSubscriptionStatus(subscriptionStatus),
  billing_provider: normalizeBillingProvider(billingProvider),
  feature_overrides: normalizeEntitlementFeatureOverrides(featureOverrides),
  trial_ends_at: trialEndsAt || null,
  current_period_end: currentPeriodEnd || null,
  updated_at: updatedAt || null,
});

const hasProviderBackedBillingState = (billingState = {}) => Boolean(
  normalizeBillingProvider(billingState?.billing_provider) ||
  normalizeSubscriptionStatus(billingState?.subscription_status) ||
  billingState?.trial_ends_at ||
  billingState?.current_period_end ||
  billingState?.updated_at ||
  normalizePlanId(billingState?.plan_id) !== PLAN_IDS.FREE ||
  Object.keys(normalizeEntitlementFeatureOverrides(billingState?.feature_overrides)).length
);

const buildBillingStateFromExistingEntitlement = (existingEntitlement = {}) => {
  const existingBillingState = isPlainObject(existingEntitlement?.billing_state)
    ? existingEntitlement.billing_state
    : null;
  const hasLegacyBillingState = Boolean(
    hasOwn(existingEntitlement, 'plan_id') ||
    hasOwn(existingEntitlement, 'subscription_status') ||
    hasOwn(existingEntitlement, 'billing_provider') ||
    hasOwn(existingEntitlement, 'feature_overrides') ||
    hasOwn(existingEntitlement, 'trial_ends_at') ||
    hasOwn(existingEntitlement, 'current_period_end')
  );
  const rawBillingState = existingBillingState || (hasLegacyBillingState ? existingEntitlement : {});

  return {
    billingState: buildEntitlementBillingState({
      planId: rawBillingState.plan_id,
      subscriptionStatus: rawBillingState.subscription_status,
      billingProvider: rawBillingState.billing_provider,
      featureOverrides: rawBillingState.feature_overrides,
      trialEndsAt: rawBillingState.trial_ends_at,
      currentPeriodEnd: rawBillingState.current_period_end,
      updatedAt: rawBillingState.updated_at || null,
    }),
    hasBillingState: Boolean(existingBillingState || hasLegacyBillingState),
  };
};

const buildEffectiveEntitlementFieldsFromBilling = ({
  parentId,
  billingState,
  usageSnapshot,
}) => ({
  parent_id: parentId,
  plan_id: billingState.plan_id,
  subscription_status: billingState.subscription_status,
  billing_provider: billingState.billing_provider,
  feature_overrides: normalizeEntitlementFeatureOverrides(billingState.feature_overrides),
  usage_snapshot: normalizeUsageSnapshot(usageSnapshot),
  trial_ends_at: billingState.trial_ends_at || null,
  current_period_end: billingState.current_period_end || null,
});

const buildEffectiveEntitlementFieldsFromManualOverride = ({
  parentId,
  manualOverride,
  billingState,
  usageSnapshot,
}) => ({
  parent_id: parentId,
  plan_id: normalizePlanId(manualOverride?.plan_id),
  subscription_status: normalizeSubscriptionStatus(manualOverride?.subscription_status),
  billing_provider: billingState.billing_provider,
  feature_overrides: normalizeEntitlementFeatureOverrides(manualOverride?.feature_overrides),
  usage_snapshot: normalizeUsageSnapshot(usageSnapshot),
  trial_ends_at: billingState.trial_ends_at || null,
  current_period_end: billingState.current_period_end || null,
});

const buildPreservedEffectiveEntitlementFields = ({
  parentId,
  existingEntitlement,
  fallbackFields,
}) => ({
  parent_id: parentId,
  plan_id: hasOwn(existingEntitlement, 'plan_id')
    ? normalizePlanId(existingEntitlement.plan_id)
    : fallbackFields.plan_id,
  subscription_status: hasOwn(existingEntitlement, 'subscription_status')
    ? normalizeSubscriptionStatus(existingEntitlement.subscription_status)
    : fallbackFields.subscription_status,
  billing_provider: hasOwn(existingEntitlement, 'billing_provider')
    ? normalizeBillingProvider(existingEntitlement.billing_provider)
    : fallbackFields.billing_provider,
  feature_overrides: hasOwn(existingEntitlement, 'feature_overrides')
    ? normalizeEntitlementFeatureOverrides(existingEntitlement.feature_overrides)
    : fallbackFields.feature_overrides,
  usage_snapshot: hasOwn(existingEntitlement, 'usage_snapshot')
    ? normalizeUsageSnapshot(existingEntitlement.usage_snapshot)
    : fallbackFields.usage_snapshot,
  trial_ends_at: hasOwn(existingEntitlement, 'trial_ends_at')
    ? existingEntitlement.trial_ends_at || null
    : fallbackFields.trial_ends_at,
  current_period_end: hasOwn(existingEntitlement, 'current_period_end')
    ? existingEntitlement.current_period_end || null
    : fallbackFields.current_period_end,
});

export const resolveEntitlementRecord = ({
  parentId = '',
  entitlementDoc = {},
  nowMillis = Date.now(),
} = {}) => {
  const existingEntitlement = isPlainObject(entitlementDoc) ? entitlementDoc : {};
  const normalizedParentId = trimString(parentId) || trimString(existingEntitlement.parent_id);
  const { billingState, hasBillingState } = buildBillingStateFromExistingEntitlement(existingEntitlement);
  const usageSnapshot = normalizeUsageSnapshot(existingEntitlement.usage_snapshot);
  const hasActiveManualOverride = isEntitlementManualOverrideActive(
    existingEntitlement.manual_override,
    nowMillis
  );
  const effectiveFields = hasActiveManualOverride
    ? buildEffectiveEntitlementFieldsFromManualOverride({
      parentId: normalizedParentId,
      manualOverride: existingEntitlement.manual_override,
      billingState,
      usageSnapshot,
    })
    : buildEffectiveEntitlementFieldsFromBilling({
      parentId: normalizedParentId,
      billingState,
      usageSnapshot,
    });
  const shouldPreserveFallbackSource = (
    existingEntitlement.resolution_source === ENTITLEMENT_RESOLUTION_SOURCES.FALLBACK_INITIALIZED &&
    !hasProviderBackedBillingState(billingState)
  );
  const resolutionSource = hasActiveManualOverride
    ? ENTITLEMENT_RESOLUTION_SOURCES.MANUAL_OVERRIDE
    : (
      shouldPreserveFallbackSource || !hasBillingState
        ? ENTITLEMENT_RESOLUTION_SOURCES.FALLBACK_INITIALIZED
        : ENTITLEMENT_RESOLUTION_SOURCES.BILLING
    );

  return {
    ...effectiveFields,
    billing_state: billingState,
    manual_override: isPlainObject(existingEntitlement.manual_override)
      ? existingEntitlement.manual_override
      : null,
    resolution_source: resolutionSource,
    updated_via: existingEntitlement.updated_via || null,
    updated_at: existingEntitlement.updated_at || null,
    planId: effectiveFields.plan_id,
    limits: PLAN_LIMITS[effectiveFields.plan_id],
    features: buildFeatureSet(effectiveFields.plan_id, effectiveFields.feature_overrides),
    hasActiveManualOverride,
    hasExpiredManualOverride: isEntitlementManualOverrideExpired(
      existingEntitlement.manual_override,
      nowMillis
    ),
  };
};

export const buildFallbackEntitlementInitializationWrite = ({
  parentId,
  usageSnapshot = DEFAULT_USAGE_SNAPSHOT,
  nowTimestamp = null,
} = {}) => {
  const normalizedParentId = trimString(parentId);
  const billingState = buildEntitlementBillingState();

  return {
    ...buildEffectiveEntitlementFieldsFromBilling({
      parentId: normalizedParentId,
      billingState,
      usageSnapshot,
    }),
    billing_state: billingState,
    manual_override: null,
    resolution_source: ENTITLEMENT_RESOLUTION_SOURCES.FALLBACK_INITIALIZED,
    updated_via: ENTITLEMENT_UPDATED_VIA.OPERATOR_CONSOLE,
    updated_at: nowTimestamp || null,
  };
};

export const buildEntitlementWriteForManualOverride = ({
  parentId,
  existingEntitlement = {},
  overridePayload = {},
  operatorSession = null,
  usageSnapshot = DEFAULT_USAGE_SNAPSHOT,
  nowTimestamp = null,
} = {}) => {
  const normalizedParentId = trimString(parentId);
  const existing = isPlainObject(existingEntitlement) ? existingEntitlement : {};
  const { billingState } = buildBillingStateFromExistingEntitlement(existing);
  const manualOverride = {
    is_active: true,
    plan_id: normalizePlanId(overridePayload.plan_id),
    subscription_status: normalizeSubscriptionStatus(overridePayload.subscription_status),
    feature_overrides: normalizeEntitlementFeatureOverrides(overridePayload.feature_overrides),
    reason: trimString(overridePayload.reason),
    expires_at: overridePayload.expires_at || null,
    applied_by_uid: trimString(operatorSession?.uid),
    applied_by_email: trimString(operatorSession?.email),
    applied_at: nowTimestamp || null,
  };

  return {
    ...buildEffectiveEntitlementFieldsFromManualOverride({
      parentId: normalizedParentId,
      manualOverride,
      billingState,
      usageSnapshot,
    }),
    billing_state: billingState,
    manual_override: manualOverride,
    resolution_source: ENTITLEMENT_RESOLUTION_SOURCES.MANUAL_OVERRIDE,
    updated_via: ENTITLEMENT_UPDATED_VIA.OPERATOR_CONSOLE,
    updated_at: nowTimestamp || null,
  };
};

export const buildEntitlementWriteForOverrideClear = ({
  parentId,
  existingEntitlement = {},
  usageSnapshot = DEFAULT_USAGE_SNAPSHOT,
  nowTimestamp = null,
} = {}) => {
  const normalizedParentId = trimString(parentId);
  const existing = isPlainObject(existingEntitlement) ? existingEntitlement : {};
  const { billingState } = buildBillingStateFromExistingEntitlement(existing);
  const clearedManualOverride = isPlainObject(existing.manual_override)
    ? {
        ...existing.manual_override,
        is_active: false,
      }
    : null;
  const resolutionSource = hasProviderBackedBillingState(billingState)
    ? ENTITLEMENT_RESOLUTION_SOURCES.BILLING
    : ENTITLEMENT_RESOLUTION_SOURCES.FALLBACK_INITIALIZED;

  return {
    ...buildEffectiveEntitlementFieldsFromBilling({
      parentId: normalizedParentId,
      billingState,
      usageSnapshot,
    }),
    billing_state: billingState,
    manual_override: clearedManualOverride,
    resolution_source: resolutionSource,
    updated_via: ENTITLEMENT_UPDATED_VIA.OPERATOR_CLEAR_OVERRIDE,
    updated_at: nowTimestamp || null,
  };
};

export const buildEntitlementWriteForBillingSync = ({
  parentId,
  existingEntitlement = {},
  billingState,
  nowTimestamp = null,
  nowMillis = null,
} = {}) => {
  const normalizedParentId = trimString(parentId);
  const existing = isPlainObject(existingEntitlement) ? existingEntitlement : {};
  const resolvedNowMillis = Number.isFinite(nowMillis)
    ? nowMillis
    : (timestampToMillis(nowTimestamp) || Date.now());
  const normalizedBillingState = buildEntitlementBillingState({
    planId: billingState?.plan_id,
    subscriptionStatus: billingState?.subscription_status,
    billingProvider: billingState?.billing_provider,
    featureOverrides: billingState?.feature_overrides,
    trialEndsAt: billingState?.trial_ends_at,
    currentPeriodEnd: billingState?.current_period_end,
    updatedAt: billingState?.updated_at || nowTimestamp || null,
  });
  const hasActiveManualOverride = isEntitlementManualOverrideActive(
    existing.manual_override,
    resolvedNowMillis
  );
  const hasExpiredManualOverride = isEntitlementManualOverrideExpired(
    existing.manual_override,
    resolvedNowMillis
  );
  const usageSnapshot = normalizeUsageSnapshot(existing.usage_snapshot);
  const fallbackManualFields = buildEffectiveEntitlementFieldsFromManualOverride({
    parentId: normalizedParentId,
    manualOverride: existing.manual_override,
    billingState: normalizedBillingState,
    usageSnapshot,
  });
  const effectiveFields = hasActiveManualOverride
    ? buildPreservedEffectiveEntitlementFields({
      parentId: normalizedParentId,
      existingEntitlement: existing,
      fallbackFields: fallbackManualFields,
    })
    : buildEffectiveEntitlementFieldsFromBilling({
      parentId: normalizedParentId,
      billingState: normalizedBillingState,
      usageSnapshot,
    });
  const entitlementDoc = {
    ...effectiveFields,
    billing_state: normalizedBillingState,
    resolution_source: hasActiveManualOverride
      ? ENTITLEMENT_RESOLUTION_SOURCES.MANUAL_OVERRIDE
      : ENTITLEMENT_RESOLUTION_SOURCES.BILLING,
    updated_via: ENTITLEMENT_UPDATED_VIA.BILLING_WEBHOOK,
    updated_at: nowTimestamp || null,
  };

  if (hasExpiredManualOverride) {
    entitlementDoc.manual_override = {
      ...existing.manual_override,
      is_active: false,
    };
  }

  return {
    entitlementDoc,
    hasActiveManualOverride,
    hasExpiredManualOverride,
  };
};

const normalizeManualOverrideAuditSnapshot = (manualOverride) => {
  if (!isPlainObject(manualOverride)) {
    return null;
  }

  return {
    is_active: manualOverride.is_active === true,
    plan_id: normalizePlanId(manualOverride.plan_id),
    subscription_status: normalizeSubscriptionStatus(manualOverride.subscription_status),
    feature_overrides: normalizeEntitlementFeatureOverrides(manualOverride.feature_overrides),
    reason: trimString(manualOverride.reason),
    expires_at: manualOverride.expires_at || null,
    applied_by_uid: trimString(manualOverride.applied_by_uid),
    applied_by_email: trimString(manualOverride.applied_by_email),
    applied_at: manualOverride.applied_at || null,
  };
};

export const buildEntitlementAuditSnapshot = (entitlementDoc) => {
  if (!isPlainObject(entitlementDoc)) {
    return null;
  }

  return {
    parent_id: trimString(entitlementDoc.parent_id),
    plan_id: normalizePlanId(entitlementDoc.plan_id),
    subscription_status: normalizeSubscriptionStatus(entitlementDoc.subscription_status),
    billing_provider: normalizeBillingProvider(entitlementDoc.billing_provider),
    feature_overrides: normalizeEntitlementFeatureOverrides(entitlementDoc.feature_overrides),
    usage_snapshot: normalizeUsageSnapshot(entitlementDoc.usage_snapshot),
    trial_ends_at: entitlementDoc.trial_ends_at || null,
    current_period_end: entitlementDoc.current_period_end || null,
    resolution_source: trimString(entitlementDoc.resolution_source),
    updated_via: trimString(entitlementDoc.updated_via),
    billing_state: buildBillingStateFromExistingEntitlement(entitlementDoc).billingState,
    manual_override: normalizeManualOverrideAuditSnapshot(entitlementDoc.manual_override),
  };
};

export const buildEntitlementAuditLog = ({
  parentId,
  operatorSession = null,
  eventType,
  reason = '',
  before = null,
  after = null,
  createdAt = null,
} = {}) => ({
  parent_id: trimString(parentId),
  operator_uid: trimString(operatorSession?.uid) || null,
  operator_email: trimString(operatorSession?.email) || null,
  event_type: trimString(eventType),
  reason: trimString(reason),
  before: buildEntitlementAuditSnapshot(before),
  after: buildEntitlementAuditSnapshot(after),
  created_at: createdAt || FieldValue.serverTimestamp(),
});

const queueEntitlementAuditWrite = (batch, auditLog) => {
  batch.set(entitlementAuditLogRef(), buildEntitlementAuditLog(auditLog));
};

export const normalizeOperatorSessionRecord = ({ uid, operatorRecord } = {}) => {
  const normalizedUid = trimString(uid);

  if (
    !normalizedUid ||
    !operatorRecord ||
    typeof operatorRecord !== 'object' ||
    Array.isArray(operatorRecord)
  ) {
    return null;
  }

  const recordUid = trimString(operatorRecord.uid);
  const email = trimString(operatorRecord.email);
  const role = trimString(operatorRecord.role);

  if (
    recordUid !== normalizedUid ||
    !email ||
    operatorRecord.is_active !== true ||
    !SUPPORTED_OPERATOR_ROLES.has(role)
  ) {
    return null;
  }

  return {
    uid: normalizedUid,
    email,
    role,
    is_active: true,
  };
};

export const ensureOperatorSessionRecord = ({ uid, operatorRecord } = {}) => {
  const operatorSession = normalizeOperatorSessionRecord({ uid, operatorRecord });

  if (!operatorSession) {
    throw new HttpsError(
      'permission-denied',
      'This account is not authorized for operator access.'
    );
  }

  return operatorSession;
};

const normalizeOperatorParentId = (value) => {
  const parentId = trimString(value);

  if (!parentId) {
    throw new HttpsError('invalid-argument', 'A parent account id is required.');
  }

  return parentId;
};

const requireOperatorSupportReason = (value) => {
  const reason = trimString(value);

  if (!reason) {
    throw new HttpsError('invalid-argument', 'A non-empty support reason is required.');
  }

  return reason;
};

const normalizeOperatorSubscriptionStatus = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const subscriptionStatus = trimString(value);
  if (!Object.values(SUBSCRIPTION_STATUSES).includes(subscriptionStatus)) {
    throw new HttpsError('invalid-argument', 'Manual override subscription status is invalid.');
  }

  return subscriptionStatus;
};

const normalizeOperatorPlanId = (value) => {
  const planId = trimString(value);

  if (!Object.values(PLAN_IDS).includes(planId)) {
    throw new HttpsError('invalid-argument', 'Manual override plan id is invalid.');
  }

  return planId;
};

const normalizeOperatorFeatureOverrides = (featureOverrides = {}) => {
  if (featureOverrides == null) {
    return {};
  }

  if (!isPlainObject(featureOverrides)) {
    throw new HttpsError('invalid-argument', 'Manual override feature overrides must be an object.');
  }

  const knownFeatureKeys = Object.keys(PLAN_LIMITS[PLAN_IDS.FREE].features);

  Object.entries(featureOverrides).forEach(([featureKey, featureValue]) => {
    if (!knownFeatureKeys.includes(featureKey)) {
      throw new HttpsError('invalid-argument', `Unknown entitlement feature override: ${featureKey}.`);
    }

    if (typeof featureValue !== 'boolean') {
      throw new HttpsError('invalid-argument', `Entitlement feature override ${featureKey} must be a boolean.`);
    }
  });

  return normalizeEntitlementFeatureOverrides(featureOverrides);
};

const normalizeOperatorExpiration = (value, nowMillis = Date.now()) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const expiresAtMillis = timestampToMillis(value);
  if (!Number.isFinite(expiresAtMillis)) {
    throw new HttpsError('invalid-argument', 'Manual override expiration must be a valid date.');
  }

  if (expiresAtMillis <= nowMillis) {
    throw new HttpsError('invalid-argument', 'Manual override expiration must be in the future.');
  }

  return Timestamp.fromMillis(expiresAtMillis);
};

export const normalizeOperatorEntitlementOverridePayload = (
  payload = {},
  { nowMillis = Date.now() } = {}
) => {
  if (!isPlainObject(payload)) {
    throw new HttpsError('invalid-argument', 'Manual override payload must be an object.');
  }

  return {
    plan_id: normalizeOperatorPlanId(payload.plan_id ?? payload.planId),
    subscription_status: normalizeOperatorSubscriptionStatus(
      payload.subscription_status ?? payload.subscriptionStatus
    ),
    feature_overrides: normalizeOperatorFeatureOverrides(
      payload.feature_overrides ?? payload.featureOverrides ?? {}
    ),
    reason: requireOperatorSupportReason(payload.reason),
    expires_at: normalizeOperatorExpiration(
      payload.expires_at ?? payload.expiresAt ?? null,
      nowMillis
    ),
  };
};

const normalizeOperatorMutationPayload = (payload = {}) => {
  if (!isPlainObject(payload)) {
    throw new HttpsError('invalid-argument', 'Operator mutation payload must be an object.');
  }

  return {
    parentId: normalizeOperatorParentId(payload.parent_id ?? payload.parentId),
    reason: requireOperatorSupportReason(payload.reason),
  };
};

const normalizeOperatorParentLookupPayload = (payload = {}) => {
  if (!isPlainObject(payload)) {
    throw new HttpsError('invalid-argument', 'Operator lookup payload must be an object.');
  }

  return normalizeOperatorParentId(payload.parent_id ?? payload.parentId);
};

const normalizeOperatorSearchPayload = (payload = {}) => {
  if (!isPlainObject(payload)) {
    throw new HttpsError('invalid-argument', 'Operator search payload must be an object.');
  }

  const query = trimString(payload.query);

  if (query.length < 2) {
    throw new HttpsError('invalid-argument', 'Enter at least 2 characters to search parent accounts.');
  }

  return query;
};

export const buildOperatorEntitlementUsageSummary = ({
  planId = PLAN_IDS.FREE,
  usageSnapshot = DEFAULT_USAGE_SNAPSHOT,
} = {}) => {
  const normalizedPlanId = normalizePlanId(planId);
  const limits = PLAN_LIMITS[normalizedPlanId];
  const usage = normalizeUsageSnapshot(usageSnapshot);

  return {
    students: usage.students,
    curriculum_items: usage.curriculum_items,
    plan_id: normalizedPlanId,
    limits: {
      students: limits.maxStudents,
      curriculum_items: limits.maxActiveSubjects,
    },
    over_limits: {
      students: limits.maxStudents != null && usage.students > limits.maxStudents,
      curriculum_items: limits.maxActiveSubjects != null &&
        usage.curriculum_items > limits.maxActiveSubjects,
    },
  };
};

export const buildOperatorDowngradeWarnings = ({
  planId = PLAN_IDS.FREE,
  featureOverrides = {},
  usageSummary = {},
  lockdownSummary = {},
} = {}) => {
  const targetPlanId = normalizePlanId(planId);
  const targetFeatures = buildFeatureSet(targetPlanId, featureOverrides);
  const usage = normalizeUsageSnapshot({
    students: usageSummary.students,
    curriculum_items: usageSummary.curriculum_items,
  });
  const warnings = [];

  if (targetPlanId === PLAN_IDS.FREE) {
    const freeLimits = PLAN_LIMITS[PLAN_IDS.FREE];

    if (usage.students > freeLimits.maxStudents) {
      warnings.push({
        code: 'free_student_limit_exceeded',
        severity: 'warning',
        plan_id: targetPlanId,
        usage_key: 'students',
        usage: usage.students,
        limit: freeLimits.maxStudents,
        message: `This account has ${usage.students} students, above the Free plan limit of ${freeLimits.maxStudents}.`,
      });
    }

    if (usage.curriculum_items > freeLimits.maxActiveSubjects) {
      warnings.push({
        code: 'free_curriculum_limit_exceeded',
        severity: 'warning',
        plan_id: targetPlanId,
        usage_key: 'curriculum_items',
        usage: usage.curriculum_items,
        limit: freeLimits.maxActiveSubjects,
        message: `This account has ${usage.curriculum_items} active curriculum items, above the Free plan limit of ${freeLimits.maxActiveSubjects}.`,
      });
    }
  }

  if (
    lockdownSummary.has_saved_setup === true &&
    !targetFeatures.can_use_lockdown_extension &&
    !targetFeatures.can_use_lockdown_kiosk
  ) {
    warnings.push({
      code: 'lockdown_setup_would_be_disabled',
      severity: 'warning',
      plan_id: targetPlanId,
      usage_key: 'lockdown',
      usage: lockdownSummary.configured_students || lockdownSummary.active_devices || 1,
      limit: 0,
      message: 'This change removes Lockdown access while saved Lockdown setup exists.',
    });
  }

  return warnings;
};

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
    const channelMatch = policyChannels.find((candidate) => trimString(candidate?.channel_id) === normalizedChannelId);
    if (channelMatch) {
      return normalizeLockdownChannel(channelMatch);
    }
  }

  if (normalizedHandle) {
    const handleMatch = policyChannels.find((candidate) => (
      normalizeYoutubeHandle(candidate?.handle).toLowerCase() === normalizedHandle
    ));

    if (handleMatch) {
      return normalizeLockdownChannel(handleMatch);
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

const toIsoTimestampString = (value) => {
  const millis = toTimestampMillis(value);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
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

const ensureActiveOperator = async (request) => {
  const operatorId = ensureAuthenticated(request);
  const operatorSnapshot = await supportOperatorRef(operatorId).get();

  return ensureOperatorSessionRecord({
    uid: operatorId,
    operatorRecord: operatorSnapshot.exists ? operatorSnapshot.data() : null,
  });
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
  const resolvedEntitlement = resolveEntitlementRecord({
    parentId,
    entitlementDoc: data,
  });

  return {
    exists: snapshot.exists,
    data,
    planId: resolvedEntitlement.planId,
    limits: resolvedEntitlement.limits,
    features: resolvedEntitlement.features,
  };
};

const getHouseholdModuleAccess = (entitlementState = {}) => {
  const features = entitlementState.features || {};
  const canUseDailyRoutines = Boolean(features.can_use_daily_routines || features.can_use_chores);
  const canUseChores = Boolean(features.can_use_chores);
  const canUseRewards = Boolean(features.can_use_rewards);

  return {
    canUseDailyRoutines,
    canUseChores,
    canUseRewards,
    canUsePaidModule: canUseChores || canUseRewards,
  };
};

const assertHouseholdModuleAccess = async (parentId, accessKey, message) => {
  const entitlementState = await getAccountEntitlementState(parentId);
  const access = getHouseholdModuleAccess(entitlementState);

  if (!access[accessKey]) {
    throw new HttpsError(
      'permission-denied',
      message || 'This household module action is not included in the current plan.',
      {
        code: 'entitlement_locked',
        plan_id: entitlementState.planId,
        access,
      }
    );
  }

  return {
    entitlementState,
    access,
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

const isArchivedSubjectRecord = (subjectRecord = {}) => (
  subjectRecord.is_archived === true ||
  subjectRecord.archived === true ||
  subjectRecord.status === 'archived' ||
  subjectRecord.archived_at != null
);

const isActiveSubjectRecord = (subjectRecord = {}) => (
  subjectRecord.is_active !== false && !isArchivedSubjectRecord(subjectRecord)
);

const listParentStudents = async (parentId) => {
  const snapshot = await db.collection(COLLECTIONS.STUDENTS)
    .where('parent_id', '==', parentId)
    .get();

  return snapshot.docs.map((studentSnapshot) => ({
    id: studentSnapshot.id,
    ...studentSnapshot.data(),
  }));
};

const listParentSubjects = async (parentId) => {
  const snapshot = await db.collection(COLLECTIONS.SUBJECTS)
    .where('parent_id', '==', parentId)
    .get();

  return snapshot.docs.map((subjectSnapshot) => ({
    id: subjectSnapshot.id,
    ...subjectSnapshot.data(),
  }));
};

const buildLiveUsageSnapshot = ({ students = [], subjects = [] } = {}) => ({
  students: Array.isArray(students) ? students.length : 0,
  curriculum_items: Array.isArray(subjects)
    ? subjects.filter((subjectRecord) => isActiveSubjectRecord(subjectRecord)).length
    : 0,
});

const loadParentUsageSnapshot = async (parentId) => {
  const [students, subjects] = await Promise.all([
    listParentStudents(parentId),
    listParentSubjects(parentId),
  ]);

  return {
    students,
    subjects,
    usageSnapshot: buildLiveUsageSnapshot({ students, subjects }),
  };
};

const hasCustomizedLockdownSchedule = (studentRecord = {}) => {
  const schedule = isPlainObject(studentRecord.lockdown_schedule)
    ? studentRecord.lockdown_schedule
    : null;

  if (!schedule) {
    return false;
  }

  const schoolDays = normalizeDayList(schedule.school_days, DEFAULT_LOCKDOWN_SCHOOL_DAYS);
  const schoolDaysChanged = (
    schoolDays.length !== DEFAULT_LOCKDOWN_SCHOOL_DAYS.length ||
    schoolDays.some((day, index) => day !== DEFAULT_LOCKDOWN_SCHOOL_DAYS[index])
  );
  const startTime = parseDailyTimeValue(
    schedule.school_day_start_time,
    DEFAULT_LOCKDOWN_SCHOOL_DAY_START_TIME
  ).value;
  const endTime = parseDailyTimeValue(
    schedule.school_day_end_time,
    DEFAULT_LOCKDOWN_SCHOOL_DAY_END_TIME
  ).value;
  const hasOffHoursWindows = Array.isArray(schedule.off_hours_resource_windows) &&
    schedule.off_hours_resource_windows.length > 0;

  return (
    schoolDaysChanged ||
    startTime !== DEFAULT_LOCKDOWN_SCHOOL_DAY_START_TIME ||
    endTime !== DEFAULT_LOCKDOWN_SCHOOL_DAY_END_TIME ||
    hasOffHoursWindows
  );
};

const loadLockdownSummary = async ({ parentId, students = [] } = {}) => {
  const configuredStudents = (Array.isArray(students) ? students : [])
    .filter((studentRecord) => hasCustomizedLockdownSchedule(studentRecord));
  const [deviceSnapshot, legacyPolicySnapshot] = await Promise.all([
    db.collection(COLLECTIONS.LOCKDOWN_DEVICES)
      .where('parent_id', '==', parentId)
      .get(),
    db.collection(COLLECTIONS.LOCKDOWN_POLICIES).doc(parentId).get(),
  ]);
  const pairedDevices = deviceSnapshot.size;
  const activeDevices = deviceSnapshot.docs.filter((deviceDoc) => (
    deviceDoc.data()?.status === LOCKDOWN_DEVICE_STATUSES.ACTIVE
  )).length;
  const legacyPolicy = legacyPolicySnapshot.exists ? legacyPolicySnapshot.data() : null;
  const legacyPolicyConfigured = Boolean(
    legacyPolicy &&
    (
      legacyPolicy.is_enabled === true ||
      (Array.isArray(legacyPolicy.allowed_origins) && legacyPolicy.allowed_origins.length > 0) ||
      (
        Array.isArray(legacyPolicy.allowed_youtube_channels) &&
        legacyPolicy.allowed_youtube_channels.length > 0
      )
    )
  );

  return {
    configured_students: configuredStudents.length,
    paired_devices: pairedDevices,
    active_devices: activeDevices,
    legacy_policy_exists: legacyPolicySnapshot.exists,
    legacy_policy_configured: legacyPolicyConfigured,
    has_saved_setup: configuredStudents.length > 0 ||
      pairedDevices > 0 ||
      legacyPolicyConfigured,
  };
};

const buildLockdownDeviceSummary = (deviceSnapshot) => {
  const deviceRecord = deviceSnapshot.data() || {};

  return {
    device_id: deviceSnapshot.id,
    parent_id: trimString(deviceRecord.parent_id),
    student_id: trimString(deviceRecord.student_id),
    source_policy_parent_id: trimString(deviceRecord.source_policy_parent_id),
    source_policy_kind: trimString(deviceRecord.source_policy_kind),
    pairing_contract: trimString(deviceRecord.pairing_contract),
    policy_read_contract: trimString(deviceRecord.policy_read_contract),
    status: trimString(deviceRecord.status) || LOCKDOWN_DEVICE_STATUSES.ACTIVE,
    device_name: trimString(deviceRecord.device_name),
    device_platform: trimString(deviceRecord.device_platform),
    extension_version: trimString(deviceRecord.extension_version),
    paired_at: toIsoTimestampString(deviceRecord.paired_at),
    last_seen_at: toIsoTimestampString(deviceRecord.last_seen_at),
    last_policy_read_at: toIsoTimestampString(deviceRecord.last_policy_read_at),
    created_at: toIsoTimestampString(deviceRecord.created_at),
    updated_at: toIsoTimestampString(deviceRecord.updated_at),
  };
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

const buildParentIdentity = (parentSnapshot) => {
  const parentRecord = parentSnapshot.exists ? parentSnapshot.data() : {};

  return {
    uid: parentSnapshot.id,
    email: trimString(parentRecord?.email),
    school_name: trimString(parentRecord?.school_name),
  };
};

const addParentSearchResult = (results, parentSnapshot) => {
  if (!parentSnapshot.exists || results.has(parentSnapshot.id)) {
    return;
  }

  results.set(parentSnapshot.id, buildParentIdentity(parentSnapshot));
};

const buildSearchVariants = (query) => {
  const lower = query.toLowerCase();
  const titleCase = query
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return Array.from(new Set([query, lower, titleCase].filter(Boolean)));
};

const queryParentsByField = async ({ field, value, limit = OPERATOR_PARENT_SEARCH_LIMIT }) => (
  db.collection(COLLECTIONS.PARENTS)
    .where(field, '==', value)
    .limit(limit)
    .get()
);

const queryParentsBySchoolNamePrefix = async ({
  value,
  limit = OPERATOR_PARENT_SEARCH_LIMIT,
}) => (
  db.collection(COLLECTIONS.PARENTS)
    .orderBy('school_name')
    .startAt(value)
    .endAt(`${value}${SCHOOL_NAME_PREFIX_SUFFIX}`)
    .limit(limit)
    .get()
);

const loadParentSearchResults = async (query) => {
  const results = new Map();
  const parentCollection = db.collection(COLLECTIONS.PARENTS);
  const directSnapshot = await parentCollection.doc(query).get();

  addParentSearchResult(results, directSnapshot);

  const variants = buildSearchVariants(query);
  const searchSnapshots = await Promise.all([
    ...variants.map((variant) => queryParentsByField({ field: 'email', value: variant })),
    ...variants.map((variant) => queryParentsByField({ field: 'school_name', value: variant })),
    ...variants.map((variant) => queryParentsBySchoolNamePrefix({ value: variant })),
  ]);

  searchSnapshots.forEach((snapshot) => {
    snapshot.docs.forEach((parentSnapshot) => addParentSearchResult(results, parentSnapshot));
  });

  return Array.from(results.values()).slice(0, OPERATOR_PARENT_SEARCH_LIMIT);
};

const loadRecentEntitlementAuditEntries = async (parentId) => {
  const snapshot = await db.collection(COLLECTIONS.ENTITLEMENT_AUDIT_LOGS)
    .where('parent_id', '==', parentId)
    .get();

  return snapshot.docs
    .map((auditSnapshot) => ({
      id: auditSnapshot.id,
      ...auditSnapshot.data(),
    }))
    .sort((left, right) => (
      (toTimestampMillis(right.created_at) || 0) -
      (toTimestampMillis(left.created_at) || 0)
    ))
    .slice(0, OPERATOR_AUDIT_ENTRY_LIMIT);
};

const buildEffectiveEntitlementResponse = ({ entitlementExists, resolvedEntitlement }) => ({
  exists: entitlementExists,
  parent_id: resolvedEntitlement.parent_id,
  plan_id: resolvedEntitlement.plan_id,
  subscription_status: resolvedEntitlement.subscription_status,
  billing_provider: resolvedEntitlement.billing_provider,
  feature_overrides: resolvedEntitlement.feature_overrides,
  features: resolvedEntitlement.features,
  usage_snapshot: resolvedEntitlement.usage_snapshot,
  trial_ends_at: resolvedEntitlement.trial_ends_at,
  current_period_end: resolvedEntitlement.current_period_end,
  resolution_source: resolvedEntitlement.resolution_source,
  updated_via: resolvedEntitlement.updated_via,
  updated_at: resolvedEntitlement.updated_at,
  has_active_manual_override: resolvedEntitlement.hasActiveManualOverride,
  has_expired_manual_override: resolvedEntitlement.hasExpiredManualOverride,
});

const buildOperatorEntitlementDetail = async (parentId) => {
  const parentSnapshot = await db.collection(COLLECTIONS.PARENTS).doc(parentId).get();

  if (!parentSnapshot.exists) {
    throw new HttpsError('not-found', 'Parent account was not found.');
  }

  const [entitlementSnapshot, usageData, recentAuditEntries] = await Promise.all([
    entitlementRef(parentId).get(),
    loadParentUsageSnapshot(parentId),
    loadRecentEntitlementAuditEntries(parentId),
  ]);
  const entitlementDoc = entitlementSnapshot.exists ? entitlementSnapshot.data() : {};
  const resolvedEntitlement = resolveEntitlementRecord({
    parentId,
    entitlementDoc,
  });
  const usageSummary = buildOperatorEntitlementUsageSummary({
    planId: resolvedEntitlement.plan_id,
    usageSnapshot: usageData.usageSnapshot,
  });
  const lockdownSummary = await loadLockdownSummary({
    parentId,
    students: usageData.students,
  });

  return {
    parent: buildParentIdentity(parentSnapshot),
    effective_entitlement: buildEffectiveEntitlementResponse({
      entitlementExists: entitlementSnapshot.exists,
      resolvedEntitlement,
    }),
    billing_state: resolvedEntitlement.billing_state,
    manual_override: resolvedEntitlement.manual_override,
    usage_summary: usageSummary,
    lockdown_summary: lockdownSummary,
    downgrade_warnings: buildOperatorDowngradeWarnings({
      planId: resolvedEntitlement.plan_id,
      featureOverrides: resolvedEntitlement.feature_overrides,
      usageSummary,
      lockdownSummary,
    }),
    recent_audit_entries: recentAuditEntries,
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

const LOCKDOWN_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const normalizeLockdownSchedule = (studentRecord = {}) => {
  const rawSchedule = studentRecord?.lockdown_schedule
    && typeof studentRecord.lockdown_schedule === 'object'
    && !Array.isArray(studentRecord.lockdown_schedule)
      ? studentRecord.lockdown_schedule
      : studentRecord;
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

const formatLockdownScheduleDayList = (days = []) => {
  const labels = (Array.isArray(days) ? days : [])
    .map((dayValue) => LOCKDOWN_DAY_LABELS[dayValue])
    .filter(Boolean);

  return labels.length ? labels.join(', ') : 'No days selected';
};

const buildLockdownScheduleSummary = (schedule = {}, fallbackTimezone = '') => {
  const normalizedSchedule = normalizeLockdownSchedule({
    timezone: fallbackTimezone,
    ...schedule,
  });
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

const normalizeLockdownResourceReference = (resource = {}, {
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
      status: LOCKDOWN_RESOURCE_TEST_DECISIONS.UNSUPPORTED,
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
    const channel = normalizeLockdownChannel({
      channel_id: parseResult.channel_id || youtubeMetadata.channel_id,
      title: youtubeMetadata.title,
      handle: youtubeMetadata.handle,
    });

    if (!channel?.channel_id) {
      return {
        status: hasExplicitYoutubeMetadata
          ? LOCKDOWN_RESOURCE_TEST_DECISIONS.METADATA_NEEDED
          : LOCKDOWN_RESOURCE_TEST_DECISIONS.UNSUPPORTED,
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
      status: LOCKDOWN_RESOURCE_TEST_DECISIONS.ALLOW,
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
        status: LOCKDOWN_RESOURCE_TEST_DECISIONS.ALLOW,
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
        status: LOCKDOWN_RESOURCE_TEST_DECISIONS.ALLOW,
        reason: 'youtube_handle_resolved_from_metadata',
        resource_type: 'youtube',
        url: `https://www.youtube.com/channel/${youtubeMetadata.channel_id}`,
        origin: '',
        normalized_origin: '',
        youtube: {
          ...normalizeLockdownChannel({
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
      status: LOCKDOWN_RESOURCE_TEST_DECISIONS.METADATA_NEEDED,
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
    const effectiveChannel = resolvedChannel || normalizeLockdownChannel(youtubeMetadata);

    if (effectiveChannel?.channel_id) {
      return {
        status: LOCKDOWN_RESOURCE_TEST_DECISIONS.ALLOW,
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
      status: LOCKDOWN_RESOURCE_TEST_DECISIONS.METADATA_NEEDED,
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
      status: LOCKDOWN_RESOURCE_TEST_DECISIONS.UNSUPPORTED,
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
        status: LOCKDOWN_RESOURCE_TEST_DECISIONS.UNSUPPORTED,
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
          status: LOCKDOWN_RESOURCE_TEST_DECISIONS.UNSUPPORTED,
          reason: 'unsupported_scheme',
          resource_type: 'website',
          url: rawValue,
          origin: '',
          normalized_origin: '',
        };
      }
    } catch {
      return {
        status: LOCKDOWN_RESOURCE_TEST_DECISIONS.UNSUPPORTED,
        reason: 'invalid_url',
        resource_type: 'website',
        url: rawValue,
        origin: '',
        normalized_origin: '',
      };
    }
  }

  return {
    status: LOCKDOWN_RESOURCE_TEST_DECISIONS.ALLOW,
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

const validateLockdownOriginInput = (value = '') => {
  const origin = resolveHttpOriginFromValue(value);

  if (!trimString(value)) {
    return {
      origin: '',
      error: 'Origin is required.',
    };
  }

  if (!origin) {
    return {
      origin: '',
      error: 'Only exact http or https origins are supported.',
    };
  }

  return {
    origin,
    error: null,
  };
};

const normalizeLockdownResourceInput = (resource = {}) => ({
  name: trimString(resource?.name),
  url: trimString(resource?.url),
  lockdown_origin: trimString(resource?.lockdown_origin),
  youtube_channel_id: trimString(resource?.youtube_channel_id),
  youtube_channel_title: trimString(resource?.youtube_channel_title),
  youtube_channel_handle: trimString(resource?.youtube_channel_handle),
});

const validateLockdownResourceInput = (resource = {}) => {
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

  if (normalizedReference.status === LOCKDOWN_RESOURCE_TEST_DECISIONS.UNSUPPORTED) {
    return {
      resource: normalizedResource,
      error: normalizedReference.reason === 'unsupported_scheme'
        ? 'Only http and https resources are supported.'
        : normalizedReference.reason === 'empty_resource'
          ? 'Add a valid website URL or YouTube creator URL.'
          : 'This resource type is not supported in the first production Lockdown scope.',
    };
  }

  if (normalizedReference.status === LOCKDOWN_RESOURCE_TEST_DECISIONS.METADATA_NEEDED) {
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
    const { origin, error } = validateLockdownOriginInput(normalizedResource.lockdown_origin);

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

const validateLockdownResourceLibraryEntryInput = (resource = {}) => {
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

export const selectAssignedLockdownResources = ({
  resourceLibrary = [],
  studentId = '',
} = {}) => (
  (Array.isArray(resourceLibrary) ? resourceLibrary : [])
    .map((resource) => normalizeLockdownResourceLibraryEntry(resource))
    .filter((resource) => resource.is_active && isLockdownResourceAssignedToStudent(resource, studentId))
    .map((resource) => buildLockdownResourceFromLibraryEntry(resource))
);

const deriveLockdownTargetsFromResources = (resources = []) => {
  const allowedOrigins = [];
  const allowedYoutubeChannels = [];
  const unsupportedResources = [];
  const seenOrigins = new Set();
  const seenChannels = new Set();

  (Array.isArray(resources) ? resources : []).forEach((resource) => {
    const normalizedReference = normalizeLockdownResourceReference(resource, {
      allowHandleFallback: false,
    });

    if (normalizedReference.resource_type === 'website' && normalizedReference.status === LOCKDOWN_RESOURCE_TEST_DECISIONS.ALLOW) {
      if (normalizedReference.normalized_origin && !seenOrigins.has(normalizedReference.normalized_origin)) {
        seenOrigins.add(normalizedReference.normalized_origin);
        allowedOrigins.push(normalizedReference.normalized_origin);
      }
      return;
    }

    if (
      normalizedReference.resource_type === 'youtube'
      && normalizedReference.status === LOCKDOWN_RESOURCE_TEST_DECISIONS.ALLOW
      && normalizedReference.youtube?.channel_id
    ) {
      const normalizedChannel = normalizeLockdownChannel({
        channel_id: normalizedReference.youtube.channel_id,
        title: normalizedReference.youtube.title || trimString(resource?.youtube_channel_title) || trimString(resource?.name),
        handle: normalizedReference.youtube.handle || trimString(resource?.youtube_channel_handle),
      });

      if (normalizedChannel && !seenChannels.has(normalizedChannel.channel_id)) {
        seenChannels.add(normalizedChannel.channel_id);
        allowedYoutubeChannels.push(normalizedChannel);
      }
      return;
    }

    if (
      normalizedReference.status === LOCKDOWN_RESOURCE_TEST_DECISIONS.METADATA_NEEDED
      || normalizedReference.status === LOCKDOWN_RESOURCE_TEST_DECISIONS.UNSUPPORTED
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

const describeSystemResource = (resource = {}) => {
  const resourceType = trimString(resource.resource_type || resource.type);

  if (resourceType === 'decision') {
    return 'Deliberately excluded from the student Lockdown allowlist.';
  }

  if (resourceType === 'page_group') {
    const pages = Array.isArray(resource.pages) ? resource.pages.filter(Boolean) : [];
    return pages.length ? `Pages: ${pages.join(', ')}` : 'Extension pages are modeled separately.';
  }

  if (resourceType === 'origin') {
    return trimString(resource.url) || trimString(resource.origin) || 'System origin';
  }

  return trimString(resource.url) || trimString(resource.origin) || trimString(resource.page) || 'System resource';
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
      && normalizedReference.status === LOCKDOWN_RESOURCE_TEST_DECISIONS.ALLOW
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
      && normalizedReference.status === LOCKDOWN_RESOURCE_TEST_DECISIONS.ALLOW
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
  (Array.isArray(resources) ? resources : []).map((resource) => ({
    key: `${resource.resource_type || 'system'}:${resource.name || resource.label || resource.origin || resource.page || resource.url}`,
    resource_type: resource.resource_type || resource.type || 'system',
    title: resource.name || resource.label || resource.origin || resource.page || resource.url || 'System resource',
    detail: describeSystemResource(resource),
    allowed: resource.allowed !== false,
  }))
);

const buildAllowedResourceGroups = ({
  policyState = '',
  systemResources = [],
  parentApprovedResources = [],
  activeBlockResources = [],
  legacyOffHoursWindowCount = 0,
} = {}) => {
  const normalizedPolicyState = trimString(policyState);
  const inSchoolTime = normalizedPolicyState === LOCKDOWN_POLICY_STATES.ACTIVE_BLOCK
    || normalizedPolicyState === LOCKDOWN_POLICY_STATES.NO_ACTIVE_BLOCK;
  const outsideSchedule = normalizedPolicyState === LOCKDOWN_POLICY_STATES.OUTSIDE_SCHOOL_TIME;
  const activeBlockState = normalizedPolicyState === LOCKDOWN_POLICY_STATES.ACTIVE_BLOCK;
  const legacyWindowNote = legacyOffHoursWindowCount
    ? `Saved legacy off-hours window data is preserved for compatibility, but it does not turn on outside-schedule blocking right now.`
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
  stateContext = null,
  activeWorkSession = null,
} = {}) => ({
  kind: LOCKDOWN_CONTRACTS.DERIVED_WEEKLY_PLAN_SOURCE,
  parent_id: parentId,
  student_id: studentId,
  weekly_plan_id: weeklyPlan?.id || '',
  published_weekly_plan_exists: Boolean(weeklyPlan),
  weekly_plan_status: trimString(weeklyPlan?.status) || null,
  active_timer_session_id: activeTimerSession?.id || '',
  active_work_session_id: activeWorkSession?.id || '',
  active_work_session_kind: activeWorkSession?.kind || '',
  derived_state: policyState,
  state_context: stateContext,
  active_work_session: activeWorkSession,
  is_legacy_poc_boundary: false,
  document_exists: true,
});

export const derivePublishedWeeklyPlanDevicePolicy = ({
  entitlementActive = false,
  parentId = '',
  studentRecord = null,
  weeklyPlan = null,
  timerSessions = [],
  lockdownResourceLibrary = [],
  activeWorkSession = null,
  deviceStatus = '',
  bindingStatus = '',
  cacheStatus = '',
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
  const assignedOffBlockResources = selectAssignedLockdownResources({
    resourceLibrary: lockdownResourceLibrary,
    studentId: normalizedStudentId,
  });
  const blockResources = Array.isArray(activeBlock?.resources) ? activeBlock.resources : [];
  const legacyActiveWorkSession = buildLegacyLockdownActiveWorkSession({
    activeBlock,
    activeTimerSession,
    weeklyPlan,
    studentRecord,
  });
  const normalizedActiveWorkSession = normalizeLockdownActiveWorkSession(
    activeWorkSession || legacyActiveWorkSession
  );

  let policyState = LOCKDOWN_POLICY_STATES.NO_ACTIVE_BLOCK;
  let policyResources = [];
  const activeTimerSessionIsInactive = activeTimerSession
    ? isInactiveActiveWorkStatus(activeTimerSession.status)
    : false;

  if (!entitlementActive) {
    policyState = LOCKDOWN_POLICY_STATES.ENTITLEMENT_INACTIVE;
  } else if (!timeContext.inSchoolTime) {
    policyState = LOCKDOWN_POLICY_STATES.OUTSIDE_SCHOOL_TIME;
  } else if (activeTimerSessionIsInactive) {
    policyState = LOCKDOWN_POLICY_STATES.NO_ACTIVE_BLOCK;
    policyResources = assignedOffBlockResources;
  } else if (activeBlock) {
    policyState = LOCKDOWN_POLICY_STATES.ACTIVE_BLOCK;
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
  const allowedResourceGroups = buildAllowedResourceGroups({
    policyState,
    systemResources,
    parentApprovedResources: assignedOffBlockResources,
    activeBlockResources: blockResources,
    legacyOffHoursWindowCount: timeContext.schedule?.off_hours_resource_windows?.length || 0,
  });
  const scheduleSummary = buildLockdownScheduleSummary(timeContext.schedule, timeContext.timezone);
  const effectiveActiveBlock = policyState === LOCKDOWN_POLICY_STATES.ACTIVE_BLOCK
    ? activeBlock
    : null;
  const effectiveActiveTimerSession = policyState === LOCKDOWN_POLICY_STATES.ACTIVE_BLOCK
    ? activeTimerSession
    : null;
  const derivedActiveWorkSession = (activeBlock || activeTimerSession)
    ? normalizeLockdownActiveWorkSession({
        id: activeTimerSession?.id || activeBlock?.id || '',
        kind: activeTimerSession
          ? (trimString(activeBlock?.completion_mode) === 'task_complete'
            ? LOCKDOWN_ACTIVE_WORK_SESSION_KINDS.TASK_COMPLETE
            : LOCKDOWN_ACTIVE_WORK_SESSION_KINDS.TIMER)
          : '',
        status: activeTimerSession?.is_running === false
          ? 'paused'
          : activeTimerSession
            ? 'active'
            : '',
        source_kind: LOCKDOWN_CONTRACTS.DERIVED_WEEKLY_PLAN_SOURCE,
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
        target_end_time: normalizeFiniteNumberLike(activeTimerSession?.target_end_time),
        duration_ms: normalizeFiniteNumberLike(activeTimerSession?.duration_ms),
        remaining_time: normalizeFiniteNumberLike(activeTimerSession?.remaining_time),
        is_running: Boolean(activeTimerSession?.is_running),
        metadata: {
          source: activeTimerSession ? 'timer_session' : 'weekly_plan_block',
        },
      })
    : null;
  const stateContext = normalizeLockdownPolicyStateContext({
    policyState: !timeContext.inSchoolTime
      ? LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.OFF_HOURS_CLOSED
      : policyState,
    entitlementActive,
    weeklyPlan,
    timeContext,
    activeWorkSession: normalizedActiveWorkSession || derivedActiveWorkSession,
    activeBlock: effectiveActiveBlock,
    deviceStatus,
    bindingStatus,
    cacheStatus,
    active_work_state: activeTimerSessionIsInactive
      ? LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.NO_ACTIVE_WORK
      : (activeBlock || activeTimerSession
        ? LOCKDOWN_PRODUCTION_POLICY_STATE_VOCABULARY.ACTIVE_BLOCK
        : ''),
  });
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
    policy_state_metadata: stateContext,
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
      active_work_session: stateContext.active_work_session,
      state_context: stateContext,
      unsupported_resources: derivedTargets.unsupported_resources,
      system_resources: systemResources,
    },
    source_policy: buildTrustedPolicySourceMetadata({
      parentId: normalizedParentId,
      studentId: normalizedStudentId,
      weeklyPlan,
      policyState,
      activeTimerSession: effectiveActiveTimerSession,
      stateContext,
      activeWorkSession: stateContext.active_work_session,
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

const loadParentLockdownResourceLibrary = async (parentId) => {
  if (!trimString(parentId)) {
    return [];
  }

  const snapshot = await db.collection(COLLECTIONS.LOCKDOWN_RESOURCE_LIBRARY)
    .where('parent_id', '==', parentId)
    .get();

  return snapshot.docs.map((resourceSnapshot) => normalizeLockdownResourceLibraryEntry({
    id: resourceSnapshot.id,
    ...resourceSnapshot.data(),
  }));
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
  const [timerSessions, lockdownResourceLibrary] = await Promise.all([
    loadStudentTimerSessions(binding.studentId),
    loadParentLockdownResourceLibrary(deviceRecord.parent_id),
  ]);
  const derivedPolicy = derivePublishedWeeklyPlanDevicePolicy({
    entitlementActive: entitlementState.features.can_use_lockdown_extension,
    parentId: deviceRecord.parent_id,
    studentRecord: binding.studentRecord,
    weeklyPlan,
    timerSessions,
    lockdownResourceLibrary,
    deviceStatus: deviceRecord.status,
    bindingStatus: binding.bindingError,
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
  if (!/^\d{4,6}$/.test(normalized)) {
    throw new HttpsError('invalid-argument', 'Access PINs must be 4 to 6 numeric digits.');
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

const normalizeCurriculumBlocks = (curriculumBlocks = []) => {
  if (!Array.isArray(curriculumBlocks)) {
    throw new HttpsError('invalid-argument', 'Curriculum blocks must be an array.');
  }

  return curriculumBlocks
    .map((block, index) => {
      const defaultQuantity = Number.parseInt(block?.default_quantity, 10);

      return {
        id: trimString(block?.id) || `block_${index + 1}`,
        title: trimString(block?.title) || `Block ${index + 1}`,
        type: trimString(block?.type) || 'standard',
        instruction: trimString(block?.instruction),
        resources: normalizeResourceList(block?.resources || []),
        require_timer: typeof block?.require_timer === 'boolean' ? block.require_timer : null,
        require_input: typeof block?.require_input === 'boolean' ? block.require_input : null,
        custom_fields: normalizeCustomFields(block?.custom_fields || []),
        default_quantity: Number.isFinite(defaultQuantity) && defaultQuantity >= 0
          ? Math.min(defaultQuantity, 20)
          : 0,
        pinned: block?.pinned !== false,
      };
    })
    .filter((block) => block.title);
};

const assertParentOwnsStudents = async (parentId, studentIds, { requireActive = false } = {}) => {
  const uniqueStudentIds = Array.from(new Set(studentIds));
  const studentSnapshots = await Promise.all(
    uniqueStudentIds.map((studentId) => db.collection(COLLECTIONS.STUDENTS).doc(studentId).get())
  );

  const allOwned = studentSnapshots.every((snapshot) => (
    snapshot.exists &&
    snapshot.data()?.parent_id === parentId &&
    (!requireActive || snapshot.data()?.is_active !== false)
  ));

  if (!allOwned) {
    throw new HttpsError(
      'failed-precondition',
      requireActive
        ? 'Every assigned student must be active and belong to the current parent account.'
        : 'Every assigned student must exist and belong to the current parent account.'
    );
  }
};

const serializeTrustedDoc = (snapshot) => ({
  id: snapshot.id,
  ...(snapshot.data() || {}),
});

const listParentCollectionRecords = async (collectionName, parentId) => {
  const snapshot = await db.collection(collectionName)
    .where('parent_id', '==', parentId)
    .get();

  return snapshot.docs.map(serializeTrustedDoc);
};

const getChoreSettingsRef = (parentId) => (
  db.collection(COLLECTIONS.CHORE_SETTINGS).doc(parentId)
);

const getRewardSettingsRef = (parentId) => (
  db.collection(COLLECTIONS.REWARD_SETTINGS).doc(parentId)
);

const getRewardCatalogItemRef = (rewardCatalogItemId) => (
  db.collection(COLLECTIONS.REWARD_CATALOG_ITEMS).doc(rewardCatalogItemId)
);

const getRewardRedemptionRef = (rewardRedemptionId) => (
  db.collection(COLLECTIONS.REWARD_REDEMPTIONS).doc(rewardRedemptionId)
);

const getStudentPointWalletRef = (studentId) => (
  db.collection(COLLECTIONS.STUDENT_POINT_WALLETS).doc(studentId)
);

const getPointLedgerEntryRef = ({ studentId, sourceType, sourceId } = {}) => (
  db.collection(COLLECTIONS.POINT_LEDGER_ENTRIES).doc(buildPointLedgerEntryId({
    studentId,
    sourceType,
    sourceId,
  }))
);

const getTrustedParentChoreSettings = async (parentId) => {
  const [settingsSnapshot, parentSettings] = await Promise.all([
    getChoreSettingsRef(parentId).get(),
    loadParentSettings(parentId),
  ]);
  const settingsRecord = settingsSnapshot.exists ? settingsSnapshot.data() : {};

  return {
    ...DEFAULT_TRUSTED_CHORE_SETTINGS,
    ...parentSettings,
    ...settingsRecord,
  };
};

const getTrustedParentRewardSettings = async (parentId) => {
  const settingsSnapshot = await getRewardSettingsRef(parentId).get();
  return normalizePointSettings(settingsSnapshot.exists ? settingsSnapshot.data() : DEFAULT_POINT_SETTINGS);
};

const normalizeTrustedPointAdjustmentPayload = (payload = {}) => ({
  student_id: trimString(payload?.student_id || payload?.studentId),
  delta_points: Number.parseInt(payload?.delta_points ?? payload?.deltaPoints, 10),
  description: trimString(payload?.description || payload?.note || ''),
});

const normalizeTrustedRewardRequestPayload = (payload = {}) => ({
  reward_catalog_item_id: trimString(
    payload?.reward_catalog_item_id
    || payload?.rewardCatalogItemId
  ),
});

const normalizeTrustedRewardReviewPayload = (payload = {}) => ({
  redemption_id: trimString(payload?.redemption_id || payload?.redemptionId),
  action: trimString(payload?.action).toLowerCase(),
});

const applyTrustedPointLedgerInTransaction = async ({
  transaction,
  parentId,
  studentId,
  sourceType,
  sourceId,
  deltaPoints,
  description = '',
  metadata = {},
} = {}) => {
  const normalizedStudentId = trimString(studentId);
  const normalizedSourceType = trimString(sourceType);
  const normalizedSourceId = trimString(sourceId);
  const normalizedDelta = Number.parseInt(deltaPoints, 10);

  if (
    !transaction ||
    !trimString(parentId) ||
    !normalizedStudentId ||
    !normalizedSourceType ||
    !normalizedSourceId ||
    !Number.isFinite(normalizedDelta) ||
    normalizedDelta === 0
  ) {
    return {
      applied: false,
      reason: 'invalid_award',
    };
  }

  const walletRef = getStudentPointWalletRef(normalizedStudentId);
  const ledgerRef = getPointLedgerEntryRef({
    studentId: normalizedStudentId,
    sourceType: normalizedSourceType,
    sourceId: normalizedSourceId,
  });
  const [walletSnapshot, ledgerSnapshot] = await Promise.all([
    transaction.get(walletRef),
    transaction.get(ledgerRef),
  ]);

  if (ledgerSnapshot.exists) {
    return {
      applied: false,
      reason: 'already_awarded',
      entry_id: ledgerRef.id,
    };
  }

  const currentWallet = normalizePointWallet(
    walletSnapshot.exists ? walletSnapshot.data() : {},
    normalizedStudentId
  );
  const nextState = applyPointLedgerMutation({
    parentId,
    studentId: normalizedStudentId,
    sourceType: normalizedSourceType,
    sourceId: normalizedSourceId,
    deltaPoints: normalizedDelta,
    description,
    metadata,
    pointWallets: [currentWallet],
    pointLedgerEntries: [],
    entryId: ledgerRef.id,
  });

  if (!nextState.applied || !nextState.wallet || !nextState.ledgerEntry) {
    return {
      applied: false,
      reason: nextState.code || 'not_applied',
    };
  }

  transaction.set(walletRef, {
    id: normalizedStudentId,
    parent_id: trimString(parentId),
    student_id: normalizedStudentId,
    total_points: nextState.wallet.total_points,
    lifetime_points: nextState.wallet.lifetime_points,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  transaction.set(ledgerRef, {
    id: ledgerRef.id,
    parent_id: trimString(parentId),
    student_id: normalizedStudentId,
    wallet_id: normalizedStudentId,
    source_type: normalizedSourceType,
    source_id: normalizedSourceId,
    delta_points: nextState.ledgerEntry.delta_points,
    balance_after: nextState.ledgerEntry.balance_after,
    description: description || '',
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    created_at: FieldValue.serverTimestamp(),
  });

  return {
    applied: true,
    entry_id: ledgerRef.id,
    total_points: nextState.wallet.total_points,
    lifetime_points: nextState.wallet.lifetime_points,
  };
};

const awardTrustedPointsForSource = async ({
  parentId,
  studentId,
  sourceType,
  sourceId,
  deltaPoints,
  description = '',
  metadata = {},
} = {}) => {
  const normalizedStudentId = trimString(studentId);
  const normalizedSourceType = trimString(sourceType);
  const normalizedSourceId = trimString(sourceId);
  const normalizedDelta = Number.parseInt(deltaPoints, 10);

  if (
    !trimString(parentId) ||
    !normalizedStudentId ||
    !normalizedSourceType ||
    !normalizedSourceId ||
    !Number.isFinite(normalizedDelta) ||
    normalizedDelta === 0
  ) {
    return {
      awarded: false,
      reason: 'invalid_award',
    };
  }

  return db.runTransaction(async (transaction) => {
    const walletRef = getStudentPointWalletRef(normalizedStudentId);
    const ledgerRef = getPointLedgerEntryRef({
      studentId: normalizedStudentId,
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
    });
    const [walletSnapshot, ledgerSnapshot] = await Promise.all([
      transaction.get(walletRef),
      transaction.get(ledgerRef),
    ]);

    if (ledgerSnapshot.exists) {
      return {
        awarded: false,
        reason: 'already_awarded',
        entry_id: ledgerRef.id,
      };
    }

    const currentWallet = normalizePointWallet(
      walletSnapshot.exists ? walletSnapshot.data() : {},
      normalizedStudentId
    );
    const nextState = applyPointLedgerMutation({
      parentId,
      studentId: normalizedStudentId,
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
      deltaPoints: normalizedDelta,
      description,
      metadata,
      pointWallets: [currentWallet],
      pointLedgerEntries: [],
      entryId: ledgerRef.id,
    });

    if (!nextState.applied || !nextState.wallet || !nextState.ledgerEntry) {
      return {
        awarded: false,
        reason: nextState.code || 'not_applied',
      };
    }

    transaction.set(walletRef, {
      id: normalizedStudentId,
      parent_id: trimString(parentId),
      student_id: normalizedStudentId,
      total_points: nextState.wallet.total_points,
      lifetime_points: nextState.wallet.lifetime_points,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(ledgerRef, {
      id: ledgerRef.id,
      parent_id: trimString(parentId),
      student_id: normalizedStudentId,
      wallet_id: normalizedStudentId,
      source_type: normalizedSourceType,
      source_id: normalizedSourceId,
      delta_points: nextState.ledgerEntry.delta_points,
      balance_after: nextState.ledgerEntry.balance_after,
      description: description || '',
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      created_at: FieldValue.serverTimestamp(),
    });

    return {
      awarded: true,
      entry_id: ledgerRef.id,
      total_points: nextState.wallet.total_points,
      lifetime_points: nextState.wallet.lifetime_points,
    };
  });
};

const applyRewardRedemptionTransition = async ({
  parentId,
  studentId = '',
  redemptionId = '',
  action = '',
} = {}) => {
  const normalizedRedemptionId = trimString(redemptionId);
  const normalizedAction = trimString(action).toLowerCase();

  if (!trimString(parentId) || !normalizedRedemptionId || !normalizedAction) {
    throw new HttpsError('invalid-argument', 'A redemption id and action are required.');
  }

  return db.runTransaction(async (transaction) => {
    const redemptionRef = getRewardRedemptionRef(normalizedRedemptionId);
    const redemptionSnapshot = await transaction.get(redemptionRef);

    if (!redemptionSnapshot.exists) {
      throw new HttpsError('not-found', 'The requested redemption was not found.');
    }

    const redemption = serializeTrustedDoc(redemptionSnapshot);
    if (trimString(redemption.parent_id) !== trimString(parentId)) {
      throw new HttpsError('permission-denied', 'This redemption does not belong to your account.');
    }
    if (studentId && trimString(redemption.student_id) !== trimString(studentId)) {
      throw new HttpsError('permission-denied', 'This redemption does not belong to the current student.');
    }

    const transition = buildRewardStatusTransition({
      redemption,
      action: normalizedAction,
    });

    if (!transition.ok) {
      throw new HttpsError('failed-precondition', 'That redemption action is not available from the current state.');
    }

    const rewardType = trimString(redemption.reward_type_snapshot) || REWARD_CATALOG_ITEM_TYPES.PARENT_CREATED;
    let rewardCatalogItem = null;
    if (
      rewardType !== REWARD_CATALOG_ITEM_TYPES.BUILT_IN &&
      trimString(redemption.reward_catalog_item_id)
    ) {
      const rewardCatalogItemRef = getRewardCatalogItemRef(redemption.reward_catalog_item_id);
      const rewardCatalogItemSnapshot = await transaction.get(rewardCatalogItemRef);
      if (rewardCatalogItemSnapshot.exists) {
        rewardCatalogItem = normalizeRewardCatalogItemRecord(serializeTrustedDoc(rewardCatalogItemSnapshot));
      }
    }

    if (transition.refund_points) {
      const refundResult = await applyTrustedPointLedgerInTransaction({
        transaction,
        parentId,
        studentId: redemption.student_id,
        sourceType: POINT_SOURCE_TYPES.REWARD_REDEMPTION_REFUND,
        sourceId: redemption.id,
        deltaPoints: redemption.point_cost_snapshot,
        description: trimString(redemption.title_snapshot)
          ? `Reward refund: ${trimString(redemption.title_snapshot)}`
          : 'Reward refund',
        metadata: {
          reward_redemption_id: redemption.id,
          reward_catalog_item_id: trimString(redemption.reward_catalog_item_id),
          action: normalizedAction,
        },
      });

      if (!refundResult.applied) {
        throw new HttpsError(
          refundResult.reason === 'insufficient_points' ? 'failed-precondition' : 'invalid-argument',
          refundResult.reason === 'insufficient_points'
            ? 'The refund could not be applied without pushing the wallet below zero.'
            : 'The reward refund could not be saved.'
        );
      }
    }

    if (
      transition.restore_stock &&
      rewardCatalogItem &&
      trimString(rewardCatalogItem.id)
    ) {
      transaction.set(getRewardCatalogItemRef(rewardCatalogItem.id), {
        available_quantity: Math.min(
          rewardCatalogItem.available_quantity + 1,
          rewardCatalogItem.stock_quantity
        ),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    const update = {
      status: transition.status,
      updated_at: FieldValue.serverTimestamp(),
    };

    if (transition.status === REWARD_REDEMPTION_STATUSES.APPROVED) {
      update.approved_at = FieldValue.serverTimestamp();
    }
    if (transition.status === REWARD_REDEMPTION_STATUSES.FULFILLED) {
      if (!redemption.approved_at) {
        update.approved_at = FieldValue.serverTimestamp();
      }
      update.fulfilled_at = FieldValue.serverTimestamp();
    }
    if (transition.status === REWARD_REDEMPTION_STATUSES.REJECTED) {
      update.rejected_at = FieldValue.serverTimestamp();
    }
    if (transition.status === REWARD_REDEMPTION_STATUSES.CANCELED) {
      update.canceled_at = FieldValue.serverTimestamp();
    }

    transaction.set(redemptionRef, update, { merge: true });

    return {
      redemption_id: redemption.id,
      status: transition.status,
    };
  });
};

const awardTrustedPointsForChoreCompletion = async (completionRecord = {}) => {
  const parentId = trimString(completionRecord.parent_id);
  const studentId = trimString(completionRecord.student_id);

  if (!parentId || !studentId || !trimString(completionRecord.id)) {
    return {
      awarded: false,
      reason: 'invalid_completion_record',
    };
  }

  const rewardSettings = await getTrustedParentRewardSettings(parentId);
  const deltaPoints = getPointValueForSource({
    sourceType: POINT_SOURCE_TYPES.CHORE_COMPLETION,
    rewardSettings,
  });

  if (deltaPoints <= 0) {
    return {
      awarded: false,
      reason: 'points_disabled',
    };
  }

  return awardTrustedPointsForSource({
    parentId,
    studentId,
    sourceType: POINT_SOURCE_TYPES.CHORE_COMPLETION,
    sourceId: trimString(completionRecord.id),
    deltaPoints,
    description: 'Chore completion',
    metadata: {
      chore_completion_id: trimString(completionRecord.id),
      chore_definition_id: trimString(completionRecord.chore_definition_id),
      claim_id: trimString(completionRecord.claim_id),
      status: trimString(completionRecord.status),
    },
  });
};

const awardTrustedPointsForRoutineCompletion = async ({
  completionRecord = {},
  routineTemplate = {},
} = {}) => {
  const parentId = trimString(completionRecord.parent_id);
  const studentId = trimString(completionRecord.student_id);

  if (!parentId || !studentId || !trimString(completionRecord.id)) {
    return {
      awarded: false,
      reason: 'invalid_routine_completion',
    };
  }

  const rewardSettings = await getTrustedParentRewardSettings(parentId);
  const deltaPoints = getPointValueForSource({
    sourceType: POINT_SOURCE_TYPES.ROUTINE_COMPLETION,
    rewardSettings,
    routineTemplate,
  });

  if (deltaPoints <= 0) {
    return {
      awarded: false,
      reason: 'points_disabled',
    };
  }

  return awardTrustedPointsForSource({
    parentId,
    studentId,
    sourceType: POINT_SOURCE_TYPES.ROUTINE_COMPLETION,
    sourceId: trimString(completionRecord.id),
    deltaPoints,
    description: trimString(routineTemplate.title)
      ? `Routine completion: ${trimString(routineTemplate.title)}`
      : 'Routine completion',
    metadata: {
      routine_completion_id: trimString(completionRecord.id),
      routine_template_id: trimString(completionRecord.routine_template_id),
      date_key: trimString(completionRecord.date_key),
    },
  });
};

const getTrustedRoutineDateKey = (referenceDate, timezone) => {
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: trimString(timezone) || DEFAULT_TRUSTED_CHORE_SETTINGS.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date).reduce((resolved, part) => {
      if (part.type !== 'literal') {
        resolved[part.type] = part.value;
      }
      return resolved;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

const buildAllowancePeriodDocumentId = ({
  parentId,
  studentId,
  periodType,
  periodKey,
} = {}) => (
  [trimString(parentId), trimString(studentId), trimString(periodType), trimString(periodKey)]
    .filter(Boolean)
    .join('_')
);

const listActiveStudentRecordsForParent = async (parentId) => {
  const snapshot = await db.collection(COLLECTIONS.STUDENTS)
    .where('parent_id', '==', parentId)
    .where('is_active', '==', true)
    .get();

  return snapshot.docs.map(serializeTrustedDoc);
};

const syncAllowanceLedgerForStudents = async ({
  parentId,
  settings,
  studentRecords = [],
  referenceDate = new Date(),
  overridesByStudentId = {},
} = {}) => {
  const effectiveSettings = settings || await getTrustedParentChoreSettings(parentId);
  const effectiveStudentRecords = Array.isArray(studentRecords) && studentRecords.length
    ? studentRecords
    : await listActiveStudentRecordsForParent(parentId);

  if (!effectiveStudentRecords.length) {
    return [];
  }

  const allowancePolicy = effectiveSettings.allowance_policy || {};
  const period = resolveAllowancePeriod({
    referenceDate,
    allowancePolicy,
    weekConfig: effectiveSettings,
  });
  const [
    routineTemplates,
    routineCompletions,
    choreDefinitions,
    choreCompletions,
    allowancePeriodRecords,
  ] = await Promise.all([
    listParentCollectionRecords(COLLECTIONS.ROUTINE_TEMPLATES, parentId),
    listParentCollectionRecords(COLLECTIONS.ROUTINE_COMPLETIONS, parentId),
    listParentCollectionRecords(COLLECTIONS.CHORE_DEFINITIONS, parentId),
    listParentCollectionRecords(COLLECTIONS.CHORE_COMPLETIONS, parentId),
    listParentCollectionRecords(COLLECTIONS.ALLOWANCE_PERIODS, parentId),
  ]);
  const existingRecordLookup = new Map(
    allowancePeriodRecords
      .filter((record) => (
        trimString(record.period_type) === period.period_type &&
        trimString(record.period_key) === period.period_key
      ))
      .map((record) => [
        buildAllowancePeriodDocumentId({
          parentId,
          studentId: record.student_id,
          periodType: record.period_type,
          periodKey: record.period_key,
        }),
        record,
      ])
  );
  const batch = db.batch();
  const syncedRecords = [];

  effectiveStudentRecords.forEach((studentRecord) => {
    const studentId = trimString(studentRecord.id);
    if (!studentId) {
      return;
    }

    const existingRecord = existingRecordLookup.get(buildAllowancePeriodDocumentId({
      parentId,
      studentId,
      periodType: period.period_type,
      periodKey: period.period_key,
    })) || null;
    const nextRecord = buildAllowanceLedgerEntry({
      studentId,
      quota: effectiveSettings.quotas?.[studentId] || {},
      allowancePolicy,
      weekConfig: effectiveSettings,
      routineTemplates,
      routineCompletions,
      choreDefinitions,
      choreCompletions,
      existingRecord,
      overrides: overridesByStudentId[studentId] || {},
      referenceDate,
    });
    const recordId = buildAllowancePeriodDocumentId({
      parentId,
      studentId,
      periodType: nextRecord.period_type,
      periodKey: nextRecord.period_key,
    });
    const targetRef = db.collection(COLLECTIONS.ALLOWANCE_PERIODS).doc(recordId);
    const paidAtDate = nextRecord.paid_at instanceof Date
      ? nextRecord.paid_at
      : typeof nextRecord.paid_at?.toDate === 'function'
        ? nextRecord.paid_at.toDate()
        : (nextRecord.paid_at ? new Date(nextRecord.paid_at) : null);

    batch.set(targetRef, {
      id: recordId,
      parent_id: parentId,
      student_id: studentId,
      period_type: nextRecord.period_type,
      period_key: nextRecord.period_key,
      period_start: Timestamp.fromDate(nextRecord.period_start),
      period_end: Timestamp.fromDate(nextRecord.period_end),
      required_counts: nextRecord.required_counts,
      completed_counts: nextRecord.completed_counts,
      calculated_earned_amount: nextRecord.calculated_earned_amount,
      parent_adjustment_amount: nextRecord.parent_adjustment_amount,
      paid_amount: nextRecord.paid_amount,
      paid_status: nextRecord.paid_status,
      paid_at: paidAtDate && !Number.isNaN(paidAtDate.getTime())
        ? Timestamp.fromDate(paidAtDate)
        : null,
      policy_snapshot: nextRecord.policy_snapshot,
      updated_at: FieldValue.serverTimestamp(),
      created_at: existingRecord ? (existingRecord.created_at || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
    }, { merge: true });

    syncedRecords.push({
      ...nextRecord,
      id: recordId,
    });
  });

  if (syncedRecords.length) {
    await batch.commit();
  }

  return syncedRecords;
};

const assertParentOwnsReferencedSetupStudents = async (parentId, records = []) => {
  const studentIds = collectReferencedStudentIdsFromSetup(records);

  if (studentIds.length) {
    await assertParentOwnsStudents(parentId, studentIds);
  }
};

const normalizeTrustedProofAttachments = (value = []) => (
  Array.isArray(value)
    ? value.map((entry) => trimString(entry)).filter(Boolean).slice(0, 10)
    : []
);

const resolveTrustedStudentContext = async (payload = {}) => {
  const context = normalizeTrustedStudentChoreContextPayload(payload);

  if (!context.student_id && !context.slug) {
    throw new HttpsError(
      'invalid-argument',
      'A student_id or student slug is required for student chore access.'
    );
  }

  let studentSnapshot;
  if (context.student_id) {
    studentSnapshot = await db.collection(COLLECTIONS.STUDENTS).doc(context.student_id).get();
  } else {
    const slugSnapshot = await db.collection(COLLECTIONS.STUDENTS)
      .where('slug', '==', context.slug)
      .limit(1)
      .get();
    studentSnapshot = slugSnapshot.docs[0] || null;
  }

  if (!studentSnapshot?.exists) {
    throw new HttpsError('not-found', 'The requested student was not found.');
  }

  const studentRecord = serializeTrustedDoc(studentSnapshot);
  if (studentRecord.is_active === false) {
    throw new HttpsError('failed-precondition', 'This student portal is not active.');
  }

  const pinDecision = validateTrustedStudentPinContext({
    payload,
    studentRecord,
  });

  if (!pinDecision.ok) {
    throw new HttpsError('permission-denied', pinDecision.message);
  }

  return {
    studentId: studentSnapshot.id,
    parentId: trimString(studentRecord.parent_id),
    studentRecord,
  };
};

const assertTrustedSetupRecord = (record, requiredFields = []) => {
  const missingFields = validateRequiredTrustedFields(record, requiredFields);

  if (missingFields.length) {
    throw new HttpsError(
      'invalid-argument',
      `Missing required field(s): ${missingFields.join(', ')}.`
    );
  }
};

const setTrustedUpsertRecord = async ({
  collectionName,
  parentId,
  recordId,
  record,
} = {}) => {
  const targetRef = recordId
    ? db.collection(collectionName).doc(recordId)
    : db.collection(collectionName).doc();
  const targetSnapshot = await targetRef.get();
  const nowFields = {
    updated_at: FieldValue.serverTimestamp(),
  };

  if (targetSnapshot.exists && trimString(targetSnapshot.data()?.parent_id) !== parentId) {
    throw new HttpsError(
      'permission-denied',
      'You can only update setup records owned by your account.'
    );
  }

  if (!targetSnapshot.exists) {
    nowFields.created_at = FieldValue.serverTimestamp();
  }

  const trustedRecord = {
    ...record,
    id: targetRef.id,
    parent_id: parentId,
    ...nowFields,
  };

  await targetRef.set(trustedRecord, { merge: true });

  return {
    id: targetRef.id,
  };
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

const syncEntitlementFromSubscription = async (stripe, subscription, eventType = 'stripe_subscription_sync') => {
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
  const existingEntitlement = existingSnapshot.exists ? existingSnapshot.data() : {};
  const nowTimestamp = Timestamp.now();
  const billingState = buildEntitlementBillingState({
    planId,
    subscriptionStatus,
    billingProvider: BILLING_PROVIDERS.STRIPE,
    featureOverrides: existingEntitlement?.billing_state?.feature_overrides
      || existingEntitlement?.feature_overrides
      || {},
    trialEndsAt: toTimestampOrNull(subscription.trial_end),
    currentPeriodEnd: toTimestampOrNull(subscription.current_period_end),
    updatedAt: nowTimestamp,
  });
  const {
    entitlementDoc,
    hasExpiredManualOverride,
  } = buildEntitlementWriteForBillingSync({
    parentId,
    existingEntitlement,
    billingState,
    nowTimestamp,
    nowMillis: nowTimestamp.toMillis(),
  });
  const afterEntitlement = {
    ...existingEntitlement,
    ...entitlementDoc,
  };
  const batch = db.batch();

  batch.set(entitlementRef(parentId), entitlementDoc, { merge: true });
  queueEntitlementAuditWrite(batch, {
    parentId,
    eventType: ENTITLEMENT_AUDIT_EVENT_TYPES.BILLING_WEBHOOK_SYNC,
    reason: eventType,
    before: existingSnapshot.exists ? existingEntitlement : null,
    after: afterEntitlement,
    createdAt: nowTimestamp,
  });

  if (hasExpiredManualOverride) {
    queueEntitlementAuditWrite(batch, {
      parentId,
      eventType: ENTITLEMENT_AUDIT_EVENT_TYPES.OVERRIDE_EXPIRED,
      reason: 'manual override expired during billing webhook sync',
      before: existingSnapshot.exists ? existingEntitlement : null,
      after: afterEntitlement,
      createdAt: nowTimestamp,
    });
  }

  await batch.commit();
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
    curriculum_blocks: normalizeCurriculumBlocks(request.data?.curriculum_blocks || []),
    is_active: true,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const createdRef = await db.collection(COLLECTIONS.SUBJECTS).add(subjectDoc);

  return {
    id: createdRef.id,
  };
});

export const upsertChoreSettings = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseChores',
    'Chore pools, quotas, and allowance settings require Core or Lockdown.'
  );
  const parentSettings = await loadParentSettings(parentId);
  const settings = normalizeTrustedChoreSettingsPayload(request.data, parentSettings);

  await assertParentOwnsReferencedSetupStudents(parentId, [settings]);

  const settingsRef = getChoreSettingsRef(parentId);
  const settingsSnapshot = await settingsRef.get();
  const write = {
    ...settings,
    parent_id: parentId,
    updated_at: FieldValue.serverTimestamp(),
  };

  if (!settingsSnapshot.exists) {
    write.created_at = FieldValue.serverTimestamp();
  }

  await settingsRef.set(write, { merge: true });
  await syncAllowanceLedgerForStudents({
    parentId,
    settings,
    studentRecords: await listActiveStudentRecordsForParent(parentId),
    referenceDate: new Date(),
  });

  return {
    id: parentId,
    contract: TRUSTED_CHORE_CONTRACT,
  };
});

export const upsertRoutineTemplate = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  const { access } = await assertHouseholdModuleAccess(
    parentId,
    'canUseDailyRoutines',
    'Daily routines are not included in the current plan.'
  );
  const normalizedRoutineTemplate = normalizeTrustedRoutineTemplatePayload(request.data);
  const routineTemplate = {
    ...normalizedRoutineTemplate,
    counts_toward_allowance: access.canUseChores
      ? normalizedRoutineTemplate.counts_toward_allowance
      : false,
    counts_toward_points: access.canUseRewards
      ? normalizedRoutineTemplate.counts_toward_points
      : false,
  };

  assertTrustedSetupRecord(routineTemplate, ['title']);
  await assertParentOwnsReferencedSetupStudents(parentId, [routineTemplate]);

  const result = {
    contract: TRUSTED_CHORE_CONTRACT,
    ...(await setTrustedUpsertRecord({
      collectionName: COLLECTIONS.ROUTINE_TEMPLATES,
      parentId,
      recordId: routineTemplate.id,
      record: routineTemplate,
    })),
  };

  if (access.canUseChores) {
    await syncAllowanceLedgerForStudents({
      parentId,
      studentRecords: await listActiveStudentRecordsForParent(parentId),
      referenceDate: new Date(),
    });
  }

  return result;
});

export const upsertChoreDefinition = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseChores',
    'Weekly and monthly chore pools require Core or Lockdown.'
  );
  const choreDefinition = normalizeTrustedChoreDefinitionPayload(request.data);

  assertTrustedSetupRecord(choreDefinition, ['title']);

  if (!choreDefinition.all_students_eligible && !choreDefinition.eligible_student_ids.length) {
    throw new HttpsError(
      'invalid-argument',
      'A chore must be open to all students or include eligible_student_ids.'
    );
  }

  await assertParentOwnsReferencedSetupStudents(parentId, [choreDefinition]);

  const result = {
    contract: TRUSTED_CHORE_CONTRACT,
    ...(await setTrustedUpsertRecord({
      collectionName: COLLECTIONS.CHORE_DEFINITIONS,
      parentId,
      recordId: choreDefinition.id,
      record: choreDefinition,
    })),
  };

  await syncAllowanceLedgerForStudents({
    parentId,
    studentRecords: await listActiveStudentRecordsForParent(parentId),
    referenceDate: new Date(),
  });

  return result;
});

export const syncAllowanceLedger = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseChores',
    'Allowance tracking requires Core or Lockdown.'
  );
  const payload = normalizeTrustedAllowanceLedgerPayload(request.data);

  if (!payload.student_id) {
    const synced = await syncAllowanceLedgerForStudents({
      parentId,
      studentRecords: await listActiveStudentRecordsForParent(parentId),
      referenceDate: payload.reference_date || new Date(),
    });

    return {
      contract: TRUSTED_CHORE_CONTRACT,
      synced_count: synced.length,
    };
  }

  const studentSnapshot = await db.collection(COLLECTIONS.STUDENTS).doc(payload.student_id).get();
  if (!studentSnapshot.exists || trimString(studentSnapshot.data()?.parent_id) !== parentId) {
    throw new HttpsError('not-found', 'The requested student was not found.');
  }

  const override = {};
  if (Number.isFinite(payload.parent_adjustment_amount)) {
    override.parent_adjustment_amount = payload.parent_adjustment_amount;
  }
  if (Number.isFinite(payload.paid_amount)) {
    override.paid_amount = payload.paid_amount;
  }
  if (payload.mark_paid_at) {
    override.paid_at = new Date();
  }

  const synced = await syncAllowanceLedgerForStudents({
    parentId,
    studentRecords: [{
      id: studentSnapshot.id,
      ...studentSnapshot.data(),
    }],
    referenceDate: payload.reference_date || new Date(),
    overridesByStudentId: {
      [payload.student_id]: override,
    },
  });

  return {
    contract: TRUSTED_CHORE_CONTRACT,
    allowance_period: synced[0] || null,
  };
});

export const upsertRewardSettings = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseRewards',
    'Point and reward settings require Core or Lockdown.'
  );
  const rewardSettings = normalizeTrustedRewardSettingsPayload(request.data);
  const settingsRef = getRewardSettingsRef(parentId);
  const settingsSnapshot = await settingsRef.get();
  const write = {
    ...rewardSettings,
    parent_id: parentId,
    updated_at: FieldValue.serverTimestamp(),
  };

  if (!settingsSnapshot.exists) {
    write.created_at = FieldValue.serverTimestamp();
  }

  await settingsRef.set(write, { merge: true });

  return {
    id: parentId,
    contract: TRUSTED_CHORE_CONTRACT,
  };
});

export const adjustStudentPoints = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseRewards',
    'Manual point adjustments require Core or Lockdown.'
  );
  const payload = normalizeTrustedPointAdjustmentPayload(request.data);

  if (!payload.student_id) {
    throw new HttpsError('invalid-argument', 'A student_id is required for manual point adjustments.');
  }

  if (!Number.isFinite(payload.delta_points) || payload.delta_points === 0) {
    throw new HttpsError('invalid-argument', 'delta_points must be a non-zero whole number.');
  }

  const studentSnapshot = await db.collection(COLLECTIONS.STUDENTS).doc(payload.student_id).get();
  if (!studentSnapshot.exists || trimString(studentSnapshot.data()?.parent_id) !== parentId) {
    throw new HttpsError('not-found', 'The requested student was not found.');
  }

  const adjustmentSourceId = db.collection(COLLECTIONS.POINT_LEDGER_ENTRIES).doc().id;
  const result = await awardTrustedPointsForSource({
    parentId,
    studentId: payload.student_id,
    sourceType: POINT_SOURCE_TYPES.ADJUSTMENT,
    sourceId: adjustmentSourceId,
    deltaPoints: payload.delta_points,
    description: payload.description || 'Manual point adjustment',
    metadata: {
      adjustment_kind: 'manual_parent_adjustment',
      adjusted_by_parent_id: parentId,
    },
  });

  if (!result.awarded) {
    throw new HttpsError(
      result.reason === 'insufficient_points' ? 'failed-precondition' : 'invalid-argument',
      result.reason === 'insufficient_points'
        ? 'This adjustment would push the wallet below zero.'
        : 'The point adjustment could not be saved.',
      result
    );
  }

  return {
    contract: TRUSTED_CHORE_CONTRACT,
    point_ledger_entry_id: result.entry_id,
    total_points: result.total_points,
    lifetime_points: result.lifetime_points,
  };
});

export const upsertRewardCatalogItem = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseRewards',
    'Reward catalog management requires Core or Lockdown.'
  );
  const rewardCatalogItem = normalizeTrustedRewardCatalogItemPayload(request.data);

  assertTrustedSetupRecord(rewardCatalogItem, ['title']);
  await assertParentOwnsReferencedSetupStudents(parentId, [rewardCatalogItem]);

  if (rewardCatalogItem.type !== REWARD_CATALOG_ITEM_TYPES.PARENT_CREATED) {
    throw new HttpsError('invalid-argument', 'Built-in rewards are server-owned and cannot be edited here.');
  }

  const rewardCatalogItemRef = rewardCatalogItem.id
    ? getRewardCatalogItemRef(rewardCatalogItem.id)
    : db.collection(COLLECTIONS.REWARD_CATALOG_ITEMS).doc();

  const result = await db.runTransaction(async (transaction) => {
    const rewardCatalogItemSnapshot = await transaction.get(rewardCatalogItemRef);
    if (
      rewardCatalogItemSnapshot.exists &&
      trimString(rewardCatalogItemSnapshot.data()?.parent_id) !== parentId
    ) {
      throw new HttpsError(
        'permission-denied',
        'You can only update reward catalog items owned by your account.'
      );
    }

    const nextRewardCatalogItem = buildRewardCatalogItemUpdate({
      existingItem: rewardCatalogItemSnapshot.exists
        ? serializeTrustedDoc(rewardCatalogItemSnapshot)
        : null,
      payload: rewardCatalogItem,
    });

    transaction.set(rewardCatalogItemRef, {
      ...nextRewardCatalogItem,
      id: rewardCatalogItemRef.id,
      parent_id: parentId,
      created_at: rewardCatalogItemSnapshot.exists
        ? rewardCatalogItemSnapshot.data()?.created_at || FieldValue.serverTimestamp()
        : FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      id: rewardCatalogItemRef.id,
    };
  });

  return {
    contract: TRUSTED_CHORE_CONTRACT,
    ...result,
  };
});

export const requestRewardRedemption = onCall({ region: REGION }, async (request) => {
  const {
    studentId,
    parentId,
  } = await resolveTrustedStudentContext(request.data);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseRewards',
    'Reward redemptions require Core or Lockdown.'
  );
  const payload = normalizeTrustedRewardRequestPayload(request.data);

  if (!payload.reward_catalog_item_id) {
    throw new HttpsError('invalid-argument', 'A reward_catalog_item_id is required.');
  }

  const result = await db.runTransaction(async (transaction) => {
    const rewardCatalogQuery = db.collection(COLLECTIONS.REWARD_CATALOG_ITEMS)
      .where('parent_id', '==', parentId);
    const rewardRedemptionsQuery = db.collection(COLLECTIONS.REWARD_REDEMPTIONS)
      .where('parent_id', '==', parentId)
      .where('student_id', '==', studentId);
    const walletRef = getStudentPointWalletRef(studentId);
    const redemptionRef = db.collection(COLLECTIONS.REWARD_REDEMPTIONS).doc();

    const [rewardCatalogSnapshot, rewardRedemptionsSnapshot, walletSnapshot] = await Promise.all([
      transaction.get(rewardCatalogQuery),
      transaction.get(rewardRedemptionsQuery),
      transaction.get(walletRef),
    ]);

    const rewardCatalogItems = rewardCatalogSnapshot.docs.map(serializeTrustedDoc);
    const rewardRedemptions = rewardRedemptionsSnapshot.docs.map(serializeTrustedDoc);
    const wallet = normalizePointWallet(
      walletSnapshot.exists ? walletSnapshot.data() : {},
      studentId
    );
    const decision = buildRewardRequestDecision({
      rewardCatalogItems,
      rewardRedemptions,
      studentId,
      rewardCatalogItemId: payload.reward_catalog_item_id,
      walletPoints: wallet.total_points,
    });

    if (!decision.ok) {
      throw new HttpsError(
        decision.code === 'insufficient_points' ? 'failed-precondition' : 'failed-precondition',
        decision.code === 'insufficient_points'
          ? 'This reward costs more points than the current wallet balance.'
          : decision.code === 'out_of_stock'
            ? 'This reward is out of stock.'
            : decision.code === 'already_unlocked'
              ? 'This built-in reward is already unlocked.'
              : 'This reward is not available.'
      );
    }

    const rewardCatalogItem = decision.rewardCatalogItem;
    const reservationResult = await applyTrustedPointLedgerInTransaction({
      transaction,
      parentId,
      studentId,
      sourceType: decision.ledger_source_type,
      sourceId: redemptionRef.id,
      deltaPoints: rewardCatalogItem.point_cost * -1,
      description: trimString(rewardCatalogItem.title)
        ? `Reward redemption: ${trimString(rewardCatalogItem.title)}`
        : 'Reward redemption',
      metadata: {
        reward_catalog_item_id: trimString(rewardCatalogItem.id),
        reward_type: rewardCatalogItem.type,
      },
    });

    if (!reservationResult.applied) {
      throw new HttpsError(
        reservationResult.reason === 'insufficient_points' ? 'failed-precondition' : 'invalid-argument',
        reservationResult.reason === 'insufficient_points'
          ? 'This reward costs more points than the current wallet balance.'
          : 'The reward reservation could not be saved.'
      );
    }

    if (
      rewardCatalogItem.type === REWARD_CATALOG_ITEM_TYPES.PARENT_CREATED &&
      trimString(rewardCatalogItem.id)
    ) {
      transaction.set(getRewardCatalogItemRef(rewardCatalogItem.id), {
        available_quantity: Math.max(0, rewardCatalogItem.available_quantity - 1),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    const requestedAt = FieldValue.serverTimestamp();
    transaction.set(redemptionRef, {
      id: redemptionRef.id,
      ...buildRewardRedemptionWrite({
        parentId,
        studentId,
        rewardCatalogItem,
        status: decision.status,
        requestedAt,
      }),
      created_at: requestedAt,
      updated_at: requestedAt,
    });

    return {
      redemption_id: redemptionRef.id,
      status: decision.status,
      total_points: reservationResult.total_points,
      lifetime_points: reservationResult.lifetime_points,
    };
  });

  return {
    contract: TRUSTED_CHORE_CONTRACT,
    ...result,
  };
});

export const cancelRewardRedemption = onCall({ region: REGION }, async (request) => {
  const {
    studentId,
    parentId,
  } = await resolveTrustedStudentContext(request.data);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseRewards',
    'Reward redemptions require Core or Lockdown.'
  );
  const payload = normalizeTrustedRewardReviewPayload({
    ...request.data,
    action: 'cancel',
  });

  const result = await applyRewardRedemptionTransition({
    parentId,
    studentId,
    redemptionId: payload.redemption_id,
    action: 'cancel',
  });

  return {
    contract: TRUSTED_CHORE_CONTRACT,
    ...result,
  };
});

export const reviewRewardRedemption = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseRewards',
    'Reward review requires Core or Lockdown.'
  );
  const payload = normalizeTrustedRewardReviewPayload(request.data);

  if (!payload.redemption_id || !payload.action) {
    throw new HttpsError('invalid-argument', 'A redemption_id and action are required.');
  }

  const result = await applyRewardRedemptionTransition({
    parentId,
    redemptionId: payload.redemption_id,
    action: payload.action,
  });

  return {
    contract: TRUSTED_CHORE_CONTRACT,
    ...result,
  };
});

export const readStudentChoreState = onCall({ region: REGION }, async (request) => {
  const {
    studentId,
    parentId,
  } = await resolveTrustedStudentContext(request.data);
  const [{ access }, settings] = await Promise.all([
    assertHouseholdModuleAccess(
      parentId,
      'canUseDailyRoutines',
      'Daily routines are not included in the current plan.'
    ),
    getTrustedParentChoreSettings(parentId),
  ]);
  const weekConfig = normalizeTrustedChoreWeekConfig(settings);
  const [
    routineTemplates,
    routineCompletions,
    choreDefinitions,
    choreClaims,
    choreCompletions,
    allowancePeriods,
    pointWallets,
    rewardCatalogItems,
    rewardRedemptions,
  ] = await Promise.all([
    listParentCollectionRecords(COLLECTIONS.ROUTINE_TEMPLATES, parentId),
    listParentCollectionRecords(COLLECTIONS.ROUTINE_COMPLETIONS, parentId),
    listParentCollectionRecords(COLLECTIONS.CHORE_DEFINITIONS, parentId),
    listParentCollectionRecords(COLLECTIONS.CHORE_CLAIMS, parentId),
    listParentCollectionRecords(COLLECTIONS.CHORE_COMPLETIONS, parentId),
    listParentCollectionRecords(COLLECTIONS.ALLOWANCE_PERIODS, parentId),
    listParentCollectionRecords(COLLECTIONS.STUDENT_POINT_WALLETS, parentId),
    listParentCollectionRecords(COLLECTIONS.REWARD_CATALOG_ITEMS, parentId),
    listParentCollectionRecords(COLLECTIONS.REWARD_REDEMPTIONS, parentId),
  ]);

  const studentSafeView = buildTrustedStudentSafeChoreView({
    studentId,
    routineTemplates,
    routineCompletions,
    choreDefinitions: access.canUseChores ? choreDefinitions : [],
    choreClaims: access.canUseChores ? choreClaims : [],
    choreCompletions: access.canUseChores ? choreCompletions : [],
    allowancePeriods: access.canUseChores ? allowancePeriods : [],
    pointWallets: access.canUseRewards ? pointWallets : [],
    rewardCatalogItems: access.canUseRewards ? rewardCatalogItems : [],
    rewardRedemptions: access.canUseRewards ? rewardRedemptions : [],
    now: new Date(),
    weekConfig,
    claimExpirationHours: settings.claim_expiration_hours,
  });

  return {
    ...studentSafeView,
    rewards: access.canUseRewards
      ? studentSafeView.rewards
      : {
        wallet: {
          id: studentId,
          student_id: studentId,
          total_points: 0,
          lifetime_points: 0,
          updated_at: null,
        },
        catalog: [],
        myRedemptions: [],
      },
    access: {
      can_use_daily_routines: access.canUseDailyRoutines,
      can_use_chores: access.canUseChores,
      can_use_rewards: access.canUseRewards,
    },
  };
});

export const claimChore = onCall({ region: REGION }, async (request) => {
  const {
    studentId,
    parentId,
  } = await resolveTrustedStudentContext(request.data);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseChores',
    'Weekly and monthly chore pools require Core or Lockdown.'
  );
  const payload = normalizeTrustedChoreClaimPayload(request.data);

  if (!payload.chore_definition_id) {
    throw new HttpsError('invalid-argument', 'A chore_definition_id is required.');
  }

  const settings = await getTrustedParentChoreSettings(parentId);
  const now = Timestamp.now();
  const result = await db.runTransaction(async (transaction) => {
    const choreRef = db.collection(COLLECTIONS.CHORE_DEFINITIONS).doc(payload.chore_definition_id);
    const choreSnapshot = await transaction.get(choreRef);

    if (!choreSnapshot.exists || trimString(choreSnapshot.data()?.parent_id) !== parentId) {
      throw new HttpsError('not-found', 'The requested chore was not found.');
    }

    const [claimsSnapshot, completionsSnapshot] = await Promise.all([
      transaction.get(db.collection(COLLECTIONS.CHORE_CLAIMS)
        .where('parent_id', '==', parentId)
        .where('chore_definition_id', '==', payload.chore_definition_id)),
      transaction.get(db.collection(COLLECTIONS.CHORE_COMPLETIONS)
        .where('parent_id', '==', parentId)
        .where('chore_definition_id', '==', payload.chore_definition_id)),
    ]);
    const claims = claimsSnapshot.docs.map(serializeTrustedDoc);
    const completions = completionsSnapshot.docs.map(serializeTrustedDoc);
    const choreDefinition = serializeTrustedDoc(choreSnapshot);
    const decision = buildTrustedChoreClaimDecision({
      choreDefinition,
      studentId,
      claims,
      completions,
      now: now.toDate(),
      weekConfig: normalizeTrustedChoreWeekConfig(settings),
      claimExpirationHours: settings.claim_expiration_hours,
    });

    decision.expired_claim_ids.forEach((claimId) => {
      transaction.set(db.collection(COLLECTIONS.CHORE_CLAIMS).doc(claimId), {
        status: CHORE_CLAIM_STATUSES.EXPIRED,
        released_at: now,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    if (!decision.ok) {
      return decision;
    }

    const claimRef = db.collection(COLLECTIONS.CHORE_CLAIMS).doc();
    const expiresAtDate = new Date(decision.expires_at);

    transaction.set(claimRef, {
      id: claimRef.id,
      parent_id: parentId,
      student_id: studentId,
      chore_definition_id: payload.chore_definition_id,
      status: CHORE_CLAIM_STATUSES.CLAIMED,
      claim_expiration_hours: decision.claim_expiration_hours,
      claimed_at: now,
      expires_at: Number.isNaN(expiresAtDate.getTime()) ? null : Timestamp.fromDate(expiresAtDate),
      released_at: null,
      completed_at: null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    return {
      ...decision,
      claim_id: claimRef.id,
    };
  });

  if (!result.ok) {
    throw new HttpsError(
      'failed-precondition',
      `Chore claim was rejected: ${result.code}.`,
      result
    );
  }

  return {
    contract: TRUSTED_CHORE_CONTRACT,
    claim_id: result.claim_id,
    expires_at: result.expires_at,
  };
});

export const completeChore = onCall({ region: REGION }, async (request) => {
  const {
    studentId,
    parentId,
  } = await resolveTrustedStudentContext(request.data);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseChores',
    'Weekly and monthly chore pools require Core or Lockdown.'
  );
  const payload = normalizeTrustedChoreCompletionPayload(request.data);

  if (!payload.claim_id) {
    throw new HttpsError('invalid-argument', 'A claim_id is required to complete a chore.');
  }

  const settings = await getTrustedParentChoreSettings(parentId);
  const now = Timestamp.now();
  const result = await db.runTransaction(async (transaction) => {
    const claimRef = db.collection(COLLECTIONS.CHORE_CLAIMS).doc(payload.claim_id);
    const claimSnapshot = await transaction.get(claimRef);

    if (!claimSnapshot.exists || trimString(claimSnapshot.data()?.parent_id) !== parentId) {
      throw new HttpsError('not-found', 'The requested claim was not found.');
    }

    const claim = serializeTrustedDoc(claimSnapshot);
    const choreRef = db.collection(COLLECTIONS.CHORE_DEFINITIONS).doc(claim.chore_definition_id);
    const choreSnapshot = await transaction.get(choreRef);

    if (!choreSnapshot.exists || trimString(choreSnapshot.data()?.parent_id) !== parentId) {
      throw new HttpsError('not-found', 'The claimed chore was not found.');
    }

    const decision = buildTrustedChoreCompletionDecision({
      claim,
      choreDefinition: serializeTrustedDoc(choreSnapshot),
      studentId,
      now: now.toDate(),
      claimExpirationHours: settings.claim_expiration_hours,
    });

    if (!decision.ok) {
      if (decision.expired_claim_ids?.includes(payload.claim_id)) {
        transaction.set(claimRef, {
          status: CHORE_CLAIM_STATUSES.EXPIRED,
          released_at: now,
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      return decision;
    }

    const completionRef = db.collection(COLLECTIONS.CHORE_COMPLETIONS).doc();

    transaction.set(claimRef, {
      status: CHORE_CLAIM_STATUSES.COMPLETED,
      completed_at: now,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(completionRef, {
      id: completionRef.id,
      parent_id: parentId,
      student_id: studentId,
      chore_definition_id: claim.chore_definition_id,
      claim_id: payload.claim_id,
      status: decision.status,
      completed_at: now,
      approved_at: decision.final ? now : null,
      reviewed_at: decision.final ? now : null,
      proof_note: payload.proof_note,
      proof_attachments: normalizeTrustedProofAttachments(payload.proof_attachments),
      quota_blocks: decision.quota_blocks,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    return {
      ...decision,
      completion_id: completionRef.id,
      chore_definition_id: claim.chore_definition_id,
    };
  });

  if (!result.ok) {
    throw new HttpsError(
      'failed-precondition',
      `Chore completion was rejected: ${result.code}.`,
      result
    );
  }

  await syncAllowanceLedgerForStudents({
    parentId,
    studentRecords: [{ id: studentId }],
    referenceDate: now.toDate(),
  });

  if (result.final) {
    await awardTrustedPointsForChoreCompletion({
      id: result.completion_id,
      parent_id: parentId,
      student_id: studentId,
      chore_definition_id: result.chore_definition_id,
      claim_id: payload.claim_id,
      status: result.status,
    });
  }

  return {
    contract: TRUSTED_CHORE_CONTRACT,
    completion_id: result.completion_id,
    status: result.status,
    final: result.final,
  };
});

export const completeRoutine = onCall({ region: REGION }, async (request) => {
  const {
    studentId,
    parentId,
  } = await resolveTrustedStudentContext(request.data);
  const { access } = await assertHouseholdModuleAccess(
    parentId,
    'canUseDailyRoutines',
    'Daily routines are not included in the current plan.'
  );
  const payload = normalizeTrustedRoutineCompletionPayload(request.data);

  if (!payload.routine_template_id) {
    throw new HttpsError('invalid-argument', 'A routine_template_id is required.');
  }

  const settings = await getTrustedParentChoreSettings(parentId);
  const now = Timestamp.now();
  const dateKey = getTrustedRoutineDateKey(now.toDate(), settings.timezone);
  const completionId = `${payload.routine_template_id}_${studentId}_${dateKey}`;
  const result = await db.runTransaction(async (transaction) => {
    const routineRef = db.collection(COLLECTIONS.ROUTINE_TEMPLATES).doc(payload.routine_template_id);
    const completionRef = db.collection(COLLECTIONS.ROUTINE_COMPLETIONS).doc(completionId);
    const [routineSnapshot, completionSnapshot] = await Promise.all([
      transaction.get(routineRef),
      transaction.get(completionRef),
    ]);

    if (!routineSnapshot.exists || trimString(routineSnapshot.data()?.parent_id) !== parentId) {
      throw new HttpsError('not-found', 'The requested routine was not found.');
    }

    const routine = serializeTrustedDoc(routineSnapshot);
    const routineStudentIds = Array.isArray(routine.student_ids) ? routine.student_ids : [];

    if (routine.is_active === false || (routineStudentIds.length > 0 && !routineStudentIds.includes(studentId))) {
      throw new HttpsError(
        'failed-precondition',
        'This routine is not available to the verified student.'
      );
    }

    if (completionSnapshot.exists) {
      return {
        id: completionSnapshot.id,
        already_completed: true,
        routine,
      };
    }

    transaction.set(completionRef, {
      id: completionRef.id,
      parent_id: parentId,
      student_id: studentId,
      routine_template_id: payload.routine_template_id,
      date_key: dateKey,
      completed_item_ids: payload.completed_item_ids,
      completed_at: now,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    return {
      id: completionRef.id,
      already_completed: false,
      routine,
    };
  });

  if (access.canUseChores) {
    await syncAllowanceLedgerForStudents({
      parentId,
      studentRecords: [{ id: studentId }],
      referenceDate: now.toDate(),
    });
  }

  if (!result.already_completed && access.canUseRewards) {
    await awardTrustedPointsForRoutineCompletion({
      completionRecord: {
        id: result.id,
        parent_id: parentId,
        student_id: studentId,
        routine_template_id: payload.routine_template_id,
        date_key: dateKey,
      },
      routineTemplate: result.routine,
    });
  }

  return {
    contract: TRUSTED_CHORE_CONTRACT,
    routine_completion_id: result.id,
    date_key: dateKey,
    already_completed: result.already_completed,
  };
});

export const reviewChoreCompletion = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  await assertHouseholdModuleAccess(
    parentId,
    'canUseChores',
    'Chore completion review requires Core or Lockdown.'
  );
  const reviewPayload = normalizeTrustedChoreReviewPayload(request.data);

  if (!reviewPayload.completion_id) {
    throw new HttpsError('invalid-argument', 'A completion_id is required for parent review.');
  }

  const now = Timestamp.now();
  const result = await db.runTransaction(async (transaction) => {
    const completionRef = db.collection(COLLECTIONS.CHORE_COMPLETIONS).doc(reviewPayload.completion_id);
    const completionSnapshot = await transaction.get(completionRef);

    if (!completionSnapshot.exists || trimString(completionSnapshot.data()?.parent_id) !== parentId) {
      throw new HttpsError('not-found', 'The requested chore completion was not found.');
    }

    const completion = serializeTrustedDoc(completionSnapshot);
    const decision = buildTrustedChoreReviewDecision({
      completion,
      reviewPayload,
    });

    if (!decision.ok) {
      return decision;
    }

    transaction.set(completionRef, {
      status: decision.status,
      reviewed_at: now,
      approved_at: decision.status === CHORE_COMPLETION_STATUSES.APPROVED ? now : null,
      review_note: decision.review_note,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      ...decision,
      student_id: trimString(completion.student_id),
      chore_definition_id: trimString(completion.chore_definition_id),
      claim_id: trimString(completion.claim_id),
    };
  });

  if (!result.ok) {
    throw new HttpsError(
      'failed-precondition',
      `Chore review was rejected: ${result.code}.`,
      result
    );
  }

  await syncAllowanceLedgerForStudents({
    parentId,
    studentRecords: result.student_id ? [{ id: result.student_id }] : [],
    referenceDate: now.toDate(),
  });

  if (result.status === CHORE_COMPLETION_STATUSES.APPROVED) {
    await awardTrustedPointsForChoreCompletion({
      id: reviewPayload.completion_id,
      parent_id: parentId,
      student_id: result.student_id,
      chore_definition_id: result.chore_definition_id,
      claim_id: result.claim_id,
      status: result.status,
    });
  }

  return {
    contract: TRUSTED_CHORE_CONTRACT,
    completion_id: reviewPayload.completion_id,
    status: result.status,
  };
});

export const getOperatorSession = onCall({ region: REGION }, async (request) => {
  return ensureActiveOperator(request);
});

export const searchParentAccounts = onCall({ region: REGION }, async (request) => {
  await ensureActiveOperator(request);

  const query = normalizeOperatorSearchPayload(request.data);
  const results = await loadParentSearchResults(query);

  return {
    query,
    results,
  };
});

export const getOperatorEntitlementRecord = onCall({ region: REGION }, async (request) => {
  await ensureActiveOperator(request);

  const parentId = normalizeOperatorParentLookupPayload(request.data);
  return buildOperatorEntitlementDetail(parentId);
});

export const initializeEntitlementRecord = onCall({ region: REGION }, async (request) => {
  const operatorSession = await ensureActiveOperator(request);
  const { parentId, reason } = normalizeOperatorMutationPayload(request.data);
  const { usageSnapshot } = await loadParentUsageSnapshot(parentId);
  const nowTimestamp = Timestamp.now();
  let initialized = false;

  await db.runTransaction(async (transaction) => {
    const parentSnapshot = await transaction.get(db.collection(COLLECTIONS.PARENTS).doc(parentId));

    if (!parentSnapshot.exists) {
      throw new HttpsError('not-found', 'Parent account was not found.');
    }

    const existingEntitlementSnapshot = await transaction.get(entitlementRef(parentId));

    if (existingEntitlementSnapshot.exists) {
      return;
    }

    const entitlementDoc = buildFallbackEntitlementInitializationWrite({
      parentId,
      usageSnapshot,
      nowTimestamp,
    });

    transaction.set(entitlementRef(parentId), entitlementDoc);
    queueEntitlementAuditWrite(transaction, {
      parentId,
      operatorSession,
      eventType: ENTITLEMENT_AUDIT_EVENT_TYPES.RECORD_INITIALIZED,
      reason,
      before: null,
      after: entitlementDoc,
      createdAt: nowTimestamp,
    });
    initialized = true;
  });

  return {
    initialized,
    ...(await buildOperatorEntitlementDetail(parentId)),
  };
});

export const applyEntitlementOverride = onCall({ region: REGION }, async (request) => {
  const operatorSession = await ensureActiveOperator(request);
  const nowTimestamp = Timestamp.now();
  const parentId = normalizeOperatorParentId(request.data?.parent_id ?? request.data?.parentId);
  const overridePayload = normalizeOperatorEntitlementOverridePayload(request.data, {
    nowMillis: nowTimestamp.toMillis(),
  });
  const { usageSnapshot } = await loadParentUsageSnapshot(parentId);

  await db.runTransaction(async (transaction) => {
    const parentSnapshot = await transaction.get(db.collection(COLLECTIONS.PARENTS).doc(parentId));

    if (!parentSnapshot.exists) {
      throw new HttpsError('not-found', 'Parent account was not found.');
    }

    const existingEntitlementSnapshot = await transaction.get(entitlementRef(parentId));

    if (!existingEntitlementSnapshot.exists) {
      throw new HttpsError(
        'failed-precondition',
        'Initialize this parent entitlement record before applying a manual override.'
      );
    }

    const beforeEntitlement = existingEntitlementSnapshot.data();
    const entitlementDoc = buildEntitlementWriteForManualOverride({
      parentId,
      existingEntitlement: beforeEntitlement,
      overridePayload,
      operatorSession,
      usageSnapshot,
      nowTimestamp,
    });
    const afterEntitlement = {
      ...beforeEntitlement,
      ...entitlementDoc,
    };

    transaction.set(entitlementRef(parentId), entitlementDoc, { merge: true });
    queueEntitlementAuditWrite(transaction, {
      parentId,
      operatorSession,
      eventType: ENTITLEMENT_AUDIT_EVENT_TYPES.OVERRIDE_APPLIED,
      reason: overridePayload.reason,
      before: beforeEntitlement,
      after: afterEntitlement,
      createdAt: nowTimestamp,
    });
  });

  return {
    applied: true,
    ...(await buildOperatorEntitlementDetail(parentId)),
  };
});

export const clearEntitlementOverride = onCall({ region: REGION }, async (request) => {
  const operatorSession = await ensureActiveOperator(request);
  const { parentId, reason } = normalizeOperatorMutationPayload(request.data);
  const { usageSnapshot } = await loadParentUsageSnapshot(parentId);
  const nowTimestamp = Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const parentSnapshot = await transaction.get(db.collection(COLLECTIONS.PARENTS).doc(parentId));

    if (!parentSnapshot.exists) {
      throw new HttpsError('not-found', 'Parent account was not found.');
    }

    const existingEntitlementSnapshot = await transaction.get(entitlementRef(parentId));

    if (!existingEntitlementSnapshot.exists) {
      throw new HttpsError(
        'failed-precondition',
        'This parent account does not have an entitlement record to clear.'
      );
    }

    const beforeEntitlement = existingEntitlementSnapshot.data();

    if (!isPlainObject(beforeEntitlement.manual_override) || beforeEntitlement.manual_override.is_active !== true) {
      throw new HttpsError(
        'failed-precondition',
        'This parent account does not have an active manual override to clear.'
      );
    }

    const entitlementDoc = buildEntitlementWriteForOverrideClear({
      parentId,
      existingEntitlement: beforeEntitlement,
      usageSnapshot,
      nowTimestamp,
    });
    const afterEntitlement = {
      ...beforeEntitlement,
      ...entitlementDoc,
    };

    transaction.set(entitlementRef(parentId), entitlementDoc, { merge: true });
    queueEntitlementAuditWrite(transaction, {
      parentId,
      operatorSession,
      eventType: ENTITLEMENT_AUDIT_EVENT_TYPES.OVERRIDE_CLEARED,
      reason,
      before: beforeEntitlement,
      after: afterEntitlement,
      createdAt: nowTimestamp,
    });
  });

  return {
    cleared: true,
    ...(await buildOperatorEntitlementDetail(parentId)),
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

export const issueLockdownRecovery = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  const entitlementState = await getAccountEntitlementState(parentId);

  ensureLockdownExtensionEntitlement(entitlementState);

  const deviceId = trimString(request.data?.device_id);
  const requestedStudentId = trimString(request.data?.student_id);

  if (!deviceId) {
    throw new HttpsError('invalid-argument', 'A device_id is required to issue a recovery code.');
  }

  const deviceSnapshot = await lockdownDeviceRef(deviceId).get();
  if (!deviceSnapshot.exists) {
    throw new HttpsError('not-found', 'The requested device record was not found.');
  }

  const deviceRecord = deviceSnapshot.data() || {};
  const deviceParentId = trimString(deviceRecord.parent_id);
  const deviceStudentId = trimString(deviceRecord.student_id);

  if (deviceParentId !== parentId) {
    throw new HttpsError('permission-denied', 'You can only issue recovery codes for devices owned by your account.');
  }

  if (!deviceStudentId) {
    throw new HttpsError('failed-precondition', 'The requested device does not have a student binding.');
  }

  await loadLockdownStudentBinding({
    parentId,
    requestedStudentId: requestedStudentId || deviceStudentId,
    allowImplicitSingleStudent: false,
    allowUnboundFallback: false,
  });

  if (requestedStudentId && requestedStudentId !== deviceStudentId) {
    throw new HttpsError('invalid-argument', 'The requested recovery student does not match the device binding.');
  }

  const recoveryId = randomBytes(12).toString('hex');
  const recoveryCredential = buildOpaqueCredential(
    LOCKDOWN_TOKEN_PREFIXES.RECOVERY,
    recoveryId
  );
  const expiresAt = Timestamp.fromMillis(Date.now() + LOCKDOWN_RECOVERY_TTL_MS);

  await lockdownRecoveryRef(recoveryId).set({
    parent_id: parentId,
    student_id: deviceStudentId,
    device_id: deviceId,
    token_hash: recoveryCredential.tokenHash,
    status: LOCKDOWN_RECOVERY_STATUSES.PENDING,
    consumed_device_id: '',
    consumed_at: null,
    expires_at: expiresAt,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  return {
    contract: LOCKDOWN_CONTRACTS.TRUSTED_RECOVERY,
    recovery_token: recoveryCredential.token,
    expires_at: expiresAt.toDate().toISOString(),
    parent_id: parentId,
    student_id: deviceStudentId,
    device_id: deviceId,
  };
});

export const listLockdownDevices = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  const entitlementState = await getAccountEntitlementState(parentId);

  ensureLockdownExtensionEntitlement(entitlementState);

  const requestedStudentId = trimString(request.data?.student_id);
  if (requestedStudentId) {
    await loadLockdownStudentBinding({
      parentId,
      requestedStudentId,
      allowImplicitSingleStudent: false,
      allowUnboundFallback: false,
    });
  }

  let deviceQuery = db.collection(COLLECTIONS.LOCKDOWN_DEVICES)
    .where('parent_id', '==', parentId);

  if (requestedStudentId) {
    deviceQuery = deviceQuery.where('student_id', '==', requestedStudentId);
  }

  const snapshot = await deviceQuery.get();

  const devices = snapshot.docs
    .map((deviceSnapshot) => buildLockdownDeviceSummary(deviceSnapshot))
    .sort((left, right) => (
      (maxTimestampMillis(right.paired_at, right.last_seen_at, right.updated_at) || 0) -
      (maxTimestampMillis(left.paired_at, left.last_seen_at, left.updated_at) || 0)
    ));

  return {
    devices,
  };
});

export const revokeLockdownDevice = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  const entitlementState = await getAccountEntitlementState(parentId);

  ensureLockdownExtensionEntitlement(entitlementState);

  const deviceId = trimString(request.data?.device_id);
  if (!deviceId) {
    throw new HttpsError('invalid-argument', 'A device_id is required to revoke a device.');
  }

  const deviceRef = lockdownDeviceRef(deviceId);
  const deviceSnapshot = await deviceRef.get();

  if (!deviceSnapshot.exists) {
    throw new HttpsError('not-found', 'The requested device record was not found.');
  }

  const deviceRecord = deviceSnapshot.data() || {};
  if (trimString(deviceRecord.parent_id) !== parentId) {
    throw new HttpsError('permission-denied', 'You can only manage devices owned by your account.');
  }

  await deviceRef.set({
    status: LOCKDOWN_DEVICE_STATUSES.REVOKED,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    device_id: deviceId,
    status: LOCKDOWN_DEVICE_STATUSES.REVOKED,
  };
});

export const upsertLockdownResourceLibraryEntry = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  const entitlementState = await getAccountEntitlementState(parentId);

  ensureLockdownExtensionEntitlement(entitlementState);

  const { resource, error } = validateLockdownResourceLibraryEntryInput(
    request.data?.resource || request.data || {}
  );

  if (error) {
    throw new HttpsError('invalid-argument', error);
  }

  if (!resource.assign_to_all_students) {
    await assertParentOwnsStudents(parentId, resource.student_ids, { requireActive: true });
  }

  const resourceId = trimString(resource.id) || randomBytes(12).toString('hex');
  const resourceRef = lockdownResourceLibraryRef(resourceId);
  const existingSnapshot = await resourceRef.get();

  if (existingSnapshot.exists && trimString(existingSnapshot.data()?.parent_id) !== parentId) {
    throw new HttpsError('permission-denied', 'You can only manage resources owned by your account.');
  }

  await resourceRef.set({
    parent_id: parentId,
    name: resource.name,
    url: resource.url,
    lockdown_origin: resource.lockdown_origin,
    youtube_channel_id: resource.youtube_channel_id,
    youtube_channel_title: resource.youtube_channel_title,
    youtube_channel_handle: resource.youtube_channel_handle,
    assign_to_all_students: resource.assign_to_all_students,
    student_ids: resource.assign_to_all_students ? [] : resource.student_ids,
    is_active: resource.is_active !== false,
    updated_at: FieldValue.serverTimestamp(),
    created_at: existingSnapshot.exists
      ? (existingSnapshot.data()?.created_at || FieldValue.serverTimestamp())
      : FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    status: 'saved',
    resource: {
      id: resourceId,
      parent_id: parentId,
      ...resource,
      student_ids: resource.assign_to_all_students ? [] : resource.student_ids,
      is_active: resource.is_active !== false,
    },
  };
});

export const deleteLockdownResourceLibraryEntry = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  const entitlementState = await getAccountEntitlementState(parentId);

  ensureLockdownExtensionEntitlement(entitlementState);

  const resourceId = trimString(request.data?.resource_id);
  if (!resourceId) {
    throw new HttpsError('invalid-argument', 'A resource_id is required to remove a resource.');
  }

  const resourceRef = lockdownResourceLibraryRef(resourceId);
  const resourceSnapshot = await resourceRef.get();

  if (!resourceSnapshot.exists) {
    throw new HttpsError('not-found', 'The requested resource record was not found.');
  }

  if (trimString(resourceSnapshot.data()?.parent_id) !== parentId) {
    throw new HttpsError('permission-denied', 'You can only manage resources owned by your account.');
  }

  await resourceRef.delete();

  return {
    resource_id: resourceId,
    deleted: true,
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

export const lockdownRecoverDevicePairing = onRequest({
  region: REGION,
  invoker: 'public',
}, async (request, response) => {
  if (maybeHandleLockdownPreflight(request, response)) {
    return;
  }

  if (request.method !== 'POST') {
    sendLockdownError(response, 405, 'Use POST to validate recovery material.', 'method_not_allowed');
    return;
  }

  const body = readJsonBody(request);
  const parsedRecovery = parseOpaqueCredential(
    body.recovery_token,
    LOCKDOWN_TOKEN_PREFIXES.RECOVERY
  );
  const rawDeviceCredential = readBearerToken(request) || trimString(body.device_credential);
  const parsedDeviceCredential = parseOpaqueCredential(
    rawDeviceCredential,
    LOCKDOWN_TOKEN_PREFIXES.DEVICE
  );

  if (!parsedRecovery) {
    sendLockdownError(response, 400, 'Recovery token is invalid.', 'invalid_recovery_token');
    return;
  }

  if (!parsedDeviceCredential) {
    sendLockdownError(response, 401, 'Device credential is missing or invalid.', 'invalid_device_credential');
    return;
  }

  const recoverySnapshot = await lockdownRecoveryRef(parsedRecovery.documentId).get();
  if (!recoverySnapshot.exists) {
    sendLockdownError(response, 404, 'Recovery ticket was not found.', 'recovery_not_found');
    return;
  }

  const recoveryRecord = recoverySnapshot.data() || {};
  if (recoveryRecord.status === LOCKDOWN_RECOVERY_STATUSES.REVOKED) {
    sendLockdownError(response, 403, 'Recovery ticket was revoked.', 'recovery_revoked');
    return;
  }

  if (recoveryRecord.status === LOCKDOWN_RECOVERY_STATUSES.CONSUMED) {
    sendLockdownError(response, 409, 'Recovery ticket has already been used.', 'recovery_consumed');
    return;
  }

  if (isExpiredTimestamp(recoveryRecord.expires_at)) {
    await recoverySnapshot.ref.set({
      status: LOCKDOWN_RECOVERY_STATUSES.EXPIRED,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    sendLockdownError(response, 410, 'Recovery ticket expired.', 'recovery_expired');
    return;
  }

  if (!constantTimeHexEquals(recoveryRecord.token_hash, hashLockdownSecret(parsedRecovery.secret))) {
    sendLockdownError(response, 403, 'Recovery token is invalid.', 'invalid_recovery_token');
    return;
  }

  const recoveryDeviceId = trimString(recoveryRecord.device_id);
  if (parsedDeviceCredential.documentId !== recoveryDeviceId) {
    sendLockdownError(response, 403, 'Recovery token does not match this device.', 'wrong_device');
    return;
  }

  const deviceSnapshot = await lockdownDeviceRef(recoveryDeviceId).get();
  if (!deviceSnapshot.exists) {
    sendLockdownError(response, 404, 'Device record was not found.', 'device_not_found');
    return;
  }

  const deviceRecord = deviceSnapshot.data() || {};
  if (
    trimString(deviceRecord.parent_id) !== trimString(recoveryRecord.parent_id)
    || trimString(deviceRecord.student_id) !== trimString(recoveryRecord.student_id)
  ) {
    sendLockdownError(response, 403, 'Recovery token no longer matches this device binding.', 'wrong_device_binding');
    return;
  }

  if (!constantTimeHexEquals(deviceRecord.credential_hash, hashLockdownSecret(parsedDeviceCredential.secret))) {
    sendLockdownError(response, 401, 'Device credential is invalid.', 'invalid_device_credential');
    return;
  }

  try {
    await db.runTransaction(async (transaction) => {
      const freshRecoverySnapshot = await transaction.get(lockdownRecoveryRef(parsedRecovery.documentId));
      const freshDeviceSnapshot = await transaction.get(lockdownDeviceRef(recoveryDeviceId));
      if (!freshRecoverySnapshot.exists) {
        const error = new Error('recovery_not_found');
        error.code = 'recovery_not_found';
        throw error;
      }

      if (!freshDeviceSnapshot.exists) {
        const error = new Error('device_not_found');
        error.code = 'device_not_found';
        throw error;
      }

      const freshRecoveryRecord = freshRecoverySnapshot.data() || {};
      const freshDeviceRecord = freshDeviceSnapshot.data() || {};
      if (freshRecoveryRecord.status === LOCKDOWN_RECOVERY_STATUSES.CONSUMED) {
        const error = new Error('recovery_consumed');
        error.code = 'recovery_consumed';
        throw error;
      }

      if (freshRecoveryRecord.status === LOCKDOWN_RECOVERY_STATUSES.REVOKED) {
        const error = new Error('recovery_revoked');
        error.code = 'recovery_revoked';
        throw error;
      }

      if (isExpiredTimestamp(freshRecoveryRecord.expires_at)) {
        const error = new Error('recovery_expired');
        error.code = 'recovery_expired';
        throw error;
      }

      if (
        trimString(freshRecoveryRecord.parent_id) !== trimString(recoveryRecord.parent_id)
        || trimString(freshRecoveryRecord.student_id) !== trimString(recoveryRecord.student_id)
        || trimString(freshRecoveryRecord.device_id) !== recoveryDeviceId
        || trimString(freshDeviceRecord.parent_id) !== trimString(freshRecoveryRecord.parent_id)
        || trimString(freshDeviceRecord.student_id) !== trimString(freshRecoveryRecord.student_id)
      ) {
        const error = new Error('wrong_device_binding');
        error.code = 'wrong_device_binding';
        throw error;
      }

      if (!constantTimeHexEquals(freshDeviceRecord.credential_hash, hashLockdownSecret(parsedDeviceCredential.secret))) {
        const error = new Error('invalid_device_credential');
        error.code = 'invalid_device_credential';
        throw error;
      }

      transaction.set(freshRecoverySnapshot.ref, {
        status: LOCKDOWN_RECOVERY_STATUSES.CONSUMED,
        consumed_device_id: recoveryDeviceId,
        consumed_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  } catch (error) {
    if (error?.code === 'recovery_expired') {
      await recoverySnapshot.ref.set({
        status: LOCKDOWN_RECOVERY_STATUSES.EXPIRED,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });
      sendLockdownError(response, 410, 'Recovery ticket expired.', 'recovery_expired');
      return;
    }

    if (error?.code === 'recovery_consumed') {
      sendLockdownError(response, 409, 'Recovery ticket has already been used.', 'recovery_consumed');
      return;
    }

    if (error?.code === 'recovery_revoked') {
      sendLockdownError(response, 403, 'Recovery ticket was revoked.', 'recovery_revoked');
      return;
    }

    if (error?.code === 'recovery_not_found') {
      sendLockdownError(response, 404, 'Recovery ticket was not found.', 'recovery_not_found');
      return;
    }

    if (error?.code === 'device_not_found') {
      sendLockdownError(response, 404, 'Device record was not found.', 'device_not_found');
      return;
    }

    if (error?.code === 'invalid_device_credential') {
      sendLockdownError(response, 401, 'Device credential is invalid.', 'invalid_device_credential');
      return;
    }

    if (error?.code === 'wrong_device_binding') {
      sendLockdownError(response, 403, 'Recovery token no longer matches this device binding.', 'wrong_device_binding');
      return;
    }

    console.error('Trusted lockdown recovery validation failed:', error);
    sendLockdownError(response, 500, 'Recovery validation failed.', 'internal');
    return;
  }

  sendLockdownJson(response, 200, {
    contract: LOCKDOWN_CONTRACTS.TRUSTED_RECOVERY,
    status: 'recovered',
    parent_id: trimString(recoveryRecord.parent_id),
    student_id: trimString(recoveryRecord.student_id),
    device_id: recoveryDeviceId,
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
  const normalizedDeviceStatus = trimString(deviceRecord.status);
  if (normalizedDeviceStatus === LOCKDOWN_DEVICE_STATUSES.REVOKED) {
    sendLockdownError(response, 403, 'Device credential was revoked.', 'device_revoked');
    return;
  }

  if (normalizedDeviceStatus !== LOCKDOWN_DEVICE_STATUSES.ACTIVE) {
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
        await syncEntitlementFromSubscription(stripe, hydratedSubscription, event.type);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncEntitlementFromSubscription(stripe, event.data.object, event.type);
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
