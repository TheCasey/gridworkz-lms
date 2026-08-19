import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  Globe,
  Info,
  Lock,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  X,
  Youtube,
} from 'lucide-react';
import { dashboardFeaturesById } from '../constants/dashboardFeatures';
import { Collections } from '../constants/schema';
import useStudentPortalWeeklyPlan from '../hooks/useStudentPortalWeeklyPlan';
import { getStudentSubjectsFromLegacyRecords } from '../utils/planningCompatibilityUtils';
import {
  normalizeLockdownSchedule,
  RESET_DAY_OPTIONS,
} from '../utils/schoolSettingsUtils';
import { getTimerSessionDocId } from '../utils/timerUtils';
import {
  buildDefaultLockdownPolicy,
  buildLockdownDeviceSummaryState,
  buildDefaultLockdownResourceLibraryEntry,
  buildLockdownResourceAssignmentSummary,
  buildLockdownParentSummaryViewModel,
  buildLockdownPocPairingCode,
  buildTrustedLockdownEnrollmentCode,
  buildTrustedLockdownRecoveryCode,
  deriveCurrentLockdownPolicyPreview,
  getActiveLockdownStudents,
  LockdownDeviceSummaryStates,
  LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND,
  LockdownParentSummaryGuidanceKinds,
  LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS,
  LOCKDOWN_POC_POLICY_COLLECTION,
  LOCKDOWN_TRUSTED_ENROLLMENT_CONTRACT,
  LOCKDOWN_TRUSTED_POLICY_READ_CONTRACT,
  LockdownResourceTestDecisions,
  LockdownPolicyStates,
  evaluateLockdownResourceAgainstPolicy,
  normalizeLockdownResourceLibraryEntry,
  normalizeLockdownResourceReference,
  normalizeLockdownPolicy,
  normalizeTrustedLockdownEnrollmentMaterial,
  normalizeTrustedLockdownRecoveryMaterial,
  selectAssignedLockdownResources,
  validateLockdownResourceLibraryEntryInput,
} from '../utils/lockdownPolicyUtils';
import {
  deleteTrustedLockdownResourceLibraryEntry,
  issueTrustedLockdownEnrollment,
  issueTrustedLockdownRecovery,
  listTrustedLockdownDevices,
  revokeTrustedLockdownDevice,
  upsertTrustedLockdownResourceLibraryEntry,
} from '../firebase/trustedOperations';

const POLICY_STATE_META = {
  [LockdownPolicyStates.ACTIVE_BLOCK]: {
    label: 'Active block',
    description: 'School time is active. Own Path system resources, parent-approved school-time resources, and the running block resources are all available right now.',
  },
  [LockdownPolicyStates.NO_ACTIVE_BLOCK]: {
    label: 'No active block',
    description: 'School time is active, but no block is running. Own Path system resources and the selected student’s parent-approved school-time resources stay available until work starts.',
  },
  [LockdownPolicyStates.OUTSIDE_SCHOOL_TIME]: {
    label: 'Outside school time',
    description: 'This browser is outside the scheduled school hours. Lockdown network blocking is off right now.',
  },
  [LockdownPolicyStates.ENTITLEMENT_INACTIVE]: {
    label: 'Entitlement inactive',
    description: 'Trusted device policy reads stay visible here, but the Lockdown entitlement is inactive so paid learning resources clear out while the system context remains readable.',
  },
};

const RESOURCE_TEST_RESULT_META = {
  [LockdownResourceTestDecisions.ALLOW]: {
    label: 'Allowed',
    borderColor: '#b9dfc3',
    backgroundColor: '#eef8f1',
    textColor: '#23693f',
  },
  [LockdownResourceTestDecisions.DENY]: {
    label: 'Denied',
    borderColor: '#f3c2c2',
    backgroundColor: '#fff1f1',
    textColor: '#8f3030',
  },
  [LockdownResourceTestDecisions.UNSUPPORTED]: {
    label: 'Unsupported',
    borderColor: '#dcd7d3',
    backgroundColor: '#fbfaf8',
    textColor: '#6b625a',
  },
  [LockdownResourceTestDecisions.METADATA_NEEDED]: {
    label: 'Metadata needed',
    borderColor: '#cbb7fb',
    backgroundColor: '#f0eaff',
    textColor: '#714cb6',
  },
};

const DEVICE_STATUS_META = {
  paired: {
    label: 'Paired',
    backgroundColor: '#eef8f1',
    borderColor: '#b9dfc3',
    textColor: '#23693f',
  },
  stale: {
    label: 'Stale',
    backgroundColor: '#fff4e8',
    borderColor: '#f2c68e',
    textColor: '#8b5a14',
  },
  revoked: {
    label: 'Revoked',
    backgroundColor: '#fff1f1',
    borderColor: '#f3c2c2',
    textColor: '#8f3030',
  },
  inactive: {
    label: 'Inactive',
    backgroundColor: '#fbfaf8',
    borderColor: '#dcd7d3',
    textColor: '#6b625a',
  },
  invalid_credential: {
    label: 'Credential error',
    backgroundColor: '#fff4e8',
    borderColor: '#f2c68e',
    textColor: '#8b5a14',
  },
  network_error: {
    label: 'Network failure',
    backgroundColor: '#f0eaff',
    borderColor: '#cbb7fb',
    textColor: '#714cb6',
  },
};

const inputClassName = 'w-full rounded-xl bg-white px-3 py-2.5 text-[14px] focus:outline-none disabled:cursor-not-allowed disabled:opacity-55';
const fieldLabelClassName = 'mb-1.5 block text-[11px] uppercase tracking-[0.16em] font-label';

const formatTimestampLabel = (value) => {
  if (!value) {
    return 'Not available';
  }

  const parsedDate = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(parsedDate.getTime())
    ? 'Not available'
    : parsedDate.toLocaleString();
};

const pluralize = (count, singular, plural = `${singular}s`) => (
  `${count} ${count === 1 ? singular : plural}`
);

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  const parsedDate = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toLocaleString();
};

const formatTimeDistanceLabel = (value, referenceNow = Date.now()) => {
  const parsedDate = value?.toDate ? value.toDate() : new Date(value);
  const referenceTime = Number.isFinite(referenceNow) ? referenceNow : Date.now();

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Not available';
  }

  const diffMs = Math.max(0, referenceTime - parsedDate.getTime());
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) {
    return 'Just now';
  }

  if (diffMinutes < 60) {
    return `${pluralize(diffMinutes, 'minute')} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${pluralize(diffHours, 'hour')} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${pluralize(diffDays, 'day')} ago`;
  }

  return `${pluralize(diffDays, 'day')} ago`;
};

const DEVICE_ISSUE_REASON_LABELS = {
  inactive: 'The device record is inactive and needs parent review.',
  invalid_credential: 'The saved device credential is no longer valid.',
  network_error: 'The browser has not completed trusted sync successfully.',
};

const PAIRING_WIZARD_STEPS = Object.freeze([
  {
    id: 'student',
    title: 'Choose Student',
    eyebrow: 'Student Binding',
    description: 'Keep the browser tied to one learner so schedule, plan, and resource rules resolve correctly.',
  },
  {
    id: 'browser',
    title: 'Prepare Browser',
    eyebrow: 'Chrome Profile',
    description: 'Use the student learning profile, then open Chrome extension management in that profile.',
  },
  {
    id: 'code',
    title: 'Generate Code',
    eyebrow: 'Trusted Enrollment',
    description: 'Issue a short-lived code only when you are standing at the device you want to pair.',
  },
  {
    id: 'sync',
    title: 'Confirm Sync',
    eyebrow: 'Secure Sync',
    description: 'Paste the code into the extension setup screen and confirm the paired browser reports secure sync.',
  },
  {
    id: 'hardening',
    title: 'Harden Setup',
    eyebrow: 'Managed Chrome',
    description: 'Use managed Chrome controls if you need force-install, profile restrictions, or stronger removal resistance.',
  },
]);

const LOCKDOWN_RESOURCE_EDITOR_KINDS = Object.freeze({
  WEBSITE: 'website',
  YOUTUBE: 'youtube',
});

const LOCKDOWN_RESOURCE_FILTERS = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  ALL: 'all',
});

const LOCKDOWN_RESOURCE_FILTER_ALL_STUDENTS = '__all__';

const getLockdownResourceEditorKind = (resource = {}) => {
  const normalizedReference = normalizeLockdownResourceReference(resource, {
    allowHandleFallback: false,
  });

  return normalizedReference.resource_type === 'youtube' || resource?.youtube_channel_id
    ? LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE
    : LOCKDOWN_RESOURCE_EDITOR_KINDS.WEBSITE;
};

const buildLockdownResourceEditorDraft = ({
  resource = null,
  selectedStudentId = '',
} = {}) => {
  const normalizedResource = resource
    ? normalizeLockdownResourceLibraryEntry(resource)
    : buildDefaultLockdownResourceLibraryEntry({ selectedStudentId });

  return {
    ...normalizedResource,
    editor_kind: getLockdownResourceEditorKind(normalizedResource),
  };
};

const DayToggleGroup = ({
  colors,
  days = [],
  disabled = false,
  onToggle,
}) => (
  <div className="flex flex-wrap gap-2">
    {RESET_DAY_OPTIONS.map((option) => {
      const isActive = days.includes(option.value);

      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onToggle(option.value)}
          disabled={disabled}
          className="rounded-full px-3 py-1.5 text-[12px] font-label uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: isActive ? colors.amethyst : '#ffffff',
            border: `1px solid ${isActive ? colors.amethyst : colors.parchment}`,
            color: isActive ? '#ffffff' : colors.charcoal,
          }}
        >
          {option.label.slice(0, 3)}
        </button>
      );
    })}
  </div>
);

const LOCKDOWN_MODAL_IDS = Object.freeze({
  SCHEDULE: 'schedule',
  RESOURCES: 'resources',
  PAIRING: 'pairing',
  DEVICES: 'devices',
  ALLOWED: 'allowed',
  ADVANCED: 'advanced',
});

const SummaryMetric = ({ label, value, detail, colors, accent = false }) => (
  <div
    className="rounded-xl px-4 py-3"
    style={{ backgroundColor: accent ? `${colors.lavenderTint}80` : '#fbfaf8' }}
  >
    <p
      className="text-[11px] uppercase tracking-[0.14em] font-label"
      style={{ color: accent ? colors.amethyst : 'rgba(41,40,39,0.48)' }}
    >
      {label}
    </p>
    <p className="mt-1 text-[16px] font-display" style={{ color: colors.charcoal, lineHeight: 1.05 }}>
      {value}
    </p>
    {detail ? (
      <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.58)' }}>
        {detail}
      </p>
    ) : null}
  </div>
);

const SummaryCard = ({
  colors,
  icon: Icon,
  eyebrow,
  title,
  description,
  metrics = [],
  actionLabel,
  onAction,
  disabled = false,
  disabledReason = '',
  children = null,
}) => (
  <section
    className="flex h-full flex-col rounded-2xl border p-5"
    style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
  >
    <div className="flex items-start gap-3">
      <div
        className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border"
        style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
      >
        <Icon className="h-4 w-4" style={{ color: colors.amethyst }} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[11px] uppercase tracking-[0.16em] font-label"
          style={{ color: colors.amethyst }}
        >
          {eyebrow}
        </p>
        <h4
          className="mt-1 text-[18px] font-display"
          style={{ color: colors.charcoal, lineHeight: 1.05 }}
        >
          {title}
        </h4>
        <p className="mt-2 text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
          {description}
        </p>
      </div>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {metrics.map((metric) => (
        <SummaryMetric
          key={metric.label}
          label={metric.label}
          value={metric.value}
          detail={metric.detail}
          colors={colors}
          accent={metric.accent}
        />
      ))}
    </div>

    <div className="mt-5 flex-1">
      {children}
      {disabledReason ? (
        <p className={children ? 'mt-3 text-[12px] font-body' : 'text-[12px] font-body'} style={{ color: 'rgba(41,40,39,0.56)' }}>
          {disabledReason}
        </p>
      ) : null}
    </div>

    <button
      type="button"
      onClick={onAction}
      disabled={disabled}
      className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[12px] font-label uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        backgroundColor: disabled ? '#fbfaf8' : colors.charcoal,
        border: disabled ? `1px solid ${colors.parchment}` : 'none',
        color: disabled ? 'rgba(41,40,39,0.42)' : '#ffffff',
      }}
    >
      {actionLabel}
      <ChevronRight className="h-4 w-4" />
    </button>
  </section>
);

