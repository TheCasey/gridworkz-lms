import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  CalendarDays,
  Clock3,
  Copy,
  FileText,
  Globe,
  Info,
  Lock,
  Monitor,
  Plus,
  Save,
  Shield,
  Trash2,
  User,
  Youtube,
} from 'lucide-react';
import { dashboardFeaturesById } from '../constants/dashboardFeatures';
import { Collections } from '../constants/schema';
import { issueTrustedLockdownEnrollment } from '../firebase/trustedOperations';
import useStudentPortalWeeklyPlan from '../hooks/useStudentPortalWeeklyPlan';
import { getStudentSubjectsFromLegacyRecords } from '../utils/planningCompatibilityUtils';
import {
  normalizeLockdownSchedule,
  RESET_DAY_OPTIONS,
} from '../utils/schoolSettingsUtils';
import { getTimerSessionDocId } from '../utils/timerUtils';
import {
  buildDefaultLockdownPolicy,
  buildDefaultLockdownResource,
  buildDefaultLockdownWindow,
  buildLockdownPocPairingCode,
  buildTrustedLockdownEnrollmentCode,
  deriveCurrentLockdownPolicyPreview,
  LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND,
  LOCKDOWN_POC_POLICY_COLLECTION,
  LOCKDOWN_TRUSTED_ENROLLMENT_CONTRACT,
  LOCKDOWN_TRUSTED_POLICY_READ_CONTRACT,
  LockdownPolicyStates,
  normalizeLockdownPolicy,
  normalizeTrustedLockdownEnrollmentMaterial,
  sanitizeLockdownWindowResources,
} from '../utils/lockdownPolicyUtils';

const DAY_LABELS = Object.fromEntries(
  RESET_DAY_OPTIONS.map((option) => [option.value, option.label])
);

