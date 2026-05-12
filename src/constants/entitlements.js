export const PlanIds = Object.freeze({
  FREE: 'free',
  CORE: 'core',
  LOCKDOWN: 'lockdown',
});

export const DEFAULT_PLAN_ID = PlanIds.FREE;

export const EntitlementLimitKeys = Object.freeze({
  STUDENTS: 'students',
  CURRICULUM_ITEMS: 'curriculum_items',
});

export const EntitlementFeatureKeys = Object.freeze({
  PROJECTS: 'can_use_projects',
  LOCKDOWN_EXTENSION: 'can_use_lockdown_extension',
  LOCKDOWN_KIOSK: 'can_use_lockdown_kiosk',
});

export const LockdownEntitlementFeatureKeys = Object.freeze([
  EntitlementFeatureKeys.LOCKDOWN_EXTENSION,
  EntitlementFeatureKeys.LOCKDOWN_KIOSK,
]);

export const EntitlementFeatureStatus = Object.freeze({
  INCLUDED: 'included',
  LOCKED: 'locked',
});

export const EntitlementUpgradeKeys = Object.freeze({
  STUDENTS: EntitlementLimitKeys.STUDENTS,
  CURRICULUM_ITEMS: EntitlementLimitKeys.CURRICULUM_ITEMS,
  PROJECTS: 'projects',
  LOCKDOWN: 'lockdown',
});

export const SubscriptionStatuses = Object.freeze({
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
});

export const BillingProviders = Object.freeze({
  STRIPE: 'stripe',
});

export const UNLIMITED_PLAN_LIMIT = null;

const buildPlanDefinition = ({
  id,
  displayName,
  priceLabel,
  limits,
  features,
  upgradeCopy,
}) => Object.freeze({
  id,
  displayName,
  priceLabel,
  limits: Object.freeze({ ...limits }),
  features: Object.freeze({ ...features }),
  upgradeCopy: Object.freeze({ ...upgradeCopy }),
});

const buildFeatureDefinition = ({
  key,
  title,
  shortTitle,
  availableDescription,
  lockedDescription,
  availabilityNote,
  upgradeKey,
}) => Object.freeze({
  key,
  title,
  shortTitle,
  availableDescription,
  lockedDescription,
  availabilityNote,
  upgradeKey,
});

const buildSubscriptionStatusDefinition = ({
  label,
  tone,
  description,
}) => Object.freeze({
  label,
  tone,
  description,
});

export const EntitlementCatalog = Object.freeze({
  [PlanIds.FREE]: buildPlanDefinition({
    id: PlanIds.FREE,
    displayName: 'Free',
    priceLabel: '$0',
    limits: {
      [EntitlementLimitKeys.STUDENTS]: 2,
      [EntitlementLimitKeys.CURRICULUM_ITEMS]: 3,
    },
    features: {
      [EntitlementFeatureKeys.PROJECTS]: false,
      [EntitlementFeatureKeys.LOCKDOWN_EXTENSION]: false,
      [EntitlementFeatureKeys.LOCKDOWN_KIOSK]: false,
    },
    upgradeCopy: {
      [EntitlementUpgradeKeys.STUDENTS]: 'Upgrade to Core for up to 10 students.',
      [EntitlementUpgradeKeys.CURRICULUM_ITEMS]: 'Upgrade to Core for unlimited curriculum items.',
      [EntitlementUpgradeKeys.PROJECTS]: 'Upgrade to Core to unlock projects when they launch.',
      [EntitlementUpgradeKeys.LOCKDOWN]: 'Upgrade to Lockdown to unlock extension and kiosk controls.',
    },
  }),
  [PlanIds.CORE]: buildPlanDefinition({
    id: PlanIds.CORE,
    displayName: 'Core',
    priceLabel: '$5/month',
    limits: {
      [EntitlementLimitKeys.STUDENTS]: 10,
      [EntitlementLimitKeys.CURRICULUM_ITEMS]: UNLIMITED_PLAN_LIMIT,
    },
    features: {
      [EntitlementFeatureKeys.PROJECTS]: true,
      [EntitlementFeatureKeys.LOCKDOWN_EXTENSION]: false,
      [EntitlementFeatureKeys.LOCKDOWN_KIOSK]: false,
    },
    upgradeCopy: {
      [EntitlementUpgradeKeys.STUDENTS]: 'Core includes up to 10 students. Contact support if you need a larger household limit.',
      [EntitlementUpgradeKeys.CURRICULUM_ITEMS]: 'Core includes unlimited curriculum items.',
      [EntitlementUpgradeKeys.PROJECTS]: 'Projects are included with Core.',
      [EntitlementUpgradeKeys.LOCKDOWN]: 'Upgrade to Lockdown to unlock extension and kiosk controls.',
    },
  }),
  [PlanIds.LOCKDOWN]: buildPlanDefinition({
    id: PlanIds.LOCKDOWN,
    displayName: 'Lockdown',
    priceLabel: '$10/month',
    limits: {
      [EntitlementLimitKeys.STUDENTS]: 10,
      [EntitlementLimitKeys.CURRICULUM_ITEMS]: UNLIMITED_PLAN_LIMIT,
    },
    features: {
      [EntitlementFeatureKeys.PROJECTS]: true,
      [EntitlementFeatureKeys.LOCKDOWN_EXTENSION]: true,
      [EntitlementFeatureKeys.LOCKDOWN_KIOSK]: true,
    },
    upgradeCopy: {
      [EntitlementUpgradeKeys.STUDENTS]: 'Lockdown includes up to 10 students. Contact support if you need a larger household limit.',
      [EntitlementUpgradeKeys.CURRICULUM_ITEMS]: 'Lockdown includes unlimited curriculum items.',
      [EntitlementUpgradeKeys.PROJECTS]: 'Projects are included with Lockdown.',
      [EntitlementUpgradeKeys.LOCKDOWN]: 'Lockdown features are included with this plan.',
    },
  }),
});

