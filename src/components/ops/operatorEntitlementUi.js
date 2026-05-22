import {
  DEFAULT_PLAN_ID,
  EntitlementFeatureCatalog,
  EntitlementLimitKeys,
  getEntitlementPlan,
  getSubscriptionStatusDefinition,
  isUnlimitedPlanLimit,
} from '../../constants/entitlements.js';

export const OPS_STATE_LABELS = Object.freeze({
  effective: 'Effective State',
  billing: 'Billing State',
  manual: 'Manual Override',
});

export const OPS_FEATURE_KEYS = Object.freeze(Object.keys(EntitlementFeatureCatalog));

export const validateSupportReason = (value) => {
  const normalizedReason = String(value ?? '').trim();

  return {
    isValid: normalizedReason.length > 0,
    normalizedReason,
    message: normalizedReason ? '' : 'A non-empty support reason is required.',
  };
};

export const getPlanDisplayName = (planId) => getEntitlementPlan(planId).displayName;

export const getSubscriptionStatusLabel = (subscriptionStatus) => (
  getSubscriptionStatusDefinition(subscriptionStatus).label
);

export const normalizeFeatureSet = (features = {}) => (
  OPS_FEATURE_KEYS.reduce((normalizedFeatures, featureKey) => ({
    ...normalizedFeatures,
    [featureKey]: Boolean(features?.[featureKey]),
  }), {})
);

export const buildResolvedFeaturesForPlan = (planId = DEFAULT_PLAN_ID, featureOverrides = {}) => {
  const plan = getEntitlementPlan(planId);

  return normalizeFeatureSet({
    ...plan.features,
    ...featureOverrides,
  });
};

const coerceDate = (value) => {
  if (!value) return 'No expiration';

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return value.toDate();
    }

    const seconds = value.seconds ?? value._seconds;
    const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
    if (Number.isFinite(seconds)) {
      return new Date((seconds * 1000) + Math.floor(nanos / 1000000));
    }
  }

  return new Date(value);
};