const LockdownModalFrame = ({
  colors,
  isOpen,
  onClose,
  eyebrow,
  title,
  description,
  size = 'max-w-5xl',
  children,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-4">
      <div className="flex h-full items-center justify-center">
        <div
          className={`flex h-full max-h-[min(92vh,980px)] w-full ${size} flex-col overflow-hidden rounded-[28px] border bg-white shadow-[0_24px_80px_rgba(12,12,13,0.18)]`}
          style={{ borderColor: colors.parchment }}
        >
          <div className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: colors.parchment }}>
            <div className="min-w-0">
              <p
                className="text-[11px] uppercase tracking-[0.18em] font-label"
                style={{ color: colors.amethyst }}
              >
                {eyebrow}
              </p>
              <h3 className="mt-2 text-[22px] font-display" style={{ color: colors.charcoal, lineHeight: 1.05 }}>
                {title}
              </h3>
              {description ? (
                <p className="mt-2 max-w-3xl text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                  {description}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
              style={{ borderColor: colors.parchment, color: colors.charcoal, backgroundColor: '#fbfaf8' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const LockdownPolicyPanel = ({
  currentUser,
  db,
  colors,
  lockdownAccess,
  parentSettings,
  planName,
  students = [],
  subjects = [],
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [hasExplicitStudentSelection, setHasExplicitStudentSelection] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState(() => normalizeLockdownSchedule({}, parentSettings?.timezone));
  const [isScheduleDirty, setIsScheduleDirty] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleSuccess, setScheduleSuccess] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [trustedEnrollment, setTrustedEnrollment] = useState(null);
  const [trustedEnrollmentError, setTrustedEnrollmentError] = useState('');
  const [issuingTrustedEnrollment, setIssuingTrustedEnrollment] = useState(false);
  const [trustedRecovery, setTrustedRecovery] = useState(null);
  const [trustedRecoveryError, setTrustedRecoveryError] = useState('');
  const [issuingRecoveryDeviceId, setIssuingRecoveryDeviceId] = useState('');
  const [lockdownDevices, setLockdownDevices] = useState([]);
  const [lockdownDevicesReady, setLockdownDevicesReady] = useState(false);
  const [lockdownDevicesError, setLockdownDevicesError] = useState('');
  const [refreshingLockdownDevices, setRefreshingLockdownDevices] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState('');
  const [deviceMessage, setDeviceMessage] = useState('');
  const [deviceMessageTone, setDeviceMessageTone] = useState('');
  const [legacyPolicy, setLegacyPolicy] = useState(() => buildDefaultLockdownPolicy(currentUser?.uid || ''));
  const [hasLegacyPolicyDocument, setHasLegacyPolicyDocument] = useState(false);
  const [legacyPolicyUpdatedAt, setLegacyPolicyUpdatedAt] = useState(null);
  const [legacyPolicyError, setLegacyPolicyError] = useState('');
  const [legacyPolicyReady, setLegacyPolicyReady] = useState(false);
  const [timerSessions, setTimerSessions] = useState([]);
  const [timerSessionsReady, setTimerSessionsReady] = useState(false);
  const [timerSessionsError, setTimerSessionsError] = useState('');
  const [referenceNow, setReferenceNow] = useState(() => Date.now());
  const [resourceTesterInput, setResourceTesterInput] = useState('');
  const [resourceTesterMetadata, setResourceTesterMetadata] = useState({
    youtube_channel_id: '',
    youtube_channel_title: '',
    youtube_channel_handle: '',
  });
  const [resourceTesterResult, setResourceTesterResult] = useState(null);
  const [activeModal, setActiveModal] = useState('');
  const [pairingWizardStepIndex, setPairingWizardStepIndex] = useState(0);
  const [lockdownResourceLibrary, setLockdownResourceLibrary] = useState([]);
  const [lockdownResourceLibraryReady, setLockdownResourceLibraryReady] = useState(false);
  const [lockdownResourceLibraryError, setLockdownResourceLibraryError] = useState('');
  const [resourceModalStudentFilterId, setResourceModalStudentFilterId] = useState(
    LOCKDOWN_RESOURCE_FILTER_ALL_STUDENTS
  );
  const [resourceModalStatusFilter, setResourceModalStatusFilter] = useState(
    LOCKDOWN_RESOURCE_FILTERS.ACTIVE
  );
  const [resourceModalSearch, setResourceModalSearch] = useState('');
  const [resourceEditorDraft, setResourceEditorDraft] = useState(() => (
    buildLockdownResourceEditorDraft({ selectedStudentId: '' })
  ));
  const [resourceEditorError, setResourceEditorError] = useState('');
  const [resourceEditorSuccess, setResourceEditorSuccess] = useState('');
  const [resourceSavePending, setResourceSavePending] = useState(false);
  const [removingResourceId, setRemovingResourceId] = useState(null);

  const canManagePolicy = Boolean(lockdownAccess?.canManagePolicy);
  const canPairDevices = Boolean(lockdownAccess?.canPairDevices);
  const isReadOnly = Boolean(lockdownAccess?.isReadOnly);
  const studentsPath = `/dashboard/${dashboardFeaturesById.students.path}`;
  const isMultiStudentAccount = students.length > 1;
  const activeStudents = useMemo(() => getActiveLockdownStudents(students), [students]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setReferenceNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!students.length) {
      setSelectedStudentId('');
      setHasExplicitStudentSelection(false);
      return;
    }

    const hasMatchingSelection = students.some((student) => student.id === selectedStudentId);

    if (!hasMatchingSelection) {
      if (students.length === 1) {
        setSelectedStudentId(students[0].id);
        setHasExplicitStudentSelection(false);
      } else {
        setSelectedStudentId('');
        setHasExplicitStudentSelection(false);
      }
      return;
    }

    if (students.length > 1 && !hasExplicitStudentSelection) {
      setSelectedStudentId('');
      setHasExplicitStudentSelection(false);
      return;
    }

    if (students.length === 1 && selectedStudentId !== students[0].id) {
      setSelectedStudentId(students[0].id);
    }
  }, [hasExplicitStudentSelection, selectedStudentId, students]);

  useEffect(() => {
    setResourceTesterResult(null);
  }, [selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [selectedStudentId, students]
  );

  const selectedStudentSchedule = useMemo(
    () => normalizeLockdownSchedule(
      selectedStudent?.lockdown_schedule,
      selectedStudent?.timezone || parentSettings?.timezone
    ),
    [parentSettings?.timezone, selectedStudent?.lockdown_schedule, selectedStudent?.timezone]
  );

  useEffect(() => {
    setScheduleDraft(selectedStudentSchedule);
    setIsScheduleDirty(false);
    setScheduleError('');
    setScheduleSuccess('');
  }, [selectedStudent?.id, selectedStudentSchedule]);

  useEffect(() => {
    setTrustedEnrollment(null);
    setTrustedEnrollmentError('');
    setTrustedRecovery(null);
    setTrustedRecoveryError('');
    setIssuingRecoveryDeviceId('');
    setCopyMessage('');
    setDeviceMessage('');
    setDeviceMessageTone('');
    setPairingWizardStepIndex(0);
  }, [selectedStudent?.id]);

  const policyRef = useMemo(() => {
    if (!currentUser?.uid) {
      return null;
    }

    return doc(db, LOCKDOWN_POC_POLICY_COLLECTION, currentUser.uid);
  }, [currentUser?.uid, db]);

  useEffect(() => {
    if (!policyRef || !currentUser?.uid) {
      setLegacyPolicy(buildDefaultLockdownPolicy(currentUser?.uid || ''));
      setHasLegacyPolicyDocument(false);
      setLegacyPolicyUpdatedAt(null);
      setLegacyPolicyError('');
      setLegacyPolicyReady(false);
      return undefined;
    }

    setLegacyPolicyReady(false);
    const fallbackPolicy = buildDefaultLockdownPolicy(currentUser.uid);

    return onSnapshot(policyRef, (snapshot) => {
      const nextPolicy = snapshot.exists()
        ? normalizeLockdownPolicy(snapshot.data(), currentUser.uid)
        : fallbackPolicy;

      setLegacyPolicy(nextPolicy);
      setHasLegacyPolicyDocument(snapshot.exists());
      setLegacyPolicyUpdatedAt(snapshot.exists() ? snapshot.data()?.updated_at ?? null : null);
      setLegacyPolicyError('');
      setLegacyPolicyReady(true);
    }, (error) => {
      console.error('Error loading legacy lockdown policy:', error);
      setLegacyPolicy(fallbackPolicy);
      setHasLegacyPolicyDocument(false);
      setLegacyPolicyUpdatedAt(null);
      setLegacyPolicyError('The legacy Lockdown compatibility document could not be loaded.');
      setLegacyPolicyReady(true);
    });
  }, [currentUser?.uid, policyRef]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLockdownResourceLibrary([]);
      setLockdownResourceLibraryError('');
      setLockdownResourceLibraryReady(false);
      return undefined;
    }

    setLockdownResourceLibraryReady(false);
    const resourceQuery = query(
      collection(db, Collections.LOCKDOWN_RESOURCE_LIBRARY),
      where('parent_id', '==', currentUser.uid)
    );

    return onSnapshot(resourceQuery, (snapshot) => {
      const nextResources = snapshot.docs
        .map((resourceDoc) => ({
          id: resourceDoc.id,
          ...resourceDoc.data(),
        }))
        .sort((left, right) => {
          const leftDate = left?.updated_at?.toMillis?.() || left?.created_at?.toMillis?.() || 0;
          const rightDate = right?.updated_at?.toMillis?.() || right?.created_at?.toMillis?.() || 0;
          return rightDate - leftDate;
        });

      setLockdownResourceLibrary(nextResources);
      setLockdownResourceLibraryError('');
      setLockdownResourceLibraryReady(true);
    }, (error) => {
      console.error('Error loading lockdown resource library:', error);
      setLockdownResourceLibrary([]);
      setLockdownResourceLibraryError('The household resource library could not be loaded right now.');
      setLockdownResourceLibraryReady(true);
    });
  }, [currentUser?.uid, db]);

  useEffect(() => {
    if (!scheduleSuccess) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setScheduleSuccess(''), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [scheduleSuccess]);

  useEffect(() => {
    if (!copyMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setCopyMessage(''), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [copyMessage]);

  useEffect(() => {
    if (!deviceMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setDeviceMessage('');
      setDeviceMessageTone('');
    }, 2500);
    return () => window.clearTimeout(timeoutId);
  }, [deviceMessage]);

  useEffect(() => {
    if (!resourceEditorSuccess) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setResourceEditorSuccess(''), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [resourceEditorSuccess]);

  useEffect(() => {
    setTrustedEnrollment(null);
    setTrustedEnrollmentError('');
    setIssuingTrustedEnrollment(false);
    setTrustedRecovery(null);
    setTrustedRecoveryError('');
    setIssuingRecoveryDeviceId('');
  }, [currentUser?.uid, selectedStudentId]);

  useEffect(() => {
    setResourceModalStudentFilterId(selectedStudentId || LOCKDOWN_RESOURCE_FILTER_ALL_STUDENTS);
    setResourceEditorDraft(buildLockdownResourceEditorDraft({ selectedStudentId }));
    setResourceEditorError('');
    setResourceEditorSuccess('');
  }, [selectedStudentId]);

  const studentSubjects = useMemo(
    () => (selectedStudent ? getStudentSubjectsFromLegacyRecords(subjects, selectedStudent.id) : []),
    [selectedStudent, subjects]
  );

  const studentNameById = useMemo(
    () => new Map(students.map((student) => [student.id, student.name])),
    [students]
  );

  const assignedHouseholdResources = useMemo(
    () => selectAssignedLockdownResources({
      resourceLibrary: lockdownResourceLibrary,
      studentId: selectedStudentId,
    }),
    [lockdownResourceLibrary, selectedStudentId]
  );

  const visibleResourceLibraryEntries = useMemo(() => {
    const normalizedStudentFilterId = resourceModalStudentFilterId === LOCKDOWN_RESOURCE_FILTER_ALL_STUDENTS
      ? ''
      : resourceModalStudentFilterId;
    const searchNeedle = resourceModalSearch.trim().toLowerCase();

    return lockdownResourceLibrary
      .map((resource) => normalizeLockdownResourceLibraryEntry(resource))
      .filter((resource) => {
        if (resourceModalStatusFilter === LOCKDOWN_RESOURCE_FILTERS.ACTIVE && !resource.is_active) {
          return false;
        }

        if (resourceModalStatusFilter === LOCKDOWN_RESOURCE_FILTERS.ARCHIVED && resource.is_active) {
          return false;
        }

        if (normalizedStudentFilterId && resource.assign_to_all_students !== true && !resource.student_ids.includes(normalizedStudentFilterId)) {
          return false;
        }

        if (!searchNeedle) {
          return true;
        }

        const assignmentSummary = buildLockdownResourceAssignmentSummary({
          resource,
          students: activeStudents,
        });
        const haystack = [
          resource.name,
          resource.url,
          resource.lockdown_origin,
          resource.youtube_channel_id,
          resource.youtube_channel_title,
          resource.youtube_channel_handle,
          assignmentSummary.label,
        ].join(' ').toLowerCase();

        return haystack.includes(searchNeedle);
      });
  }, [
    activeStudents,
    lockdownResourceLibrary,
    resourceModalSearch,
    resourceModalStatusFilter,
    resourceModalStudentFilterId,
  ]);

  const resourceEditorValidation = useMemo(
    () => validateLockdownResourceLibraryEntryInput(resourceEditorDraft),
    [resourceEditorDraft]
  );
  const isRemovingEditedResource = Boolean(resourceEditorDraft.id)
    && removingResourceId === resourceEditorDraft.id;

  const visibleLockdownDevices = useMemo(() => {
    if (!selectedStudentId) {
      return [];
    }

    return lockdownDevices.filter((deviceRecord) => deviceRecord.student_id === selectedStudentId);
  }, [lockdownDevices, selectedStudentId]);

  const visibleLockdownDeviceSummaries = useMemo(() => (
    visibleLockdownDevices.map((deviceRecord) => ({
      ...deviceRecord,
      ...buildLockdownDeviceSummaryState(deviceRecord, { referenceNow }),
    }))
  ), [referenceNow, visibleLockdownDevices]);

  const refreshLockdownDevices = async () => {
    if (!currentUser?.uid || !canManagePolicy || !selectedStudentId) {
      setLockdownDevices([]);
      setLockdownDevicesError('');
      setLockdownDevicesReady(true);
      setRefreshingLockdownDevices(false);
      return;
    }

    setRefreshingLockdownDevices(true);
    setLockdownDevicesError('');

    try {
      const result = await listTrustedLockdownDevices({
        student_id: selectedStudentId,
      });
      setLockdownDevices(Array.isArray(result?.devices) ? result.devices : []);
      setLockdownDevicesReady(true);
    } catch (error) {
      console.error('Error loading Lockdown device list:', error);
      setLockdownDevices([]);
      setLockdownDevicesError('Parent-owned Lockdown devices could not be loaded right now. Check your connection and try again.');
      setLockdownDevicesReady(true);
    } finally {
      setRefreshingLockdownDevices(false);
    }
  };

  useEffect(() => {
    void refreshLockdownDevices();
  }, [canManagePolicy, currentUser?.uid, selectedStudentId]);

  useEffect(() => {
    if (!selectedStudent?.id) {
      setTimerSessions([]);
      setTimerSessionsError('');
      setTimerSessionsReady(false);
      return undefined;
    }

    if (!studentSubjects.length) {
      setTimerSessions([]);
      setTimerSessionsError('');
      setTimerSessionsReady(true);
      return undefined;
    }

    let isMounted = true;
    const sessionMap = new Map();
    const loadedSubjectIds = new Set();

    setTimerSessions([]);
    setTimerSessionsError('');
    setTimerSessionsReady(false);

    const applyTimerState = () => {
      if (!isMounted) {
        return;
      }

      setTimerSessions(Array.from(sessionMap.values()).filter(Boolean));

      if (loadedSubjectIds.size === studentSubjects.length) {
        setTimerSessionsReady(true);
      }
    };

    const unsubscribes = studentSubjects.map((subject) => onSnapshot(
      doc(db, Collections.TIMER_SESSIONS, getTimerSessionDocId(selectedStudent.id, subject.id)),
      (snapshot) => {
        loadedSubjectIds.add(subject.id);
        sessionMap.set(subject.id, snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
        applyTimerState();
      },
      (error) => {
        console.error('Error loading timer session for Lockdown preview:', error);
        loadedSubjectIds.add(subject.id);
        sessionMap.set(subject.id, null);
        setTimerSessionsError('Current timer state could not be fully loaded for the derived preview.');
        applyTimerState();
      }
    ));

    return () => {
      isMounted = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [db, selectedStudent?.id, studentSubjects]);

  const {
    weeklyPlan,
    loading: weeklyPlanLoading,
    error: weeklyPlanError,
    weekIdentity,
  } = useStudentPortalWeeklyPlan({
    student: selectedStudent,
    parentId: currentUser?.uid,
    weekConfig: parentSettings,
    enabled: Boolean(selectedStudent?.id && currentUser?.uid),
  });

  const derivedPolicyPreview = useMemo(() => {
    if (!currentUser?.uid || !selectedStudent) {
      return null;
    }

    return deriveCurrentLockdownPolicyPreview({
      entitlementActive: Boolean(lockdownAccess?.isEnabled),
      parentId: currentUser.uid,
      studentRecord: selectedStudent,
      weeklyPlan,
      lockdownResourceLibrary,
      timerSessions,
      referenceDate: new Date(referenceNow),
    });
  }, [
    currentUser?.uid,
    lockdownResourceLibrary,
    lockdownAccess?.isEnabled,
    referenceNow,
    selectedStudent,
    timerSessions,
    weeklyPlan,
  ]);

  const activeBlockResources = useMemo(() => {
    const activeBlockId = derivedPolicyPreview?.policy_context?.active_block?.id;

    if (!activeBlockId || !Array.isArray(weeklyPlan?.blocks)) {
      return [];
    }

    const matchingBlock = weeklyPlan.blocks.find((block) => block.id === activeBlockId);
    return Array.isArray(matchingBlock?.resources) ? matchingBlock.resources : [];
  }, [derivedPolicyPreview?.policy_context?.active_block?.id, weeklyPlan?.blocks]);

  const trustedEnrollmentCode = useMemo(
    () => buildTrustedLockdownEnrollmentCode(trustedEnrollment || {}),
    [trustedEnrollment]
  );

  const trustedRecoveryCode = useMemo(
    () => buildTrustedLockdownRecoveryCode(trustedRecovery || {}),
    [trustedRecovery]
  );

  const trustedEnrollmentDisplayText = useMemo(() => {
    if (trustedEnrollmentCode) {
      return trustedEnrollmentCode;
    }

    if (trustedEnrollment) {
      return 'Trusted enrollment material was issued, but the local Firebase environment could not assemble the device code preview.';
    }

    return 'Generate a short-lived enrollment code when you are ready to pair a trusted device for the selected student.';
  }, [trustedEnrollment, trustedEnrollmentCode]);

  const legacyPocPairingCode = useMemo(
    () => buildLockdownPocPairingCode(currentUser?.uid || ''),
    [currentUser?.uid]
  );

  const trustedEnrollmentExpiresLabel = useMemo(() => {
    if (!trustedEnrollment?.expires_at) {
      return 'Trusted enrollment codes stay short-lived and can only be exchanged once.';
    }

    const parsedDate = new Date(trustedEnrollment.expires_at);
    return Number.isNaN(parsedDate.getTime())
      ? 'Trusted enrollment code generated.'
      : `Expires ${parsedDate.toLocaleString()}.`;
  }, [trustedEnrollment]);

  const trustedRecoveryExpiresLabel = useMemo(() => {
    if (!trustedRecovery?.expires_at) {
      return 'Parent recovery codes stay short-lived and can only be used once.';
    }

    const parsedDate = new Date(trustedRecovery.expires_at);
    return Number.isNaN(parsedDate.getTime())
      ? 'Parent recovery code generated.'
      : `Expires ${parsedDate.toLocaleString()}.`;
  }, [trustedRecovery]);

  const derivedStateMeta = POLICY_STATE_META[derivedPolicyPreview?.policy_state] || POLICY_STATE_META[LockdownPolicyStates.NO_ACTIVE_BLOCK];
  const derivedPreviewLoading = Boolean(selectedStudent?.id) && (
    weeklyPlanLoading
    || !timerSessionsReady
    || !lockdownResourceLibraryReady
  );
  const allowedResourceGroups = derivedPolicyPreview?.policy_context?.allowed_resource_groups || [];
  const resourceTesterResultMeta = RESOURCE_TEST_RESULT_META[resourceTesterResult?.decision]
    || RESOURCE_TEST_RESULT_META[LockdownResourceTestDecisions.UNSUPPORTED];
  const selectedStudentUpdatedAtLabel = formatTimestampLabel(selectedStudent?.updated_at);
  const legacyPolicyUpdatedAtLabel = formatTimestampLabel(legacyPolicyUpdatedAt);
  const resolvedWeeklyPlanId = weeklyPlan?.id
    || weekIdentity?.planId
    || derivedPolicyPreview?.policy_context?.weekly_plan_id
    || '';
  const activePairingStep = PAIRING_WIZARD_STEPS[pairingWizardStepIndex] || PAIRING_WIZARD_STEPS[0];
  const canMovePairingWizardBackward = pairingWizardStepIndex > 0;
  const canMovePairingWizardForward = pairingWizardStepIndex < PAIRING_WIZARD_STEPS.length - 1;
  const summaryViewModel = useMemo(() => buildLockdownParentSummaryViewModel({
    students,
    selectedStudentId,
    selectedStudent,
    hasExplicitStudentSelection,
    selectedStudentSchedule,
    lockdownResourceLibrary,
    visibleLockdownDevices,
    lockdownAccess,
    derivedPolicyPreview,
    referenceNow,
  }), [
    derivedPolicyPreview,
    hasExplicitStudentSelection,
    lockdownResourceLibrary,
    lockdownAccess,
    referenceNow,
    selectedStudent,
    selectedStudentId,
    selectedStudentSchedule,
    students,
    visibleLockdownDevices,
  ]);
  const statusStripItems = [
    {
      label: 'Current State',
      value: selectedStudent
        ? (derivedPreviewLoading ? 'Loading preview' : summaryViewModel.allowed_right_now.state_label)
        : 'Choose a student',
      detail: selectedStudent ? derivedStateMeta.description : summaryViewModel.guidance.description,
      accent: true,
    },
    {
      label: 'Weekly Plan',
      value: selectedStudent
        ? (weeklyPlan ? 'Published plan found' : (derivedPreviewLoading ? 'Loading preview' : 'No published plan'))
        : 'Not available',
      detail: selectedStudent ? (resolvedWeeklyPlanId || 'No current weekly-plan document') : 'Select a student first',
    },
    {
      label: 'Active Block',
      value: selectedStudent
        ? (derivedPolicyPreview?.policy_context?.active_block?.title || (derivedPreviewLoading ? 'Loading preview' : 'No active block'))
        : 'Not available',
      detail: selectedStudent
        ? (derivedPolicyPreview?.policy_context?.active_block?.category || 'Waiting for a running block timer')
        : 'Select a student first',
    },
    {
      label: 'Paired Devices',
      value: canManagePolicy
        ? pluralize(summaryViewModel.devices.total, 'device')
        : 'Read-only',
      detail: selectedStudent
        ? `${pluralize(summaryViewModel.devices.attention_needed, 'device')} need attention for ${selectedStudent.name}.`
        : 'Counts update after you choose a student.',
    },
  ];
  const selectedDeviceSummaryPills = [
    {
      key: 'paired',
      label: 'Paired',
      value: summaryViewModel.devices.paired,
      state: LockdownDeviceSummaryStates.PAIRED,
    },
    {
      key: 'stale',
      label: `Stale ${LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS}d+`,
      value: summaryViewModel.devices.stale,
      state: LockdownDeviceSummaryStates.STALE,
    },
    {
      key: 'revoked',
      label: 'Revoked',
      value: summaryViewModel.devices.revoked,
      state: LockdownDeviceSummaryStates.REVOKED,
    },
    {
      key: 'inactive',
      label: 'Inactive',
      value: summaryViewModel.devices.inactive,
      state: LockdownDeviceSummaryStates.INACTIVE,
    },
  ];

  const handleResourceTesterSubmit = (event) => {
    event.preventDefault();

    if (!selectedStudent?.id || !derivedPolicyPreview?.policy) {
      setResourceTesterResult({
        decision: LockdownResourceTestDecisions.UNSUPPORTED,
        reason: 'Select a student before testing a resource.',
      });
      return;
    }

    const result = evaluateLockdownResourceAgainstPolicy({
      resource: {
        url: resourceTesterInput,
        ...resourceTesterMetadata,
      },
      policy: derivedPolicyPreview.policy,
    });

    setResourceTesterResult(result);
  };

  const handleStudentSelectionChange = (event) => {
    const nextStudentId = event.target.value;
    setSelectedStudentId(nextStudentId);
    setHasExplicitStudentSelection(Boolean(nextStudentId));
  };

  const handlePairingWizardStepChange = (nextIndex) => {
    if (!Number.isInteger(nextIndex)) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(nextIndex, PAIRING_WIZARD_STEPS.length - 1));
    setPairingWizardStepIndex(clampedIndex);
  };

  const openScheduleModal = () => {
    setActiveModal(LOCKDOWN_MODAL_IDS.SCHEDULE);
  };

  const openPairingWizard = () => {
    setPairingWizardStepIndex(0);
    setActiveModal(LOCKDOWN_MODAL_IDS.PAIRING);
  };

  const openDevicesModal = () => {
    setActiveModal(LOCKDOWN_MODAL_IDS.DEVICES);
  };

  const closeActiveModal = () => {
    setActiveModal('');
    setPairingWizardStepIndex(0);
  };

  const updateResourceEditorDraft = (updater) => {
    setResourceEditorDraft((currentDraft) => updater(currentDraft));
    setResourceEditorError('');
    setResourceEditorSuccess('');
  };

  const openResourceModal = ({
    resource = null,
    nextStudentFilterId = selectedStudentId || LOCKDOWN_RESOURCE_FILTER_ALL_STUDENTS,
  } = {}) => {
    setResourceModalStudentFilterId(nextStudentFilterId);
    setResourceEditorDraft(buildLockdownResourceEditorDraft({
      resource,
      selectedStudentId,
    }));
    setResourceEditorError('');
    setResourceEditorSuccess('');
    setActiveModal(LOCKDOWN_MODAL_IDS.RESOURCES);
  };

  const handleStartNewResource = (editorKind = LOCKDOWN_RESOURCE_EDITOR_KINDS.WEBSITE) => {
    setResourceEditorDraft({
      ...buildLockdownResourceEditorDraft({ selectedStudentId }),
      editor_kind: editorKind,
    });
    setResourceEditorError('');
    setResourceEditorSuccess('');
  };

  const handleSaveResource = async () => {
    if (!canManagePolicy) {
      setResourceEditorError(
        lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore Lockdown management.'
      );
      return;
    }

    const { resource, error } = resourceEditorValidation;
    if (error) {
      setResourceEditorError(error);
      return;
    }

    setResourceSavePending(true);
    setResourceEditorError('');
    setResourceEditorSuccess('');

    try {
      const result = await upsertTrustedLockdownResourceLibraryEntry({ resource });
      const savedResource = normalizeLockdownResourceLibraryEntry(result?.resource || resource);
      setResourceEditorDraft({
        ...buildLockdownResourceEditorDraft({
          resource: savedResource,
          selectedStudentId,
        }),
        editor_kind: resourceEditorDraft.editor_kind,
      });
      setResourceEditorSuccess(savedResource.is_active ? 'Resource saved.' : 'Resource archived.');
      setResourceModalStatusFilter(savedResource.is_active
        ? LOCKDOWN_RESOURCE_FILTERS.ACTIVE
        : LOCKDOWN_RESOURCE_FILTERS.ALL);
    } catch (error) {
      console.error('Error saving lockdown resource library entry:', error);
      setResourceEditorError(
        error?.message || 'The resource could not be saved right now.'
      );
    } finally {
      setResourceSavePending(false);
    }
  };

  const handleArchiveResource = async (resource, nextIsActive) => {
    if (!resource?.id) {
      return;
    }

    setResourceSavePending(true);
    setResourceEditorError('');
    setResourceEditorSuccess('');

    try {
      const payload = {
        ...normalizeLockdownResourceLibraryEntry(resource),
        is_active: nextIsActive,
      };
      await upsertTrustedLockdownResourceLibraryEntry({ resource: payload });
      setResourceEditorDraft(buildLockdownResourceEditorDraft({
        resource: payload,
        selectedStudentId,
      }));
      setResourceEditorSuccess(nextIsActive ? 'Resource restored.' : 'Resource archived.');
      setResourceModalStatusFilter(nextIsActive
        ? LOCKDOWN_RESOURCE_FILTERS.ACTIVE
        : LOCKDOWN_RESOURCE_FILTERS.ARCHIVED);
    } catch (error) {
      console.error('Error updating lockdown resource archive state:', error);
      setResourceEditorError(
        error?.message || 'The resource archive state could not be updated.'
      );
    } finally {
      setResourceSavePending(false);
    }
  };

  const handleDeleteResource = async (resource) => {
    const resourceId = resource?.id || '';

    if (!resourceId) {
      return;
    }

    const shouldDelete = window.confirm(`Remove ${resource.name || 'this resource'} from the household library?`);
    if (!shouldDelete) {
      return;
    }

    setRemovingResourceId(resourceId);
    setResourceEditorError('');
    setResourceEditorSuccess('');

    try {
      await deleteTrustedLockdownResourceLibraryEntry({ resource_id: resourceId });
      setResourceEditorDraft(buildLockdownResourceEditorDraft({ selectedStudentId }));
      setResourceEditorSuccess('Resource removed.');
    } catch (error) {
      console.error('Error deleting lockdown resource library entry:', error);
      setResourceEditorError(
        error?.message || 'The resource could not be removed right now.'
      );
    } finally {
      setRemovingResourceId(null);
    }
  };

  const updateScheduleDraft = (updater) => {
    if (!canManagePolicy) {
      setScheduleError(
        lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore Lockdown management.'
      );
      return;
    }

    setScheduleDraft((currentSchedule) => updater(currentSchedule));
    setIsScheduleDirty(true);
    setScheduleError('');
    setScheduleSuccess('');
  };

  const handleToggleSchoolDay = (dayValue) => {
    updateScheduleDraft((currentSchedule) => {
      const nextDays = currentSchedule.school_days.includes(dayValue)
        ? currentSchedule.school_days.filter((candidateDay) => candidateDay !== dayValue)
        : [...currentSchedule.school_days, dayValue].sort((left, right) => left - right);

      return {
        ...currentSchedule,
        school_days: nextDays.length ? nextDays : [dayValue],
      };
    });
  };

  const handleSaveSchedule = async () => {
    if (!currentUser?.uid || !selectedStudent?.id) {
      setScheduleError('Select a student before saving Lockdown settings.');
      return;
    }

    if (!canManagePolicy) {
      setScheduleError(
        lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore Lockdown management.'
      );
      return;
    }

    setSavingSchedule(true);
    setScheduleError('');

    try {
      const nextSchedule = normalizeLockdownSchedule(
        scheduleDraft,
        selectedStudent.timezone || parentSettings?.timezone
      );

      await setDoc(doc(db, Collections.STUDENTS, selectedStudent.id), {
        lockdown_schedule: nextSchedule,
        updated_at: serverTimestamp(),
      }, { merge: true });

      setIsScheduleDirty(false);
      setScheduleSuccess('Saved Lockdown school-time schedule.');
    } catch (error) {
      console.error('Error saving Lockdown schedule:', error);
      setScheduleError('The Lockdown schedule could not be saved. Check your connection and try again.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleIssueTrustedEnrollment = async () => {
    if (!selectedStudent?.id) {
      setTrustedEnrollmentError('Select a student before generating a trusted enrollment code.');
      return;
    }

    if (!canPairDevices) {
      setTrustedEnrollmentError(
        lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore trusted device pairing.'
      );
      return;
    }

    setIssuingTrustedEnrollment(true);
    setTrustedEnrollmentError('');
    setCopyMessage('');

    try {
      const nextEnrollment = await issueTrustedLockdownEnrollment({
        student_id: selectedStudent.id,
      });
      setTrustedEnrollment(normalizeTrustedLockdownEnrollmentMaterial(nextEnrollment));
    } catch (error) {
      console.error('Error issuing trusted Lockdown enrollment:', error);
      setTrustedEnrollment(null);
      setTrustedEnrollmentError(
        error?.message || 'The trusted enrollment code could not be generated.'
      );
    } finally {
      setIssuingTrustedEnrollment(false);
    }
  };

  const handleRevokeDevice = async (deviceId) => {
    if (!deviceId) {
      return;
    }

    if (!canManagePolicy) {
      setDeviceMessage(
        lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore trusted device management.'
      );
      setDeviceMessageTone('error');
      return;
    }

    setRevokingDeviceId(deviceId);
    setDeviceMessage('');
    setDeviceMessageTone('');

    try {
      const result = await revokeTrustedLockdownDevice({ device_id: deviceId });
      if (result?.status !== 'revoked') {
        throw new Error('The device could not be revoked.');
      }

      await refreshLockdownDevices();
      setDeviceMessage('Device revoked. That browser will no longer receive active trusted policy reads.');
      setDeviceMessageTone('success');
    } catch (error) {
      console.error('Error revoking Lockdown device:', error);
      setDeviceMessage(
        error instanceof Error ? error.message : 'The device could not be revoked.'
      );
      setDeviceMessageTone('error');
    } finally {
      setRevokingDeviceId('');
    }
  };

  const handleIssueDeviceRecovery = async (deviceRecord) => {
    const deviceId = deviceRecord?.device_id || '';
    if (!deviceId) {
      return;
    }

    if (!selectedStudent?.id) {
      setTrustedRecoveryError('Select a student before issuing a parent recovery code.');
      return;
    }

    if (!canManagePolicy) {
      setTrustedRecoveryError(
        lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore trusted device management.'
      );
      return;
    }

    setIssuingRecoveryDeviceId(deviceId);
    setTrustedRecovery(null);
    setTrustedRecoveryError('');
    setCopyMessage('');

    try {
      const nextRecovery = await issueTrustedLockdownRecovery({
        device_id: deviceId,
        student_id: selectedStudent.id,
      });
      setTrustedRecovery(normalizeTrustedLockdownRecoveryMaterial(nextRecovery));
    } catch (error) {
      console.error('Error issuing Lockdown recovery code:', error);
      setTrustedRecovery(null);
      setTrustedRecoveryError(
        error?.message || 'The parent recovery code could not be generated.'
      );
    } finally {
      setIssuingRecoveryDeviceId('');
    }
  };

  const handleCopy = async (value, label, { requiresPairingAccess = false } = {}) => {
    if (!value) {
      setCopyMessage(`Could not copy the ${label}.`);
      return;
    }

    if (requiresPairingAccess && !canPairDevices) {
      setCopyMessage(
        lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore trusted device pairing.'
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch (error) {
      console.error(`Error copying ${label}:`, error);
      setCopyMessage(`Could not copy the ${label}.`);
    }
  };

  const panelDescription = canManagePolicy
    ? 'Lockdown management is student-bound now. Pair devices to a specific student, review the current derived state from published weekly plans and schedule rules, and maintain school-time resources without editing raw policy documents.'
    : 'Your Lockdown setup stays visible here in read-only mode. Saved student schedules and compatibility material remain visible, but pairing and editing stay disabled until the Lockdown plan is restored.';

  return (
    <>
      <section
        className="overflow-hidden rounded-[28px] border bg-white"
        style={{ borderColor: colors.parchment }}
      >
        <div
          className="border-b px-6 py-5"
          style={{ borderColor: colors.parchment, backgroundColor: `${colors.lavenderTint}99` }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-label"
                style={{ backgroundColor: '#ffffff', color: colors.amethyst }}
              >
                {isReadOnly ? <Lock className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                {isReadOnly ? 'Lockdown Read Only' : 'Lockdown Management'}
              </div>
              <h3
                className="mt-3 text-[20px] font-display"
                style={{ color: colors.charcoal, lineHeight: 1.05 }}
              >
                Summary-first control for the trusted Lockdown contract
              </h3>
              <p
                className="mt-2 text-[13px] font-body"
                style={{ color: 'rgba(41,40,39,0.62)' }}
              >
                {panelDescription}
              </p>
            </div>

            <div
              className="rounded-2xl border px-4 py-4"
              style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
            >
              <p
                className="text-[11px] uppercase tracking-[0.16em] font-label"
                style={{ color: 'rgba(41,40,39,0.45)' }}
              >
                Current Plan
              </p>
              <p className="mt-1 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                {planName}
              </p>
              <p
                className="mt-2 text-[12px] font-body"
                style={{ color: isReadOnly ? colors.amethyst : 'rgba(41,40,39,0.55)' }}
              >
                {isReadOnly ? 'Pairing and edits disabled' : 'Pairing and edits enabled'}
              </p>
              <p
                className="mt-2 text-[12px] font-body"
                style={{ color: 'rgba(41,40,39,0.55)' }}
              >
                {pluralize(students.length, 'student')} on this account
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {isReadOnly ? (
            <div
              className="rounded-2xl border px-4 py-4"
              style={{ borderColor: colors.lavender, backgroundColor: colors.lavenderTint }}
            >
              <p
                className="text-[12px] uppercase tracking-wider font-label"
                style={{ color: colors.amethyst }}
              >
                Upgrade Required For Active Management
              </p>
              <p className="mt-1.5 text-[14px] font-body" style={{ color: colors.charcoal }}>
                {lockdownAccess?.upgradeCopy || 'Upgrade to Lockdown to unlock student-bound pairing and Lockdown management.'}
              </p>
              <p
                className="mt-2 text-[13px] font-body"
                style={{ color: 'rgba(41,40,39,0.68)' }}
              >
                {lockdownAccess?.savedPolicyCopy || 'Saved Lockdown setup stays visible on downgrade and becomes manageable again after re-upgrade.'}
              </p>
              <p
                className="mt-2 text-[13px] font-body"
                style={{ color: 'rgba(41,40,39,0.68)' }}
              >
                {lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore trusted device pairing and Lockdown management.'}
              </p>
            </div>
          ) : null}

          <section
            className="rounded-[24px] border px-5 py-5"
            style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-4">
                <div>
                  <p
                    className="text-[11px] uppercase tracking-[0.16em] font-label"
                    style={{ color: colors.amethyst }}
                  >
                    Selected Student
                  </p>
                  <h4 className="mt-2 text-[24px] font-display" style={{ color: colors.charcoal, lineHeight: 1.05 }}>
                    Choose the student this browser belongs to
                  </h4>
                  <p className="mt-2 text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                    Trusted enrollment stays student-bound. The summary cards below follow this selection so pairing, schedule review, and current policy checks stay anchored to the right learner.
                  </p>
                </div>

                {students.length === 0 ? (
                  <div
                    className="rounded-2xl border px-4 py-4"
                    style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                  >
                    <p className="text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                      {summaryViewModel.guidance.title}
                    </p>
                    <p className="mt-1.5 text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.6)' }}>
                      {summaryViewModel.guidance.description}
                    </p>
                    <Link
                      to={studentsPath}
                      className="mt-4 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] font-label"
                      style={{ color: colors.amethyst }}
                    >
                      Open Students
                    </Link>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                        Student
                      </label>
                      <select
                        value={selectedStudentId}
                        onChange={handleStudentSelectionChange}
                        className={inputClassName}
                        style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                      >
                        {isMultiStudentAccount ? (
                          <option value="">
                            Select a student before pairing or reviewing the derived policy
                          </option>
                        ) : null}
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div
                      className="rounded-2xl border px-4 py-4"
                      style={{
                        borderColor: colors.parchment,
                        backgroundColor: summaryViewModel.guidance.kind === LockdownParentSummaryGuidanceKinds.READY
                          ? '#ffffff'
                          : `${colors.lavenderTint}66`,
                      }}
                    >
                      <p
                        className="text-[11px] uppercase tracking-[0.14em] font-label"
                        style={{ color: colors.amethyst }}
                      >
                        {summaryViewModel.guidance.kind === LockdownParentSummaryGuidanceKinds.READY
                          ? 'Student Bound'
                          : 'Selection Required'}
                      </p>
                      <p className="mt-1.5 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                        {summaryViewModel.guidance.title}
                      </p>
                      <p className="mt-1.5 text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                        {summaryViewModel.guidance.description}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryMetric
                  colors={colors}
                  label="Binding"
                  value={selectedStudent?.name || 'No student selected'}
                  detail={selectedStudent?.id ? `Student ID: ${selectedStudent.id}` : 'Choose a student to continue'}
                  accent
                />
                <SummaryMetric
                  colors={colors}
                  label="Schedule Snapshot"
                  value={selectedStudent ? summaryViewModel.schedule.summary_line : 'Waiting for selection'}
                  detail={selectedStudent ? `Updated ${selectedStudentUpdatedAtLabel}` : 'No student selected yet'}
                />
                <SummaryMetric
                  colors={colors}
                  label="Pairing Access"
                  value={canPairDevices ? 'Enabled' : 'Read-only'}
                  detail={canPairDevices ? 'Trusted enrollment can be issued for the selected student.' : 'Pairing stays visible but disabled on the current plan.'}
                />
                <SummaryMetric
                  colors={colors}
                  label="Current State"
                  value={selectedStudent ? (derivedPreviewLoading ? 'Loading preview' : derivedStateMeta.label) : 'Choose a student'}
                  detail={selectedStudent ? derivedStateMeta.description : 'The selected student drives the derived policy preview.'}
                />
              </div>
            </div>
          </section>

          <section>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {statusStripItems.map((item) => (
                <SummaryMetric
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  detail={item.detail}
                  colors={colors}
                  accent={item.accent}
                />
              ))}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <SummaryCard
              colors={colors}
              icon={CalendarDays}
              eyebrow="Weekly Schedule"
              title="School-time summary"
              description="Review the selected student's school days and hours. Outside this schedule, Lockdown network blocking is off in the current product model."
              metrics={[
                {
                  label: 'School Days',
                  value: selectedStudent ? pluralize(summaryViewModel.schedule.school_day_count, 'day') : 'Waiting for selection',
                  detail: selectedStudent ? summaryViewModel.schedule.days_label : 'Choose a student first',
                  accent: true,
                },
                {
                  label: 'School Hours',
                  value: selectedStudent ? summaryViewModel.schedule.hours_label : 'Not available',
                  detail: selectedStudent ? summaryViewModel.schedule.legacy_off_hours_note : 'Choose a student first',
                },
              ]}
              actionLabel="Edit Schedule"
              onAction={() => openScheduleModal()}
              disabled={summaryViewModel.actions.edit_schedule_disabled}
              disabledReason={!selectedStudent
                ? 'Select a student before editing schedule rules.'
                : (!canManagePolicy ? (lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore Lockdown management.') : '')}
            />

            <SummaryCard
              colors={colors}
              icon={Globe}
              eyebrow="Off-Block Resources"
              title="Approved resource summary"
              description="Manage the household school-time resource library for websites and YouTube creators, then assign each entry to all students or selected siblings."
              metrics={[
                {
                  label: 'Total Resources',
                  value: selectedStudent ? pluralize(summaryViewModel.off_block_resources.total, 'resource') : 'Waiting for selection',
                  detail: selectedStudent
                    ? `${pluralize(summaryViewModel.off_block_resources.active_library_total, 'active library entry')} in the household`
                    : 'Choose a student first',
                  accent: true,
                },
                {
                  label: 'Websites / Creators',
                  value: selectedStudent
                    ? `${summaryViewModel.off_block_resources.websites} / ${summaryViewModel.off_block_resources.youtube_creators}`
                    : 'Not available',
                  detail: selectedStudent
                    ? `${pluralize(summaryViewModel.off_block_resources.assigned_student_count, 'student')} covered · ${pluralize(summaryViewModel.off_block_resources.archived_total, 'archived entry')}`
                    : 'Website origins / YouTube creators',
                },
              ]}
              actionLabel="Manage Resources"
              onAction={() => openResourceModal()}
              disabled={summaryViewModel.actions.manage_resources_disabled}
              disabledReason={!selectedStudent
                ? 'Select a student before managing off-block resources.'
                : (!canManagePolicy ? (lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore Lockdown management.') : '')}
            />

            <SummaryCard
              colors={colors}
              icon={Shield}
              eyebrow="Paired Devices"
              title="Review trusted devices"
              description={`See the selected student's paired browsers, stale warnings, and parent-only revoke path. A device turns stale after ${LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS} days without a check-in or policy sync.`}
              metrics={[
                {
                  label: 'Selected Student',
                  value: selectedStudent ? pluralize(summaryViewModel.devices.total, 'device') : 'Choose a student',
                  detail: selectedStudent ? `Filtered to ${selectedStudent.name}` : 'Choose a student to filter the device list',
                  accent: true,
                },
                {
                  label: 'Attention Needed',
                  value: canManagePolicy ? pluralize(summaryViewModel.devices.attention_needed, 'device') : 'Disabled',
                  detail: canManagePolicy
                    ? `${summaryViewModel.devices.stale} stale · ${summaryViewModel.devices.revoked} revoked · ${summaryViewModel.devices.inactive} inactive`
                    : 'Device review is unavailable on the current plan',
                },
              ]}
              actionLabel="Manage Devices"
              onAction={() => openDevicesModal()}
              disabled={summaryViewModel.actions.manage_devices_disabled}
              disabledReason={!selectedStudent
                ? 'Choose a student before reviewing device status.'
                : (canManagePolicy ? '' : (lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore trusted device management.'))}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {selectedDeviceSummaryPills.map((item) => {
                  const meta = DEVICE_STATUS_META[item.state];

                  return (
                    <div
                      key={item.key}
                      className="rounded-xl border px-3 py-2"
                      style={{
                        borderColor: meta.borderColor,
                        backgroundColor: meta.backgroundColor,
                      }}
                    >
                      <p
                        className="text-[10px] uppercase tracking-[0.12em] font-label"
                        style={{ color: meta.textColor }}
                      >
                        {item.label}
                      </p>
                      <p
                        className="mt-1 text-[16px] font-display"
                        style={{ color: colors.charcoal, lineHeight: 1.05 }}
                      >
                        {item.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </SummaryCard>

            <SummaryCard
              colors={colors}
              icon={Monitor}
              eyebrow="Pair A Browser"
              title="Trusted enrollment"
              description="Open the guided pairing surface, issue a short-lived code, and keep the hardening guidance honest about managed Chrome limits."
              metrics={[
                {
                  label: 'Selected Student',
                  value: selectedStudent?.name || 'Choose a student',
                  detail: selectedStudent?.id || 'No student selected yet',
                  accent: true,
                },
                {
                  label: 'Code Status',
                  value: trustedEnrollmentCode ? 'Code ready' : 'Not issued',
                  detail: trustedEnrollmentCode ? trustedEnrollmentExpiresLabel : 'Generate a trusted code when you are ready to pair',
                },
              ]}
              actionLabel="Pair A Browser"
              onAction={() => openPairingWizard()}
              disabled={summaryViewModel.actions.pair_browser_disabled}
              disabledReason={!selectedStudent
                ? 'Choose a student before pairing a browser profile.'
                : (!canPairDevices ? (lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore trusted device pairing.') : '')}
            />

            <SummaryCard
              colors={colors}
              icon={FileText}
              eyebrow="Allowed Right Now"
              title="Current effective allowlist"
              description="See what the selected student's current Lockdown policy is doing right now, grouped by system resources, parent-approved school-time resources, and active-block resources."
              metrics={[
                {
                  label: 'Current State',
                  value: selectedStudent ? (derivedPreviewLoading ? 'Loading preview' : summaryViewModel.allowed_right_now.state_label) : 'Waiting for selection',
                  detail: selectedStudent
                    ? (derivedPolicyPreview?.policy_state === LockdownPolicyStates.OUTSIDE_SCHOOL_TIME
                      ? 'Lockdown blocking is off outside the saved schedule.'
                      : `${summaryViewModel.allowed_right_now.allowed_origin_count} origins · ${summaryViewModel.allowed_right_now.allowed_creator_count} creators`)
                    : 'Choose a student first',
                  accent: true,
                },
                {
                  label: 'Source Groups',
                  value: selectedStudent ? pluralize(summaryViewModel.allowed_right_now.source_groups.length, 'group') : 'Not available',
                  detail: selectedStudent
                    ? `${summaryViewModel.allowed_right_now.system_resource_count} system resources modeled separately`
                    : 'Select a student to review the current policy',
                },
              ]}
              actionLabel="Open Preview"
              onAction={() => setActiveModal(LOCKDOWN_MODAL_IDS.ALLOWED)}
              disabled={summaryViewModel.actions.allowed_right_now_disabled}
              disabledReason={selectedStudent ? '' : 'Select a student before reviewing the derived allowlist.'}
            />

            <SummaryCard
              colors={colors}
              icon={Clock3}
              eyebrow="Advanced Diagnostics"
              title="Compatibility and internals"
              description="Keep legacy PoC access, contract names, and saved compatibility material behind a deliberate advanced entry point."
              metrics={[
                {
                  label: 'Legacy Snapshot',
                  value: legacyPolicyReady ? (hasLegacyPolicyDocument ? 'Saved document found' : 'No saved document') : 'Loading snapshot',
                  detail: `Last saved ${legacyPolicyUpdatedAtLabel}`,
                  accent: true,
                },
                {
                  label: 'PoC Material',
                  value: legacyPocPairingCode ? 'Available' : 'Unavailable',
                  detail: currentUser?.uid || 'No parent boundary available',
                },
              ]}
              actionLabel="Open Advanced"
              onAction={() => setActiveModal(LOCKDOWN_MODAL_IDS.ADVANCED)}
            />
          </section>
        </div>
      </section>

      <LockdownModalFrame
        colors={colors}
        isOpen={activeModal === LOCKDOWN_MODAL_IDS.SCHEDULE}
        onClose={closeActiveModal}
        eyebrow="Weekly Schedule"
        title="Weekly school-time schedule"
        description="Edit the days and hours that define school time for the selected student. Legacy off-hours window records stay preserved for compatibility, but they are not the parent workflow in this phase."
      >
        {!selectedStudent ? (
          <div
            className="rounded-2xl border px-4 py-4"
            style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
          >
            <p className="text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
              Select a student before editing school-time schedule rules.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
              <div>
                <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                  School Days
                </label>
                <DayToggleGroup
                  colors={colors}
                  days={scheduleDraft.school_days}
                  disabled={!canManagePolicy}
                  onToggle={handleToggleSchoolDay}
                />
              </div>

              <div>
                <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                  School Day Starts
                </label>
                <input
                  type="time"
                  value={scheduleDraft.school_day_start_time}
                  onChange={(event) => updateScheduleDraft((currentSchedule) => ({
                    ...currentSchedule,
                    school_day_start_time: event.target.value,
                  }))}
                  disabled={!canManagePolicy}
                  className={inputClassName}
                  style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                />
              </div>

              <div>
                <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                  School Day Ends
                </label>
                <input
                  type="time"
                  value={scheduleDraft.school_day_end_time}
                  onChange={(event) => updateScheduleDraft((currentSchedule) => ({
                    ...currentSchedule,
                    school_day_end_time: event.target.value,
                  }))}
                  disabled={!canManagePolicy}
                  className={inputClassName}
                  style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <SummaryMetric
                colors={colors}
                label="Selected Student"
                value={selectedStudent.name}
                detail={selectedStudent.id}
                accent
              />
              <SummaryMetric
                colors={colors}
                label="Saved Schedule"
                value={summaryViewModel.schedule.days_label}
                detail={summaryViewModel.schedule.hours_label}
              />
              <SummaryMetric
                colors={colors}
                label="Legacy Off-Hours Data"
                value={pluralize(summaryViewModel.schedule.legacy_off_hours_window_count, 'saved window')}
                detail={summaryViewModel.schedule.legacy_off_hours_note}
              />
            </div>

            <div
              className="rounded-2xl border px-4 py-4"
              style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
            >
              <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                School-time resources are managed from the household resource library.
              </p>
              <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.58)' }}>
                Parent-approved websites and YouTube creators remain a separate school-time workflow. Saved legacy off-hours windows stay readable in the data model, but they do not control outside-schedule blocking in this phase.
              </p>
            </div>

            <div
              className="rounded-2xl border px-4 py-4"
              style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                    Saved schedule for {selectedStudent.name}
                  </p>
                  <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                    School days: {summaryViewModel.schedule.days_label} · {summaryViewModel.schedule.hours_label}
                  </p>
                  {scheduleError ? (
                    <p className="mt-2 text-[12px] font-body" style={{ color: '#b42318', fontWeight: 540 }}>
                      {scheduleError}
                    </p>
                  ) : null}
                  {scheduleSuccess ? (
                    <p className="mt-2 text-[12px] font-body" style={{ color: '#0f7b41', fontWeight: 540 }}>
                      {scheduleSuccess}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={!selectedStudent?.id || !canManagePolicy || !isScheduleDirty || savingSchedule}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[12px] font-label uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ backgroundColor: colors.charcoal, color: '#ffffff' }}
                >
                  <Save className="h-4 w-4" />
                  {savingSchedule ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </div>
          </div>
        )}
      </LockdownModalFrame>

      <LockdownModalFrame
        colors={colors}
        isOpen={activeModal === LOCKDOWN_MODAL_IDS.RESOURCES}
        onClose={closeActiveModal}
        eyebrow="Household Resource Library"
        title="Websites and YouTube creators for school-time access"
        description="Save approved household resources once, assign them to all students or selected siblings, and feed the derived policy preview from the same trusted records."
        size="max-w-6xl"
      >
        {!selectedStudent ? (
          <div
            className="rounded-2xl border px-4 py-4"
            style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
          >
            <p className="text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
              Select a student before managing the household resource library.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryMetric
                colors={colors}
                label="Selected Student"
                value={selectedStudent.name}
                detail={selectedStudent.id}
                accent
              />
              <SummaryMetric
                colors={colors}
                label="Assigned To Student"
                value={pluralize(summaryViewModel.off_block_resources.total, 'resource')}
                detail={`${summaryViewModel.off_block_resources.websites} websites · ${summaryViewModel.off_block_resources.youtube_creators} creators`}
              />
              <SummaryMetric
                colors={colors}
                label="Household Coverage"
                value={pluralize(summaryViewModel.off_block_resources.assigned_student_count, 'student')}
                detail={`${pluralize(summaryViewModel.off_block_resources.active_library_total, 'active entry')} · ${pluralize(summaryViewModel.off_block_resources.archived_total, 'archived entry')}`}
              />
              <SummaryMetric
                colors={colors}
                label="Preview Inputs"
                value={pluralize(assignedHouseholdResources.length, 'resource')}
                detail="Assigned household resources flow into school-time policy derivation"
              />
            </div>

            {lockdownResourceLibraryError ? (
              <div
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
              >
                <p className="text-[12px] font-body" style={{ color: '#b42318', fontWeight: 540 }}>
                  {lockdownResourceLibraryError}
                </p>
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="rounded-2xl border px-4 py-4" style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}>
                    <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                      Search Library
                    </label>
                    <div
                      className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
                      style={{ borderColor: colors.parchment }}
                    >
                      <Search className="h-4 w-4" style={{ color: 'rgba(41,40,39,0.45)' }} />
                      <input
                        type="text"
                        value={resourceModalSearch}
                        onChange={(event) => setResourceModalSearch(event.target.value)}
                        placeholder="Search by name, URL, creator, or assignment"
                        className="w-full bg-transparent text-[14px] focus:outline-none"
                        style={{ color: colors.charcoal }}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border px-4 py-4" style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}>
                    <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                      Filter By Student
                    </label>
                    <select
                      value={resourceModalStudentFilterId}
                      onChange={(event) => setResourceModalStudentFilterId(event.target.value)}
                      className={inputClassName}
                      style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                    >
                      <option value={LOCKDOWN_RESOURCE_FILTER_ALL_STUDENTS}>All active students</option>
                      {activeStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { id: LOCKDOWN_RESOURCE_FILTERS.ACTIVE, label: 'Active' },
                    { id: LOCKDOWN_RESOURCE_FILTERS.ARCHIVED, label: 'Archived' },
                    { id: LOCKDOWN_RESOURCE_FILTERS.ALL, label: 'All' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setResourceModalStatusFilter(option.id)}
                      className="rounded-full px-4 py-2 text-[12px] font-label uppercase tracking-[0.14em]"
                      style={{
                        backgroundColor: resourceModalStatusFilter === option.id ? colors.amethyst : '#ffffff',
                        border: `1px solid ${resourceModalStatusFilter === option.id ? colors.amethyst : colors.parchment}`,
                        color: resourceModalStatusFilter === option.id ? '#ffffff' : colors.charcoal,
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {!lockdownResourceLibraryReady ? (
                    <div
                      className="rounded-2xl border px-4 py-4"
                      style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                    >
                      <p className="text-[13px] font-body" style={{ color: colors.charcoal }}>
                        Loading the household resource library...
                      </p>
                    </div>
                  ) : visibleResourceLibraryEntries.length ? (
                    visibleResourceLibraryEntries.map((resource) => {
                      const assignmentSummary = buildLockdownResourceAssignmentSummary({
                        resource,
                        students: activeStudents,
                      });
                      const resourceKind = getLockdownResourceEditorKind(resource);

                      return (
                        <div
                          key={resource.id || `${resource.name}_${resource.url}`}
                          className="rounded-2xl border px-4 py-4"
                          style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                                  {resource.name || 'Untitled resource'}
                                </p>
                                <span
                                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] font-label"
                                  style={{
                                    backgroundColor: resourceKind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE
                                      ? `${colors.lavenderTint}`
                                      : '#fbfaf8',
                                    color: resourceKind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE
                                      ? colors.amethyst
                                      : colors.charcoal,
                                  }}
                                >
                                  {resourceKind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE ? 'YouTube creator' : 'Website'}
                                </span>
                                <span
                                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] font-label"
                                  style={{
                                    backgroundColor: resource.is_active ? '#eef8f1' : '#fbfaf8',
                                    color: resource.is_active ? '#23693f' : 'rgba(41,40,39,0.62)',
                                  }}
                                >
                                  {resource.is_active ? 'Active' : 'Archived'}
                                </span>
                              </div>
                              <p className="mt-2 break-all text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                                {resourceKind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE
                                  ? (resource.youtube_channel_id || resource.url || 'YouTube creator metadata needed')
                                  : (resource.lockdown_origin || resource.url || 'Origin not available')}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                                <span>{assignmentSummary.label}</span>
                                {resource.youtube_channel_handle ? (
                                  <span>{resource.youtube_channel_handle}</span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openResourceModal({ resource, nextStudentFilterId: resourceModalStudentFilterId })}
                                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em]"
                                style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => { void handleArchiveResource(resource, !resource.is_active); }}
                                disabled={resourceSavePending}
                                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45"
                                style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                              >
                                {resource.is_active ? 'Archive' : 'Restore'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { void handleDeleteResource(resource); }}
                                disabled={removingResourceId === resource.id}
                                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45"
                                style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {removingResourceId === resource.id ? 'Removing...' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div
                      className="rounded-2xl border px-4 py-4"
                      style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                    >
                      <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                        No resource entries match the current filters.
                      </p>
                      <p className="mt-1.5 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.6)' }}>
                        Add a website or YouTube creator on the right, or clear the search and filter choices.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border px-4 py-4" style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartNewResource(LOCKDOWN_RESOURCE_EDITOR_KINDS.WEBSITE)}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-label uppercase tracking-[0.14em]"
                      style={{
                        backgroundColor: resourceEditorDraft.editor_kind === LOCKDOWN_RESOURCE_EDITOR_KINDS.WEBSITE ? colors.amethyst : '#ffffff',
                        border: `1px solid ${resourceEditorDraft.editor_kind === LOCKDOWN_RESOURCE_EDITOR_KINDS.WEBSITE ? colors.amethyst : colors.parchment}`,
                        color: resourceEditorDraft.editor_kind === LOCKDOWN_RESOURCE_EDITOR_KINDS.WEBSITE ? '#ffffff' : colors.charcoal,
                      }}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Website
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartNewResource(LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE)}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-label uppercase tracking-[0.14em]"
                      style={{
                        backgroundColor: resourceEditorDraft.editor_kind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE ? colors.amethyst : '#ffffff',
                        border: `1px solid ${resourceEditorDraft.editor_kind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE ? colors.amethyst : colors.parchment}`,
                        color: resourceEditorDraft.editor_kind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE ? '#ffffff' : colors.charcoal,
                      }}
                    >
                      <Youtube className="h-3.5 w-3.5" />
                      YouTube Creator
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div>
                      <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                        Resource Name
                      </label>
                      <input
                        type="text"
                        value={resourceEditorDraft.name || ''}
                        onChange={(event) => updateResourceEditorDraft((currentDraft) => ({
                          ...currentDraft,
                          name: event.target.value,
                        }))}
                        placeholder={resourceEditorDraft.editor_kind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE ? 'Khan Academy' : 'ReadWorks'}
                        className={inputClassName}
                        style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                      />
                    </div>

                    <div>
                      <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                        {resourceEditorDraft.editor_kind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE
                          ? 'Creator URL, Handle, Watch URL, Or Channel ID'
                          : 'Website URL Or Origin'}
                      </label>
                      <input
                        type="text"
                        value={resourceEditorDraft.url || ''}
                        onChange={(event) => updateResourceEditorDraft((currentDraft) => ({
                          ...currentDraft,
                          url: event.target.value,
                        }))}
                        placeholder={resourceEditorDraft.editor_kind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE
                          ? 'https://www.youtube.com/@khanacademy'
                          : 'https://www.readworks.org'}
                        className={inputClassName}
                        style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                      />
                    </div>

                    {resourceEditorDraft.editor_kind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                            Channel ID
                          </label>
                          <input
                            type="text"
                            value={resourceEditorDraft.youtube_channel_id || ''}
                            onChange={(event) => updateResourceEditorDraft((currentDraft) => ({
                              ...currentDraft,
                              youtube_channel_id: event.target.value,
                            }))}
                            placeholder="UC4a-Gbdw7vOaccHmFo40b9g"
                            className={inputClassName}
                            style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                          />
                        </div>
                        <div>
                          <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                            Channel Handle
                          </label>
                          <input
                            type="text"
                            value={resourceEditorDraft.youtube_channel_handle || ''}
                            onChange={(event) => updateResourceEditorDraft((currentDraft) => ({
                              ...currentDraft,
                              youtube_channel_handle: event.target.value,
                            }))}
                            placeholder="@khanacademy"
                            className={inputClassName}
                            style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                            Channel Title
                          </label>
                          <input
                            type="text"
                            value={resourceEditorDraft.youtube_channel_title || ''}
                            onChange={(event) => updateResourceEditorDraft((currentDraft) => ({
                              ...currentDraft,
                              youtube_channel_title: event.target.value,
                            }))}
                            placeholder="Khan Academy"
                            className={inputClassName}
                            style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                          Origin Override
                        </label>
                        <input
                          type="text"
                          value={resourceEditorDraft.lockdown_origin || ''}
                          onChange={(event) => updateResourceEditorDraft((currentDraft) => ({
                            ...currentDraft,
                            lockdown_origin: event.target.value,
                          }))}
                          placeholder="https://www.readworks.org"
                          className={inputClassName}
                          style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                        />
                      </div>
                    )}

                    <div>
                      <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                        Assignment Scope
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updateResourceEditorDraft((currentDraft) => ({
                            ...currentDraft,
                            assign_to_all_students: true,
                            student_ids: [],
                          }))}
                          className="rounded-full px-4 py-2 text-[12px] font-label uppercase tracking-[0.14em]"
                          style={{
                            backgroundColor: resourceEditorDraft.assign_to_all_students ? colors.amethyst : '#ffffff',
                            border: `1px solid ${resourceEditorDraft.assign_to_all_students ? colors.amethyst : colors.parchment}`,
                            color: resourceEditorDraft.assign_to_all_students ? '#ffffff' : colors.charcoal,
                          }}
                        >
                          All Active Students
                        </button>
                        <button
                          type="button"
                          onClick={() => updateResourceEditorDraft((currentDraft) => ({
                            ...currentDraft,
                            assign_to_all_students: false,
                            student_ids: currentDraft.student_ids.length
                              ? currentDraft.student_ids
                              : (selectedStudentId ? [selectedStudentId] : []),
                          }))}
                          className="rounded-full px-4 py-2 text-[12px] font-label uppercase tracking-[0.14em]"
                          style={{
                            backgroundColor: resourceEditorDraft.assign_to_all_students ? '#ffffff' : colors.amethyst,
                            border: `1px solid ${resourceEditorDraft.assign_to_all_students ? colors.parchment : colors.amethyst}`,
                            color: resourceEditorDraft.assign_to_all_students ? colors.charcoal : '#ffffff',
                          }}
                        >
                          Selected Students
                        </button>
                      </div>
                    </div>

                    {!resourceEditorDraft.assign_to_all_students ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {activeStudents.map((student) => {
                          const isChecked = resourceEditorDraft.student_ids.includes(student.id);

                          return (
                            <label
                              key={student.id}
                              className="flex items-center gap-3 rounded-xl border px-3 py-3"
                              style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => updateResourceEditorDraft((currentDraft) => ({
                                  ...currentDraft,
                                  student_ids: isChecked
                                    ? currentDraft.student_ids.filter((studentId) => studentId !== student.id)
                                    : [...currentDraft.student_ids, student.id],
                                }))}
                              />
                              <span className="text-[13px] font-body" style={{ color: colors.charcoal }}>
                                {student.name}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className="mt-4 rounded-2xl border px-4 py-4"
                    style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
                  >
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: colors.amethyst }} />
                      <div>
                        <p className="text-[12px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                          Validation
                        </p>
                        <p className="mt-1.5 text-[13px] font-body" style={{ color: colors.charcoal }}>
                          {resourceEditorValidation.error
                            ? resourceEditorValidation.error
                            : resourceEditorDraft.editor_kind === LOCKDOWN_RESOURCE_EDITOR_KINDS.YOUTUBE
                              ? `Creator resolves to ${resourceEditorValidation.resource.youtube_channel_id || resourceEditorValidation.resource.url || 'pending metadata'}`
                              : `Website resolves to ${resourceEditorValidation.resource.lockdown_origin || resourceEditorValidation.resource.url || 'pending origin'}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {resourceEditorError ? (
                    <p className="mt-3 text-[12px] font-body" style={{ color: '#b42318', fontWeight: 540 }}>
                      {resourceEditorError}
                    </p>
                  ) : null}
                  {resourceEditorSuccess ? (
                    <p className="mt-3 text-[12px] font-body" style={{ color: '#0f7b41', fontWeight: 540 }}>
                      {resourceEditorSuccess}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { void handleSaveResource(); }}
                      disabled={resourceSavePending || isRemovingEditedResource}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[12px] font-label uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
                      style={{ backgroundColor: colors.charcoal, color: '#ffffff' }}
                    >
                      <Save className="h-4 w-4" />
                      {resourceSavePending ? 'Saving...' : (resourceEditorDraft.id ? 'Save Resource' : 'Add Resource')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartNewResource(resourceEditorDraft.editor_kind)}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[12px] font-label uppercase tracking-[0.14em]"
                      style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                    >
                      <Plus className="h-4 w-4" />
                      New Entry
                    </button>
                    {resourceEditorDraft.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { void handleArchiveResource(resourceEditorDraft, !resourceEditorDraft.is_active); }}
                          disabled={resourceSavePending}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[12px] font-label uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
                          style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                        >
                          {resourceEditorDraft.is_active ? 'Archive' : 'Restore'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleDeleteResource(resourceEditorDraft); }}
                          disabled={isRemovingEditedResource}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[12px] font-label uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
                          style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                        >
                          <Trash2 className="h-4 w-4" />
                          {isRemovingEditedResource ? 'Removing...' : 'Remove'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border px-4 py-4" style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}>
                  <p className="text-[12px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                    Current Preview Inputs
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-[12px] uppercase tracking-[0.12em] font-label" style={{ color: 'rgba(41,40,39,0.45)' }}>
                        Assigned Household Resources
                      </p>
                      <div className="mt-2 space-y-2">
                        {assignedHouseholdResources.length ? assignedHouseholdResources.map((resource) => (
                          <div key={`assigned_${resource.id || resource.url}`} className="rounded-xl px-3 py-3" style={{ backgroundColor: '#fbfaf8' }}>
                            <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                              {resource.name}
                            </p>
                            <p className="mt-1 break-all text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.6)' }}>
                              {resource.lockdown_origin || resource.youtube_channel_id || resource.url}
                            </p>
                          </div>
                        )) : (
                          <p className="text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.6)' }}>
                            No household resources are assigned to {selectedStudent.name}.
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[12px] uppercase tracking-[0.12em] font-label" style={{ color: 'rgba(41,40,39,0.45)' }}>
                        Active Block Resources
                      </p>
                      <div className="mt-2 space-y-2">
                        {activeBlockResources.length ? activeBlockResources.map((resource, resourceIndex) => (
                          <div key={`block_${resourceIndex}_${resource.url || resource.name}`} className="rounded-xl px-3 py-3" style={{ backgroundColor: '#fbfaf8' }}>
                            <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                              {resource.name || 'Block resource'}
                            </p>
                            <p className="mt-1 break-all text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.6)' }}>
                              {resource.url || resource.lockdown_origin || 'No URL'}
                            </p>
                          </div>
                        )) : (
                          <p className="text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.6)' }}>
                            No active block resources are contributing right now.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </LockdownModalFrame>

      <LockdownModalFrame
        colors={colors}
        isOpen={activeModal === LOCKDOWN_MODAL_IDS.PAIRING}
        onClose={closeActiveModal}
        eyebrow="Pair A Browser"
        title="Pair a student browser"
        description="Follow the same trusted enrollment flow with a parent-friendly setup checklist: student binding, Chrome profile prep, one-time code exchange, secure sync confirmation, and honest hardening guidance."
        size="max-w-5xl"
      >
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {PAIRING_WIZARD_STEPS.map((step, index) => {
              const isActive = index === pairingWizardStepIndex;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handlePairingWizardStepChange(index)}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.12em] font-label transition-colors"
                  style={{
                    borderColor: isActive ? colors.amethyst : colors.parchment,
                    backgroundColor: isActive ? `${colors.lavenderTint}90` : '#ffffff',
                    color: isActive ? colors.amethyst : colors.charcoal,
                  }}
                >
                  <span>{index + 1}</span>
                  <span>{step.title}</span>
                </button>
              );
            })}
          </div>

          <div
            className="rounded-[24px] border px-5 py-5"
            style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p
                  className="text-[11px] uppercase tracking-[0.14em] font-label"
                  style={{ color: colors.amethyst }}
                >
                  Step {pairingWizardStepIndex + 1} of {PAIRING_WIZARD_STEPS.length} · {activePairingStep.eyebrow}
                </p>
                <h4
                  className="mt-2 text-[20px] font-display"
                  style={{ color: colors.charcoal, lineHeight: 1.05 }}
                >
                  {activePairingStep.title}
                </h4>
                <p className="mt-2 text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                  {activePairingStep.description}
                </p>
              </div>

              <div className="grid gap-3 sm:min-w-[260px]">
                <SummaryMetric
                  colors={colors}
                  label="Student Binding"
                  value={selectedStudent?.name || 'No student selected'}
                  detail={trustedEnrollment?.student_id || selectedStudent?.id || 'Choose a student before pairing'}
                  accent
                />
                <SummaryMetric
                  colors={colors}
                  label="Pairing Access"
                  value={canPairDevices ? 'Enabled' : 'Read-only'}
                  detail={canPairDevices
                    ? 'Short-lived trusted enrollment codes can be issued from this parent account.'
                    : 'Upgrade is required before pairing a new learning browser.'}
                />
              </div>
            </div>

            {activePairingStep.id === 'student' ? (
              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <div
                  className="rounded-2xl border px-4 py-4 lg:col-span-2"
                  style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
                >
                  <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                    {selectedStudent
                      ? `${selectedStudent.name} is the learner bound to this browser.`
                      : 'Choose a student before generating a trusted enrollment code.'}
                  </p>
                  <p className="mt-2 text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                    Every paired learning browser stays student-bound. Schedule windows, parent-approved school-time resources, and published weekly-plan reads all resolve against this student record.
                  </p>
                </div>
                <div
                  className="rounded-2xl border px-4 py-4"
                  style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                    Confirm Before Continuing
                  </p>
                  <ul className="mt-3 space-y-2 text-[13px] font-body" style={{ color: colors.charcoal }}>
                    <li>Use the student’s learning Chrome profile.</li>
                    <li>Keep one student per paired browser profile.</li>
                    <li>Re-pair instead of reusing another student’s code.</li>
                  </ul>
                </div>
              </div>
            ) : null}

            {activePairingStep.id === 'browser' ? (
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <div
                  className="rounded-2xl border px-4 py-4"
                  style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                    Browser Prep
                  </p>
                  <ul className="mt-3 space-y-2 text-[13px] font-body" style={{ color: colors.charcoal }}>
                    <li>Open the Chrome profile the student will actually use for school time.</li>
                    <li>Install or reload the Lockdown extension in that profile.</li>
                    <li>Keep parent/admin Chrome browsing in a separate profile.</li>
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href="chrome://extensions"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em]"
                      style={{ backgroundColor: colors.charcoal, color: '#ffffff' }}
                    >
                      Open Chrome Extensions
                    </a>
                    <a
                      href="https://chromeenterprise.google/products/cloud-management/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em]"
                      style={{ borderColor: colors.parchment, color: colors.charcoal }}
                    >
                      Chrome Browser Management
                    </a>
                  </div>
                </div>

                <div
                  className="rounded-2xl border px-4 py-4"
                  style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                    Why This Matters
                  </p>
                  <p className="mt-3 text-[13px] font-body" style={{ color: colors.charcoal }}>
                    The trusted credential belongs to the student profile you pair here. If the student uses another profile or browser, Lockdown will not follow automatically.
                  </p>
                </div>
              </div>
            ) : null}

            {activePairingStep.id === 'code' ? (
              <div
                className="mt-5 rounded-2xl border px-4 py-4"
                style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
              >
                <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                  Trusted Enrollment Code
                </p>
                <p className="mt-3 break-all text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                  {trustedEnrollmentDisplayText}
                </p>
                <p className="mt-2 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                  {trustedEnrollmentExpiresLabel}
                </p>
                {trustedEnrollmentError ? (
                  <p className="mt-2 text-[12px] font-body" style={{ color: '#b42318', fontWeight: 540 }}>
                    {trustedEnrollmentError}
                  </p>
                ) : null}
                {copyMessage ? (
                  <p className="mt-2 text-[12px] font-body" style={{ color: '#0f7b41', fontWeight: 540 }}>
                    {copyMessage}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleIssueTrustedEnrollment}
                    disabled={!selectedStudent?.id || !canPairDevices || issuingTrustedEnrollment}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                    style={{ backgroundColor: colors.charcoal, color: '#ffffff' }}
                  >
                    {issuingTrustedEnrollment ? 'Generating...' : 'Generate Trusted Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(trustedEnrollmentCode, 'trusted enrollment code', { requiresPairingAccess: true })}
                    disabled={!trustedEnrollmentCode || !canPairDevices}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                    style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Code
                  </button>
                </div>
              </div>
            ) : null}

            {activePairingStep.id === 'sync' ? (
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <div
                  className="rounded-2xl border px-4 py-4"
                  style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                    Secure Sync Checklist
                  </p>
                  <ul className="mt-3 space-y-2 text-[13px] font-body" style={{ color: colors.charcoal }}>
                    <li>Paste the one-time code into the extension setup page.</li>
                    <li>Confirm the extension shows the expected student name.</li>
                    <li>Wait for the extension to report secure sync instead of cached fallback.</li>
                    <li>Return here and check that the paired browser appears in device summaries.</li>
                  </ul>
                </div>

                <div
                  className="rounded-2xl border px-4 py-4"
                  style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                    Expected Parent View
                  </p>
                  <p className="mt-3 text-[13px] font-body" style={{ color: colors.charcoal }}>
                    After the first trusted sync, the selected student’s device summary should show a paired browser and the manage-devices modal should list its last seen and last policy sync times.
                  </p>
                </div>
              </div>
            ) : null}

            {activePairingStep.id === 'hardening' ? (
              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <div
                  className="rounded-2xl border px-4 py-4 lg:col-span-2"
                  style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                    Hardening Reality Check
                  </p>
                  <p className="mt-3 text-[13px] font-body" style={{ color: colors.charcoal }}>
                    Consumer Chrome can support trusted pairing and policy sync, but it cannot fully prevent a student from removing or disabling an extension. Use managed Chrome if you need force-install, restricted extension controls, or profile restrictions that survive ordinary user action.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href="https://support.google.com/chrome/a/answer/6306504?hl=en-EN"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em]"
                      style={{ borderColor: colors.parchment, color: colors.charcoal, backgroundColor: '#ffffff' }}
                    >
                      Auto-install Extensions
                    </a>
                    <a
                      href="https://chromeenterprise.google/policies/extension-install-forcelist/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em]"
                      style={{ borderColor: colors.parchment, color: colors.charcoal, backgroundColor: '#ffffff' }}
                    >
                      Extension Install Forcelist
                    </a>
                    <a
                      href="https://chromeenterprise.google/intl/en_au/policies/incognito-mode-availability/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em]"
                      style={{ borderColor: colors.parchment, color: colors.charcoal, backgroundColor: '#ffffff' }}
                    >
                      Incognito Restrictions
                    </a>
                  </div>
                </div>

                <div
                  className="rounded-2xl border px-4 py-4"
                  style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                    Parent Checklist
                  </p>
                  <ul className="mt-3 space-y-2 text-[13px] font-body" style={{ color: colors.charcoal }}>
                    <li>Keep parent and student Chrome profiles separate.</li>
                    <li>Use managed Chrome for force-install and policy enforcement.</li>
                    <li>Watch for stale warnings after {LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS} days offline.</li>
                  </ul>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handlePairingWizardStepChange(pairingWizardStepIndex - 1)}
              disabled={!canMovePairingWizardBackward}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
              style={{ borderColor: colors.parchment, color: colors.charcoal, backgroundColor: '#ffffff' }}
            >
              Back
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={closeActiveModal}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em]"
                style={{ borderColor: colors.parchment, color: colors.charcoal, backgroundColor: '#ffffff' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => (
                  canMovePairingWizardForward
                    ? handlePairingWizardStepChange(pairingWizardStepIndex + 1)
                    : closeActiveModal()
                )}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em]"
                style={{ backgroundColor: colors.charcoal, color: '#ffffff' }}
              >
                {canMovePairingWizardForward ? 'Next Step' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      </LockdownModalFrame>

      <LockdownModalFrame
        colors={colors}
        isOpen={activeModal === LOCKDOWN_MODAL_IDS.DEVICES}
        onClose={closeActiveModal}
        eyebrow="Paired Devices"
        title="Trusted device review and revocation"
        description="Each paired browser stores a server-owned device record. Revoking it immediately stops trusted policy reads for that credential."
      >
        {canManagePolicy ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                  {pluralize(visibleLockdownDeviceSummaries.length, 'device')}
                </p>
                <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                  {selectedStudent
                    ? `Filtered to ${selectedStudent.name}. Stale warnings start after ${LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS} days without a heartbeat or policy sync.`
                    : 'Choose a student before reviewing paired browsers.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => { void refreshLockdownDevices(); }}
                disabled={refreshingLockdownDevices}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[12px] font-label uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                style={{ backgroundColor: colors.charcoal, color: '#ffffff' }}
              >
                <RefreshCw className={`h-4 w-4 ${refreshingLockdownDevices ? 'animate-spin' : ''}`} />
                {refreshingLockdownDevices ? 'Refreshing...' : 'Refresh Devices'}
              </button>
            </div>

            {lockdownDevicesError ? (
              <p className="text-[12px] font-body" style={{ color: '#b42318', fontWeight: 540 }}>
                {lockdownDevicesError}
              </p>
            ) : null}

            {lockdownDevicesReady ? (
              visibleLockdownDeviceSummaries.length ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {selectedDeviceSummaryPills.map((item) => (
                        <SummaryMetric
                          key={item.key}
                          colors={colors}
                          label={item.label}
                          value={pluralize(item.value, 'device')}
                          detail={selectedStudent ? selectedStudent.name : 'Select a student'}
                          accent={item.state === LockdownDeviceSummaryStates.STALE}
                        />
                    ))}
                  </div>

                  <div
                    className="overflow-x-auto rounded-2xl border bg-white"
                    style={{ borderColor: colors.parchment }}
                  >
                    <table className="min-w-[1120px] w-full border-collapse">
                    <thead>
                      <tr style={{ color: 'rgba(41,40,39,0.48)' }}>
                        <th className="border-b px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] font-label" style={{ borderColor: colors.parchment }}>Device</th>
                        <th className="border-b px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] font-label" style={{ borderColor: colors.parchment }}>Summary</th>
                        <th className="border-b px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] font-label" style={{ borderColor: colors.parchment }}>Student</th>
                        <th className="border-b px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] font-label" style={{ borderColor: colors.parchment }}>Last activity</th>
                        <th className="border-b px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] font-label" style={{ borderColor: colors.parchment }}>Paired</th>
                        <th className="border-b px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] font-label" style={{ borderColor: colors.parchment }}>Last seen</th>
                        <th className="border-b px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] font-label" style={{ borderColor: colors.parchment }}>Last policy sync</th>
                        <th className="border-b px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] font-label" style={{ borderColor: colors.parchment }}>Platform</th>
                        <th className="border-b px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] font-label" style={{ borderColor: colors.parchment }}>Extension</th>
                        <th className="border-b px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] font-label" style={{ borderColor: colors.parchment }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLockdownDeviceSummaries.map((deviceRecord) => {
                        const statusMeta = DEVICE_STATUS_META[deviceRecord.summary_state] || {
                          label: deviceRecord.summary_state || 'Unknown',
                          backgroundColor: '#fbfaf8',
                          borderColor: colors.parchment,
                          textColor: colors.charcoal,
                        };
                        const studentLabel = studentNameById.get(deviceRecord.student_id) || deviceRecord.student_id || 'Unbound';
                        const canRevoke = deviceRecord.status !== 'revoked';
                        const recoveryIssuedForDevice = trustedRecovery?.device_id === deviceRecord.device_id;
                        const deviceTitle = deviceRecord.device_name || 'Unlabeled device';
                        const lastActivityLabel = formatDateTime(deviceRecord.last_activity_at_millis);
                        const lastActivityDistance = Number.isFinite(deviceRecord.last_activity_at_millis)
                          ? formatTimeDistanceLabel(deviceRecord.last_activity_at_millis, referenceNow)
                          : 'No heartbeat or sync recorded yet';
                        const issueCopy = deviceRecord.summary_state === LockdownDeviceSummaryStates.STALE
                          ? `No check-in or policy sync for ${LOCKDOWN_STALE_DEVICE_WARNING_THRESHOLD_DAYS}+ days.`
                          : (DEVICE_ISSUE_REASON_LABELS[deviceRecord.status] || '');

                        return (
                          <tr key={deviceRecord.device_id}>
                            <td className="border-b px-4 py-4 text-[13px] font-body" style={{ borderColor: colors.parchment, color: colors.charcoal }}>
                              <div className="font-medium" style={{ fontWeight: 540 }}>
                                {deviceTitle}
                              </div>
                              <div className="mt-1 text-[12px]" style={{ color: 'rgba(41,40,39,0.55)' }}>
                                {deviceRecord.device_id}
                              </div>
                            </td>
                            <td className="border-b px-4 py-4" style={{ borderColor: colors.parchment }}>
                              <span
                                className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] font-label"
                                style={{
                                  backgroundColor: statusMeta.backgroundColor,
                                  borderColor: statusMeta.borderColor,
                                  color: statusMeta.textColor,
                                }}
                              >
                                {statusMeta.label}
                              </span>
                              <div className="mt-2 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.58)' }}>
                                {issueCopy || 'Trusted device record is current.'}
                              </div>
                            </td>
                            <td className="border-b px-4 py-4 text-[13px] font-body" style={{ borderColor: colors.parchment, color: colors.charcoal }}>
                              <div className="font-medium" style={{ fontWeight: 540 }}>
                                {studentLabel}
                              </div>
                              <div className="mt-1 text-[12px]" style={{ color: 'rgba(41,40,39,0.55)' }}>
                                Student ID: {deviceRecord.student_id || 'Not set'}
                              </div>
                            </td>
                            <td className="border-b px-4 py-4 text-[13px] font-body" style={{ borderColor: colors.parchment, color: colors.charcoal }}>
                              <div>{lastActivityLabel || 'Not available'}</div>
                              <div className="mt-1 text-[12px]" style={{ color: 'rgba(41,40,39,0.55)' }}>
                                {lastActivityDistance}
                              </div>
                            </td>
                            <td className="border-b px-4 py-4 text-[13px] font-body" style={{ borderColor: colors.parchment, color: colors.charcoal }}>
                              {formatTimestampLabel(deviceRecord.paired_at)}
                            </td>
                            <td className="border-b px-4 py-4 text-[13px] font-body" style={{ borderColor: colors.parchment, color: colors.charcoal }}>
                              {formatTimestampLabel(deviceRecord.last_seen_at)}
                            </td>
                            <td className="border-b px-4 py-4 text-[13px] font-body" style={{ borderColor: colors.parchment, color: colors.charcoal }}>
                              {formatTimestampLabel(deviceRecord.last_policy_read_at)}
                            </td>
                            <td className="border-b px-4 py-4 text-[13px] font-body" style={{ borderColor: colors.parchment, color: colors.charcoal }}>
                              {deviceRecord.device_platform || 'Unknown'}
                            </td>
                            <td className="border-b px-4 py-4 text-[13px] font-body" style={{ borderColor: colors.parchment, color: colors.charcoal }}>
                              {deviceRecord.extension_version || 'Unknown'}
                            </td>
                            <td className="border-b px-4 py-4" style={{ borderColor: colors.parchment }}>
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => { void handleIssueDeviceRecovery(deviceRecord); }}
                                  disabled={issuingRecoveryDeviceId === deviceRecord.device_id}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                                  style={{ backgroundColor: colors.charcoal, color: '#ffffff' }}
                                >
                                  <Shield className="h-3.5 w-3.5" />
                                  {issuingRecoveryDeviceId === deviceRecord.device_id ? 'Issuing...' : 'Issue Recovery'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { void handleRevokeDevice(deviceRecord.device_id); }}
                                  disabled={!canRevoke || revokingDeviceId === deviceRecord.device_id}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                                  style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  {revokingDeviceId === deviceRecord.device_id ? 'Revoking...' : canRevoke ? 'Revoke' : 'Revoked'}
                                </button>
                                {recoveryIssuedForDevice ? (
                                  <div
                                    className="rounded-xl border px-3 py-2 text-[12px] font-body"
                                    style={{ borderColor: colors.parchment, backgroundColor: '#fffdf8', color: colors.charcoal }}
                                  >
                                    <p className="font-medium" style={{ fontWeight: 540 }}>
                                      Parent recovery code
                                    </p>
                                    <p className="mt-1 break-all" style={{ color: 'rgba(41,40,39,0.62)' }}>
                                      {trustedRecoveryCode || 'Recovery material was issued, but the local Firebase environment could not assemble the code.'}
                                    </p>
                                    <p className="mt-1" style={{ color: 'rgba(41,40,39,0.55)' }}>
                                      {trustedRecoveryExpiresLabel}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(trustedRecoveryCode, 'parent recovery code')}
                                      disabled={!trustedRecoveryCode}
                                      className="mt-2 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-label uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45"
                                      style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                      Copy Code
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div
                  className="rounded-2xl border px-4 py-4"
                  style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                >
                  <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                    No paired devices match the current view.
                  </p>
                  <p className="mt-1.5 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.6)' }}>
                    Pair a browser with a trusted enrollment code to populate the device table.
                  </p>
                </div>
              )
            ) : (
              <p className="text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                Loading parent-owned device records...
              </p>
            )}

            {deviceMessage ? (
              <p
                className="text-[12px] font-body"
                style={{
                  color: deviceMessageTone === 'success' ? '#0f7b41' : '#b42318',
                  fontWeight: 540,
                }}
              >
                {deviceMessage}
              </p>
            ) : null}
            {trustedRecoveryError ? (
              <p className="text-[12px] font-body" style={{ color: '#b42318', fontWeight: 540 }}>
                {trustedRecoveryError}
              </p>
            ) : null}
          </div>
        ) : (
          <div
            className="rounded-2xl border px-4 py-4"
            style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
              Upgrade Required For Device Management
            </p>
            <p className="mt-1.5 text-[13px] font-body" style={{ color: colors.charcoal }}>
              {lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore trusted device management.'}
            </p>
          </div>
        )}
      </LockdownModalFrame>

      <LockdownModalFrame
        colors={colors}
        isOpen={activeModal === LOCKDOWN_MODAL_IDS.ALLOWED}
        onClose={closeActiveModal}
        eyebrow="Allowed Right Now"
        title="Current effective allowlist and tester"
        description="Derived origins and approved creators come from the assigned household resource library and the current active block. Outside the saved schedule, Lockdown network blocking is off."
      >
        {!selectedStudent ? (
          <div
            className="rounded-2xl border px-4 py-4"
            style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
          >
            <p className="text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
              Select a student to review the currently derived allowlist.
            </p>
          </div>
        ) : derivedPreviewLoading ? (
          <div
            className="rounded-2xl border px-4 py-4"
            style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
          >
            <p className="text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
              Loading the current published weekly plan and timer state...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] font-label"
                style={{ backgroundColor: colors.lavenderTint, color: colors.amethyst }}
              >
                {derivedStateMeta.label}
              </span>
            </div>

            <p className="text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
              {derivedStateMeta.description}
            </p>

            {derivedPolicyPreview?.policy_state === LockdownPolicyStates.OUTSIDE_SCHOOL_TIME ? (
              <div
                className="rounded-2xl border px-4 py-4"
                style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
              >
                <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                  Lockdown network blocking is off right now.
                </p>
                <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.58)' }}>
                  The saved school-time schedule controls when Lockdown turns back on. Legacy off-hours windows stay preserved in the record, but they do not make outside-schedule enforcement active in this phase.
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryMetric
                colors={colors}
                label="Current Local Time"
                value={derivedPolicyPreview?.policy_context?.local_time || 'Not available'}
                detail={derivedPolicyPreview?.policy_context?.timezone || selectedStudent.timezone || 'Timezone unavailable'}
                accent
              />
              <SummaryMetric
                colors={colors}
                label="Published Weekly Plan"
                value={weeklyPlan ? 'Published plan found' : 'No published plan'}
                detail={resolvedWeeklyPlanId || 'No current weekly-plan document'}
              />
              <SummaryMetric
                colors={colors}
                label="Active Block"
                value={derivedPolicyPreview?.policy_context?.active_block?.title || 'No active block'}
                detail={derivedPolicyPreview?.policy_context?.active_block?.category || 'Waiting for a running block timer'}
              />
              <SummaryMetric
                colors={colors}
                label="Saved Schedule"
                value={derivedPolicyPreview?.policy_context?.schedule_summary?.days_label || summaryViewModel.schedule.days_label}
                detail={derivedPolicyPreview?.policy_context?.schedule_summary?.hours_label || summaryViewModel.schedule.hours_label}
              />
            </div>

            {weeklyPlanError || timerSessionsError ? (
              <div
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
              >
                <p className="text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                  {weeklyPlanError
                    ? 'Published weekly-plan data could not be fully loaded for this preview.'
                    : timerSessionsError}
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-3">
              {allowedResourceGroups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-2xl border px-4 py-4"
                  style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" style={{ color: colors.amethyst }} />
                    <p className="text-[12px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                      {group.label}
                    </p>
                  </div>
                  <p className="mt-1 text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                    {group.description}
                  </p>
                  <div className="mt-4 space-y-2">
                    {group.items.length ? (
                      group.items.map((item) => (
                        <div
                          key={item.key}
                          className="rounded-xl px-4 py-3"
                          style={{ backgroundColor: '#fbfaf8' }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                              {item.title}
                            </p>
                            <span
                              className="inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] font-label"
                              style={{
                                backgroundColor: item.allowed === false ? '#f9f0f0' : '#ffffff',
                                color: item.allowed === false ? '#b42318' : colors.amethyst,
                              }}
                            >
                              {item.allowed === false ? 'Decision' : item.resource_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                            {item.detail}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div
                        className="rounded-xl px-4 py-4"
                        style={{ backgroundColor: '#fbfaf8' }}
                      >
                        <p className="text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                          {group.id === 'active_block'
                            ? 'No block-specific resources are active right now.'
                            : group.id === 'parent_approved'
                              ? 'No parent-approved school-time resources are assigned right now.'
                              : 'No system resources are modeled in the current preview.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {derivedPolicyPreview?.policy_context?.unsupported_resources?.length ? (
              <div
                className="rounded-2xl border px-4 py-4"
                style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
              >
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" style={{ color: colors.amethyst }} />
                  <p className="text-[12px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                    Resources Needing More Metadata
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {derivedPolicyPreview.policy_context.unsupported_resources.map((resource) => (
                    <div key={`${resource.reason}_${resource.name}`} className="rounded-xl px-3 py-3" style={{ backgroundColor: '#fbfaf8' }}>
                      <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                        {resource.name}
                      </p>
                      <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                        {resource.reason === 'youtube_channel_metadata_required'
                          ? 'Add YouTube channel metadata or paste a channel URL so the trusted policy can allow this resource safely.'
                          : resource.reason === 'unsupported_scheme'
                            ? 'Only http and https resources are supported in the first Lockdown production scope.'
                            : resource.reason === 'invalid_url'
                              ? 'Enter a valid website origin or a supported YouTube creator URL.'
                              : 'This resource is fail closed until the parent supplies supported metadata.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleResourceTesterSubmit}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div>
                  <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                    Resource URL or Handle
                  </label>
                  <input
                    type="text"
                    value={resourceTesterInput}
                    onChange={(event) => setResourceTesterInput(event.target.value)}
                    placeholder="https://www.khanacademy.org/lesson/... or https://www.youtube.com/watch?v=..."
                    className={inputClassName}
                    style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                  />
                </div>

                <SummaryMetric
                  colors={colors}
                  label="Current Policy"
                  value={derivedStateMeta.label}
                  detail={`${pluralize(derivedPolicyPreview?.policy?.allowed_origins?.length || 0, 'allowed origin')} · ${pluralize(derivedPolicyPreview?.policy?.allowed_youtube_channels?.length || 0, 'approved creator')}`}
                  accent
                />
              </div>

              <details className="rounded-2xl border px-4 py-4" style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}>
                <summary className="cursor-pointer text-[12px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                  Optional YouTube metadata
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                      Channel ID
                    </label>
                    <input
                      type="text"
                      value={resourceTesterMetadata.youtube_channel_id}
                      onChange={(event) => setResourceTesterMetadata((current) => ({
                        ...current,
                        youtube_channel_id: event.target.value,
                      }))}
                      placeholder="UCONtPx56PSebXJOxbFv-2jQ"
                      className={inputClassName}
                      style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                    />
                  </div>

                  <div>
                    <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                      Channel Title
                    </label>
                    <input
                      type="text"
                      value={resourceTesterMetadata.youtube_channel_title}
                      onChange={(event) => setResourceTesterMetadata((current) => ({
                        ...current,
                        youtube_channel_title: event.target.value,
                      }))}
                      placeholder="Crash Course Kids"
                      className={inputClassName}
                      style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                    />
                  </div>

                  <div>
                    <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                      Channel Handle
                    </label>
                    <input
                      type="text"
                      value={resourceTesterMetadata.youtube_channel_handle}
                      onChange={(event) => setResourceTesterMetadata((current) => ({
                        ...current,
                        youtube_channel_handle: event.target.value,
                      }))}
                      placeholder="@crashcoursekids"
                      className={inputClassName}
                      style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                    />
                  </div>
                </div>
              </details>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors"
                  style={{ backgroundColor: colors.charcoal, color: '#ffffff' }}
                >
                  <Search className="h-3.5 w-3.5" />
                  Test Resource
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResourceTesterInput('');
                    setResourceTesterMetadata({
                      youtube_channel_id: '',
                      youtube_channel_title: '',
                      youtube_channel_handle: '',
                    });
                    setResourceTesterResult(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors"
                  style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                >
                  Clear
                </button>
              </div>

              {resourceTesterResult ? (
                <div
                  className="rounded-2xl border px-4 py-4"
                  style={{
                    borderColor: resourceTesterResultMeta.borderColor,
                    backgroundColor: resourceTesterResultMeta.backgroundColor,
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] uppercase tracking-[0.14em] font-label" style={{ color: resourceTesterResultMeta.textColor }}>
                      {resourceTesterResultMeta.label}
                    </p>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] font-label"
                      style={{ backgroundColor: '#ffffff90', color: resourceTesterResultMeta.textColor }}
                    >
                      {resourceTesterResult.decision}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] font-body" style={{ color: resourceTesterResultMeta.textColor, fontWeight: 540 }}>
                    {resourceTesterResult.reason || 'The resource was evaluated against the current derived policy.'}
                  </p>

                  {resourceTesterResult.normalized_origin ? (
                    <p className="mt-2 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                      Normalized origin: {resourceTesterResult.normalized_origin}
                    </p>
                  ) : null}

                  {resourceTesterResult.youtube?.channel_id ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl px-3 py-3" style={{ backgroundColor: '#ffffff' }}>
                        <p className="text-[11px] uppercase tracking-[0.12em] font-label" style={{ color: resourceTesterResultMeta.textColor }}>
                          Channel
                        </p>
                        <p className="mt-1 text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                          {resourceTesterResult.youtube.title || resourceTesterResult.youtube.channel_id}
                        </p>
                        <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                          {resourceTesterResult.youtube.handle ? `${resourceTesterResult.youtube.handle} · ` : ''}{resourceTesterResult.youtube.channel_id}
                        </p>
                      </div>

                      <div className="rounded-xl px-3 py-3" style={{ backgroundColor: '#ffffff' }}>
                        <p className="text-[11px] uppercase tracking-[0.12em] font-label" style={{ color: resourceTesterResultMeta.textColor }}>
                          Canonical URL
                        </p>
                        <p className="mt-1 break-all text-[12px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                          {resourceTesterResult.youtube.normalized_url || resourceTesterResult.url || 'Not available'}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {resourceTesterResult.decision === LockdownResourceTestDecisions.METADATA_NEEDED ? (
                    <p className="mt-3 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                      Add channel metadata or paste a channel URL. Video and handle inputs stay fail closed until a stable creator channel is available locally.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </form>
          </div>
        )}
      </LockdownModalFrame>

      <LockdownModalFrame
        colors={colors}
        isOpen={activeModal === LOCKDOWN_MODAL_IDS.ADVANCED}
        onClose={closeActiveModal}
        eyebrow="Advanced Diagnostics"
        title="Compatibility material and raw contract details"
        description="The long inline compatibility and contract surfaces stay available here without dominating the default page."
      >
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric
              colors={colors}
              label="Enrollment Contract"
              value={LOCKDOWN_TRUSTED_ENROLLMENT_CONTRACT}
              detail="Trusted enrollment payload contract"
              accent
            />
            <SummaryMetric
              colors={colors}
              label="Policy Read Contract"
              value={LOCKDOWN_TRUSTED_POLICY_READ_CONTRACT}
              detail="Trusted device policy read contract"
            />
            <SummaryMetric
              colors={colors}
              label="Source Policy Kind"
              value={derivedPolicyPreview?.source_policy?.kind || LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND}
              detail={resolvedWeeklyPlanId || 'No current weekly-plan document'}
            />
            <SummaryMetric
              colors={colors}
              label="Student Update"
              value={selectedStudent?.name || 'Account-wide view'}
              detail={selectedStudent ? `Updated ${selectedStudentUpdatedAtLabel}` : 'Choose a student to inspect derived inputs'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div
              className="rounded-2xl border px-4 py-4"
              style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
            >
              <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                Legacy PoC Pairing Code
              </p>
              <p className="mt-2 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                Temporary compatibility for the pre-Phase-4 MV3 runtime that still reads the parent-owned policy boundary.
              </p>
              <p className="mt-3 break-all text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                {legacyPocPairingCode || 'The local Firebase web config is missing, so the legacy pairing payload cannot be assembled here.'}
              </p>
              <button
                type="button"
                onClick={() => handleCopy(legacyPocPairingCode, 'legacy PoC pairing code', { requiresPairingAccess: true })}
                disabled={!legacyPocPairingCode || !canPairDevices}
                className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy PoC Code
              </button>
            </div>

            <div
              className="rounded-2xl border px-4 py-4"
              style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
            >
              <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                PoC Policy Boundary
              </p>
              <p className="mt-2 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                Compatibility document ID only. Trusted devices should not read this boundary directly once the runtime migrates.
              </p>
              <p className="mt-3 break-all text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                {currentUser?.uid || 'No parent boundary is available yet.'}
              </p>
              <button
                type="button"
                onClick={() => handleCopy(currentUser?.uid || '', 'legacy PoC policy id', { requiresPairingAccess: true })}
                disabled={!currentUser?.uid || !canPairDevices}
                className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Policy ID
              </button>
            </div>

            <div
              className="rounded-2xl border px-4 py-4"
              style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
            >
              <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                Saved Compatibility Snapshot
              </p>
              {!legacyPolicyReady ? (
                <p className="mt-3 text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                  Loading saved compatibility data...
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                    {hasLegacyPolicyDocument ? 'Saved legacy document found' : 'No legacy document saved'}
                  </p>
                  <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                    Last saved: {legacyPolicyUpdatedAtLabel}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-xl px-3 py-3" style={{ backgroundColor: '#fbfaf8' }}>
                      <p className="text-[12px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                        Origins
                      </p>
                      <p className="mt-1 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                        {pluralize(legacyPolicy.allowed_origins.length, 'saved origin')}
                      </p>
                    </div>
                    <div className="rounded-xl px-3 py-3" style={{ backgroundColor: '#fbfaf8' }}>
                      <p className="text-[12px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                        Creators
                      </p>
                      <p className="mt-1 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                        {pluralize(legacyPolicy.allowed_youtube_channels.length, 'saved creator')}
                      </p>
                    </div>
                  </div>
                  {legacyPolicyError ? (
                    <p className="mt-3 text-[12px] font-body" style={{ color: '#b42318', fontWeight: 540 }}>
                      {legacyPolicyError}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </LockdownModalFrame>
    </>
  );
};

export default LockdownPolicyPanel;