const POLICY_STATE_META = {
  [LockdownPolicyStates.ACTIVE_BLOCK]: {
    label: 'Active block',
    description: 'Only the resources attached to the running published weekly-plan block are allowed right now.',
  },
  [LockdownPolicyStates.NO_ACTIVE_BLOCK]: {
    label: 'No active block',
    description: 'School time is active, but no running block currently contributes approved resources.',
  },
  [LockdownPolicyStates.OUTSIDE_SCHOOL_TIME]: {
    label: 'Outside school time',
    description: 'The active off-hours window controls which additional approved resources are available.',
  },
  [LockdownPolicyStates.ENTITLEMENT_INACTIVE]: {
    label: 'Entitlement inactive',
    description: 'Trusted device policy reads stay visible here, but the Lockdown entitlement is inactive so device access is disabled.',
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

const formatDayList = (days = []) => {
  const dayLabels = (Array.isArray(days) ? days : [])
    .map((dayValue) => DAY_LABELS[dayValue]?.slice(0, 3))
    .filter(Boolean);

  return dayLabels.length ? dayLabels.join(', ') : 'No days selected';
};

const pluralize = (count, singular, plural = `${singular}s`) => (
  `${count} ${count === 1 ? singular : plural}`
);

const SectionCard = ({
  colors,
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
  tone = 'white',
}) => {
  const backgroundColor = tone === 'tint' ? `${colors.lavenderTint}80` : '#ffffff';

  return (
    <section
      className="rounded-2xl border p-5"
      style={{ borderColor: colors.parchment, backgroundColor }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}` }}
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
          {description ? (
            <p
              className="mt-2 text-[13px] font-body"
              style={{ color: 'rgba(41,40,39,0.62)' }}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
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
  const [legacyPolicy, setLegacyPolicy] = useState(() => buildDefaultLockdownPolicy(currentUser?.uid || ''));
  const [hasLegacyPolicyDocument, setHasLegacyPolicyDocument] = useState(false);
  const [legacyPolicyUpdatedAt, setLegacyPolicyUpdatedAt] = useState(null);
  const [legacyPolicyError, setLegacyPolicyError] = useState('');
  const [legacyPolicyReady, setLegacyPolicyReady] = useState(false);
  const [timerSessions, setTimerSessions] = useState([]);
  const [timerSessionsReady, setTimerSessionsReady] = useState(false);
  const [timerSessionsError, setTimerSessionsError] = useState('');
  const [referenceNow, setReferenceNow] = useState(() => Date.now());

  const canManagePolicy = Boolean(lockdownAccess?.canManagePolicy);
  const canPairDevices = Boolean(lockdownAccess?.canPairDevices);
  const isReadOnly = Boolean(lockdownAccess?.isReadOnly);
  const studentsPath = `/dashboard/${dashboardFeaturesById.students.path}`;
  const isMultiStudentAccount = students.length > 1;

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
    setTrustedEnrollment(null);
    setTrustedEnrollmentError('');
    setIssuingTrustedEnrollment(false);
  }, [currentUser?.uid, selectedStudentId]);

  const studentSubjects = useMemo(
    () => (selectedStudent ? getStudentSubjectsFromLegacyRecords(subjects, selectedStudent.id) : []),
    [selectedStudent, subjects]
  );

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
      timerSessions,
      referenceDate: new Date(referenceNow),
    });
  }, [
    currentUser?.uid,
    lockdownAccess?.isEnabled,
    referenceNow,
    selectedStudent,
    timerSessions,
    weeklyPlan,
  ]);

  const trustedEnrollmentCode = useMemo(
    () => buildTrustedLockdownEnrollmentCode(trustedEnrollment || {}),
    [trustedEnrollment]
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

  const derivedStateMeta = POLICY_STATE_META[derivedPolicyPreview?.policy_state] || POLICY_STATE_META[LockdownPolicyStates.NO_ACTIVE_BLOCK];
  const derivedPreviewLoading = Boolean(selectedStudent?.id) && (weeklyPlanLoading || !timerSessionsReady);
  const offHoursWindowCount = selectedStudentSchedule.off_hours_resource_windows.length;
  const selectedStudentUpdatedAtLabel = formatTimestampLabel(selectedStudent?.updated_at);
  const legacyPolicyUpdatedAtLabel = formatTimestampLabel(legacyPolicyUpdatedAt);
  const resolvedWeeklyPlanId = weeklyPlan?.id
    || weekIdentity?.planId
    || derivedPolicyPreview?.policy_context?.weekly_plan_id
    || '';

  const handleStudentSelectionChange = (event) => {
    const nextStudentId = event.target.value;
    setSelectedStudentId(nextStudentId);
    setHasExplicitStudentSelection(Boolean(nextStudentId));
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

  const updateWindowDraft = (windowId, updater) => {
    updateScheduleDraft((currentSchedule) => ({
      ...currentSchedule,
      off_hours_resource_windows: currentSchedule.off_hours_resource_windows.map((windowConfig) => (
        windowConfig.id === windowId ? updater(windowConfig) : windowConfig
      )),
    }));
  };

  const handleAddWindow = () => {
    updateScheduleDraft((currentSchedule) => ({
      ...currentSchedule,
      off_hours_resource_windows: [
        ...currentSchedule.off_hours_resource_windows,
        buildDefaultLockdownWindow(currentSchedule.off_hours_resource_windows.length),
      ],
    }));
  };

  const handleRemoveWindow = (windowId) => {
    updateScheduleDraft((currentSchedule) => ({
      ...currentSchedule,
      off_hours_resource_windows: currentSchedule.off_hours_resource_windows.filter(
        (windowConfig) => windowConfig.id !== windowId
      ),
    }));
  };

  const handleToggleWindowDay = (windowId, dayValue) => {
    updateWindowDraft(windowId, (windowConfig) => {
      const nextDays = windowConfig.days.includes(dayValue)
        ? windowConfig.days.filter((candidateDay) => candidateDay !== dayValue)
        : [...windowConfig.days, dayValue].sort((left, right) => left - right);

      return {
        ...windowConfig,
        days: nextDays.length ? nextDays : [dayValue],
      };
    });
  };

  const handleAddResource = (windowId) => {
    updateWindowDraft(windowId, (windowConfig) => ({
      ...windowConfig,
      resources: [...windowConfig.resources, buildDefaultLockdownResource()],
    }));
  };

  const handleRemoveResource = (windowId, resourceIndex) => {
    updateWindowDraft(windowId, (windowConfig) => ({
      ...windowConfig,
      resources: windowConfig.resources.filter((_, index) => index !== resourceIndex),
    }));
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

    const normalizedWindows = [];

    for (let index = 0; index < scheduleDraft.off_hours_resource_windows.length; index += 1) {
      const windowConfig = scheduleDraft.off_hours_resource_windows[index];
      const windowLabel = windowConfig.label.trim() || `Window ${index + 1}`;

      if (!Array.isArray(windowConfig.resources) || windowConfig.resources.length === 0) {
        setScheduleError(`${windowLabel} needs at least one approved resource.`);
        return;
      }

      const { resources: sanitizedResources, error } = sanitizeLockdownWindowResources(windowConfig.resources);

      if (error) {
        setScheduleError(`${windowLabel}: ${error}`);
        return;
      }

      normalizedWindows.push({
        ...windowConfig,
        label: windowConfig.label.trim(),
        resources: sanitizedResources,
      });
    }

    setSavingSchedule(true);
    setScheduleError('');

    try {
      const nextSchedule = normalizeLockdownSchedule({
        ...scheduleDraft,
        off_hours_resource_windows: normalizedWindows,
      }, selectedStudent.timezone || parentSettings?.timezone);

      await setDoc(doc(db, Collections.STUDENTS, selectedStudent.id), {
        lockdown_schedule: nextSchedule,
        updated_at: serverTimestamp(),
      }, { merge: true });

      setIsScheduleDirty(false);
      setScheduleSuccess('Saved Lockdown schedule and approved off-hours resources.');
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
    ? 'Lockdown management is student-bound now. Pair devices to a specific student, review the current derived state from published weekly plans and schedule rules, and maintain off-hours approved resources without editing raw policy documents.'
    : 'Your Lockdown setup stays visible here in read-only mode. Saved student schedules and compatibility material remain visible, but pairing and editing stay disabled until the Lockdown plan is restored.';

  return (
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
              Student-bound setup for the trusted Lockdown contract
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <SectionCard
            colors={colors}
            icon={User}
            eyebrow="Student Binding"
            title="Choose the student this device belongs to"
            description="Trusted enrollment is always student-bound now. Multi-student households need a separate pairing code for each device or browser profile."
          >
            {students.length === 0 ? (
              <div
                className="rounded-2xl border px-4 py-4"
                style={{ borderColor: colors.parchment, backgroundColor: colors.cream }}
              >
                <p className="text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                  Add a student before pairing a Lockdown device.
                </p>
                <p
                  className="mt-1.5 text-[13px] font-body"
                  style={{ color: 'rgba(41,40,39,0.6)' }}
                >
                  Off-hours windows and published weekly-plan derivation are both student-specific, so Lockdown setup starts from an active student record.
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
              <div className="space-y-4">
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

                {isMultiStudentAccount && !selectedStudent ? (
                  <div
                    className="rounded-2xl border px-4 py-3"
                    style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                  >
                    <p
                      className="text-[11px] uppercase tracking-[0.14em] font-label"
                      style={{ color: colors.amethyst }}
                    >
                      Selection Required
                    </p>
                    <p
                      className="mt-1.5 text-[13px] font-body"
                      style={{ color: 'rgba(41,40,39,0.62)' }}
                    >
                      Multi-student accounts must choose a student explicitly before trusted pairing or weekly-plan-derived review becomes available.
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{ backgroundColor: colors.cream }}
                  >
                    <p
                      className="text-[11px] uppercase tracking-[0.14em] font-label"
                      style={{ color: colors.amethyst }}
                    >
                      Binding
                    </p>
                    <p className="mt-1 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                      {selectedStudent?.name || 'No student selected'}
                    </p>
                    <p
                      className="mt-1 text-[12px] font-body"
                      style={{ color: 'rgba(41,40,39,0.55)' }}
                    >
                      Student ID: {selectedStudent?.id || 'Not available'}
                    </p>
                  </div>

                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{ backgroundColor: colors.cream }}
                  >
                    <p
                      className="text-[11px] uppercase tracking-[0.14em] font-label"
                      style={{ color: colors.amethyst }}
                    >
                      Schedule Snapshot
                    </p>
                    <p className="mt-1 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                      {pluralize(offHoursWindowCount, 'off-hours window')}
                    </p>
                    <p
                      className="mt-1 text-[12px] font-body"
                      style={{ color: 'rgba(41,40,39,0.55)' }}
                    >
                      Last student update: {selectedStudentUpdatedAtLabel}
                    </p>
                  </div>
                </div>

                <div
                  className="rounded-2xl border px-4 py-3"
                  style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                >
                  <p
                    className="text-[11px] uppercase tracking-[0.14em] font-label"
                    style={{ color: colors.amethyst }}
                  >
                    Why this matters
                  </p>
                  <p
                    className="mt-1.5 text-[13px] font-body"
                    style={{ color: 'rgba(41,40,39,0.62)' }}
                  >
                    The trusted backend no longer issues parent-wide enrollment. Every Lockdown device is tied to one student so the published weekly plan, timers, and off-hours windows resolve against the correct learner.
                  </p>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            colors={colors}
            icon={Monitor}
            eyebrow="Trusted Pairing"
            title="Generate a trusted enrollment code"
            description="This is the production enrollment path: parent-authenticated issuance, one-time exchange, then device-credential policy reads from Cloud Functions."
            tone="tint"
          >
            <div className="space-y-4">
              <div
                className="rounded-2xl border px-4 py-4"
                style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
              >
                <p
                  className="text-[11px] uppercase tracking-[0.14em] font-label"
                  style={{ color: colors.amethyst }}
                >
                  Trusted Enrollment Code
                </p>
                <p
                  className="mt-3 break-all text-[13px] font-body"
                  style={{ color: colors.charcoal, fontWeight: 540 }}
                >
                  {trustedEnrollmentDisplayText}
                </p>
                <p
                  className="mt-2 text-[12px] font-body"
                  style={{ color: 'rgba(41,40,39,0.55)' }}
                >
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div
                  className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}` }}
                >
                  <p
                    className="text-[11px] uppercase tracking-[0.14em] font-label"
                    style={{ color: colors.amethyst }}
                  >
                    Enrollment Contract
                  </p>
                  <p className="mt-1 text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                    {LOCKDOWN_TRUSTED_ENROLLMENT_CONTRACT}
                  </p>
                  <p
                    className="mt-1 text-[12px] font-body"
                    style={{ color: 'rgba(41,40,39,0.55)' }}
                  >
                    Policy read contract: {LOCKDOWN_TRUSTED_POLICY_READ_CONTRACT}
                  </p>
                </div>

                <div
                  className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}` }}
                >
                  <p
                    className="text-[11px] uppercase tracking-[0.14em] font-label"
                    style={{ color: colors.amethyst }}
                  >
                    Student Binding
                  </p>
                  <p className="mt-1 text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                    {selectedStudent?.name || 'Select a student'}
                  </p>
                  <p
                    className="mt-1 text-[12px] font-body"
                    style={{ color: 'rgba(41,40,39,0.55)' }}
                  >
                    {trustedEnrollment?.student_id || selectedStudent?.id || 'No student selected yet'}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <SectionCard
            colors={colors}
            icon={FileText}
            eyebrow="Derived Policy"
            title="Visibility into the current trusted state"
            description="This view tracks the student-bound source inputs that feed the trusted device-policy contract: published weekly plans, running timers, school-time rules, and off-hours resource windows."
          >
            {!selectedStudent ? (
              <div
                className="rounded-2xl px-4 py-4 text-[13px] font-body"
                style={{ backgroundColor: colors.cream, color: 'rgba(41,40,39,0.6)' }}
              >
                Select a student to inspect the current derived Lockdown state.
              </div>
            ) : derivedPreviewLoading ? (
              <div
                className="rounded-2xl px-4 py-4 text-[13px] font-body"
                style={{ backgroundColor: colors.cream, color: 'rgba(41,40,39,0.6)' }}
              >
                Loading the current published weekly plan and timer state...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] font-label"
                    style={{ backgroundColor: colors.lavenderTint, color: colors.amethyst }}
                  >
                    {derivedStateMeta.label}
                  </span>
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] font-label"
                    style={{ backgroundColor: colors.cream, color: colors.charcoal }}
                  >
                    {derivedPolicyPreview?.source_policy?.kind || LOCKDOWN_DERIVED_WEEKLY_PLAN_POLICY_SOURCE_KIND}
                  </span>
                </div>

                <p
                  className="text-[13px] font-body"
                  style={{ color: 'rgba(41,40,39,0.62)' }}
                >
                  {derivedStateMeta.description}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{ backgroundColor: colors.cream }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                      Current Local Time
                    </p>
                    <p className="mt-1 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                      {derivedPolicyPreview?.policy_context?.local_time || 'Not available'}
                    </p>
                    <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                      {derivedPolicyPreview?.policy_context?.timezone || selectedStudent.timezone || 'Timezone unavailable'}
                    </p>
                  </div>

                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{ backgroundColor: colors.cream }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                      Published Weekly Plan
                    </p>
                    <p className="mt-1 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                      {weeklyPlan ? 'Published plan found' : 'No published plan for this week'}
                    </p>
                    <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                      {resolvedWeeklyPlanId || 'No current weekly-plan document'}
                    </p>
                  </div>

                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{ backgroundColor: colors.cream }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                      Active Block
                    </p>
                    <p className="mt-1 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                      {derivedPolicyPreview?.policy_context?.active_block?.title || 'No active block'}
                    </p>
                    <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                      {derivedPolicyPreview?.policy_context?.active_block?.category || 'Waiting for a running block timer'}
                    </p>
                  </div>

                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{ backgroundColor: colors.cream }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                      Off-Hours Window
                    </p>
                    <p className="mt-1 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                      {derivedPolicyPreview?.policy_context?.off_hours_window?.label || 'No active off-hours window'}
                    </p>
                    <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                      {derivedPolicyPreview?.policy_context?.off_hours_window
                        ? `${derivedPolicyPreview.policy_context.off_hours_window.start_time} - ${derivedPolicyPreview.policy_context.off_hours_window.end_time}`
                        : 'Only applies outside scheduled school time'}
                    </p>
                  </div>
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
              </div>
            )}
          </SectionCard>

          <SectionCard
            colors={colors}
            icon={Globe}
            eyebrow="Allowed Right Now"
            title="What the trusted policy would allow"
            description="Derived origins and approved creators come from the current active block or active off-hours window. They are visible here, but not edited directly."
          >
            {!selectedStudent ? (
              <div
                className="rounded-2xl px-4 py-4 text-[13px] font-body"
                style={{ backgroundColor: colors.cream, color: 'rgba(41,40,39,0.6)' }}
              >
                Select a student to review the currently derived allowlist.
              </div>
            ) : derivedPreviewLoading ? (
              <div
                className="rounded-2xl px-4 py-4 text-[13px] font-body"
                style={{ backgroundColor: colors.cream, color: 'rgba(41,40,39,0.6)' }}
              >
                Building the current allowed-resource preview...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{ backgroundColor: colors.cream }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                      Allowed Origins
                    </p>
                    <p className="mt-1 text-[18px] font-display" style={{ color: colors.charcoal }}>
                      {derivedPolicyPreview?.policy?.allowed_origins?.length || 0}
                    </p>
                  </div>

                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{ backgroundColor: colors.cream }}
                  >
                    <div className="flex items-center gap-2">
                      <Youtube className="h-4 w-4" style={{ color: colors.amethyst }} />
                      <p className="text-[11px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                        Approved Creators
                      </p>
                    </div>
                    <p className="mt-1 text-[18px] font-display" style={{ color: colors.charcoal }}>
                      {derivedPolicyPreview?.policy?.allowed_youtube_channels?.length || 0}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {derivedPolicyPreview?.policy?.allowed_origins?.length ? (
                    derivedPolicyPreview.policy.allowed_origins.map((origin) => (
                      <div
                        key={origin}
                        className="rounded-xl px-4 py-3"
                        style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}` }}
                      >
                        <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                          {origin}
                        </p>
                        <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                          Derived origin-level access
                        </p>
                      </div>
                    ))
                  ) : (
                    <div
                      className="rounded-xl px-4 py-4"
                      style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}` }}
                    >
                      <p className="text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.62)' }}>
                        No origin-level access is currently derived for this student.
                      </p>
                    </div>
                  )}
                </div>

                {derivedPolicyPreview?.policy?.allowed_youtube_channels?.length ? (
                  <div className="space-y-2">
                    {derivedPolicyPreview.policy.allowed_youtube_channels.map((channel) => (
                      <div
                        key={channel.channel_id}
                        className="rounded-xl px-4 py-3"
                        style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}` }}
                      >
                        <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                          {channel.title || channel.channel_id}
                        </p>
                        <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                          {channel.handle ? `${channel.handle} · ` : ''}{channel.channel_id}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

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
                        <div key={`${resource.reason}_${resource.name}`} className="rounded-xl px-3 py-3" style={{ backgroundColor: colors.cream }}>
                          <p className="text-[13px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                            {resource.name}
                          </p>
                          <p className="mt-1 text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.55)' }}>
                            Add YouTube channel metadata so the trusted policy can allow this resource safely.
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          colors={colors}
          icon={CalendarDays}
          eyebrow="Off-Hours Controls"
          title="Manage approved resources outside school time"
          description="Off-hours windows are saved on the selected student record and only apply when school time is inactive. Save here to update the student-bound derived policy inputs."
        >
          {!selectedStudent ? (
            <div
              className="rounded-2xl px-4 py-4 text-[13px] font-body"
              style={{ backgroundColor: colors.cream, color: 'rgba(41,40,39,0.6)' }}
            >
              Select a student before editing school-time rules or approved off-hours windows.
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

              <div className="space-y-4">
                {scheduleDraft.off_hours_resource_windows.map((windowConfig, windowIndex) => (
                  <div
                    key={windowConfig.id}
                    className="rounded-2xl border p-4"
                    style={{ borderColor: colors.parchment, backgroundColor: '#ffffff' }}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="grid flex-1 gap-4 md:grid-cols-3">
                        <div>
                          <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                            Window Label
                          </label>
                          <input
                            type="text"
                            value={windowConfig.label}
                            onChange={(event) => updateWindowDraft(windowConfig.id, (currentWindow) => ({
                              ...currentWindow,
                              label: event.target.value,
                            }))}
                            disabled={!canManagePolicy}
                            placeholder={`Window ${windowIndex + 1}`}
                            className={inputClassName}
                            style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                          />
                        </div>

                        <div>
                          <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                            Starts
                          </label>
                          <input
                            type="time"
                            value={windowConfig.start_time}
                            onChange={(event) => updateWindowDraft(windowConfig.id, (currentWindow) => ({
                              ...currentWindow,
                              start_time: event.target.value,
                            }))}
                            disabled={!canManagePolicy}
                            className={inputClassName}
                            style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                          />
                        </div>

                        <div>
                          <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                            Ends
                          </label>
                          <input
                            type="time"
                            value={windowConfig.end_time}
                            onChange={(event) => updateWindowDraft(windowConfig.id, (currentWindow) => ({
                              ...currentWindow,
                              end_time: event.target.value,
                            }))}
                            disabled={!canManagePolicy}
                            className={inputClassName}
                            style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveWindow(windowConfig.id)}
                        disabled={!canManagePolicy}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                        style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove Window
                      </button>
                    </div>

                    <div className="mt-4">
                      <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                        Days
                      </label>
                      <DayToggleGroup
                        colors={colors}
                        days={windowConfig.days}
                        disabled={!canManagePolicy}
                        onToggle={(dayValue) => handleToggleWindowDay(windowConfig.id, dayValue)}
                      />
                    </div>

                    <div className="mt-4 space-y-3">
                      {windowConfig.resources.map((resource, resourceIndex) => (
                        <div
                          key={`${windowConfig.id}_${resourceIndex}`}
                          className="rounded-2xl border p-4"
                          style={{ borderColor: colors.parchment, backgroundColor: colors.cream }}
                        >
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                            <div>
                              <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                                Resource Name
                              </label>
                              <input
                                type="text"
                                value={resource.name || ''}
                                onChange={(event) => updateWindowDraft(windowConfig.id, (currentWindow) => ({
                                  ...currentWindow,
                                  resources: currentWindow.resources.map((currentResource, currentIndex) => (
                                    currentIndex === resourceIndex
                                      ? { ...currentResource, name: event.target.value }
                                      : currentResource
                                  )),
                                }))}
                                disabled={!canManagePolicy}
                                placeholder="Evening Reading"
                                className={inputClassName}
                                style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                              />
                            </div>

                            <div>
                              <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                                Destination URL
                              </label>
                              <input
                                type="url"
                                value={resource.url || ''}
                                onChange={(event) => updateWindowDraft(windowConfig.id, (currentWindow) => ({
                                  ...currentWindow,
                                  resources: currentWindow.resources.map((currentResource, currentIndex) => (
                                    currentIndex === resourceIndex
                                      ? { ...currentResource, url: event.target.value }
                                      : currentResource
                                  )),
                                }))}
                                disabled={!canManagePolicy}
                                placeholder="https://www.khanacademy.org"
                                className={inputClassName}
                                style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                              />
                            </div>
                          </div>

                          <details className="mt-3">
                            <summary
                              className="cursor-pointer text-[12px] uppercase tracking-[0.14em] font-label"
                              style={{ color: colors.amethyst }}
                            >
                              Advanced Lockdown Metadata
                            </summary>
                            <div className="mt-3 grid gap-4 lg:grid-cols-2">
                              <div>
                                <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                                  Origin Override
                                </label>
                                <input
                                  type="text"
                                  value={resource.lockdown_origin || ''}
                                  onChange={(event) => updateWindowDraft(windowConfig.id, (currentWindow) => ({
                                    ...currentWindow,
                                    resources: currentWindow.resources.map((currentResource, currentIndex) => (
                                      currentIndex === resourceIndex
                                        ? { ...currentResource, lockdown_origin: event.target.value }
                                        : currentResource
                                    )),
                                  }))}
                                  disabled={!canManagePolicy}
                                  placeholder="https://www.example.com"
                                  className={inputClassName}
                                  style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                                />
                              </div>

                              <div>
                                <label className={fieldLabelClassName} style={{ color: 'rgba(41,40,39,0.45)' }}>
                                  YouTube Channel ID
                                </label>
                                <input
                                  type="text"
                                  value={resource.youtube_channel_id || ''}
                                  onChange={(event) => updateWindowDraft(windowConfig.id, (currentWindow) => ({
                                    ...currentWindow,
                                    resources: currentWindow.resources.map((currentResource, currentIndex) => (
                                      currentIndex === resourceIndex
                                        ? { ...currentResource, youtube_channel_id: event.target.value }
                                        : currentResource
                                    )),
                                  }))}
                                  disabled={!canManagePolicy}
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
                                  value={resource.youtube_channel_title || ''}
                                  onChange={(event) => updateWindowDraft(windowConfig.id, (currentWindow) => ({
                                    ...currentWindow,
                                    resources: currentWindow.resources.map((currentResource, currentIndex) => (
                                      currentIndex === resourceIndex
                                        ? { ...currentResource, youtube_channel_title: event.target.value }
                                        : currentResource
                                    )),
                                  }))}
                                  disabled={!canManagePolicy}
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
                                  value={resource.youtube_channel_handle || ''}
                                  onChange={(event) => updateWindowDraft(windowConfig.id, (currentWindow) => ({
                                    ...currentWindow,
                                    resources: currentWindow.resources.map((currentResource, currentIndex) => (
                                      currentIndex === resourceIndex
                                        ? { ...currentResource, youtube_channel_handle: event.target.value }
                                        : currentResource
                                    )),
                                  }))}
                                  disabled={!canManagePolicy}
                                  placeholder="@crashcoursekids"
                                  className={inputClassName}
                                  style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                                />
                              </div>
                            </div>
                          </details>

                          <button
                            type="button"
                            onClick={() => handleRemoveResource(windowConfig.id, resourceIndex)}
                            disabled={!canManagePolicy}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                            style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove Resource
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleAddResource(windowConfig.id)}
                        disabled={!canManagePolicy}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-label uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                        style={{ backgroundColor: colors.charcoal, color: '#ffffff' }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Resource
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddWindow}
                  disabled={!canManagePolicy}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[12px] font-label uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ backgroundColor: colors.lavenderTint, color: colors.amethyst }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Off-Hours Window
                </button>
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
                      School days: {formatDayList(selectedStudentSchedule.school_days)} · {selectedStudentSchedule.school_day_start_time} - {selectedStudentSchedule.school_day_end_time}
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
                    {savingSchedule ? 'Saving...' : 'Save Off-Hours Setup'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          colors={colors}
          icon={Clock3}
          eyebrow="Legacy Compatibility"
          title="Keep the PoC runtime material secondary"
          description="Phase 4 still migrates the shipped MV3 extension runtime. The legacy Firestore pairing payload remains visible here for compatibility only, but it is no longer the production management model."
          tone="tint"
        >
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
                    <div className="rounded-xl px-3 py-3" style={{ backgroundColor: colors.cream }}>
                      <p className="text-[12px] uppercase tracking-[0.14em] font-label" style={{ color: colors.amethyst }}>
                        Origins
                      </p>
                      <p className="mt-1 text-[14px] font-body" style={{ color: colors.charcoal, fontWeight: 540 }}>
                        {pluralize(legacyPolicy.allowed_origins.length, 'saved origin')}
                      </p>
                    </div>
                    <div className="rounded-xl px-3 py-3" style={{ backgroundColor: colors.cream }}>
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
        </SectionCard>
      </div>
    </section>
  );
};

export default LockdownPolicyPanel;
