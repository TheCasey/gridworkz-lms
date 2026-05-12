import { useEffect, useMemo, useState } from 'react';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { Collections, WeeklyPlanStatuses } from '../constants/schema';
import { buildWeeklyPlanIdentity } from '../utils/weeklyPlanUtils';

export const useStudentPortalWeeklyPlan = ({
  student = null,
  parentId = '',
  referenceDate = null,
  weekConfig = null,
  enabled = true,
} = {}) => {
  const db = getFirestore(app);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const resolvedParentId = parentId || student?.parent_id || '';
  const resolvedWeekConfig = weekConfig || student || {};
  const [loading, setLoading] = useState(Boolean(enabled && student?.id && resolvedParentId));
  const [error, setError] = useState(null);

  const weekIdentity = useMemo(() => {
    if (!student?.id || !resolvedParentId) {
      return null;
    }

    return buildWeeklyPlanIdentity({
      parentId: resolvedParentId,
      studentId: student.id,
      referenceDate: referenceDate || new Date(),
      weekConfig: resolvedWeekConfig,
    });
  }, [
    parentId,
    referenceDate,
    student?.id,
    student?.parent_id,
    student?.timezone,
    student?.week_reset_day,
    student?.week_reset_hour,
    student?.week_reset_minute,
    weekConfig?.timezone,
    weekConfig?.week_reset_day,
    weekConfig?.week_reset_hour,
    weekConfig?.week_reset_minute,
  ]);

  useEffect(() => {
    if (!enabled || !weekIdentity?.planId) {
      setWeeklyPlan(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const weeklyPlanRef = doc(db, Collections.WEEKLY_PLANS, weekIdentity.planId);
    const unsubscribe = onSnapshot(weeklyPlanRef, (snapshot) => {
      const nextPlan = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;

      setWeeklyPlan(nextPlan?.status === WeeklyPlanStatuses.PUBLISHED ? nextPlan : null);
      setError(null);
      setLoading(false);
    }, (nextError) => {
      if (nextError?.code === 'permission-denied') {
        setWeeklyPlan(null);
        setError(null);
        setLoading(false);
        return;
      }

      console.error('Error fetching published student weekly plan:', nextError?.code, nextError?.message);
      setWeeklyPlan(null);
      setError(nextError);
      setLoading(false);
    });

    return unsubscribe;
  }, [db, enabled, weekIdentity?.planId]);

  return {
    error,
    loading,
    weekIdentity,
    weeklyPlan,
  };
};

export default useStudentPortalWeeklyPlan;
