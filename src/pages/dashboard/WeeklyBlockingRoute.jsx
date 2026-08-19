import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import WeeklyPlanReviewPanel from '../../components/curriculum/WeeklyPlanReviewPanel';

const isSubjectActive = (subject) => {
  const status = String(subject?.status || 'active').toLowerCase();
  return !['archived', 'inactive', 'deleted'].includes(status);
};

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
  return (
    <div className="op-page">
      <div className="op-proto-shell">
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="h-8 w-8 animate-spin border-2 border-transparent border-b-[#cbb7fb]" />
          </div>
        ) : (
          <WeeklyPlanReviewPanel
            activeSubjects={activeSubjects}
            currentUser={currentUser}
            parentSettings={parentSettings}
            students={students}
          />
        )}
      </div>
    </div>
  );
};

export default WeeklyBlockingRoute;
