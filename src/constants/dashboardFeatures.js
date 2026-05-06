import { BookOpen, Calendar, FileText, Home, Shield } from 'lucide-react';
import { LockdownEntitlementFeatureKeys } from './entitlements';

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
      rightRailMode: DASHBOARD_RIGHT_RAIL_MODES.LIVE_PULSE,
    }),
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
    id: 'settings',
    label: 'Settings',
    path: 'settings',
    icon: Calendar,
    header: {
      title: 'Settings',
      description: 'Review plan visibility, account usage, and school calendar settings',
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
      description: 'Review prototype policy controls and extension pairing from a dedicated premium module',
    },
    shell: buildDashboardShellConfig(),
    entitlementGate: buildDashboardEntitlementGate({
      requiredFeatureKeys: LockdownEntitlementFeatureKeys,
      match: DASHBOARD_FEATURE_GATE_MATCH.ANY,
      fallbackState: DASHBOARD_FEATURE_STATES.LOCKED,
    }),
  },
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

export const getDashboardDefaultFeature = (features = dashboardFeatures) => (
  features.find((feature) => feature.shellState !== DASHBOARD_FEATURE_STATES.HIDDEN)
  || features[0]
  || dashboardFeaturesById[DASHBOARD_DEFAULT_FEATURE_ID]
);
