import {
  BillingProviders,
  DEFAULT_PLAN_ID,
  EntitlementFeatureKeys,
  EntitlementLimitKeys,
  EntitlementResolutionSources,
  getEntitlementPlan,
  getPlanLimit,
  getUpgradeCopy,
  isUnlimitedPlanLimit,
  SubscriptionStatuses,
} from '../constants/entitlements';

const DEFAULT_USAGE = Object.freeze({
  [EntitlementLimitKeys.STUDENTS]: 0,
  [EntitlementLimitKeys.CURRICULUM_ITEMS]: 0,
});

const DEFAULT_BILLING_STATE = Object.freeze({
  plan_id: DEFAULT_PLAN_ID,
  subscription_status: null,
  billing_provider: null,
  feature_overrides: Object.freeze({}),
  trial_ends_at: null,
  current_period_end: null,
  updated_at: null,
});

const isPlainObject = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const normalizeSubscriptionStatus = (subscriptionStatus) => (
  Object.values(SubscriptionStatuses).includes(subscriptionStatus)
    ? subscriptionStatus
    : null
);

const normalizeBillingProvider = (billingProvider) => (
  billingProvider === BillingProviders.STRIPE ? BillingProviders.STRIPE : null
);

export const normalizeEntitlementBillingState = (billingState = null) => {
  if (!isPlainObject(billingState)) {
    return null;
  }

  return {
    plan_id: normalizeEntitlementPlanId(billingState.plan_id),
    subscription_status: normalizeSubscriptionStatus(billingState.subscription_status),
    billing_provider: normalizeBillingProvider(billingState.billing_provider),
    feature_overrides: isPlainObject(billingState.feature_overrides)
      ? billingState.feature_overrides
      : {},
    trial_ends_at: billingState.trial_ends_at || null,
    current_period_end: billingState.current_period_end || null,
    updated_at: billingState.updated_at || null,
  };
};

export const isArchivedSubject = (subject) => {
  if (!subject || typeof subject !== 'object') {
    return false;
  }

  return (
    subject.is_archived === true
    || subject.archived === true
    || subject.status === 'archived'
    || subject.archived_at != null
  );
};

export const isActiveCurriculumSubject = (subject) => {
  if (!subject || typeof subject !== 'object') {
    return false;
  }

  if (subject.is_active === false) {
    return false;
  }

  return !isArchivedSubject(subject);
};

export const countActiveCurriculumSubjects = (subjects = []) => {
  if (!Array.isArray(subjects)) {
    return 0;
  }

  return subjects.reduce((total, subject) => (
    total + (isActiveCurriculumSubject(subject) ? 1 : 0)
  ), 0);
};

export const deriveEntitlementUsage = ({ students = [], subjects = [] } = {}) => ({
  [EntitlementLimitKeys.STUDENTS]: Array.isArray(students) ? students.length : 0,
  [EntitlementLimitKeys.CURRICULUM_ITEMS]: countActiveCurriculumSubjects(subjects),
});

export const normalizeEntitlementPlanId = (planId) => getEntitlementPlan(planId).id;

export const resolveEntitlementFeatures = (planId = DEFAULT_PLAN_ID, featureOverrides = {}) => {
  const planFeatures = getEntitlementPlan(planId).features;

  return Object.values(EntitlementFeatureKeys).reduce((resolvedFeatures, featureKey) => {
    const overrideValue = featureOverrides?.[featureKey];

    resolvedFeatures[featureKey] = (
      typeof overrideValue === 'boolean'
        ? overrideValue
        : Boolean(planFeatures[featureKey])
    );

    return resolvedFeatures;
  }, {});
};

