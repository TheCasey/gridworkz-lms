import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore } from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import {
  BookOpen,
  ChevronDown,
  FileText,
  Heart,
  Plus,
  Activity,
  Clock,
  X,
  Info,
  Check,
  Download,
  Calendar,
  Lock,
} from 'lucide-react';
import AddStudentModal from '../components/AddStudentModal';
import {
  DASHBOARD_HEADER_ACTIONS,
  DASHBOARD_FEATURE_STATES,
  DASHBOARD_HEADER_FILTERS,
  DASHBOARD_HEADER_NOTICES,
  DASHBOARD_DEFAULT_FEATURE_ID,
  DASHBOARD_NAV_BADGES,
  getDashboardDefaultFeature,
  getDashboardSectionIdForFeatureId,
  resolveDashboardNavigation,
  resolveDashboardFeatures,
  dashboardFeaturesById,
} from '../constants/dashboardFeatures';
import useEntitlements from '../hooks/useEntitlements';
import useParentSettings from '../hooks/useParentSettings';
import useStudentMutations from '../hooks/useStudentMutations';
import useStudents from '../hooks/useStudents';
import useSubjects from '../hooks/useSubjects';
import useChoreSetup from '../hooks/useChoreSetup';
import useWeeklyActivity from '../hooks/useWeeklyActivity';
import useWeeklyReportRecords from '../hooks/useWeeklyReportRecords';
import useWeeklyRollover from '../hooks/useWeeklyRollover';
import {
  getCurrentWeekRange,
  getWeekRangeByOffset,
  formatWeekRange,
  getWeekLabel,
  getWeekPickerOptions,
  getWeekConfig,
} from '../utils/weekUtils';
import { buildEntitlementUsageSummary } from '../utils/entitlementUtils';
import { AllowancePaidStatuses } from '../utils/allowanceUtils';

const FONT = "'Super Sans VF', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

const labelCls = 'block text-[11px] uppercase tracking-wider mb-1.5' + ' ' + 'font-label';
const LIVE_PULSE_ALL_STUDENTS = 'all-students';
const LIVE_PULSE_DOMAINS = Object.freeze({
  SCHOOL: 'school',
  CHORES: 'chores',
});

