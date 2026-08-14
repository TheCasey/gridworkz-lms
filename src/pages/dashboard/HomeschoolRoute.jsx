import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  FileText,
  GraduationCap,
  LayoutTemplate,
  Plus,
  Users,
} from 'lucide-react';
import { dashboardFeaturesById } from '../../constants/dashboardFeatures';
import { formatWeekRange, getCurrentWeekRange, getWeekConfig } from '../../utils/weekUtils';

const getSubjectStudentIds = (subject) => {
  if (Array.isArray(subject.student_ids)) {
    return subject.student_ids;
  }

  return subject.student_id ? [subject.student_id] : [];
};

const isSubjectActive = (subject) => {
  const status = String(subject.status || 'active').toLowerCase();
  return !['archived', 'inactive', 'deleted'].includes(status);
};

const getSubjectBlockCount = (subject) => (
  Array.isArray(subject.blocks)
    ? subject.blocks.length
    : Number(subject.total_blocks || subject.weekly_goal || 0)
);

const StatPanel = ({ label, value, detail }) => (
  <div className="op-stat p-4">
    <p className="op-eyebrow">{label}</p>
    <p className="mt-3 text-[30px] font-display leading-none text-white">{value}</p>
    <p className="op-subtle mt-2 text-[12px] leading-5">{detail}</p>
  </div>
);