export const EntitlementFeatureCatalog = Object.freeze({
  [EntitlementFeatureKeys.PROJECTS]: buildFeatureDefinition({
    key: EntitlementFeatureKeys.PROJECTS,
    title: 'Projects',
    shortTitle: 'Projects',
    availableDescription: 'Included in your plan when projects launch.',
    lockedDescription: 'Projects stay reserved for paid plans once that surface exists.',
    availabilityNote: 'No projects UI ships in this phase.',
    upgradeKey: EntitlementUpgradeKeys.PROJECTS,
  }),
  [EntitlementFeatureKeys.LOCKDOWN_EXTENSION]: buildFeatureDefinition({
    key: EntitlementFeatureKeys.LOCKDOWN_EXTENSION,
    title: 'Lockdown Extension',
    shortTitle: 'Extension',
    availableDescription: 'Included for extension pairing and browser-policy setup.',
    lockedDescription: 'Extension pairing and policy controls stay locked until the Lockdown plan is active.',
    availabilityNote: 'Saved Lockdown PoC controls become a plan-aware surface in this phase.',
    upgradeKey: EntitlementUpgradeKeys.LOCKDOWN,
  }),
  [EntitlementFeatureKeys.LOCKDOWN_KIOSK]: buildFeatureDefinition({
    key: EntitlementFeatureKeys.LOCKDOWN_KIOSK,
    title: 'Lockdown Kiosk',
    shortTitle: 'Kiosk',
    availableDescription: 'Included for future kiosk-device management flows.',
    lockedDescription: 'Kiosk configuration stays locked until the Lockdown plan is active.',
    availabilityNote: 'Kiosk management is still future work.',
    upgradeKey: EntitlementUpgradeKeys.LOCKDOWN,
  }),
});

export const SubscriptionStatusCatalog = Object.freeze({
  [SubscriptionStatuses.TRIALING]: buildSubscriptionStatusDefinition({
    label: 'Trialing',
    tone: 'accent',
    description: 'Your entitlement record is in a trial window.',
  }),
  [SubscriptionStatuses.ACTIVE]: buildSubscriptionStatusDefinition({
    label: 'Active',
    tone: 'neutral',
    description: 'Your entitlement record is active.',
  }),
  [SubscriptionStatuses.PAST_DUE]: buildSubscriptionStatusDefinition({
    label: 'Past Due',
    tone: 'warning',
    description: 'Billing needs attention to avoid interruptions later.',
  }),
  [SubscriptionStatuses.CANCELED]: buildSubscriptionStatusDefinition({
    label: 'Canceled',
    tone: 'warning',
    description: 'The account is no longer renewing and may drop to a lower plan later.',
  }),
  unknown: buildSubscriptionStatusDefinition({
    label: 'No Billing State',
    tone: 'muted',
    description: 'No provider-backed billing status is attached to this entitlement record yet.',
  }),
});

export const getEntitlementPlan = (planId = DEFAULT_PLAN_ID) => (
  EntitlementCatalog[planId] || EntitlementCatalog[DEFAULT_PLAN_ID]
);

export const getEntitlementFeatureDefinition = (featureKey) => (
  EntitlementFeatureCatalog[featureKey] || null
);

export const getPlanLimit = (planId, limitKey) => (
  getEntitlementPlan(planId).limits[limitKey] ?? UNLIMITED_PLAN_LIMIT
);

export const hasPlanFeature = (planId, featureKey) => (
  Boolean(getEntitlementPlan(planId).features[featureKey])
);

export const getUpgradeCopy = (planId, upgradeKey) => (
  getEntitlementPlan(planId).upgradeCopy[upgradeKey] || ''
);

export const getFeatureUpgradeCopy = (planId, featureKey) => {
  const featureDefinition = getEntitlementFeatureDefinition(featureKey);
  if (!featureDefinition?.upgradeKey) {
    return '';
  }

  return getUpgradeCopy(planId, featureDefinition.upgradeKey);
};

export const getLockdownUpgradeCopy = (planId) => (
  getUpgradeCopy(planId, EntitlementUpgradeKeys.LOCKDOWN)
);

export const getSubscriptionStatusDefinition = (subscriptionStatus) => (
  SubscriptionStatusCatalog[subscriptionStatus] || SubscriptionStatusCatalog.unknown
);

export const isUnlimitedPlanLimit = (limitValue) => limitValue == null;
