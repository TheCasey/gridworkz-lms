import React, { useState, useCallback, useMemo } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFirestore } from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import {
  BookOpen,
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
  DASHBOARD_RIGHT_RAIL_MODES,
  getDashboardDefaultFeature,
  resolveDashboardFeatures,
  dashboardFeaturesById,
} from '../constants/dashboardFeatures';
import useEntitlements from '../hooks/useEntitlements';
import useParentSettings from '../hooks/useParentSettings';
import useStudentMutations from '../hooks/useStudentMutations';
import useStudents from '../hooks/useStudents';
import useSubjects from '../hooks/useSubjects';
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

const FONT = "'Super Sans VF', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

const labelCls = 'block text-[11px] uppercase tracking-wider mb-1.5' + ' ' + 'font-label';

const DashboardLivePulseRail = ({
  colors,
  formatTimestamp,
  getRealTimeWeeklyProgress,
  getWeekSubmissions,
  selectedWeekOffset,
  setViewingSummary,
  students,
  submissions,
}) => (
  <div className="w-80 flex flex-col flex-shrink-0" style={{ backgroundColor: '#ffffff', borderLeft: `1px solid ${colors.parchment}` }}>
    <div className="px-6 pt-6 pb-5" style={{ borderBottom: `1px solid ${colors.parchment}` }}>
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-4 h-4" style={{ color: colors.amethyst }} />
        <h3 style={{ fontSize: 15, fontWeight: 540, color: colors.charcoal }}>Live Pulse</h3>
      </div>
      <p className="text-[12px]" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>Real-time activity feed</p>
    </div>

    <div className="flex-1 overflow-auto p-5">
      {submissions.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#f0eaff' }}>
            <Activity className="w-5 h-5" style={{ color: 'rgba(113,76,182,0.5)' }} />
          </div>
          <p className="text-[13px]" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>No submissions yet</p>
          <p className="text-[12px] mt-1" style={{ color: 'rgba(41,40,39,0.3)', fontWeight: 460 }}>Student activity will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(240,234,255,0.5)', border: `1px solid rgba(203,183,251,0.4)` }}>
            <div className="flex items-center justify-between mb-3">
              <h4 style={{ fontSize: 13, fontWeight: 540, color: colors.charcoal }}>Weekly Progress</h4>
              <span className="text-[11px] uppercase tracking-wider" style={{ color: colors.amethyst, fontWeight: 700 }}>
                {getWeekLabel(selectedWeekOffset)}
              </span>
            </div>
            <div className="space-y-3">
              {students.map(student => {
                const progress = getRealTimeWeeklyProgress(student.id, selectedWeekOffset);
                if (progress.total === 0) return null;
                return (
                  <div key={student.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px]" style={{ color: colors.charcoal, fontWeight: 460 }}>{student.name}</span>
                      <span className="text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 700 }}>
                        {progress.completed}/{progress.total}
                      </span>
                    </div>
                    <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: colors.parchment }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress.percentage}%`, backgroundColor: colors.lavender }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] uppercase tracking-wider mb-3" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
              Activity — {getWeekLabel(selectedWeekOffset)}
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(() => {
                const weekSubmissions = getWeekSubmissions(selectedWeekOffset);
                if (weekSubmissions.length === 0) {
                  return (
                    <p className="text-[13px] text-center py-4" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                      No submissions {selectedWeekOffset === 0 ? 'this week' : 'for selected week'}
                    </p>
                  );
                }
                return weekSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                    style={{ backgroundColor: colors.cream }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.parchment}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.cream}
                    onClick={() => setViewingSummary(submission)}
                  >
                    <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: colors.lavender }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px]" style={{ color: colors.charcoal, fontWeight: 460 }}>
                        <span style={{ fontWeight: 540 }}>{students.find(s => s.id === submission.student_id)?.name || 'Unknown'}</span>
                        {' '}completed{' '}
                        <span style={{ color: colors.amethyst }}>{submission.subject_name}</span>
                      </p>
                      {submission.custom_field_responses && Object.keys(submission.custom_field_responses).length > 0 && (
                        <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f0eaff' }}>
                          <Info className="w-3 h-3" style={{ color: colors.amethyst }} />
                          <span className="text-[10px]" style={{ color: colors.amethyst, fontWeight: 700 }}>Extra Details</span>
                        </div>
                      )}
                      <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(submission.timestamp)}
                      </p>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);

const ParentDashboard = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingStudentProgress, setViewingStudentProgress] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [viewingSummary, setViewingSummary] = useState(null);
  const [manualCompleteBlock, setManualCompleteBlock] = useState(null);
  const [parentNote, setParentNote] = useState('');
  const [showManualConfirm, setShowManualConfirm] = useState(false);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);

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
    submissions,
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
  const resolvedDashboardFeaturesByPath = useMemo(
    () => Object.fromEntries(resolvedDashboardFeatures.map((feature) => [feature.path, feature])),
    [resolvedDashboardFeatures]
  );
  const defaultDashboardFeature = useMemo(
    () => getDashboardDefaultFeature(resolvedDashboardFeatures),
    [resolvedDashboardFeatures]
  );
  const activeFeaturePath = location.pathname.replace(/\/+$/, '').split('/')[2] || DASHBOARD_DEFAULT_FEATURE_ID;
  const activeFeature = resolvedDashboardFeaturesByPath[activeFeaturePath] || defaultDashboardFeature;
  const activeFeatureShell = activeFeature.shell || {
    headerSlots: {
      primaryAction: null,
      secondaryActions: [],
      filters: [],
      notices: [],
    },
    rightRail: {
      mode: DASHBOARD_RIGHT_RAIL_MODES.NONE,
    },
  };
  const defaultDashboardPath = defaultDashboardFeature?.path || dashboardFeaturesById[DASHBOARD_DEFAULT_FEATURE_ID].path;
  const navigableDashboardFeatures = resolvedDashboardFeatures.filter(
    (feature) => feature.shellState !== DASHBOARD_FEATURE_STATES.HIDDEN
  );
  const hasShellHeaderControls = Boolean(
    activeFeatureShell.headerSlots.primaryAction ||
    activeFeatureShell.headerSlots.filters.length ||
    activeFeatureShell.headerSlots.secondaryActions.length
  );

  const handleAddStudent = useCallback(async ({ name, accessPin }) => {
    const added = await addStudent({ name, accessPin });
    if (added) {
      setModalOpen(false);
    }
  }, [addStudent]);

  if (activeFeature?.shellState === DASHBOARD_FEATURE_STATES.HIDDEN) {
    return <Navigate to={`/dashboard/${defaultDashboardPath}`} replace />;
  }

  const handleViewStudentProgress = (student) => {
    setViewingStudentProgress(student);
  };

  const handleCloseStudentProgress = () => {
    setViewingStudentProgress(null);
    setSelectedSubmission(null);
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
        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
        style={{
          backgroundColor: canAddStudent ? C.charcoal : 'rgba(41,40,39,0.2)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          opacity: canAddStudent ? 1 : 0.75,
        }}
        onMouseEnter={e => { if (canAddStudent) e.currentTarget.style.backgroundColor = '#3a3937'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = canAddStudent ? C.charcoal : 'rgba(41,40,39,0.2)'; }}
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
        <Calendar className="w-4 h-4" style={{ color: 'rgba(41,40,39,0.4)' }} />
        <select
          value={selectedWeekOffset}
          onChange={(e) => setSelectedWeekOffset(parseInt(e.target.value, 10))}
          className="px-3 py-2 rounded-lg text-[13px] focus:outline-none"
          style={{ border: `1px solid ${C.parchment}`, backgroundColor: '#fff', color: C.charcoal, fontWeight: 460 }}
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: C.cream, color: C.charcoal, fontSize: 13, fontWeight: 700 }}
          onMouseEnter={e => { if (!isGeneratingReport) e.currentTarget.style.backgroundColor = C.parchment; }}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: C.charcoal, color: '#fff', fontSize: 13, fontWeight: 700 }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}
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
        className="mt-3 rounded-xl px-4 py-3"
        style={{
          backgroundColor: studentLimitReached ? `${C.lavenderTint}` : '#fbfaf8',
          border: `1px solid ${studentLimitReached ? `${C.lavender}90` : C.parchment}`,
          color: C.charcoal,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] uppercase tracking-wider font-label" style={{ color: studentLimitReached ? C.amethyst : 'rgba(41,40,39,0.5)' }}>
            Student Plan Usage
          </p>
          <span className="text-[12px] font-label" style={{ color: studentLimitReached ? C.amethyst : 'rgba(41,40,39,0.45)' }}>
            {studentLimitCheck.isUnlimited ? `${studentLimitCheck.usage} active` : `${studentLimitCheck.usage}/${studentLimitCheck.limit}`}
          </span>
        </div>
        <p className="mt-1.5 text-[13px] font-body" style={{ color: studentLimitReached ? C.charcoal : 'rgba(41,40,39,0.68)' }}>
          {studentLimitMessage}
        </p>
      </div>
    );
  };

  const renderRightRail = () => {
    if (activeFeatureShell.rightRail?.mode !== DASHBOARD_RIGHT_RAIL_MODES.LIVE_PULSE) return null;

    return (
      <DashboardLivePulseRail
        colors={C}
        formatTimestamp={formatTimestamp}
        getRealTimeWeeklyProgress={getRealTimeWeeklyProgress}
        getWeekSubmissions={getWeekSubmissions}
        selectedWeekOffset={selectedWeekOffset}
        setViewingSummary={setViewingSummary}
        students={students}
        submissions={submissions}
      />
    );
  };

  return (
    <div className="min-h-screen" style={{ fontFamily: FONT, backgroundColor: '#f5f3ef' }}>
      <div className="flex h-screen">

        {/* Sidebar — dark Mysteria purple */}
        <div className="w-64 flex flex-col flex-shrink-0" style={{ backgroundColor: C.mysteria }}>
          <div className="px-6 pt-7 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-6 h-[3px] rounded-full mb-3" style={{ backgroundColor: C.lavender }} />
            <h1 style={{ fontSize: 20, fontWeight: 540, lineHeight: 0.96, letterSpacing: '-0.4px', color: '#ffffff' }}>
              GRIDWORKZ
            </h1>
            <p className="text-[12px] mt-1.5" style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 460 }}>Parent Portal</p>
          </div>

          <nav className="flex-1 p-3">
            <div className="space-y-0.5">
              {navigableDashboardFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <NavLink
                    key={feature.id}
                    to={feature.path}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-white/5"
                    style={({ isActive }) => ({
                      backgroundColor: isActive
                        ? 'rgba(203,183,251,0.15)'
                        : (feature.isLocked ? 'rgba(255,255,255,0.03)' : 'transparent'),
                      color: isActive
                        ? C.lavender
                        : (feature.isLocked ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.5)'),
                      fontWeight: isActive ? 540 : 460,
                      fontSize: 14,
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span>{feature.label}</span>
                        {feature.isLocked ? (
                          <span
                            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-label"
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.08)',
                              color: isActive ? C.lavender : 'rgba(255,255,255,0.72)',
                            }}
                          >
                            <Lock className="w-3 h-3" />
                            Locked
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>

          <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700 }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
            >
              <Heart className="w-4 h-4" />
              Support Project
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="px-8 py-4 flex-shrink-0" style={{ backgroundColor: '#ffffff', borderBottom: `1px solid ${C.parchment}` }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 540, lineHeight: 0.96, letterSpacing: '-0.4px', color: C.charcoal }}>
                  {activeFeature.header.title}
                </h2>
                <p className="text-[13px] mt-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
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

                <div
                  className="flex items-center gap-3"
                  style={{
                    borderLeft: hasShellHeaderControls ? `1px solid ${C.parchment}` : 'none',
                    paddingLeft: hasShellHeaderControls ? 12 : 0,
                  }}
                >
                  <span className="text-[13px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>{currentUser?.email}</span>
                  <button
                    onClick={handleLogout}
                    className="text-[13px] hover:underline"
                    style={{ color: C.amethyst, fontWeight: 460 }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
            {rolloverStatus.message && (
              <div className="mt-3 rounded-lg px-3 py-2 text-[12px] font-body" style={{ backgroundColor: `${C.lavenderTint}80`, color: C.charcoal }}>
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
          <main className="flex-1 overflow-auto">
            <Outlet
              context={{
                canAddStudent,
                colors: C,
                currentUser,
                db,
                entitlementSummary,
                featureShellState: activeFeature.shellState,
                handleDeleteStudent,
                handleSaveSettings,
                handleViewStudentProgress,
                loading,
                lockdownAccess,
                openAddStudentModal,
                parentSettings,
                planName: plan?.displayName || 'Free',
                resolvedDashboardFeaturesById,
                settingsSaving,
                studentLimitReached,
                students,
              }}
            />
          </main>
        </div>
        {renderRightRail()}
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
