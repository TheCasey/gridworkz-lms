import { BookOpen, Calendar, CalendarDays, FileText, Home, ListTodo, Shield } from 'lucide-react';
import { EntitlementFeatureKeys, LockdownEntitlementFeatureKeys } from './entitlements.js';

export const DASHBOARD_DEFAULT_FEATURE_ID = 'students';
export const DASHBOARD_FEATURE_STATES = Object.freeze({
  VISIBLE: 'visible',
  LOCKED: 'locked',
  HIDDEN: 'hidden',
});
export const DASHBOARD_FEATURE_GATE_MATCH = Object.freeze({
  ALL: 'all',
  ANY: 'any',
});
export const DASHBOARD_HEADER_FILTERS = Object.freeze({
  WEEK_RANGE: 'week-range',
});

export const DASHBOARD_HEADER_ACTIONS = Object.freeze({
  ADD_STUDENT: 'add-student',
  DOWNLOAD_WEEKLY_REPORT: 'download-weekly-report',
  VIEW_REPORTS: 'view-reports',
});

export const DASHBOARD_HEADER_NOTICES = Object.freeze({
  STUDENT_PLAN_USAGE: 'student-plan-usage',
});

export const DASHBOARD_RIGHT_RAIL_MODES = Object.freeze({
  NONE: 'none',
  LIVE_PULSE: 'live-pulse',
});
export const DASHBOARD_NAV_BADGES = Object.freeze({
  COMING_SOON: 'coming-soon',
});
export const DASHBOARD_CHORES_CHILD_FEATURE_IDS = Object.freeze({
  DAILY_ROUTINES: 'daily-routines',
  WEEKLY_CHORES: 'weekly-chores',
  MONTHLY_CHORES: 'monthly-chores',
  ALLOWANCE: 'allowance',
  REWARDS: 'rewards',
});

const buildDashboardEntitlementGate = ({
  requiredFeatureKeys = [],
  match = DASHBOARD_FEATURE_GATE_MATCH.ALL,
  fallbackState = DASHBOARD_FEATURE_STATES.LOCKED,
} = {}) => ({
  requiredFeatureKeys: [...requiredFeatureKeys],
  match,
  fallbackState,
});

const buildDashboardShellConfig = ({
  primaryAction = null,
  secondaryActions = [],
  filters = [],
  notices = [],
  rightRailMode = DASHBOARD_RIGHT_RAIL_MODES.NONE,
} = {}) => ({
  headerSlots: {
    primaryAction,
    secondaryActions: [...secondaryActions],
    filters: [...filters],
    notices: [...notices],
  },
  rightRail: {
    mode: rightRailMode,
  },
});

const buildDashboardNavigationFeatureItem = ({
  featureId,
  badge = null,
  children = [],
} = {}) => ({
  kind: 'feature',
  featureId,
  badge,
  children: [...children],
});

