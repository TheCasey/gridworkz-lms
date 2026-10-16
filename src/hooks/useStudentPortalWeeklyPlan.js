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
  const [clockRevision, refreshClock] = useState(0);
  const [record, setRecord] = useState({ scope: null, plan: null, observedVersioned: false });
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
    clockRevision,
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
    if (!enabled || referenceDate || !weekIdentity) return undefined;
    const refresh = () => refreshClock((revision) => revision + 1);
    const timer = setTimeout(refresh, Math.max(1, weekIdentity.weekEnd.getTime() + 1 - Date.now()));
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [enabled, referenceDate, weekIdentity]);

  useEffect(() => {
    if (!enabled || !weekIdentity?.planId) {
      setRecord({ scope: null, plan: null, observedVersioned: false });
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let active = true;

    const weeklyPlanRef = doc(db, Collections.WEEKLY_PLANS, weekIdentity.planId);
    const unsubscribe = onSnapshot(weeklyPlanRef, (snapshot) => {
      const nextPlan = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;

      if (!active) return;
      setRecord((previous) => ({ scope: weekIdentity.planId,
        plan: nextPlan?.status === WeeklyPlanStatuses.PUBLISHED ? nextPlan : null,
        observedVersioned: nextPlan?.schema_version >= 1 || (previous.scope === weekIdentity.planId && previous.observedVersioned),
      }));
      setError(null);
      setLoading(false);
    }, (nextError) => {
      if (!active) return;
      if (nextError?.code === 'permission-denied') {
        setRecord((previous) => ({ scope: weekIdentity.planId, plan: null, observedVersioned: previous.scope === weekIdentity.planId && previous.observedVersioned }));
        setError(null);
        setLoading(false);
        return;
      }

      console.error('Error fetching published student weekly plan:', nextError?.code, nextError?.message);
      setRecord((previous) => ({ scope: weekIdentity.planId, plan: null, observedVersioned: previous.scope === weekIdentity.planId && previous.observedVersioned }));
      setError(nextError);
      setLoading(false);
    });

    return () => { active = false; unsubscribe(); };
  }, [db, enabled, weekIdentity?.planId]);

  return {
    error,
    loading: loading || Boolean(enabled && weekIdentity?.planId && record.scope !== weekIdentity.planId),
    weekIdentity,
    weeklyPlan: record.scope === weekIdentity?.planId ? record.plan : null,
    usesWeeklyPlanAuthority: Number(student?.weekly_planning_version) >= 1
      || Boolean(record.scope === weekIdentity?.planId && record.observedVersioned)
      || Boolean(enabled && weekIdentity?.planId && (loading || record.scope !== weekIdentity.planId || error)),
  };
};

export default useStudentPortalWeeklyPlan;
