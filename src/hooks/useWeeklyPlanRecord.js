import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { Collections, WeeklyPlanStatuses } from '../constants/schema';
import {
  buildPublishedWeeklyPlan,
  buildWeeklyPlanDraft,
  buildWeeklyPlanIdentity,
} from '../utils/weeklyPlanUtils';

const cloneWeeklyPlanValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(cloneWeeklyPlanValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneWeeklyPlanValue(nestedValue)])
    );
  }

  return value;
};

const deriveAssignmentIdsFromBlocks = (blocks) => {
  const seenAssignmentIds = new Set();

  return (Array.isArray(blocks) ? blocks : []).reduce((assignmentIds, block) => {
    const assignmentId = typeof block?.assignment_id === 'string' ? block.assignment_id.trim() : '';

    if (!assignmentId || seenAssignmentIds.has(assignmentId)) {
      return assignmentIds;
    }

    seenAssignmentIds.add(assignmentId);
    assignmentIds.push(assignmentId);
    return assignmentIds;
  }, []);
};

export const useWeeklyPlanRecord = ({
  currentUser = null,
  studentId = '',
  subjects = [],
  parentSettings = {},
  referenceDate = null,
  enabled = true,
  listen = true,
} = {}) => {
  const db = getFirestore(app);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [loading, setLoading] = useState(Boolean(listen && enabled && currentUser && studentId));
  const [error, setError] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [publishingPlan, setPublishingPlan] = useState(false);

  const weekIdentity = useMemo(() => {
    if (!currentUser?.uid || !studentId) {
      return null;
    }

    return buildWeeklyPlanIdentity({
      parentId: currentUser.uid,
      studentId,
      referenceDate: referenceDate || new Date(),
      weekConfig: parentSettings,
    });
  }, [
    currentUser?.uid,
    parentSettings?.week_reset_day,
    parentSettings?.week_reset_hour,
    parentSettings?.week_reset_minute,
    referenceDate,
    studentId,
  ]);

  useEffect(() => {
    if (!listen || !enabled || !weekIdentity?.planId) {
      setWeeklyPlan(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const weeklyPlanRef = doc(db, Collections.WEEKLY_PLANS, weekIdentity.planId);
    const unsubscribe = onSnapshot(weeklyPlanRef, (snapshot) => {
      setWeeklyPlan(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      setError(null);
      setLoading(false);
    }, (nextError) => {
      console.error('Error fetching weekly plan:', nextError.code, nextError.message);
      setError(nextError);
      setLoading(false);
    });

    const loadingTimeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, [db, enabled, listen, weekIdentity?.planId]);

  const buildDraftPreview = useCallback((overrides = {}) => {
    if (!currentUser?.uid || !studentId) {
      return null;
    }

    return buildWeeklyPlanDraft({
      parentId: currentUser.uid,
      studentId,
      subjects: overrides.subjects ?? subjects,
      referenceDate: weekIdentity?.weekStart || referenceDate,
      weekConfig: parentSettings,
      existingPlan: overrides.existingPlan ?? weeklyPlan,
    });
  }, [currentUser?.uid, parentSettings, referenceDate, studentId, subjects, weekIdentity?.weekStart, weeklyPlan]);

  const buildDraftMutationPayload = useCallback(({
    existingPlan = null,
    subjects: overrideSubjects,
    planOverrides = {},
  } = {}) => {
    const basePlan = existingPlan
      ? {
          ...existingPlan,
          status: WeeklyPlanStatuses.DRAFT,
          published_at: null,
          archived_at: null,
        }
      : buildDraftPreview({
          existingPlan: null,
          subjects: overrideSubjects,
        });

    if (!basePlan) {
      return null;
    }

    const nextBlocks = Array.isArray(planOverrides.blocks)
      ? cloneWeeklyPlanValue(planOverrides.blocks)
      : cloneWeeklyPlanValue(basePlan.blocks || []);
    const nextAssignmentIds = Array.isArray(planOverrides.assignment_ids)
      ? cloneWeeklyPlanValue(planOverrides.assignment_ids)
      : Array.isArray(planOverrides.blocks)
        ? deriveAssignmentIdsFromBlocks(nextBlocks)
        : cloneWeeklyPlanValue(basePlan.assignment_ids || []);

    return {
      ...basePlan,
      assignment_ids: nextAssignmentIds,
      weekly_exceptions: Array.isArray(planOverrides.weekly_exceptions)
        ? cloneWeeklyPlanValue(planOverrides.weekly_exceptions)
        : cloneWeeklyPlanValue(basePlan.weekly_exceptions || []),
      blocks: nextBlocks,
    };
  }, [buildDraftPreview]);

  const saveDraftWeeklyPlan = useCallback(async ({
    overwritePublished = false,
    overwriteArchived = false,
    subjects: overrideSubjects,
    planOverrides = {},
  } = {}) => {
    if (!currentUser?.uid || !studentId || !weekIdentity?.planId) {
      return null;
    }

    setSavingPlan(true);

    try {
      const weeklyPlanRef = doc(db, Collections.WEEKLY_PLANS, weekIdentity.planId);
      const snapshot = await getDoc(weeklyPlanRef);
      const existingPlan = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      const existingStatus = existingPlan?.status || null;

      if (existingStatus === WeeklyPlanStatuses.PUBLISHED && !overwritePublished) {
        const nextError = new Error('Weekly plan is already published for this student-week.');
        setError(nextError);
        return null;
      }

      if (existingStatus === WeeklyPlanStatuses.ARCHIVED && !overwriteArchived) {
        const nextError = new Error('Weekly plan is archived for this student-week.');
        setError(nextError);
        return null;
      }

      const draftPlan = buildDraftMutationPayload({
        existingPlan,
        subjects: overrideSubjects,
        planOverrides,
      });

      if (!draftPlan) {
        return null;
      }

      await setDoc(weeklyPlanRef, {
        ...draftPlan,
        created_at: existingPlan?.created_at || serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true });

      setError(null);
      return {
        ...draftPlan,
        created_at: existingPlan?.created_at || null,
      };
    } catch (nextError) {
      console.error('Error saving weekly plan draft:', nextError);
      setError(nextError);
      return null;
    } finally {
      setSavingPlan(false);
    }
  }, [buildDraftMutationPayload, currentUser?.uid, db, studentId, weekIdentity?.planId]);

  const publishWeeklyPlan = useCallback(async ({
    subjects: overrideSubjects,
    planOverrides = {},
  } = {}) => {
    if (!currentUser?.uid || !studentId || !weekIdentity?.planId) {
      return null;
    }

    setPublishingPlan(true);

    try {
      const weeklyPlanRef = doc(db, Collections.WEEKLY_PLANS, weekIdentity.planId);
      const snapshot = await getDoc(weeklyPlanRef);
      const existingPlan = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;

      if (existingPlan?.status === WeeklyPlanStatuses.ARCHIVED) {
        const nextError = new Error('Weekly plan is archived for this student-week.');
        setError(nextError);
        return null;
      }

      const draftPlan = buildDraftMutationPayload({
        existingPlan,
        subjects: overrideSubjects,
        planOverrides,
      });

      if (!draftPlan) {
        return null;
      }

      const publishedPlan = buildPublishedWeeklyPlan({
        ...draftPlan,
        id: weekIdentity.planId,
      });

      await setDoc(weeklyPlanRef, {
        ...publishedPlan,
        created_at: existingPlan?.created_at || serverTimestamp(),
        published_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true });

      setError(null);
      return {
        ...publishedPlan,
        created_at: existingPlan?.created_at || null,
      };
    } catch (nextError) {
      console.error('Error publishing weekly plan:', nextError);
      setError(nextError);
      return null;
    } finally {
      setPublishingPlan(false);
    }
  }, [buildDraftMutationPayload, currentUser?.uid, db, studentId, weekIdentity?.planId]);

  return {
    buildDraftPreview,
    error,
    loading,
    planId: weekIdentity?.planId || '',
    publishWeeklyPlan,
    publishingPlan,
    saveDraftWeeklyPlan,
    savingPlan,
    weekIdentity,
    weeklyPlan,
  };
};

export default useWeeklyPlanRecord;
