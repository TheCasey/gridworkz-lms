import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, FileText } from 'lucide-react';
import WeeklyPlanReviewPanel from '../../components/curriculum/WeeklyPlanReviewPanel';
import { dashboardFeaturesById } from '../../constants/dashboardFeatures';

const isSubjectActive = (subject) => {
  const status = String(subject?.status || 'active').toLowerCase();
  return !['archived', 'inactive', 'deleted'].includes(status);
};

const getSubjectStudentIds = (subject) => {
  if (Array.isArray(subject?.student_ids)) {
    return subject.student_ids;
  }

  return subject?.student_id ? [subject.student_id] : [];
};

const LinkCard = ({ description, icon: Icon, label, to }) => (
  <Link to={to} className="op-surface block p-4 transition-colors hover:bg-[#292942]">
    <div className="flex items-start justify-between gap-4">
      <div className="flex h-10 w-10 items-center justify-center border border-[rgba(203,183,251,0.24)] bg-[#202034]">
        <Icon className="h-4 w-4 text-[#cbb7fb]" />
      </div>
      <ArrowRight className="h-4 w-4 text-[rgba(238,234,248,0.44)]" />
    </div>
    <h3 className="mt-5 text-[18px] font-display leading-none text-white">{label}</h3>
    <p className="op-subtle mt-3 text-[12px] leading-5">{description}</p>
  </Link>
);

const WeeklyBlockingRoute = () => {
  const {
    currentUser,
    loading,
    parentSettings,
    students,
    subjects,
  } = useOutletContext();

  const activeSubjects = useMemo(
    () => (Array.isArray(subjects) ? subjects.filter(isSubjectActive) : []),
    [subjects]
  );
  const studentsWithSubjects = useMemo(() => {
    const studentIds = new Set();

    activeSubjects.forEach((subject) => {
      getSubjectStudentIds(subject).forEach((studentId) => studentIds.add(studentId));
    });

    return students.filter((student) => studentIds.has(student.id));
  }, [activeSubjects, students]);

  return (
    <div className="op-page">
      <div className="op-shell space-y-6">
        <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="op-eyebrow">Homeschool</p>
            <h1 className="op-title mt-3">Weekly Blocking</h1>
            <p className="op-subtle mt-4 max-w-2xl text-[14px] font-body leading-6">
              Turn current subject blocks into a saved draft or published student week without changing the underlying curriculum records.
            </p>
          </div>
          <div className="op-pill min-h-[34px]">
            <CalendarDays className="h-3.5 w-3.5" />
            Student-week planner
          </div>
        </section>

        {loading ? (
          <div className="op-panel flex min-h-[360px] items-center justify-center">
            <div className="h-8 w-8 animate-spin border-2 border-transparent border-b-[#cbb7fb]" />
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <div className="op-stat p-4">
                <p className="op-eyebrow">Students</p>
                <p className="mt-3 text-[30px] font-display leading-none text-white">{students.length}</p>
                <p className="op-subtle mt-2 text-[12px] leading-5">Learners available for weekly planning.</p>
              </div>
              <div className="op-stat p-4">
                <p className="op-eyebrow">Ready</p>
                <p className="mt-3 text-[30px] font-display leading-none text-white">{studentsWithSubjects.length}</p>
                <p className="op-subtle mt-2 text-[12px] leading-5">Students with at least one active subject.</p>
              </div>
              <div className="op-stat p-4">
                <p className="op-eyebrow">Subjects</p>
                <p className="mt-3 text-[30px] font-display leading-none text-white">{activeSubjects.length}</p>
                <p className="op-subtle mt-2 text-[12px] leading-5">Active subject records feeding weekly plans.</p>
              </div>
            </section>

            <WeeklyPlanReviewPanel
              activeSubjects={activeSubjects}
              currentUser={currentUser}
              parentSettings={parentSettings}
              students={students}
            />

            <section className="grid gap-4 md:grid-cols-2">
              <LinkCard
                description="Edit subject block counts, resources, and per-block instructions before regenerating the week."
                icon={BookOpen}
                label="Curriculum"
                to={`/dashboard/${dashboardFeaturesById.curriculum.path}`}
              />
              <LinkCard
                description="Review printable weekly records after published work is completed or archived."
                icon={FileText}
                label="Reports"
                to={`/dashboard/${dashboardFeaturesById.reports.path}`}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default WeeklyBlockingRoute;