export const dashboardFeatures = [
  {
    id: 'students',
    label: 'Students',
    path: 'students',
    icon: Home,
    header: {
      title: 'Students',
      description: 'Manage your student accounts and access',
    },
    shell: buildDashboardShellConfig({
      primaryAction: DASHBOARD_HEADER_ACTIONS.ADD_STUDENT,
      secondaryActions: [
        DASHBOARD_HEADER_ACTIONS.DOWNLOAD_WEEKLY_REPORT,
        DASHBOARD_HEADER_ACTIONS.VIEW_REPORTS,
      ],
      filters: [DASHBOARD_HEADER_FILTERS.WEEK_RANGE],
      notices: [DASHBOARD_HEADER_NOTICES.STUDENT_PLAN_USAGE],
    }),
  },
  {
    id: 'homeschool',
    label: 'Homeschool',
    path: 'homeschool',
    icon: BookOpen,
    header: {
      title: 'Homeschool',
      description: 'Enter the school planning area and jump into curriculum, weekly blocking, and reports.',
    },
    shell: buildDashboardShellConfig(),
  },
  {
    id: 'curriculum',
    label: 'Curriculum',
    path: 'curriculum',
    icon: BookOpen,
    header: {
      title: 'Curriculum',
      description: 'Manage subjects and learning resources',
    },
    shell: buildDashboardShellConfig(),
  },
  {
    id: 'weekly-blocking',
    label: 'Weekly Blocking',
    path: 'weekly-blocking',
    icon: CalendarDays,
    header: {
      title: 'Weekly Blocking',
      description: 'Publish one student-week at a time from the current subject block plan.',
    },
    shell: buildDashboardShellConfig(),
  },
  {
    id: 'reports',
    label: 'Reports',
    path: 'reports',
    icon: FileText,
    header: {
      title: 'Reports',
      description: 'View weekly reports and student progress',
    },
    shell: buildDashboardShellConfig(),
  },
  {
    id: 'chores',
    label: 'Chores',
    path: 'chores',
    icon: ListTodo,
    header: {
      title: 'Chores',
      description: 'Manage household routines, chore pools, quotas, and pending parent review',
    },
    shell: buildDashboardShellConfig(),
    entitlementGate: buildDashboardEntitlementGate({
      requiredFeatureKeys: [
        EntitlementFeatureKeys.DAILY_ROUTINES,
        EntitlementFeatureKeys.CHORES,
        EntitlementFeatureKeys.REWARDS,
      ],
      match: DASHBOARD_FEATURE_GATE_MATCH.ANY,
      fallbackState: DASHBOARD_FEATURE_STATES.LOCKED,
    }),
  },
  {
    id: DASHBOARD_CHORES_CHILD_FEATURE_IDS.DAILY_ROUTINES,
    label: 'Daily Routines',
    path: `chores/${DASHBOARD_CHORES_CHILD_FEATURE_IDS.DAILY_ROUTINES}`,
    icon: ListTodo,
    header: {
      title: 'Daily Routines',
      description: 'Review grouped routine templates and keep daily checklist setup current.',
    },
    shell: buildDashboardShellConfig(),
    entitlementGate: buildDashboardEntitlementGate({
      requiredFeatureKeys: [
        EntitlementFeatureKeys.DAILY_ROUTINES,
        EntitlementFeatureKeys.CHORES,
      ],
      match: DASHBOARD_FEATURE_GATE_MATCH.ANY,
      fallbackState: DASHBOARD_FEATURE_STATES.LOCKED,
    }),
  },
  {
    id: DASHBOARD_CHORES_CHILD_FEATURE_IDS.WEEKLY_CHORES,
    label: 'Weekly Chores',
    path: `chores/${DASHBOARD_CHORES_CHILD_FEATURE_IDS.WEEKLY_CHORES}`,
    icon: ListTodo,
    header: {
      title: 'Weekly Chores',
      description: 'Define the shared weekly chore pool and review weekly approvals.',
    },
    shell: buildDashboardShellConfig(),
    entitlementGate: buildDashboardEntitlementGate({
      requiredFeatureKeys: [EntitlementFeatureKeys.CHORES],
      fallbackState: DASHBOARD_FEATURE_STATES.LOCKED,
    }),
  },
  {
    id: DASHBOARD_CHORES_CHILD_FEATURE_IDS.MONTHLY_CHORES,
    label: 'Monthly Chores',
    path: `chores/${DASHBOARD_CHORES_CHILD_FEATURE_IDS.MONTHLY_CHORES}`,
    icon: ListTodo,
    header: {
      title: 'Monthly Chores',
      description: 'Define the shared monthly chore pool and review monthly approvals.',
    },
    shell: buildDashboardShellConfig(),
    entitlementGate: buildDashboardEntitlementGate({
      requiredFeatureKeys: [EntitlementFeatureKeys.CHORES],
      fallbackState: DASHBOARD_FEATURE_STATES.LOCKED,
    }),
  },
  {
    id: DASHBOARD_CHORES_CHILD_FEATURE_IDS.ALLOWANCE,
    label: 'Allowance',
    path: `chores/${DASHBOARD_CHORES_CHILD_FEATURE_IDS.ALLOWANCE}`,
    icon: Calendar,
    header: {
      title: 'Allowance',
      description: 'Configure quotas and allowance policy, then review trusted current-period ledger totals.',
    },
    shell: buildDashboardShellConfig(),
    entitlementGate: buildDashboardEntitlementGate({
      requiredFeatureKeys: [EntitlementFeatureKeys.CHORES],
      fallbackState: DASHBOARD_FEATURE_STATES.LOCKED,
    }),
  },
  {
    id: DASHBOARD_CHORES_CHILD_FEATURE_IDS.REWARDS,
    label: 'Rewards',
    path: `chores/${DASHBOARD_CHORES_CHILD_FEATURE_IDS.REWARDS}`,
    icon: ListTodo,
    header: {
      title: 'Rewards',
      description: 'Manage point settings, parent rewards, and reward redemption follow-through.',
    },
    shell: buildDashboardShellConfig(),
    entitlementGate: buildDashboardEntitlementGate({
      requiredFeatureKeys: [EntitlementFeatureKeys.REWARDS],
      fallbackState: DASHBOARD_FEATURE_STATES.LOCKED,
    }),
  },
  {
    id: 'settings',
    label: 'Account Settings',
    path: 'settings',
    icon: Calendar,
    header: {
      title: 'Account Settings',
      description: 'Review plan visibility, account usage, and school calendar settings.',
    },
    shell: buildDashboardShellConfig(),
  },
  {
    id: 'lockdown',
    label: 'Lockdown',
    path: 'lockdown',
    icon: Shield,
    header: {
      title: 'Lockdown',
      description: 'Review the live Lockdown preview, current access, and student-bound pairing while the broader tier remains coming soon.',
    },
    shell: buildDashboardShellConfig(),
    entitlementGate: buildDashboardEntitlementGate({
      requiredFeatureKeys: LockdownEntitlementFeatureKeys,
      match: DASHBOARD_FEATURE_GATE_MATCH.ANY,
      fallbackState: DASHBOARD_FEATURE_STATES.LOCKED,
    }),
  },
];