const formatDateLabel = (value) => {
  if (!value) return 'No expiration';

  const date = coerceDate(value);
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getCurrentFeatureSet = (currentState = {}) => {
  if (currentState.features) {
    return normalizeFeatureSet(currentState.features);
  }

  return buildResolvedFeaturesForPlan(
    currentState.plan_id,
    currentState.feature_overrides
  );
};

const buildFeatureDiffs = (beforeFeatures, afterFeatures) => (
  OPS_FEATURE_KEYS
    .map((featureKey) => {
      const featureDefinition = EntitlementFeatureCatalog[featureKey];
      const before = Boolean(beforeFeatures[featureKey]);
      const after = Boolean(afterFeatures[featureKey]);

      return {
        key: featureKey,
        label: featureDefinition?.shortTitle || featureDefinition?.title || featureKey,
        before,
        after,
        beforeLabel: before ? 'Enabled' : 'Disabled',
        afterLabel: after ? 'Enabled' : 'Disabled',
        changed: before !== after,
      };
    })
    .filter((featureDiff) => featureDiff.changed)
);

export const buildOverrideDiffPreview = ({
  currentState = {},
  currentManualOverride = {},
  draftOverride = {},
} = {}) => {
  const beforePlanId = currentState.plan_id || DEFAULT_PLAN_ID;
  const afterPlanId = draftOverride.plan_id || DEFAULT_PLAN_ID;
  const beforeStatus = currentState.subscription_status ?? null;
  const afterStatus = draftOverride.subscription_status ?? null;
  const beforeFeatures = getCurrentFeatureSet(currentState);
  const afterFeatures = buildResolvedFeaturesForPlan(
    afterPlanId,
    draftOverride.feature_overrides
  );
  const featureChanges = buildFeatureDiffs(beforeFeatures, afterFeatures);
  const beforeExpiration = currentManualOverride?.is_active
    ? currentManualOverride.expires_at
    : null;
  const afterExpiration = draftOverride.expires_at || null;
  const beforeExpirationLabel = formatDateLabel(beforeExpiration);
  const afterExpirationLabel = formatDateLabel(afterExpiration);

  return [
    {
      key: 'plan',
      label: 'Plan',
      beforeValue: beforePlanId,
      afterValue: afterPlanId,
      beforeLabel: getPlanDisplayName(beforePlanId),
      afterLabel: getPlanDisplayName(afterPlanId),
      changed: beforePlanId !== afterPlanId,
    },
    {
      key: 'status',
      label: 'Status',
      beforeValue: beforeStatus,
      afterValue: afterStatus,
      beforeLabel: getSubscriptionStatusLabel(beforeStatus),
      afterLabel: getSubscriptionStatusLabel(afterStatus),
      changed: beforeStatus !== afterStatus,
    },
    {
      key: 'features',
      label: 'Features',
      beforeValue: beforeFeatures,
      afterValue: afterFeatures,
      beforeLabel: featureChanges.length
        ? `${featureChanges.length} feature change${featureChanges.length === 1 ? '' : 's'}`
        : 'No feature flag changes',
      afterLabel: featureChanges.length
        ? featureChanges
          .map((featureDiff) => `${featureDiff.label}: ${featureDiff.afterLabel}`)
          .join(', ')
        : 'No feature flag changes',
      changed: featureChanges.length > 0,
      changes: featureChanges,
    },
    {
      key: 'expiration',
      label: 'Expiration',
      beforeValue: beforeExpiration,
      afterValue: afterExpiration,
      beforeLabel: beforeExpirationLabel,
      afterLabel: afterExpirationLabel,
      changed: beforeExpirationLabel !== afterExpirationLabel,
    },
  ];
};

export const hasOverrideDiffChanges = (diffRows = []) => (
  diffRows.some((diffRow) => diffRow.changed)
);

const buildLimitWarning = ({
  code,
  label,
  usage,
  limit,
  planName,
}) => ({
  code,
  severity: 'warning',
  message: `${label} usage is ${usage}, above the ${planName} limit of ${limit}.`,
});

export const buildOverrideRiskWarnings = ({
  draftOverride = {},
  usageSummary = {},
  lockdownSummary = {},
} = {}) => {
  const planId = draftOverride.plan_id || DEFAULT_PLAN_ID;
  const plan = getEntitlementPlan(planId);
  const targetFeatures = buildResolvedFeaturesForPlan(planId, draftOverride.feature_overrides);
  const warnings = [];
  const studentLimit = plan.limits[EntitlementLimitKeys.STUDENTS];
  const curriculumLimit = plan.limits[EntitlementLimitKeys.CURRICULUM_ITEMS];
  const studentUsage = Number(usageSummary.students || 0);
  const curriculumUsage = Number(usageSummary.curriculum_items || 0);

  if (!isUnlimitedPlanLimit(studentLimit) && studentUsage > studentLimit) {
    warnings.push(buildLimitWarning({
      code: 'student_limit_exceeded',
      label: 'Student',
      usage: studentUsage,
      limit: studentLimit,
      planName: plan.displayName,
    }));
  }

  if (!isUnlimitedPlanLimit(curriculumLimit) && curriculumUsage > curriculumLimit) {
    warnings.push(buildLimitWarning({
      code: 'curriculum_limit_exceeded',
      label: 'Active curriculum',
      usage: curriculumUsage,
      limit: curriculumLimit,
      planName: plan.displayName,
    }));
  }

  if (
    lockdownSummary.has_saved_setup === true &&
    !targetFeatures.can_use_lockdown_extension &&
    !targetFeatures.can_use_lockdown_kiosk
  ) {
    warnings.push({
      code: 'lockdown_setup_would_be_disabled',
      severity: 'warning',
      message: 'This override removes Lockdown access while saved Lockdown setup exists.',
    });
  }

  return warnings;
};