const LaunchPanel = ({ description, icon: Icon, label, note, onClick, to }) => {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center border border-[rgba(203,183,251,0.24)] bg-[#202034]">
          <Icon className="h-5 w-5 text-[#cbb7fb]" />
        </div>
        <ArrowRight className="h-4 w-4 text-[rgba(238,234,248,0.44)]" />
      </div>
      <h3 className="mt-6 text-[22px] font-display leading-none text-white">{label}</h3>
      <p className="op-subtle mt-3 text-[13px] leading-5">{description}</p>
      {note ? <p className="mt-4 text-[12px] leading-5 text-[rgba(203,183,251,0.72)]">{note}</p> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="op-surface block p-5 transition-colors hover:bg-[#292942]">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="op-surface block w-full p-5 text-left transition-colors hover:bg-[#292942]">
      {content}
    </button>
  );
};

const HomeschoolRoute = () => {
  const {
    loading,
    openAddStudentModal,
    parentSettings,
    students,
    subjects,
  } = useOutletContext();

  const weekConfig = useMemo(() => getWeekConfig(parentSettings || {}), [parentSettings]);
  const currentWeek = useMemo(() => getCurrentWeekRange(weekConfig), [weekConfig]);

  const activeSubjects = useMemo(() => subjects.filter(isSubjectActive), [subjects]);
  const subjectCountByStudentId = useMemo(() => {
    const counts = new Map();

    activeSubjects.forEach((subject) => {
      getSubjectStudentIds(subject).forEach((studentId) => {
        counts.set(studentId, (counts.get(studentId) || 0) + 1);
      });
    });

    return counts;
  }, [activeSubjects]);

  const totalPlannedBlocks = useMemo(() => (
    activeSubjects.reduce((total, subject) => total + getSubjectBlockCount(subject), 0)
  ), [activeSubjects]);

  const studentsWithoutSubjects = students.filter((student) => !subjectCountByStudentId.get(student.id));
  const recentlyUpdatedSubjects = [...activeSubjects]
    .sort((a, b) => {
      const aDate = a.updated_at?.toDate?.() || new Date(a.updated_at || a.created_at || 0);
      const bDate = b.updated_at?.toDate?.() || new Date(b.updated_at || b.created_at || 0);
      return bDate.getTime() - aDate.getTime();
    })
    .slice(0, 5);

  return (
    <div className="op-page">
      <div className="op-proto-shell">
        <div className="op-proto-topbar">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-label text-white">Homeschool Overview</p>
            <p className="mt-1 truncate text-[10px] text-[rgba(238,234,248,0.42)]">
              {formatWeekRange(currentWeek.weekStart, currentWeek.weekEnd)} · {studentsWithoutSubjects.length ? `${studentsWithoutSubjects.length} setup item${studentsWithoutSubjects.length === 1 ? '' : 's'}` : 'Ready for weekly review'}
            </p>
          </div>
          <div className="hidden min-w-0 items-center gap-2 border border-[rgba(255,255,255,0.1)] bg-[rgba(124,111,212,0.12)] px-3 py-1.5 text-[10px] text-[#b8adff] md:flex">
            <CalendarRange className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{formatWeekRange(currentWeek.weekStart, currentWeek.weekEnd)}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Link to={`/dashboard/${dashboardFeaturesById.curriculum.path}`} className="op-proto-btn">
              <Plus className="h-3.5 w-3.5" />
              Add subject
            </Link>
            <Link to={`/dashboard/${dashboardFeaturesById['weekly-blocking'].path}`} className="op-proto-btn op-proto-btn-primary">
              <CalendarRange className="h-3.5 w-3.5" />
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
          <div className="op-overview-content">
            <section
              className={`op-weekly-banner ${studentsWithoutSubjects.length ? 'is-modified' : ''}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {studentsWithoutSubjects.length
                  ? `${studentsWithoutSubjects.length} student${studentsWithoutSubjects.length === 1 ? '' : 's'} still need subject setup before weekly publishing is useful.`
                  : 'Subject setup is ready for weekly planning review.'}
              </span>
            </section>

            <section className="op-overview-nav-strip">
              <Link to={`/dashboard/${dashboardFeaturesById.curriculum.path}`} className="op-overview-nav-card" style={{ borderLeftColor: '#7c6fd4' }}>
                <span>
                  <span className="op-overview-nav-title">Curriculum <ArrowRight className="h-3.5 w-3.5" /></span>
                  <span className="op-overview-nav-sub">Edit per-student subjects, blocks, and completion rules.</span>
                </span>
                <span className="op-overview-nav-meta">Open subject library</span>
              </Link>
              <Link to={`/dashboard/${dashboardFeaturesById['weekly-blocking'].path}`} className="op-overview-nav-card" style={{ borderLeftColor: '#0f9e7a' }}>
                <span>
                  <span className="op-overview-nav-title">Weekly Blocking <ArrowRight className="h-3.5 w-3.5" /></span>
                  <span className="op-overview-nav-sub">Plan the full family week and publish changes from subjects.</span>
                </span>
                <span className="op-overview-nav-meta">Weekly publish flow</span>
              </Link>
              <Link to={`/dashboard/${dashboardFeaturesById.reports.path}`} className="op-overview-nav-card" style={{ borderLeftColor: '#185fa5' }}>
                <span>
                  <span className="op-overview-nav-title">Reports <ArrowRight className="h-3.5 w-3.5" /></span>
                  <span className="op-overview-nav-sub">Review weekly progress, subject history, and printable summaries.</span>
                </span>
                <span className="op-overview-nav-meta">Records</span>
              </Link>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatPanel label="Students" value={students.length} detail="Learners with an active dashboard profile." />
              <StatPanel label="Subjects" value={activeSubjects.length} detail="Active per-student subject records." />
              <StatPanel label="Blocks" value={totalPlannedBlocks} detail="Planned curriculum blocks visible to portals." />
              <StatPanel label="Needs Setup" value={studentsWithoutSubjects.length} detail="Students without assigned subjects." />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="op-panel p-5 md:p-6">
                <div className="flex flex-col gap-4 border-b border-[rgba(238,234,248,0.12)] pb-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="op-eyebrow">Student Focus</p>
                    <h2 className="mt-3 text-[28px] font-display leading-none text-white">Subject coverage</h2>
                    <p className="op-subtle mt-3 text-[13px] leading-5">
                      Subjects are treated as per-student records in the redesign, even while legacy shared records remain readable.
                    </p>
                  </div>
                  <button type="button" onClick={openAddStudentModal} className="op-button">
                    <Plus className="h-4 w-4" />
                    Add Student
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {students.length === 0 ? (
                    <div className="op-surface flex min-h-[180px] flex-col items-center justify-center p-6 text-center">
                      <Users className="h-8 w-8 text-[#cbb7fb]" />
                      <p className="mt-4 text-[15px] font-display text-white">No students yet</p>
                      <p className="op-subtle mt-2 text-[13px]">Add a student before building curriculum.</p>
                    </div>
                  ) : students.map((student) => {
                    const subjectCount = subjectCountByStudentId.get(student.id) || 0;
                    const statusLabel = subjectCount > 0 ? 'Ready' : 'Needs setup';

                    return (
                      <article
                        key={student.id}
                        className="grid gap-4 border border-[rgba(238,234,248,0.1)] bg-[rgba(238,234,248,0.04)] p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center border border-[rgba(203,183,251,0.24)] bg-[#202034] text-[16px] font-display text-[#cbb7fb]">
                            {student.name?.charAt(0)?.toUpperCase() || <GraduationCap className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-[15px] font-display leading-tight text-white">{student.name}</h3>
                            <p className="mt-1 text-[12px] text-[rgba(238,234,248,0.46)]">
                              {subjectCount} active subject{subjectCount === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 md:justify-end">
                          <span className="op-pill">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {statusLabel}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <LaunchPanel
                  description="Create or edit each student's subject plan, resources, and block structure."
                  icon={BookOpen}
                  label="Curriculum"
                  to={`/dashboard/${dashboardFeaturesById.curriculum.path}`}
                />
                <LaunchPanel
                  description="Select a student-week, adjust generated blocks, then save a draft or publish the live plan."
                  icon={LayoutTemplate}
                  label="Weekly Blocking"
                  to={`/dashboard/${dashboardFeaturesById['weekly-blocking'].path}`}
                />
                <LaunchPanel
                  description="Review printable records, weekly summaries, and school-year reporting outputs."
                  icon={FileText}
                  label="Reports"
                  to={`/dashboard/${dashboardFeaturesById.reports.path}`}
                />
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="op-panel p-5 md:p-6">
                <p className="op-eyebrow">Planning State</p>
                <h2 className="mt-3 text-[26px] font-display leading-none text-white">Current setup notes</h2>
                <div className="mt-5 space-y-3">
                  {(studentsWithoutSubjects.length > 0 ? studentsWithoutSubjects : students.slice(0, 2)).map((student) => (
                    <div key={student.id} className="border border-[rgba(238,234,248,0.1)] bg-[rgba(238,234,248,0.04)] p-4">
                      <p className="text-[14px] font-label text-white">{student.name}</p>
                      <p className="op-subtle mt-2 text-[13px] leading-5">
                        {subjectCountByStudentId.get(student.id)
                          ? 'Subject setup is started. Review weekly blocking after the block editor lands.'
                          : 'Needs at least one per-student subject before the student portal is useful.'}
                      </p>
                    </div>
                  ))}
                  {students.length === 0 ? (
                    <div className="border border-[rgba(238,234,248,0.1)] bg-[rgba(238,234,248,0.04)] p-4">
                      <p className="op-subtle text-[13px] leading-5">Add students to begin setup tracking.</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="op-panel p-5 md:p-6">
                <p className="op-eyebrow">Recent Curriculum</p>
                <h2 className="mt-3 text-[26px] font-display leading-none text-white">Subject records</h2>
                <div className="mt-5 space-y-3">
                  {recentlyUpdatedSubjects.length === 0 ? (
                    <div className="border border-[rgba(238,234,248,0.1)] bg-[rgba(238,234,248,0.04)] p-5">
                      <p className="op-subtle text-[13px] leading-5">No active subject records yet.</p>
                    </div>
                  ) : recentlyUpdatedSubjects.map((subject) => (
                    <div key={subject.id} className="grid gap-3 border border-[rgba(238,234,248,0.1)] bg-[rgba(238,234,248,0.04)] p-4 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-label text-white">{subject.name}</h3>
                        <p className="mt-1 text-[12px] text-[rgba(238,234,248,0.46)]">
                          {getSubjectStudentIds(subject).length || 1} student assignment{getSubjectStudentIds(subject).length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span className="op-pill">{getSubjectBlockCount(subject)} blocks</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeschoolRoute;