export const buildEntitlementLimitCheck = ({
  planId = DEFAULT_PLAN_ID,
  limitKey,
  usage = 0,
} = {}) => {
  const limit = getPlanLimit(planId, limitKey);
  const isUnlimited = isUnlimitedPlanLimit(limit);
  const normalizedUsage = Number.isFinite(usage) ? usage : 0;

  return {
    limitKey,
    limit,
    usage: normalizedUsage,
    isUnlimited,
    remaining: isUnlimited ? null : Math.max(limit - normalizedUsage, 0),
    hasReachedLimit: !isUnlimited && normalizedUsage >= limit,
    isOverLimit: !isUnlimited && normalizedUsage > limit,
    upgradeCopy: getUpgradeCopy(planId, limitKey),
  };
};

export const buildEntitlementLimitChecks = ({
  planId = DEFAULT_PLAN_ID,
  usage = DEFAULT_USAGE,
} = {}) => ({
  [EntitlementLimitKeys.STUDENTS]: buildEntitlementLimitCheck({
    planId,
    limitKey: EntitlementLimitKeys.STUDENTS,
    usage: usage[EntitlementLimitKeys.STUDENTS],
  }),
  [EntitlementLimitKeys.CURRICULUM_ITEMS]: buildEntitlementLimitCheck({
    planId,
    limitKey: EntitlementLimitKeys.CURRICULUM_ITEMS,
    usage: usage[EntitlementLimitKeys.CURRICULUM_ITEMS],
  }),
});

export const hasReachedEntitlementLimit = (limitChecks = {}, limitKey) => (
  Boolean(limitChecks[limitKey]?.hasReachedLimit)
);

export const isWithinEntitlementLimit = (limitChecks = {}, limitKey) => (
  !hasReachedEntitlementLimit(limitChecks, limitKey)
);

export const buildEntitlementUsageSummary = ({
  limitCheck,
  nounSingular,
  nounPlural,
  planName,
} = {}) => {
  if (!limitCheck) {
    return '';
  }

  const resolvedPlural = nounPlural || `${nounSingular}s`;

  if (limitCheck.isUnlimited) {
    return `${limitCheck.usage} ${resolvedPlural} used on the ${planName} plan.`;
  }

  return `${limitCheck.usage} of ${limitCheck.limit} ${resolvedPlural} used on the ${planName} plan.`;
};

export const resolveEntitlementState = ({
  entitlementDoc = null,
  students = [],
  subjects = [],
} = {}) => {
  const planId = normalizeEntitlementPlanId(entitlementDoc?.plan_id);
  const plan = getEntitlementPlan(planId);
  const usage = deriveEntitlementUsage({ students, subjects });
  const limitChecks = buildEntitlementLimitChecks({ planId, usage });
  const billingState = normalizeEntitlementBillingState(entitlementDoc?.billing_state);

  return {
    planId,
    plan,
    limits: plan.limits,
    features: resolveEntitlementFeatures(planId, entitlementDoc?.feature_overrides),
    usage,
    usageSnapshot: {
      [EntitlementLimitKeys.STUDENTS]: entitlementDoc?.usage_snapshot?.students ?? 0,
      [EntitlementLimitKeys.CURRICULUM_ITEMS]: entitlementDoc?.usage_snapshot?.curriculum_items ?? 0,
    },
    limitChecks,
    subscriptionStatus: entitlementDoc?.subscription_status || null,
    billingProvider: entitlementDoc?.billing_provider || null,
    trialEndsAt: entitlementDoc?.trial_ends_at || null,
    currentPeriodEnd: entitlementDoc?.current_period_end || null,
    featureOverrides: entitlementDoc?.feature_overrides || {},
    billingState: billingState || DEFAULT_BILLING_STATE,
    manualOverride: isPlainObject(entitlementDoc?.manual_override)
      ? entitlementDoc.manual_override
      : null,
    resolutionSource: entitlementDoc?.resolution_source || (
      entitlementDoc
        ? EntitlementResolutionSources.BILLING
        : EntitlementResolutionSources.FALLBACK_INITIALIZED
    ),
    updatedVia: entitlementDoc?.updated_via || null,
    isFreePlanFallback: !entitlementDoc,
  };
};
