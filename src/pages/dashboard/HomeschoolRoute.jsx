import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  LayoutDashboard,
  PieChart,
  Plus,
  RotateCcw,
  Send,
  User,
  Users,
} from 'lucide-react';
import { dashboardFeaturesById } from '../../constants/dashboardFeatures';
import { formatWeekRange, getCurrentWeekRange, getWeekConfig } from '../../utils/weekUtils';
import {
  getSubjectBlockLengthMinutes,
  getSubjectCurriculumBlocks,
  getSubjectDefaultBlockQuantities,
} from '../../utils/planningCompatibilityUtils';

const getSubjectStudentIds = (subject) => {
  if (Array.isArray(subject.student_ids) && subject.student_ids.length) {
    return subject.student_ids;
  }

  return subject.student_id ? [subject.student_id] : [];
};

const isSubjectActive = (subject) => {
  const status = String(subject.status || 'active').toLowerCase();
  return subject.is_active !== false && !['archived', 'inactive', 'deleted'].includes(status);
};

const getSubjectTitle = (subject) => (
  subject?.title || subject?.name || 'Untitled subject'
);

const getSubjectDefaultBlockCount = (subject) => {
  const quantityTotal = Object.values(getSubjectDefaultBlockQuantities(subject)).reduce((total, quantity) => (
    total + (Number.parseInt(quantity, 10) || 0)
  ), 0);

  return quantityTotal || Number(subject?.block_count || subject?.weekly_goal || subject?.total_blocks || 0);
};

const getSubjectDescription = (subject) => {
  const blocks = getSubjectCurriculumBlocks(subject);
  const namedBlocks = blocks
    .filter((block) => block.title && block.title !== getSubjectTitle(subject))
    .slice(0, 3)
    .map((block) => block.title);

  if (namedBlocks.length) {
    return namedBlocks.join(', ');
  }

  if (Array.isArray(subject?.resources) && subject.resources.length) {
    return subject.resources.slice(0, 2).map((resource) => resource.name).filter(Boolean).join(', ');
  }

  return 'Reusable blocks ready for weekly planning';
};

const getSubjectReadiness = (subject) => {
  const blocks = getSubjectCurriculumBlocks(subject);
  const target = getSubjectDefaultBlockCount(subject);
  const hasBlockLibrary = blocks.length > 0;
  const hasRequirements = blocks.some((block) => (
    block.instruction
    || block.resources?.length
    || block.custom_fields?.length
    || typeof block.require_timer === 'boolean'
    || typeof block.require_input === 'boolean'
  ));

  if (!hasBlockLibrary || target <= 0) {
    return {
      label: 'REVIEW',
      status: 'warn',
      state: 'needs prep',
      count: `0/${Math.max(target, 1)}`,
    };
  }

  if (hasRequirements) {
    return {
      label: 'GOOD',
      status: 'good',
      state: 'on track',
      count: `${target}/${target}`,
    };
  }

  return {
    label: 'CHECK',
    status: 'warn',
    state: 'needs detail',
    count: `${target}/${target}`,
  };
};

const buildStudentSubjectGroups = ({ activeSubjects, students }) => (
  students.map((student, index) => {
    const subjectsForStudent = activeSubjects.filter((subject) => getSubjectStudentIds(subject).includes(student.id));
    const subjectCount = subjectsForStudent.length;
    const plannedMinutes = subjectsForStudent.reduce((total, subject) => (
      total + getSubjectDefaultBlockCount(subject) * getSubjectBlockLengthMinutes(subject)
    ), 0);

    return {
      accent: student.color || ['#7c6fd4', '#0f9e7a', '#ba7517', '#185fa5'][index % 4],
      plannedHours: plannedMinutes / 60,
      student,
      subjectCount,
      subjects: subjectsForStudent,
    };
  })
);