const DashboardLivePulseDrawer = ({
  colors,
  filteredStudents,
  filteredWeekSubmissions,
  formatTimestamp,
  isOpen,
  loading,
  onClose,
  onDomainChange,
  onStudentFilterChange,
  selectedDomain,
  selectedStudentFilter,
  selectedWeekOffset,
  setViewingSummary,
  studentNameById,
  studentProgressRows,
  students,
}) => (
  <div className="pointer-events-none absolute inset-0 z-40 flex justify-end">
    <button
      type="button"
      className={`absolute inset-0 transition-opacity duration-300 ${
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(27,25,56,0.12)' }}
      onClick={onClose}
      aria-label="Close Live Pulse drawer"
    />

    <aside
      id="dashboard-live-pulse-drawer"
      className={`pointer-events-auto flex h-full w-full max-w-[26rem] transform flex-col transition-transform duration-300 ease-out ${
        isOpen ? 'visible translate-x-0' : 'invisible translate-x-full'
      }`}
      style={{
        backgroundColor: '#ffffff',
        borderLeft: `1px solid ${colors.parchment}`,
        boxShadow: isOpen ? '-20px 0 60px rgba(27,25,56,0.14)' : 'none',
      }}
      aria-hidden={!isOpen}
    >
      <div className="px-6 pt-6 pb-5" style={{ borderBottom: `1px solid ${colors.parchment}` }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4" style={{ color: colors.amethyst }} />
              <h3 style={{ fontSize: 15, fontWeight: 540, color: colors.charcoal }}>Live Pulse</h3>
            </div>
            <p className="text-[12px]" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
              Real-time school and chores activity
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
            style={{ backgroundColor: '#fbfaf8', color: colors.charcoal }}
            onMouseEnter={event => { event.currentTarget.style.backgroundColor = colors.cream; }}
            onMouseLeave={event => { event.currentTarget.style.backgroundColor = '#fbfaf8'; }}
            aria-label="Close Live Pulse"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className={labelCls}>Student</label>
            <select
              value={selectedStudentFilter}
              onChange={(event) => onStudentFilterChange(event.target.value)}
              className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none"
              style={{ border: `1px solid ${colors.parchment}`, backgroundColor: '#fff', color: colors.charcoal, fontWeight: 460 }}
            >
              <option value={LIVE_PULSE_ALL_STUDENTS}>All students</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className={labelCls}>Domain</p>
            <div className="grid grid-cols-2 gap-2">
              {[LIVE_PULSE_DOMAINS.SCHOOL, LIVE_PULSE_DOMAINS.CHORES].map((domain) => {
                const isActive = selectedDomain === domain;
                const label = domain === LIVE_PULSE_DOMAINS.SCHOOL ? 'School' : 'Chores';

                return (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => onDomainChange(domain)}
                    className="rounded-lg px-3 py-2 text-[13px] transition-colors"
                    style={{
                      backgroundColor: isActive ? colors.lavenderTint : '#fbfaf8',
                      border: `1px solid ${isActive ? colors.lavender : colors.parchment}`,
                      color: isActive ? colors.amethyst : colors.charcoal,
                      fontWeight: isActive ? 700 : 540,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div
              className="h-8 w-8 animate-spin rounded-full"
              style={{
                border: '2px solid transparent',
                borderBottomColor: colors.lavender,
                borderLeftColor: colors.lavender,
              }}
            />
          </div>
        ) : selectedDomain === LIVE_PULSE_DOMAINS.CHORES ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: colors.lavenderTint }}>
              <Activity className="h-5 w-5" style={{ color: colors.amethyst }} />
            </div>
            <p className="text-[14px]" style={{ color: colors.charcoal, fontWeight: 540 }}>
              Chores activity is not connected here yet.
            </p>
            <p className="mx-auto mt-1 max-w-[18rem] text-[12px]" style={{ color: 'rgba(41,40,39,0.45)', fontWeight: 460 }}>
              This drawer now preserves the chores filter state, but the current Live Pulse feed still only reuses school activity for this phase.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(240,234,255,0.5)', border: `1px solid rgba(203,183,251,0.4)` }}>
              <div className="mb-3 flex items-center justify-between">
                <h4 style={{ fontSize: 13, fontWeight: 540, color: colors.charcoal }}>Weekly Progress</h4>
                <span className="text-[11px] uppercase tracking-wider" style={{ color: colors.amethyst, fontWeight: 700 }}>
                  {getWeekLabel(selectedWeekOffset)}
                </span>
              </div>
              {studentProgressRows.length === 0 ? (
                <p className="text-[13px]" style={{ color: 'rgba(41,40,39,0.45)', fontWeight: 460 }}>
                  No weekly school blocks are available for this filter yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {studentProgressRows.map(({ progress, student }) => (
                    <div key={student.id}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[13px]" style={{ color: colors.charcoal, fontWeight: 460 }}>{student.name}</span>
                        <span className="text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 700 }}>
                          {progress.completed}/{progress.total}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: colors.parchment }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${progress.percentage}%`, backgroundColor: colors.lavender }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-3 text-[11px] uppercase tracking-wider" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                Activity — {getWeekLabel(selectedWeekOffset)}
              </h4>
              {filteredWeekSubmissions.length === 0 ? (
                <p className="py-4 text-center text-[13px]" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                  No submissions {selectedWeekOffset === 0 ? 'this week' : 'for selected week'}
                  {selectedStudentFilter !== LIVE_PULSE_ALL_STUDENTS ? ' for this student' : ''}
                </p>
              ) : (
                <div className="max-h-[28rem] space-y-2 overflow-y-auto">
                  {filteredWeekSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors"
                      style={{ backgroundColor: colors.cream }}
                      onMouseEnter={event => { event.currentTarget.style.backgroundColor = colors.parchment; }}
                      onMouseLeave={event => { event.currentTarget.style.backgroundColor = colors.cream; }}
                      onClick={() => setViewingSummary(submission)}
                    >
                      <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: colors.lavender }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px]" style={{ color: colors.charcoal, fontWeight: 460 }}>
                          <span style={{ fontWeight: 540 }}>{studentNameById[submission.student_id] || 'Unknown'}</span>
                          {' '}completed{' '}
                          <span style={{ color: colors.amethyst }}>{submission.subject_name}</span>
                        </p>
                        {submission.custom_field_responses && Object.keys(submission.custom_field_responses).length > 0 ? (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: '#f0eaff' }}>
                            <Info className="h-3 w-3" style={{ color: colors.amethyst }} />
                            <span className="text-[10px]" style={{ color: colors.amethyst, fontWeight: 700 }}>Extra Details</span>
                          </div>
                        ) : null}
                        <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(submission.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {filteredStudents.length === 0 ? (
              <p className="text-center text-[12px]" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                Add a student to start seeing Live Pulse activity.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  </div>
);

const ParentDashboard = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingStudentProgress, setViewingStudentProgress] = useState(null);
  const [viewingStudentChoresProgress, setViewingStudentChoresProgress] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [viewingSummary, setViewingSummary] = useState(null);
  const [manualCompleteBlock, setManualCompleteBlock] = useState(null);
  const [parentNote, setParentNote] = useState('');
  const [showManualConfirm, setShowManualConfirm] = useState(false);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [expandedSectionId, setExpandedSectionId] = useState(null);
  const [isLivePulseOpen, setIsLivePulseOpen] = useState(false);
  const [livePulseStudentFilter, setLivePulseStudentFilter] = useState(LIVE_PULSE_ALL_STUDENTS);
  const [livePulseDomainFilter, setLivePulseDomainFilter] = useState(LIVE_PULSE_DOMAINS.SCHOOL);
  const currentDashboardFeaturePath = location.pathname.replace(/\/+$/, '').split('/').slice(2).join('/') || DASHBOARD_DEFAULT_FEATURE_ID;
  const shouldLoadStudentChoresSnapshot = Boolean(currentUser) && (
    currentDashboardFeaturePath === dashboardFeaturesById.students.path
    || Boolean(viewingStudentChoresProgress)
  );

  const db = getFirestore(app);
  const { students, loading: studentsLoading } = useStudents({
    parentId: currentUser?.uid,
    enabled: Boolean(currentUser),
  });
  const {
    parentSettings,
    saveSettings: handleSaveSettings,
    settingsReady,
    settingsSaving,
  } = useParentSettings({
    currentUser,
    students,
    enabled: Boolean(currentUser),
  });
  const { subjects, loading: subjectsLoading } = useSubjects({
    parentId: currentUser?.uid,
    enabled: Boolean(currentUser),
    activeOnly: true,
    sortField: 'title',
    sortDirection: 'asc',
  });
  const weekConfig = useMemo(() => getWeekConfig(parentSettings), [
    parentSettings.week_reset_day,
    parentSettings.week_reset_hour,
    parentSettings.week_reset_minute,
  ]);
  const currentWeekStart = useMemo(
    () => getCurrentWeekRange(new Date(), weekConfig).weekStart,
    [weekConfig]
  );
  const {
    plan,
    curriculumLimitCheck,
    featureAccess,
    featureAccessList,
    isMissingEntitlementDoc,
    lockdownAccess,
    subscriptionStatusMeta,
    studentLimitCheck,
    trialEndsAt,
    currentPeriodEnd,
    canAddStudent,
  } = useEntitlements({
    parentId: currentUser?.uid,
    students,
    subjects,
    enabled: Boolean(currentUser),
  });
  const {
    addStudent,
    addingStudent,
    deleteStudent: handleDeleteStudent,
  } = useStudentMutations({
    canAddStudent,
    currentUser,
    planName: plan?.displayName || 'Free',
    studentLimitCheck,
  });
  const {
    completeBlockManually,
    downloadWeeklyReport,
    getCustomFieldLabel,
    getRealTimeWeeklyProgress,
    getWeeklyProgress,
    getWeekSubmissions,
    isGeneratingReport,
    loading: activityLoading,
    resetSubmission,
  } = useWeeklyActivity({
    currentUser,
    parentId: currentUser?.uid,
    enabled: Boolean(currentUser),
    students,
    subjects,
    weekConfig,
    startAt: currentWeekStart,
  });
  const { createWeeklyRecordsForRange } = useWeeklyReportRecords({
    currentUser,
    parentSettings,
    students,
    subjects,
    enabled: Boolean(currentUser),
    listen: false,
  });
  const {
    loading: choresLoading,
    pointWallets,
    rewardRedemptions,
    viewModel: choresViewModel,
  } = useChoreSetup({
    parentId: currentUser?.uid,
    parentSettings,
    students,
    enabled: shouldLoadStudentChoresSnapshot,
  });
  const loading = studentsLoading || subjectsLoading || activityLoading;
  const { rolloverStatus } = useWeeklyRollover({
    createWeeklyRecordsForRange,
    currentUser,
    enabled: Boolean(currentUser),
    loading,
    parentSettings,
    settingsReady,
    weekConfig,
  });
  const resolvedDashboardFeatures = useMemo(
    () => resolveDashboardFeatures({ featureAccess }),
    [featureAccess]
  );
  const resolvedDashboardFeaturesById = useMemo(
    () => Object.fromEntries(resolvedDashboardFeatures.map((feature) => [feature.id, feature])),
    [resolvedDashboardFeatures]
  );
  const resolvedDashboardNavigation = useMemo(
    () => resolveDashboardNavigation({ featureAccess }),
    [featureAccess]
  );
  const resolvedDashboardFeaturesByPath = useMemo(
    () => Object.fromEntries(resolvedDashboardFeatures.map((feature) => [feature.path, feature])),
    [resolvedDashboardFeatures]
  );
  const defaultDashboardFeature = useMemo(
    () => getDashboardDefaultFeature(resolvedDashboardFeatures),
    [resolvedDashboardFeatures]
  );
  const activeFeaturePath = currentDashboardFeaturePath;
  const activeFeature = resolvedDashboardFeaturesByPath[activeFeaturePath] || defaultDashboardFeature;
  const activeFeatureShell = activeFeature.shell || {
    headerSlots: {
      primaryAction: null,
      secondaryActions: [],
      filters: [],
      notices: [],
    },
  };
  const defaultDashboardPath = defaultDashboardFeature?.path || dashboardFeaturesById[DASHBOARD_DEFAULT_FEATURE_ID].path;
  const activeSectionId = getDashboardSectionIdForFeatureId(activeFeature.id);
  const hasShellHeaderControls = Boolean(
    activeFeatureShell.headerSlots.primaryAction ||
    activeFeatureShell.headerSlots.filters.length ||
    activeFeatureShell.headerSlots.secondaryActions.length
  );
  const accountSettingsPath = `/dashboard/${dashboardFeaturesById.settings.path}`;
  const isAccountSettingsActive = activeFeature.id === dashboardFeaturesById.settings.id;
  const studentNameById = useMemo(
    () => Object.fromEntries(students.map((student) => [student.id, student.name])),
    [students]
  );
  const pointWalletsByStudentId = useMemo(
    () => Object.fromEntries(
      (Array.isArray(pointWallets) ? pointWallets : []).map((wallet) => [
        wallet.student_id,
        {
          total_points: Number.parseInt(wallet?.total_points, 10) || 0,
          lifetime_points: Number.parseInt(wallet?.lifetime_points, 10) || 0,
        },
      ])
    ),
    [pointWallets]
  );
  const choresProgressByStudentId = useMemo(
    () => Object.fromEntries(
      (choresViewModel?.progress_by_student || []).map((card) => [card.student_id, card])
    ),
    [choresViewModel?.progress_by_student]
  );
  const choresAllowanceByStudentId = useMemo(
    () => Object.fromEntries(
      (choresViewModel?.allowance?.cards || []).map((card) => [card.student_id, card])
    ),
    [choresViewModel?.allowance?.cards]
  );
  const rewardRequestCountByStudentId = useMemo(
    () => (Array.isArray(rewardRedemptions) ? rewardRedemptions : []).reduce((counts, redemption) => {
      if (
        redemption?.student_id &&
        (redemption?.status === 'requested' || redemption?.status === 'approved')
      ) {
        counts[redemption.student_id] = (counts[redemption.student_id] || 0) + 1;
      }
      return counts;
    }, {}),
    [rewardRedemptions]
  );
  const pendingChoreReviewsByStudentId = useMemo(
    () => (choresViewModel?.pending_review || []).reduce((grouped, record) => {
      if (!record?.student_id) {
        return grouped;
      }

      if (!grouped[record.student_id]) {
        grouped[record.student_id] = [];
      }

      grouped[record.student_id].push(record);
      return grouped;
    }, {}),
    [choresViewModel?.pending_review]
  );
  const filteredLivePulseStudents = useMemo(() => {
    if (livePulseStudentFilter === LIVE_PULSE_ALL_STUDENTS) {
      return students;
    }

    return students.filter((student) => student.id === livePulseStudentFilter);
  }, [livePulseStudentFilter, students]);
  const livePulseStudentProgressRows = useMemo(
    () => filteredLivePulseStudents
      .map((student) => ({
        student,
        progress: getRealTimeWeeklyProgress(student.id, selectedWeekOffset),
      }))
      .filter(({ progress }) => progress.total > 0),
    [filteredLivePulseStudents, getRealTimeWeeklyProgress, selectedWeekOffset]
  );
  const filteredLivePulseSubmissions = useMemo(() => {
    if (livePulseDomainFilter === LIVE_PULSE_DOMAINS.CHORES) {
      return [];
    }

    const weekSubmissions = getWeekSubmissions(selectedWeekOffset);
    if (livePulseStudentFilter === LIVE_PULSE_ALL_STUDENTS) {
      return weekSubmissions;
    }

    return weekSubmissions.filter(
      (submission) => submission.student_id === livePulseStudentFilter
    );
  }, [
    getWeekSubmissions,
    livePulseDomainFilter,
    livePulseStudentFilter,
    selectedWeekOffset,
  ]);

  useEffect(() => {
    const activeSection = resolvedDashboardNavigation.find(
      (section) => section.sectionId === activeSectionId
    );

    if (activeSection?.children?.length) {
      setExpandedSectionId(activeSection.sectionId);
      return;
    }

    setExpandedSectionId(null);
  }, [activeSectionId, resolvedDashboardNavigation]);

  useEffect(() => {
    if (livePulseStudentFilter === LIVE_PULSE_ALL_STUDENTS) {
      return;
    }

    const hasSelectedStudent = students.some((student) => student.id === livePulseStudentFilter);
    if (!hasSelectedStudent) {
      setLivePulseStudentFilter(LIVE_PULSE_ALL_STUDENTS);
    }
  }, [livePulseStudentFilter, students]);

  const handleAddStudent = useCallback(async ({ name, accessPin }) => {
    const added = await addStudent({ name, accessPin });
    if (added) {
      setModalOpen(false);
    }
  }, [addStudent]);

  if (activeFeature?.shellState === DASHBOARD_FEATURE_STATES.HIDDEN) {
    return <Navigate to={`/dashboard/${defaultDashboardPath}`} replace />;
  }

  const handleViewSchoolProgress = (student) => {
    setViewingStudentChoresProgress(null);
    setViewingStudentProgress(student);
  };

  const handleCloseStudentProgress = () => {
    setViewingStudentProgress(null);
    setSelectedSubmission(null);
  };

  const handleViewChoresProgress = (student) => {
    setSelectedSubmission(null);
    setViewingStudentProgress(null);
    setViewingStudentChoresProgress(student);
  };

  const handleCloseStudentChoresProgress = () => {
    setViewingStudentChoresProgress(null);
  };

  const handleResetBlock = async (submissionId) => {
    if (!window.confirm('Are you sure you want to reset this block? This will delete the submission and the student will need to redo it.')) return;

    const reset = await resetSubmission(submissionId);
    if (reset) {
      setSelectedSubmission(null);
      alert('Block reset successfully! The student can now redo this block.');
    } else {
      alert('Failed to reset block. Please try again.');
    }
  };

  const handleManualComplete = (subject, blockIndex) => {
    setManualCompleteBlock({ subject, blockIndex });
    setParentNote('');
    setShowManualConfirm(true);
  };

  const confirmManualComplete = async () => {
    if (!manualCompleteBlock || !viewingStudentProgress) return;

    const completed = await completeBlockManually({
      studentId: viewingStudentProgress.id,
      subject: manualCompleteBlock.subject,
      blockIndex: manualCompleteBlock.blockIndex,
      parentNote,
    });

    if (completed) {
      setShowManualConfirm(false);
      setManualCompleteBlock(null);
      setParentNote('');
      alert('Block marked as completed successfully!');
    } else {
      alert('Failed to mark block complete. Please try again.');
    }
  };

  const cancelManualComplete = () => {
    setShowManualConfirm(false);
    setManualCompleteBlock(null);
    setParentNote('');
  };

  const getStudentProgressForSubject = (subjectId) => {
    const weekSubmissions = getWeekSubmissions(selectedWeekOffset);
    return weekSubmissions
      .filter(s => s.student_id === viewingStudentProgress?.id && s.subject_id === subjectId)
      .map(s => s.block_index);
  };

  const isBlockCompletedForStudent = (subjectId, blockIndex) => {
    return getStudentProgressForSubject(subjectId).includes(blockIndex);
  };

  const handleLogout = async () => {
    const result = await logout();
    if (!result.success) console.error('Logout failed:', result.error);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    const now = new Date();
    const t = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMins = Math.floor((now - t) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

  const C = {
    mysteria: '#1b1938',
    lavender: '#cbb7fb',
    charcoal: '#292827',
    amethyst: '#714cb6',
    cream: '#e9e5dd',
    parchment: '#dcd7d3',
    lavenderTint: '#f0eaff',
  };
  const studentLimitSummary = buildEntitlementUsageSummary({
    limitCheck: studentLimitCheck,
    nounSingular: 'student',
    planName: plan?.displayName || 'Free',
  });
  const studentLimitReached = Boolean(studentLimitCheck?.hasReachedLimit);
  const studentLimitMessage = studentLimitReached
    ? `${studentLimitSummary} ${studentLimitCheck?.upgradeCopy || ''} You can still delete existing students to get back under the cap.`
    : studentLimitSummary;
  const openAddStudentModal = () => {
    if (!canAddStudent) return;
    setModalOpen(true);
  };
  const entitlementSummary = {
    plan,
    studentLimitCheck,
    curriculumLimitCheck,
    featureAccessList,
    subscriptionStatusMeta,
    isMissingEntitlementDoc,
    trialEndsAt,
    currentPeriodEnd,
  };
  const renderHeaderPrimaryAction = (actionId) => {
    if (actionId !== DASHBOARD_HEADER_ACTIONS.ADD_STUDENT) return null;

    return (
      <button
        onClick={openAddStudentModal}
        disabled={!canAddStudent}
        className="op-button disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
        {studentLimitReached ? 'Student Limit Reached' : 'Add Student'}
      </button>
    );
  };

  const renderHeaderFilter = (filterId) => {
    if (filterId !== DASHBOARD_HEADER_FILTERS.WEEK_RANGE) return null;

    return (
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[rgba(238,234,248,0.52)]" />
        <select
          value={selectedWeekOffset}
          onChange={(e) => setSelectedWeekOffset(parseInt(e.target.value, 10))}
          className="op-input max-w-[220px] py-2 text-[13px]"
        >
          {getWeekPickerOptions(weekConfig).map(option => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.displayText})
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderHeaderSecondaryAction = (actionId) => {
    if (actionId === DASHBOARD_HEADER_ACTIONS.DOWNLOAD_WEEKLY_REPORT) {
      return (
        <button
          onClick={() => downloadWeeklyReport(selectedWeekOffset)}
          disabled={isGeneratingReport}
          className="op-button op-button-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {isGeneratingReport ? 'Generating...' : 'Download Report'}
        </button>
      );
    }

    if (actionId === DASHBOARD_HEADER_ACTIONS.VIEW_REPORTS) {
      if (selectedWeekOffset >= 0) return null;

      return (
        <button
          onClick={() => navigate(`/dashboard/${dashboardFeaturesById.reports.path}`)}
          className="op-button"
        >
          <FileText className="w-4 h-4" />
          View Reports
        </button>
      );
    }

    return null;
  };

  const renderHeaderNotice = (noticeId) => {
    if (noticeId !== DASHBOARD_HEADER_NOTICES.STUDENT_PLAN_USAGE || !studentLimitCheck) return null;

    return (
      <div
        className="op-panel-muted mt-3 px-4 py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="op-eyebrow">
            Student Plan Usage
          </p>
          <span className="text-[12px] font-label text-[rgba(238,234,248,0.56)]">
            {studentLimitCheck.isUnlimited ? `${studentLimitCheck.usage} active` : `${studentLimitCheck.usage}/${studentLimitCheck.limit}`}
          </span>
        </div>
        <p className="op-subtle mt-1.5 text-[13px] font-body leading-5">
          {studentLimitMessage}
        </p>
      </div>
    );
  };

  const toggleLivePulseDrawer = () => {
    setIsLivePulseOpen((currentIsOpen) => !currentIsOpen);
  };

  const toggleExpandedSection = (sectionId) => {
    setExpandedSectionId((currentSectionId) => (
      currentSectionId === sectionId ? null : sectionId
    ));
  };

  const renderNavBadge = (badge, { active = false } = {}) => {
    if (badge !== DASHBOARD_NAV_BADGES.COMING_SOON) return null;

    return (
      <span
        className="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-label"
        style={{
          backgroundColor: active ? 'rgba(203,183,251,0.18)' : 'rgba(255,255,255,0.08)',
          color: active ? C.lavender : 'rgba(255,255,255,0.72)',
        }}
      >
        Coming Soon
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#1f1f32]" style={{ fontFamily: FONT }}>
      <div className="flex h-screen">

        {/* Sidebar */}
        <div className="w-64 flex flex-col flex-shrink-0 border-r border-[rgba(203,183,251,0.12)] bg-[#181829]">
          <div className="px-6 pt-7 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="mb-3 h-[3px] w-6 bg-[#cbb7fb]" />
            <h1 style={{ fontSize: 20, fontWeight: 540, lineHeight: 0.96, letterSpacing: 0, color: '#ffffff' }}>
              OWN PATH
            </h1>
            <p className="text-[12px] mt-1.5" style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 460 }}>Parent Portal</p>
          </div>

          <nav key={location.pathname} className="flex-1 p-3">
            <div className="space-y-2">
              {resolvedDashboardNavigation.map((section) => {
                const Icon = section.icon;
                const isSectionActive = activeSectionId === section.sectionId;
                const hasChildren = section.children.length > 0;
                const isExpanded = expandedSectionId === section.sectionId;
                const showLockedBadge = section.isLocked && !section.navBadge;

                return (
                  <div key={section.sectionId}>
                    <div className="flex items-center gap-1">
                      <NavLink
                        to={section.path}
                        className="flex min-w-0 flex-1 items-center gap-3 border-l-2 px-3 py-2.5 transition-all hover:bg-white/5"
                        style={{
                          backgroundColor: isSectionActive
                            ? 'rgba(203,183,251,0.15)'
                            : (section.isLocked ? 'rgba(255,255,255,0.03)' : 'transparent'),
                          borderColor: isSectionActive ? C.lavender : 'transparent',
                          color: isSectionActive
                            ? C.lavender
                            : (section.isLocked ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.5)'),
                          fontWeight: isSectionActive ? 540 : 460,
                          fontSize: 14,
                        }}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{section.label}</span>
                        {showLockedBadge ? (
                          <span
                            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-label"
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.08)',
                              color: isSectionActive ? C.lavender : 'rgba(255,255,255,0.72)',
                            }}
                          >
                            <Lock className="w-3 h-3" />
                            Locked
                          </span>
                        ) : renderNavBadge(section.navBadge, { active: isSectionActive })}
                      </NavLink>

                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleExpandedSection(section.sectionId)}
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-transparent transition-colors hover:border-[rgba(203,183,251,0.18)] hover:bg-white/5"
                          style={{ color: isSectionActive ? C.lavender : 'rgba(255,255,255,0.45)' }}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${section.label}`}
                          aria-expanded={isExpanded}
                        >
                          <ChevronDown
                            className="h-4 w-4 transition-transform"
                            style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                          />
                        </button>
                      ) : null}
                    </div>

                    {hasChildren && isExpanded ? (
                      <div
                        className="ml-6 mt-1 space-y-1 border-l pl-4"
                        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                      >
                        {section.children.map((child) => {
                          if (child.isPlaceholder) {
                            return (
                              <div
                                key={child.id}
                                className="flex items-center gap-3 px-3 py-2 text-[13px]"
                                style={{ color: 'rgba(255,255,255,0.46)' }}
                              >
                                <span>{child.label}</span>
                                {renderNavBadge(child.badge)}
                              </div>
                            );
                          }

                          const isChildActive = activeFeature.id === child.id;
                          const showChildLockedBadge = child.isLocked;

                          return (
                            <NavLink
                              key={child.id}
                              to={child.path}
                              className="flex items-center gap-3 border-l-2 px-3 py-2 text-[13px] transition-colors hover:bg-white/5"
                              style={{
                                backgroundColor: isChildActive
                                  ? 'rgba(203,183,251,0.12)'
                                  : (child.isLocked ? 'rgba(255,255,255,0.03)' : 'transparent'),
                                borderColor: isChildActive ? C.lavender : 'transparent',
                                color: isChildActive
                                  ? C.lavender
                                  : (child.isLocked ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.62)'),
                                fontWeight: isChildActive ? 540 : 460,
                              }}
                            >
                              <span>{child.label}</span>
                              {showChildLockedBadge ? (
                                <span
                                  className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-label"
                                  style={{
                                    backgroundColor: 'rgba(255,255,255,0.08)',
                                    color: isChildActive ? C.lavender : 'rgba(255,255,255,0.72)',
                                  }}
                                >
                                  <Lock className="w-3 h-3" />
                                  Locked
                                </span>
                              ) : null}
                            </NavLink>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </nav>

          <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              className="w-full flex items-center justify-center gap-2 border border-[rgba(238,234,248,0.14)] px-4 py-2.5 transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.62)', fontSize: 13, fontWeight: 700 }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
            >
              <Heart className="w-4 h-4" />
              Support Project
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative flex-1 flex flex-col overflow-hidden bg-[#1f1f32]">
          {/* Header */}
          <header className="flex-shrink-0 border-b border-[rgba(203,183,251,0.12)] bg-[#202034] px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 540, lineHeight: 0.96, letterSpacing: 0, color: 'rgba(250,249,255,0.96)' }}>
                  {activeFeature.header.title}
                </h2>
                <p className="text-[13px] mt-1" style={{ color: 'rgba(238,234,248,0.5)', fontWeight: 460 }}>
                  {activeFeature.header.description}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {activeFeatureShell.headerSlots.primaryAction && renderHeaderPrimaryAction(activeFeatureShell.headerSlots.primaryAction)}
                {activeFeatureShell.headerSlots.filters.map((filterId) => (
                  <React.Fragment key={filterId}>
                    {renderHeaderFilter(filterId)}
                  </React.Fragment>
                ))}
                {activeFeatureShell.headerSlots.secondaryActions.map((actionId) => (
                  <React.Fragment key={actionId}>
                    {renderHeaderSecondaryAction(actionId)}
                  </React.Fragment>
                ))}
                <button
                  type="button"
                  onClick={toggleLivePulseDrawer}
                  aria-controls="dashboard-live-pulse-drawer"
                  aria-expanded={isLivePulseOpen}
                  className="op-button op-button-secondary"
                  style={{
                    fontSize: 13,
                    fontWeight: isLivePulseOpen ? 700 : 540,
                  }}
                >
                  <Activity className="w-4 h-4" />
                  {isLivePulseOpen ? 'Hide Live Pulse' : 'Live Pulse'}
                </button>

                <div
                  className="flex items-center gap-3"
                  style={{
                    borderLeft: hasShellHeaderControls ? '1px solid rgba(238,234,248,0.12)' : 'none',
                    paddingLeft: hasShellHeaderControls ? 12 : 0,
                  }}
                >
                  <span className="text-[13px]" style={{ color: 'rgba(238,234,248,0.5)', fontWeight: 460 }}>{currentUser?.email}</span>
                  <NavLink
                    to={accountSettingsPath}
                    end
                    className="border px-3 py-1.5 text-[13px] transition-colors"
                    style={{
                      backgroundColor: isAccountSettingsActive ? 'rgba(203,183,251,0.14)' : 'transparent',
                      borderColor: isAccountSettingsActive ? 'rgba(203,183,251,0.42)' : 'rgba(238,234,248,0.14)',
                      color: isAccountSettingsActive ? C.lavender : 'rgba(238,234,248,0.68)',
                      fontWeight: 540,
                    }}
                  >
                    Account Settings
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="text-[13px] hover:underline"
                    style={{ color: C.lavender, fontWeight: 460 }}
                  >
                    Log Out
                  </button>
                </div>
              </div>
            </div>
            {rolloverStatus.message && (
              <div className="op-panel-muted mt-3 px-3 py-2 text-[12px] font-body text-[rgba(238,234,248,0.72)]">
                {rolloverStatus.message}
              </div>
            )}
            {activeFeatureShell.headerSlots.notices.map((noticeId) => (
              <React.Fragment key={noticeId}>
                {renderHeaderNotice(noticeId)}
              </React.Fragment>
            ))}
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-auto bg-[#1f1f32]">
            <Outlet
              context={{
                activeDashboardFeatureId: activeFeature.id,
                activeDashboardFeaturePath: activeFeature.path,
                canAddStudent,
                colors: C,
                currentUser,
                db,
                entitlementSummary,
                featureShellState: activeFeature.shellState,
                handleDeleteStudent,
                handleSaveSettings,
                handleViewChoresProgress,
                handleViewSchoolProgress,
                loading,
                lockdownAccess,
                openAddStudentModal,
                parentSettings,
                planName: plan?.displayName || 'Free',
                resolvedDashboardFeaturesById,
                settingsSaving,
                studentLimitReached,
                students,
                subjects,
              }}
            />
          </main>
          <DashboardLivePulseDrawer
            colors={C}
            filteredStudents={filteredLivePulseStudents}
            filteredWeekSubmissions={filteredLivePulseSubmissions}
            formatTimestamp={formatTimestamp}
            isOpen={isLivePulseOpen}
            loading={loading}
            onClose={() => setIsLivePulseOpen(false)}
            onDomainChange={setLivePulseDomainFilter}
            onStudentFilterChange={setLivePulseStudentFilter}
            selectedDomain={livePulseDomainFilter}
            selectedStudentFilter={livePulseStudentFilter}
            selectedWeekOffset={selectedWeekOffset}
            setViewingSummary={setViewingSummary}
            studentNameById={studentNameById}
            studentProgressRows={livePulseStudentProgressRows}
            students={students}
          />
        </div>
      </div>

      {/* Add Student Modal */}
      <AddStudentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAddStudent={handleAddStudent}
        loading={addingStudent}
      />


      {/* Summary Modal */}
      {viewingSummary && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 border border-parchment">
            <div className="flex items-center justify-between p-6 border-b border-parchment">
              <h2 style={{ fontSize: 17, fontWeight: 540, color: '#292827' }}>
                {viewingSummary.subject_name} Summary
              </h2>
              <button onClick={() => setViewingSummary(null)} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[13px] font-body text-charcoal-ink/60">
                  <span style={{ fontWeight: 540, color: '#292827' }}>
                    {students.find(s => s.id === viewingSummary.student_id)?.name || 'Unknown Student'}
                  </span>
                </p>
                <p className="text-[12px] font-body text-charcoal-ink/40 mt-0.5">
                  {formatTimestamp(viewingSummary.timestamp)}
                </p>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: C.cream }}>
                <p className="text-[14px] whitespace-pre-wrap" style={{ color: C.charcoal, fontWeight: 460 }}>
                  {viewingSummary.summary_text}
                </p>
              </div>
              {viewingSummary.custom_field_responses && Object.keys(viewingSummary.custom_field_responses).length > 0 && (
                <div className="bg-[#f0eaff]/50 rounded-xl p-4 border border-lavender-glow/40">
                  <h4 style={{ fontSize: 12, fontWeight: 700 }} className="uppercase tracking-wider text-amethyst-link mb-3">Custom Details</h4>
                  <div className="space-y-2">
                    {Object.entries(viewingSummary.custom_field_responses).map(([fieldId, value]) => (
                      <div key={fieldId}>
                        <span className="text-[11px] font-label uppercase tracking-wider text-amethyst-link/70">
                          {getCustomFieldLabel(fieldId, viewingSummary.subject_id)}
                        </span>
                        <p className="text-[14px] font-body text-charcoal-ink mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Student Progress Modal */}
      {viewingStudentProgress && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden border border-parchment">
            <div className="flex items-center justify-between p-6 border-b border-parchment">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 540, color: '#292827' }}>
                  {viewingStudentProgress.name}'s Progress
                </h2>
                <p className="text-[13px] font-body text-charcoal-ink/40 mt-0.5">View and manage individual student progress</p>
              </div>
              <button onClick={handleCloseStudentProgress} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
              {/* Week Selector */}
              <div className="mb-6 p-4 bg-[#f0eaff]/40 rounded-xl border border-lavender-glow/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-label uppercase tracking-wider text-amethyst-link mb-1">Viewing Progress For</p>
                    <p className="text-[13px] font-body text-charcoal-ink">
                      {formatWeekRange(...Object.values(getWeekRangeByOffset(selectedWeekOffset, weekConfig)))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amethyst-link/60" />
                    <select
                      value={selectedWeekOffset}
                      onChange={(e) => setSelectedWeekOffset(parseInt(e.target.value))}
                      className="px-3 py-1.5 text-[13px] font-body border border-parchment rounded-lg bg-white text-charcoal-ink focus:outline-none focus:border-charcoal-ink"
                    >
                      {getWeekPickerOptions(weekConfig).slice(-8).map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {(() => {
                const studentSubjects = subjects.filter(subject => {
                  if (subject.student_ids && Array.isArray(subject.student_ids)) return subject.student_ids.includes(viewingStudentProgress.id);
                  return subject.student_id === viewingStudentProgress.id;
                });

                if (studentSubjects.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 bg-[#f0eaff] rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-7 h-7 text-amethyst-link/50" />
                      </div>
                      <h3 className="text-[16px] font-display text-charcoal-ink mb-2">No subjects assigned</h3>
                      <p className="text-[14px] font-body text-charcoal-ink/40">This student hasn't been assigned any subjects yet.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-5">
                    {studentSubjects.map((subject) => {
                      const progress = getWeeklyProgress(viewingStudentProgress.id, subject.id, selectedWeekOffset);

                      return (
                        <div key={subject.id} className="bg-white rounded-2xl border border-parchment p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color || '#cbb7fb' }} />
                                <h3 style={{ fontSize: 16, fontWeight: 540, color: '#292827' }}>{subject.title}</h3>
                              </div>
                              <div className="flex items-center gap-3 text-[13px] font-body text-charcoal-ink/50">
                                <span>Progress: {progress.completed}/{progress.total} blocks</span>
                                <span className="text-amethyst-link font-label">{progress.percentage}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full rounded-full h-2 overflow-hidden mb-5" style={{ backgroundColor: C.parchment }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${progress.percentage}%`, backgroundColor: C.lavender }}
                            />
                          </div>

                          {/* Blocks Grid */}
                          <div>
                            <p className="text-[11px] font-label uppercase tracking-wider text-charcoal-ink/40 mb-3">
                              {getWeekLabel(selectedWeekOffset)} Blocks
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              {Array.from({ length: progress.total }, (_, index) => {
                                const isCompleted = isBlockCompletedForStudent(subject.id, index);
                                const weekSubmissions = getWeekSubmissions(selectedWeekOffset);
                                const submission = weekSubmissions.find(s =>
                                  s.student_id === viewingStudentProgress.id &&
                                  s.subject_id === subject.id &&
                                  s.block_index === index
                                );

                                return (
                                  <div key={index} className="flex items-center gap-1">
                                    <button
                                      onClick={() => isCompleted && setSelectedSubmission(submission)}
                                      disabled={!isCompleted}
                                      className="w-11 h-11 rounded-lg font-label text-[13px] transition-all"
                                      style={{
                                        backgroundColor: isCompleted ? '#f0eaff' : '#ffffff',
                                        border: `1px solid ${isCompleted ? C.lavender : C.parchment}`,
                                        color: isCompleted ? C.amethyst : 'rgba(41,40,39,0.3)',
                                        cursor: isCompleted ? 'pointer' : 'not-allowed',
                                      }}
                                      title={isCompleted ? 'Click to view details' : 'Not completed'}
                                    >
                                      {isCompleted ? '✓' : index + 1}
                                    </button>

                                    {!isCompleted && (
                                      <button
                                        onClick={() => handleManualComplete(subject, index)}
                                        className="w-8 h-11 rounded-lg transition-all flex items-center justify-center"
                                        style={{ backgroundColor: C.cream, border: `1px solid ${C.parchment}`, color: 'rgba(41,40,39,0.4)' }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0eaff'; e.currentTarget.style.borderColor = C.lavender; e.currentTarget.style.color = C.amethyst; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.cream; e.currentTarget.style.borderColor = C.parchment; e.currentTarget.style.color = 'rgba(41,40,39,0.4)'; }}
                                        title="Mark as complete (Parent-led session)"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Student Chores Progress Modal */}
      {viewingStudentChoresProgress && (() => {
        const progressCard = choresProgressByStudentId[viewingStudentChoresProgress.id] || null;
        const allowanceCard = choresAllowanceByStudentId[viewingStudentChoresProgress.id] || null;
        const pointWallet = pointWalletsByStudentId[viewingStudentChoresProgress.id] || {
          total_points: 0,
          lifetime_points: 0,
        };
        const pendingReviews = pendingChoreReviewsByStudentId[viewingStudentChoresProgress.id] || [];
        const openRewardRequests = rewardRequestCountByStudentId[viewingStudentChoresProgress.id] || 0;
        const allowanceRatio = Math.max(
          0,
          Math.min(100, Math.round((allowanceCard?.completion_ratio || 0) * 100))
        );
        const quickStats = progressCard ? [
          {
            label: 'Routine Days',
            completed: progressCard.progress.routine_days_completed,
            required: progressCard.quotas.required_routine_days,
            detail: 'Completed this week',
          },
          {
            label: 'Weekly Pool',
            completed: progressCard.progress.weekly_blocks_completed,
            required: progressCard.quotas.required_weekly_chore_blocks,
            detail: 'Weekly chore blocks',
          },
          {
            label: 'Monthly Pool',
            completed: progressCard.progress.monthly_blocks_completed,
            required: progressCard.quotas.required_monthly_chore_blocks,
            detail: 'Monthly chore blocks',
          },
        ] : [];

        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden border border-parchment">
              <div className="flex items-center justify-between p-6 border-b border-parchment">
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 540, color: '#292827' }}>
                    {viewingStudentChoresProgress.name}'s Chores Progress
                  </h2>
                  <p className="text-[13px] font-body text-charcoal-ink/40 mt-0.5">
                    Quick chores snapshot for the current household cycle
                  </p>
                </div>
                <button onClick={handleCloseStudentChoresProgress} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
                {choresLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div
                      className="h-8 w-8 animate-spin rounded-full"
                      style={{
                        border: '2px solid transparent',
                        borderBottomColor: C.lavender,
                        borderLeftColor: C.lavender,
                      }}
                    />
                  </div>
                ) : !progressCard && !allowanceCard ? (
                  <div className="text-center py-14">
                    <div className="w-14 h-14 bg-[#f0eaff] rounded-full flex items-center justify-center mx-auto mb-4">
                      <Activity className="w-7 h-7 text-amethyst-link/50" />
                    </div>
                    <h3 className="text-[16px] font-display text-charcoal-ink mb-2">No chores snapshot yet</h3>
                    <p className="text-[14px] font-body text-charcoal-ink/40">
                      This student does not have saved chores summary data to show in the overview yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-parchment bg-[#fbfaf8] p-4">
                        <p className="text-[11px] uppercase tracking-wider font-label text-charcoal-ink/40">Active Routines</p>
                        <p className="mt-2 text-[28px] font-display text-charcoal-ink">{progressCard?.active_routine_count || 0}</p>
                        <p className="mt-1 text-[12px] font-body text-charcoal-ink/50">Current routine templates assigned</p>
                      </div>
                      <div className="rounded-2xl border border-parchment bg-[#fbfaf8] p-4">
                        <p className="text-[11px] uppercase tracking-wider font-label text-charcoal-ink/40">Pending Review</p>
                        <p className="mt-2 text-[28px] font-display text-charcoal-ink">{progressCard?.pending_review_count || 0}</p>
                        <p className="mt-1 text-[12px] font-body text-charcoal-ink/50">Parent review decisions waiting</p>
                      </div>
                      <div className="rounded-2xl border border-parchment bg-[#fbfaf8] p-4">
                        <p className="text-[11px] uppercase tracking-wider font-label text-charcoal-ink/40">Available Now</p>
                        <p className="mt-2 text-[20px] font-display text-charcoal-ink">
                          {progressCard?.available_counts?.weekly || 0} weekly / {progressCard?.available_counts?.monthly || 0} monthly
                        </p>
                        <p className="mt-1 text-[12px] font-body text-charcoal-ink/50">Open chore options in the current pools</p>
                      </div>
                      <div className="rounded-2xl border border-parchment bg-[#fbfaf8] p-4">
                        <p className="text-[11px] uppercase tracking-wider font-label text-charcoal-ink/40">Points</p>
                        <p className="mt-2 text-[28px] font-display text-charcoal-ink">{pointWallet.total_points}</p>
                        <p className="mt-1 text-[12px] font-body text-charcoal-ink/50">
                          {pointWallet.lifetime_points} lifetime • {openRewardRequests} open reward request{openRewardRequests === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    {quickStats.length > 0 ? (
                      <div className="rounded-2xl border border-parchment bg-white p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-label text-amethyst-link mb-1">Current Progress</p>
                            <h3 className="text-[17px] font-display text-charcoal-ink">Weekly and monthly chores snapshot</h3>
                          </div>
                          <span className="rounded-full bg-[#f0eaff] px-3 py-1 text-[11px] uppercase tracking-wider font-label text-amethyst-link">
                            In-place overview
                          </span>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          {quickStats.map((stat) => {
                            const percentage = stat.required > 0
                              ? Math.max(0, Math.min(100, Math.round((stat.completed / stat.required) * 100)))
                              : 0;

                            return (
                              <div key={stat.label} className="rounded-xl bg-[#fbfaf8] p-4" style={{ border: `1px solid ${C.parchment}` }}>
                                <p className="text-[11px] uppercase tracking-wider font-label text-charcoal-ink/40">{stat.label}</p>
                                <div className="mt-2 flex items-end justify-between gap-3">
                                  <p className="text-[24px] font-display text-charcoal-ink">
                                    {stat.completed}/{stat.required}
                                  </p>
                                  <span className="text-[12px] font-label text-amethyst-link">
                                    {percentage}%
                                  </span>
                                </div>
                                <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.parchment }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${percentage}%`, backgroundColor: C.lavender }}
                                  />
                                </div>
                                <p className="mt-2 text-[12px] font-body text-charcoal-ink/50">{stat.detail}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {allowanceCard ? (
                      <div className="rounded-2xl border border-parchment bg-white p-5">
                        <div className="mb-4">
                          <p className="text-[11px] uppercase tracking-wider font-label text-amethyst-link mb-1">Allowance</p>
                          <h3 className="text-[17px] font-display text-charcoal-ink">
                            {allowanceCard.period_label || 'Current allowance period'}
                          </h3>
                        </div>

                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="rounded-xl bg-[#fbfaf8] p-4" style={{ border: `1px solid ${C.parchment}` }}>
                            <p className="text-[11px] uppercase tracking-wider font-label text-charcoal-ink/40">Completion</p>
                            <p className="mt-2 text-[24px] font-display text-charcoal-ink">{allowanceRatio}%</p>
                            <p className="mt-1 text-[12px] font-body text-charcoal-ink/50">
                              {allowanceCard.completed_counts.total_blocks || 0}/{allowanceCard.required_counts.total_blocks || 0} required blocks
                            </p>
                          </div>
                          <div className="rounded-xl bg-[#fbfaf8] p-4" style={{ border: `1px solid ${C.parchment}` }}>
                            <p className="text-[11px] uppercase tracking-wider font-label text-charcoal-ink/40">Earned</p>
                            <p className="mt-2 text-[24px] font-display text-charcoal-ink">{formatCurrency(allowanceCard.adjusted_earned_amount)}</p>
                            <p className="mt-1 text-[12px] font-body text-charcoal-ink/50">After parent adjustments</p>
                          </div>
                          <div className="rounded-xl bg-[#fbfaf8] p-4" style={{ border: `1px solid ${C.parchment}` }}>
                            <p className="text-[11px] uppercase tracking-wider font-label text-charcoal-ink/40">Remaining</p>
                            <p className="mt-2 text-[24px] font-display text-charcoal-ink">{formatCurrency(allowanceCard.remaining_amount)}</p>
                            <p className="mt-1 text-[12px] font-body text-charcoal-ink/50">
                              {allowanceCard.paid_status === AllowancePaidStatuses.PAID ? 'Marked paid for this period' : 'Still unpaid this period'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-[#fbfaf8] p-4" style={{ border: `1px solid ${C.parchment}` }}>
                            <p className="text-[11px] uppercase tracking-wider font-label text-charcoal-ink/40">Policy</p>
                            <p className="mt-2 text-[18px] font-display text-charcoal-ink">{formatCurrency(allowanceCard.allowance_amount)}</p>
                            <p className="mt-1 text-[12px] font-body text-charcoal-ink/50">
                              {allowanceCard.include_routines ? 'Routine-eligible policy' : 'Routines excluded'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-parchment bg-white p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider font-label text-amethyst-link mb-1">Pending Review</p>
                          <h3 className="text-[17px] font-display text-charcoal-ink">Recent chores waiting on a parent</h3>
                        </div>
                        <span className="rounded-full bg-[#fbfaf8] px-3 py-1 text-[11px] uppercase tracking-wider font-label text-charcoal-ink/45" style={{ border: `1px solid ${C.parchment}` }}>
                          {pendingReviews.length} open
                        </span>
                      </div>

                      {pendingReviews.length > 0 ? (
                        <div className="space-y-3">
                          {pendingReviews.slice(0, 4).map((record) => (
                            <div key={record.id} className="rounded-xl bg-[#fbfaf8] p-4" style={{ border: `1px solid ${C.parchment}` }}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[15px] font-display text-charcoal-ink">{record.chore_title}</p>
                                  <p className="mt-1 text-[12px] font-body text-charcoal-ink/50">
                                    {record.frequency_pool === 'monthly' ? 'Monthly pool' : 'Weekly pool'} • {record.quota_blocks} block{record.quota_blocks === 1 ? '' : 's'}
                                  </p>
                                </div>
                                <span className="rounded-full bg-white px-3 py-1 text-[11px] uppercase tracking-wider font-label text-amethyst-link" style={{ border: `1px solid ${C.parchment}` }}>
                                  Awaiting review
                                </span>
                              </div>
                              {record.proof_note ? (
                                <p className="mt-3 text-[13px] font-body text-charcoal-ink/65">{record.proof_note}</p>
                              ) : (
                                <p className="mt-3 text-[13px] font-body text-charcoal-ink/45">No proof note was added to this completion.</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-[#fbfaf8] p-4 text-[13px] font-body text-charcoal-ink/50" style={{ border: `1px solid ${C.parchment}` }}>
                          No chores are waiting on review for this student right now.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Submission Details Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 border border-parchment">
            <div className="flex items-center justify-between p-6 border-b border-parchment">
              <h2 style={{ fontSize: 17, fontWeight: 540, color: '#292827' }}>
                Block {selectedSubmission.block_index + 1} Details
              </h2>
              <button onClick={() => setSelectedSubmission(null)} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className={labelCls}>Subject</p>
                <p className="text-[15px] font-body text-charcoal-ink">{selectedSubmission.subject_name}</p>
              </div>

              <div>
                <p className={labelCls}>Completed</p>
                <p className="text-[14px] font-body text-charcoal-ink/60">
                  {selectedSubmission.timestamp?.toDate?.()
                    ? new Date(selectedSubmission.timestamp.toDate()).toLocaleString()
                    : 'Unknown time'}
                </p>
              </div>

              {selectedSubmission.summary_text && (
                <div>
                  <p className={labelCls}>Student Summary</p>
                  <div className="bg-warm-cream rounded-xl p-4">
                    <p className="text-[14px] font-body text-charcoal-ink whitespace-pre-wrap">
                      {selectedSubmission.summary_text}
                    </p>
                  </div>
                </div>
              )}

              {selectedSubmission.custom_field_responses && Object.keys(selectedSubmission.custom_field_responses).length > 0 && (
                <div>
                  <p className={labelCls}>Custom Details</p>
                  <div className="bg-[#f0eaff]/50 rounded-xl p-4 border border-lavender-glow/40">
                    <div className="space-y-2">
                      {Object.entries(selectedSubmission.custom_field_responses).map(([fieldId, value]) => (
                        <div key={fieldId}>
                          <span className="text-[11px] font-label uppercase tracking-wider text-amethyst-link/70">
                            {getCustomFieldLabel(fieldId, selectedSubmission.subject_id)}
                          </span>
                          <p className="text-[14px] font-body text-charcoal-ink mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedSubmission.resources_used && selectedSubmission.resources_used.length > 0 && (
                <div>
                  <p className={labelCls}>Resources Used</p>
                  <div className="space-y-1">
                    {selectedSubmission.resources_used.map((resourceIndex, index) => {
                      const subject = subjects.find(s => s.id === selectedSubmission.subject_id);
                      const resource = subject?.resources?.[resourceIndex];
                      return resource ? (
                        <p key={index} className="text-[14px] font-body text-charcoal-ink/60">• {resource.name}</p>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg transition-colors"
                  style={{ backgroundColor: C.cream, color: C.charcoal, fontSize: 14, fontWeight: 700 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}
                >
                  Close
                </button>
                <button
                  onClick={() => handleResetBlock(selectedSubmission.id)}
                  className="flex-1 px-4 py-2.5 text-white bg-red-500 hover:bg-red-600 rounded-lg font-label text-[14px] transition-colors"
                >
                  Reset Block
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Complete Modal */}
      {showManualConfirm && manualCompleteBlock && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 border border-parchment">
            <div className="flex items-center justify-between p-6 border-b border-parchment">
              <h2 style={{ fontSize: 17, fontWeight: 540, color: '#292827' }}>
                Mark Block {manualCompleteBlock.blockIndex + 1} Complete
              </h2>
              <button onClick={cancelManualComplete} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[14px] font-body text-charcoal-ink">
                  <span style={{ fontWeight: 540 }}>{manualCompleteBlock.subject.title}</span> — Block {manualCompleteBlock.blockIndex + 1}
                </p>
                <p className="text-[12px] font-body text-charcoal-ink/40 mt-0.5">
                  Parent-led completion (no timer required)
                </p>
              </div>

              <div>
                <label className={labelCls}>Quick Note <span className="normal-case font-body">(optional)</span></label>
                <textarea
                  value={parentNote}
                  onChange={(e) => setParentNote(e.target.value)}
                  placeholder="e.g., Parent-led session, Reviewed material together, etc."
                  className="w-full px-3 py-2.5 rounded-lg focus:outline-none text-[14px] resize-none transition-colors"
                  style={{ border: '1px solid #dcd7d3', color: '#292827', fontWeight: 460 }}
                  onFocus={e => e.target.style.borderColor = '#292827'}
                  onBlur={e => e.target.style.borderColor = '#dcd7d3'}
                  rows={3}
                />
              </div>

              <p className="text-[13px] font-body text-charcoal-ink/50">
                This will create a submission marked as "parent_completed" and bypass the timer requirement.
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={cancelManualComplete}
                  className="flex-1 px-4 py-2.5 rounded-lg transition-colors"
                  style={{ backgroundColor: C.cream, color: C.charcoal, fontSize: 14, fontWeight: 700 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmManualComplete}
                  className="flex-1 px-4 py-2.5 rounded-lg transition-colors"
                  style={{ backgroundColor: C.charcoal, color: '#fff', fontSize: 14, fontWeight: 700 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}
                >
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ParentDashboard;
