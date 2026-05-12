import { useEffect, useMemo, useState } from 'react';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { Collections } from '../constants/schema';
import { buildWeeklyPlanDocumentId } from '../utils/weeklyPlanUtils';
import { getWeekKey } from '../utils/weekUtils';

export const useWeeklyPlansForWeek = ({
  currentUser = null,
  students = [],
  weekStart = null,
  enabled = true,
} = {}) => {
  const db = getFirestore(app);
  const [weeklyPlansByStudentId, setWeeklyPlansByStudentId] = useState({});
  const [loading, setLoading] = useState(Boolean(enabled && currentUser?.uid));
  const [error, setError] = useState(null);

  const studentIds = useMemo(
    () => (Array.isArray(students) ? students.map((student) => student?.id).filter(Boolean) : []),
    [students]
  );
  const studentIdsKey = studentIds.join('|');
  const weekKey = useMemo(() => getWeekKey(weekStart), [weekStart]);

  useEffect(() => {
    if (!enabled || !currentUser?.uid || !weekKey || studentIds.length === 0) {
      setWeeklyPlansByStudentId({});
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const nextWeeklyPlansByStudentId = {};
    const readyStudentIds = new Set();

    const markReady = (studentId) => {
      readyStudentIds.add(studentId);

      if (readyStudentIds.size === studentIds.length) {
        setLoading(false);
      }
    };

    const unsubscribers = studentIds.map((studentId) => {
      const weeklyPlanId = buildWeeklyPlanDocumentId({
        parentId: currentUser.uid,
        studentId,
        weekKey,
      });
      const weeklyPlanRef = doc(db, Collections.WEEKLY_PLANS, weeklyPlanId);

      return onSnapshot(weeklyPlanRef, (snapshot) => {
        if (snapshot.exists()) {
          nextWeeklyPlansByStudentId[studentId] = {
            id: snapshot.id,
            ...snapshot.data(),
          };
        } else {
          delete nextWeeklyPlansByStudentId[studentId];
        }

        setWeeklyPlansByStudentId({ ...nextWeeklyPlansByStudentId });
        markReady(studentId);
      }, (nextError) => {
        console.error('Error fetching weekly plan for reports:', nextError?.code, nextError?.message);
        delete nextWeeklyPlansByStudentId[studentId];
        setWeeklyPlansByStudentId({ ...nextWeeklyPlansByStudentId });
        setError(nextError);
        markReady(studentId);
      });
    });

    const loadingTimeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      clearTimeout(loadingTimeout);
    };
  }, [currentUser?.uid, db, enabled, studentIds, studentIds.length, studentIdsKey, weekKey]);

  return {
    error,
    loading,
    weeklyPlansByStudentId,
  };
};

export default useWeeklyPlansForWeek;