const HomeschoolRoute = () => {
  const {
    loading,
    parentSettings,
    students,
    subjects,
  } = useOutletContext();
  const [focusStudentId, setFocusStudentId] = useState('all');

  const weekConfig = useMemo(() => getWeekConfig(parentSettings || {}), [parentSettings]);
  const currentWeek = useMemo(() => getCurrentWeekRange(weekConfig), [weekConfig]);
  const activeSubjects = useMemo(() => (
    (Array.isArray(subjects) ? subjects : []).filter(isSubjectActive)
  ), [subjects]);
  const studentGroups = useMemo(() => buildStudentSubjectGroups({
    activeSubjects,
    students: Array.isArray(students) ? students : [],
  }), [activeSubjects, students]);
  const visibleGroups = focusStudentId === 'all'
    ? studentGroups
    : studentGroups.filter((group) => group.student.id === focusStudentId);
  const visibleSubjects = visibleGroups.flatMap((group) => group.subjects);
  const totalDefaultBlocks = visibleSubjects.reduce((total, subject) => total + getSubjectDefaultBlockCount(subject), 0);
  const readySubjectCount = visibleSubjects.filter((subject) => getSubjectReadiness(subject).status === 'good').length;
  const studentsWithoutSubjects = studentGroups.filter((group) => group.subjectCount === 0);
  const subjectsNeedingReview = visibleSubjects.filter((subject) => getSubjectReadiness(subject).status === 'warn');
  const attentionItems = [
    ...studentsWithoutSubjects
      .filter((group) => focusStudentId === 'all' || group.student.id === focusStudentId)
      .map((group) => ({
        key: `student_${group.student.id}`,
        critical: true,
        title: `${group.student.name} still needs subject setup`,
        meta: 'Add at least one active subject before weekly publishing is useful.',
      })),
    ...subjectsNeedingReview.slice(0, 3).map((subject) => ({
      key: `subject_${subject.id}`,
      critical: false,
      title: `${getSubjectTitle(subject)} needs block details`,
      meta: 'Open Curriculum to add instructions, resources, or response requirements.',
    })),
  ];
  const focusLabel = focusStudentId === 'all'
    ? 'All family'
    : studentGroups.find((group) => group.student.id === focusStudentId)?.student.name || 'Selected student';

  return (
    <div className="op-page">
      <div className="op-proto-shell">
        <div className="op-home-topbar">
          <div className="op-home-title-wrap">
            <div className="op-home-title">
              <LayoutDashboard className="h-4 w-4 text-[#b8adff]" />
              Homeschool Overview
            </div>
            <div className="op-home-sub">This week is being prepared for publish.</div>
          </div>

          <div className="op-home-focus-tabs">
            <button
              type="button"
              onClick={() => setFocusStudentId('all')}
              className={`op-home-focus-btn ${focusStudentId === 'all' ? 'is-active' : ''}`}
            >
              <Users className="h-3.5 w-3.5" />
              All family
            </button>
            {studentGroups.map((group) => (
              <button
                type="button"
                key={group.student.id}
                onClick={() => setFocusStudentId(group.student.id)}
                className={`op-home-focus-btn ${focusStudentId === group.student.id ? 'is-active' : ''}`}
              >
                <User className="h-3.5 w-3.5" />
                {group.student.name}
              </button>
            ))}
          </div>

          <div className="op-home-actions">
            <Link to={`/dashboard/${dashboardFeaturesById.curriculum.path}`} className="op-proto-btn">
              <Plus className="h-3.5 w-3.5" />
              Add subject
            </Link>
            <Link to={`/dashboard/${dashboardFeaturesById['weekly-blocking'].path}`} className="op-proto-btn op-proto-btn-primary">
              <CalendarPlus className="h-3.5 w-3.5" />
              Plan this week
            </Link>
            <Link to={`/dashboard/${dashboardFeaturesById.reports.path}`} className="op-proto-btn">
              <BarChart3 className="h-3.5 w-3.5" />
              View reports
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="h-8 w-8 animate-spin border-2 border-transparent border-b-[#cbb7fb]" />
          </div>
        ) : (
          <div className="op-home-content">
            <section className={`op-home-status ${attentionItems.length ? '' : 'is-ok'}`}>
              <div className="op-home-status-main">
                <div className="op-home-status-label">This week</div>
                <div className="op-home-status-title">
                  {formatWeekRange(currentWeek.weekStart, currentWeek.weekEnd)}
                  <span className="op-home-status-tag">Draft</span>
                </div>
                <div className="op-home-status-meta">
                  Focus: <b>{focusLabel}</b>. {attentionItems.length
                    ? `${attentionItems.length} item${attentionItems.length === 1 ? '' : 's'} waiting for review before publish.`
                    : 'Default week is in place and ready for final review.'}
                </div>
              </div>
              <div className="op-home-status-actions">
                <Link to={`/dashboard/${dashboardFeaturesById['weekly-blocking'].path}`} className="op-proto-btn">
                  <Send className="h-3.5 w-3.5" />
                  Publish draft
                </Link>
                <Link to={`/dashboard/${dashboardFeaturesById['weekly-blocking'].path}`} className="op-proto-btn">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Link>
              </div>
            </section>

            <section className="op-home-nav-strip">
              <Link to={`/dashboard/${dashboardFeaturesById.curriculum.path}`} className="op-home-nav-card" style={{ borderLeftColor: '#7c6fd4' }}>
                <span className="op-home-nav-title">Curriculum <ArrowRight className="h-3.5 w-3.5" /></span>
                <span className="op-home-nav-sub">Edit per-student subjects, blocks, and completion rules.</span>
                <span className="op-home-nav-meta">Open subject library</span>
              </Link>
              <Link to={`/dashboard/${dashboardFeaturesById['weekly-blocking'].path}`} className="op-home-nav-card" style={{ borderLeftColor: '#0f9e7a' }}>
                <span className="op-home-nav-title">Weekly Blocking <ArrowRight className="h-3.5 w-3.5" /></span>
                <span className="op-home-nav-sub">Plan the full family week and publish changes from the default week.</span>
                <span className="op-home-nav-meta">Weekly publish flow</span>
              </Link>
              <Link to={`/dashboard/${dashboardFeaturesById.reports.path}`} className="op-home-nav-card" style={{ borderLeftColor: '#185fa5' }}>
                <span className="op-home-nav-title">Reports <ArrowRight className="h-3.5 w-3.5" /></span>
                <span className="op-home-nav-sub">Review weekly progress, subject history, and printable summaries.</span>
                <span className="op-home-nav-meta">Records</span>
              </Link>
            </section>

            <div className="op-home-grid">
              <section className="op-home-panel">
                <div className="op-home-panel-header">
                  <div>
                    <div className="op-home-panel-title">
                      <BookOpen className="h-3.5 w-3.5 text-[#b8adff]" />
                      Active subjects by student
                    </div>
                    <div className="op-home-panel-sub">{focusLabel}</div>
                  </div>
                  <div className="op-home-tiny">{visibleSubjects.length} total</div>
                </div>
                <div className="op-home-panel-body">
                  {visibleGroups.length === 0 || !visibleGroups.some((group) => group.subjectCount > 0) ? (
                    <div className="op-home-empty">
                      <BookOpen className="h-8 w-8 text-[#b8adff]" />
                      <p className="mt-4 text-[15px] font-label text-white">No active subjects in view</p>
                      <p className="mt-2 text-[12px] text-[rgba(238,234,248,0.5)]">Open Curriculum to create the first subject plan.</p>
                    </div>
                  ) : visibleGroups.map((group) => (
                    <div key={group.student.id} className="op-home-student-group" style={{ borderLeftColor: group.accent }}>
                      <div className="op-home-student-top">
                        <div className="op-home-student-name">
                          <span className="op-home-dot" style={{ backgroundColor: group.accent }} />
                          {group.student.name}
                        </div>
                        <div className="op-home-student-meta">
                          {group.subjectCount} active subject{group.subjectCount === 1 ? '' : 's'} · ~{group.plannedHours.toFixed(1)}h planned
                        </div>
                      </div>
                      <div className="op-home-subject-list">
                        {group.subjects.length ? group.subjects.map((subject) => {
                          const readiness = getSubjectReadiness(subject);
                          const blockCount = getSubjectDefaultBlockCount(subject);

                          return (
                            <Link
                              key={subject.id}
                              to={`/dashboard/${dashboardFeaturesById.curriculum.path}`}
                              className="op-home-subject-row"
                            >
                              <span className="op-home-subject-swatch" style={{ backgroundColor: subject.color || group.accent }} />
                              <span className="op-home-subject-main">
                                <span className="op-home-subject-title">
                                  {getSubjectTitle(subject)}
                                  <span className={`op-home-subject-pill ${readiness.status === 'good' ? 'is-good' : 'is-warn'}`}>
                                    {readiness.status === 'good' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                                    {readiness.label}
                                  </span>
                                </span>
                                <span className="op-home-subject-meta">{getSubjectDescription(subject)}</span>
                              </span>
                              <span className="op-home-subject-right">
                                <span className="op-home-subject-count">{readiness.count}</span>
                                <span className="op-home-subject-mini">{blockCount} blocks/wk · {readiness.state}</span>
                              </span>
                            </Link>
                          );
                        }) : (
                          <Link to={`/dashboard/${dashboardFeaturesById.curriculum.path}`} className="op-home-subject-row">
                            <span className="op-home-subject-swatch" style={{ backgroundColor: '#f59e0b' }} />
                            <span className="op-home-subject-main">
                              <span className="op-home-subject-title">Needs subject setup</span>
                              <span className="op-home-subject-meta">Create a per-student subject plan in Curriculum.</span>
                            </span>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="op-home-stack">
                <section className="op-home-panel">
                  <div className="op-home-panel-header">
                    <div>
                      <div className="op-home-panel-title">
                        <PieChart className="h-3.5 w-3.5 text-[#b8adff]" />
                        Quick stats
                      </div>
                      <div className="op-home-panel-sub">{focusLabel} snapshot</div>
                    </div>
                  </div>
                  <div className="op-home-panel-body">
                    <div className="op-home-stats-grid">
                      <div className="op-home-stat is-primary">
                        <span>{visibleSubjects.length}</span>
                        <p>Active subjects in view</p>
                        <small>Per-student subjects only</small>
                      </div>
                      <div className="op-home-stat is-green">
                        <span>{totalDefaultBlocks}</span>
                        <p>Blocks already placed</p>
                        <small>For the selected focus</small>
                      </div>
                      <div className="op-home-stat is-amber">
                        <span>{readySubjectCount}</span>
                        <p>Subjects on track</p>
                        <small>Ready or nearly ready</small>
                      </div>
                      <div className="op-home-stat is-blue">
                        <span>{attentionItems.length}</span>
                        <p>Attention items</p>
                        <small>Needs review before publish</small>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="op-home-panel">
                  <div className="op-home-panel-header">
                    <div>
                      <div className="op-home-panel-title">
                        <BellRing className="h-3.5 w-3.5 text-[#b8adff]" />
                        Attention items
                      </div>
                      <div className="op-home-panel-sub">Needs parent review</div>
                    </div>
                  </div>
                  <div className="op-home-panel-body">
                    <div className="op-home-warning-list">
                      {attentionItems.length ? attentionItems.map((item) => (
                        <Link
                          key={item.key}
                          to={`/dashboard/${item.key.startsWith('subject_') ? dashboardFeaturesById.curriculum.path : dashboardFeaturesById.students.path}`}
                          className={`op-home-warning ${item.critical ? 'is-critical' : ''}`}
                        >
                          {item.critical ? <AlertTriangle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                          <span>
                            <span className="op-home-warning-title">{item.title}</span>
                            <span className="op-home-warning-meta">{item.meta}</span>
                          </span>
                        </Link>
                      )) : (
                        <div className="op-home-warning is-ok">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>
                            <span className="op-home-warning-title">No attention items</span>
                            <span className="op-home-warning-meta">The selected focus is ready for weekly review.</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeschoolRoute;