export const dashboardNavigationSections = [
  buildDashboardNavigationFeatureItem({
    featureId: 'students',
  }),
  buildDashboardNavigationFeatureItem({
    featureId: 'homeschool',
    children: [
      buildDashboardNavigationFeatureItem({ featureId: 'curriculum' }),
      buildDashboardNavigationFeatureItem({ featureId: 'weekly-blocking' }),
      buildDashboardNavigationFeatureItem({ featureId: 'reports' }),
    ],
  }),
  buildDashboardNavigationFeatureItem({
    featureId: 'chores',
    children: [
      buildDashboardNavigationFeatureItem({
        featureId: DASHBOARD_CHORES_CHILD_FEATURE_IDS.DAILY_ROUTINES,
      }),
      buildDashboardNavigationFeatureItem({
        featureId: DASHBOARD_CHORES_CHILD_FEATURE_IDS.WEEKLY_CHORES,
      }),
      buildDashboardNavigationFeatureItem({
        featureId: DASHBOARD_CHORES_CHILD_FEATURE_IDS.MONTHLY_CHORES,
      }),
      buildDashboardNavigationFeatureItem({
        featureId: DASHBOARD_CHORES_CHILD_FEATURE_IDS.ALLOWANCE,
      }),
      buildDashboardNavigationFeatureItem({
        featureId: DASHBOARD_CHORES_CHILD_FEATURE_IDS.REWARDS,
      }),
    ],
  }),
  buildDashboardNavigationFeatureItem({
    featureId: 'lockdown',
    badge: DASHBOARD_NAV_BADGES.COMING_SOON,
  }),
];

