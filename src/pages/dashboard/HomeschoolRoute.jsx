import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  ArrowRight,
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
      <div className="op-shell space-y-6">
        <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="op-eyebrow">Homeschool</p>
            <h1 className="op-title mt-3">School planning overview</h1>
            <p className="op-subtle mt-4 max-w-2xl text-[14px] leading-6">
              A parent command surface for curriculum setup, weekly planning, and report readiness across all students.
            </p>
          </div>

          <div className="op-pill min-h-[34px]">
            <CalendarRange className="h-3.5 w-3.5" />
            {formatWeekRange(currentWeek.weekStart, currentWeek.weekEnd)}
          </div>
        </section>

        {loading ? (
          <div className="op-panel flex min-h-[360px] items-center justify-center">
            <div className="h-8 w-8 animate-spin border-2 border-transparent border-b-[#cbb7fb]" />
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

export default HomeschoolRoute;