export const dashboardFeaturesById = Object.fromEntries(
  dashboardFeatures.map((feature) => [feature.id, feature])
);

export const dashboardFeaturesByPath = Object.fromEntries(
  dashboardFeatures.map((feature) => [feature.path, feature])
);

export const getDashboardFeatureByPath = (featurePath) =>
  dashboardFeaturesByPath[featurePath] || dashboardFeaturesById[DASHBOARD_DEFAULT_FEATURE_ID];

export const resolveDashboardFeatureState = (feature, { featureAccess = {} } = {}) => {
  const entitlementGate = feature?.entitlementGate;
  const requiredFeatureKeys = entitlementGate?.requiredFeatureKeys || [];

  if (!requiredFeatureKeys.length) {
    return DASHBOARD_FEATURE_STATES.VISIBLE;
  }

  const isFeatureEnabled = (featureKey) => Boolean(featureAccess?.[featureKey]?.isEnabled);
  const satisfiesGate = entitlementGate.match === DASHBOARD_FEATURE_GATE_MATCH.ANY
    ? requiredFeatureKeys.some(isFeatureEnabled)
    : requiredFeatureKeys.every(isFeatureEnabled);

  if (satisfiesGate) {
    return DASHBOARD_FEATURE_STATES.VISIBLE;
  }

  return entitlementGate?.fallbackState || DASHBOARD_FEATURE_STATES.LOCKED;
};

export const resolveDashboardFeatures = ({ featureAccess = {} } = {}) => (
  dashboardFeatures.map((feature) => {
    const shellState = resolveDashboardFeatureState(feature, { featureAccess });

    return {
      ...feature,
      shellState,
      isVisible: shellState === DASHBOARD_FEATURE_STATES.VISIBLE,
      isLocked: shellState === DASHBOARD_FEATURE_STATES.LOCKED,
      isHidden: shellState === DASHBOARD_FEATURE_STATES.HIDDEN,
    };
  })
);

const resolveDashboardNavigationItem = (item, resolvedFeaturesById, sectionId) => {
  if (item.kind === 'placeholder') {
    return {
      ...item,
      sectionId,
      isPlaceholder: true,
    };
  }

  const feature = resolvedFeaturesById[item.featureId] || dashboardFeaturesById[item.featureId];

  return {
    ...feature,
    sectionId,
    navBadge: item.badge,
    isPlaceholder: false,
  };
};

export const resolveDashboardNavigation = ({ featureAccess = {} } = {}) => {
  const resolvedFeatures = resolveDashboardFeatures({ featureAccess });
  const resolvedFeaturesById = Object.fromEntries(
    resolvedFeatures.map((feature) => [feature.id, feature])
  );

  return dashboardNavigationSections
    .map((section) => {
      const resolvedSection = resolveDashboardNavigationItem(
        section,
        resolvedFeaturesById,
        section.featureId
      );

      if (resolvedSection.shellState === DASHBOARD_FEATURE_STATES.HIDDEN) {
        return null;
      }

      return {
        ...resolvedSection,
        children: section.children.map((child) =>
          resolveDashboardNavigationItem(child, resolvedFeaturesById, section.featureId)
        ),
      };
    })
    .filter(Boolean);
};

export const getDashboardSectionIdForFeatureId = (featureId) => {
  const matchingSection = dashboardNavigationSections.find((section) => (
    section.featureId === featureId
    || section.children.some((child) => child.featureId === featureId)
  ));

  return matchingSection?.featureId || null;
};

export const getDashboardDefaultFeature = (features = dashboardFeatures) => (
  features.find((feature) => feature.shellState !== DASHBOARD_FEATURE_STATES.HIDDEN)
  || features[0]
  || dashboardFeaturesById[DASHBOARD_DEFAULT_FEATURE_ID]
);
