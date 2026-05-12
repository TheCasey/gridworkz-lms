import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { Collections, WeeklyPlanStatuses } from '../constants/schema';
import {
  buildStudentWeeklySnapshot,
  buildWeeklyReportPayload,
} from '../utils/reportUtils';
import { buildWeeklyPlanDocumentId } from '../utils/weeklyPlanUtils';
import { getWeekKey } from '../utils/weekUtils';

export const useWeeklyReportRecords = ({
  currentUser = null,
  parentSettings = {},
  students = [],
  subjects = [],
  enabled = true,
  listen = true,
} = {}) => {
  const db = getFirestore(app);
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [loading, setLoading] = useState(Boolean(listen && enabled && currentUser));
  const [error, setError] = useState(null);
  const [savingRecord, setSavingRecord] = useState(false);

  useEffect(() => {
    if (!listen || !enabled || !currentUser) {
      setWeeklyReports([]);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const reportsQuery = query(
      collection(db, Collections.WEEKLY_REPORTS),
      where('parent_id', '==', currentUser.uid),
      orderBy('week_ending', 'desc')
    );

    const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
      setWeeklyReports(snapshot.docs.map((reportDoc) => ({ id: reportDoc.id, ...reportDoc.data() })));
      setError(null);
      setLoading(false);
    }, (nextError) => {
      console.error('Error fetching weekly reports:', nextError.code, nextError.message);
      setError(nextError);
      setLoading(false);
    });

    const loadingTimeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, [currentUser, db, enabled, listen]);

  const loadWeeklyPlansByStudentId = useCallback(async ({
    batchStudents,
    weekStart,
  }) => {
    if (!currentUser?.uid || !Array.isArray(batchStudents) || batchStudents.length === 0) {
      return {};
    }

    const weekKey = getWeekKey(weekStart);
    const weeklyPlanEntries = await Promise.all(batchStudents.map(async (student) => {
      if (!student?.id) {
        return [student?.id || '', null];
      }

      const weeklyPlanId = buildWeeklyPlanDocumentId({
        parentId: currentUser.uid,
        studentId: student.id,
        weekKey,
      });
      const weeklyPlanSnapshot = await getDoc(doc(db, Collections.WEEKLY_PLANS, weeklyPlanId));

      return [
        student.id,
        weeklyPlanSnapshot.exists()
          ? { id: weeklyPlanSnapshot.id, ...weeklyPlanSnapshot.data() }
          : null,
      ];
    }));

    return Object.fromEntries(weeklyPlanEntries.filter(([studentId]) => Boolean(studentId)));
  }, [currentUser?.uid, db]);

  const buildRecordBatch = useCallback(({
    batchStudents,
    batchSubjects,
    batchSubmissions,
    weekStart,
    weekEnd,
    source,
    weeklyPlansByStudentId = {},
    archivePublishedPlans = false,
  }) => {
    const batch = writeBatch(db);
    let createdCount = 0;

    batchStudents.forEach((student) => {
      const snapshot = buildStudentWeeklySnapshot({
        student,
        subjects: batchSubjects,
        submissions: batchSubmissions,
        weekStart,
        weekEnd,
        weeklyPlan: weeklyPlansByStudentId[student.id] || null,
      });

      if (!snapshot) return;

      const reportId = `${currentUser.uid}_${student.id}_${getWeekKey(weekStart)}`;
      batch.set(doc(db, Collections.WEEKLY_REPORTS, reportId), buildWeeklyReportPayload({
        student,
        snapshot,
        weekStart,
        weekEnd,
        parentId: currentUser.uid,
        parentSettings,
        source,
      }), { merge: true });

      const weeklyPlan = weeklyPlansByStudentId[student.id] || null;

      if (
        archivePublishedPlans
        && snapshot.snapshotModel === 'weekly_plan'
        && weeklyPlan?.id
        && weeklyPlan.status === WeeklyPlanStatuses.PUBLISHED
      ) {
        batch.set(doc(db, Collections.WEEKLY_PLANS, weeklyPlan.id), {
          status: WeeklyPlanStatuses.ARCHIVED,
          archived_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        }, { merge: true });
      }

      createdCount += 1;
    });

    return { batch, createdCount };
  }, [currentUser?.uid, db, parentSettings]);

  const saveWeeklyRecordSnapshot = useCallback(async ({
    submissions,
    weekStart,
    weekEnd,
    source = 'manual',
  }) => {
    if (!currentUser) return false;

    setSavingRecord(true);

    try {
      const weeklyPlansByStudentId = await loadWeeklyPlansByStudentId({
        batchStudents: students,
        weekStart,
      });
      const { batch, createdCount } = buildRecordBatch({
        batchStudents: students,
        batchSubjects: subjects,
        batchSubmissions: submissions,
        weekStart,
        weekEnd,
        source,
        weeklyPlansByStudentId,
        archivePublishedPlans: false,
      });

      if (createdCount > 0) {
        await batch.commit();
      }

      return true;
    } catch (nextError) {
      console.error('Error saving weekly record:', nextError);
      return false;
    } finally {
      setSavingRecord(false);
    }
  }, [buildRecordBatch, currentUser, loadWeeklyPlansByStudentId, students, subjects]);

  const deleteWeeklyReportRecord = useCallback(async (reportId) => {
    try {
      await deleteDoc(doc(db, Collections.WEEKLY_REPORTS, reportId));
      return true;
    } catch (nextError) {
      console.error('Error deleting weekly record:', nextError);
      return false;
    }
  }, [db]);

  const createWeeklyRecordsForRange = useCallback(async ({
    weekStart,
    weekEnd,
    source = 'automatic',
  }) => {
    if (!currentUser) return 0;

    const activeStudents = students.length > 0
      ? students
      : (await getDocs(query(
        collection(db, Collections.STUDENTS),
        where('parent_id', '==', currentUser.uid),
        orderBy('created_at', 'desc')
      ))).docs.map((studentDoc) => ({ id: studentDoc.id, ...studentDoc.data() }));

    const activeSubjects = subjects.length > 0
      ? subjects
      : (await getDocs(query(
        collection(db, Collections.SUBJECTS),
        where('parent_id', '==', currentUser.uid),
        where('is_active', '==', true),
        orderBy('title')
      ))).docs.map((subjectDoc) => ({ id: subjectDoc.id, ...subjectDoc.data() }));

    if (activeStudents.length === 0) {
      return 0;
    }

    const submissionsSnapshot = await getDocs(query(
      collection(db, Collections.SUBMISSIONS),
      where('parent_id', '==', currentUser.uid),
      where('timestamp', '>=', weekStart),
      where('timestamp', '<=', weekEnd),
      orderBy('timestamp', 'desc')
    ));

    const rangeSubmissions = submissionsSnapshot.docs.map((submissionDoc) => ({ id: submissionDoc.id, ...submissionDoc.data() }));
    const weeklyPlansByStudentId = await loadWeeklyPlansByStudentId({
      batchStudents: activeStudents,
      weekStart,
    });
    const { batch, createdCount } = buildRecordBatch({
      batchStudents: activeStudents,
      batchSubjects: activeSubjects,
      batchSubmissions: rangeSubmissions,
      weekStart,
      weekEnd,
      source,
      weeklyPlansByStudentId,
      archivePublishedPlans: true,
    });

    if (createdCount > 0) {
      await batch.commit();
    }

    return createdCount;
  }, [buildRecordBatch, currentUser, db, loadWeeklyPlansByStudentId, students, subjects]);

  return {
    createWeeklyRecordsForRange,
    deleteWeeklyReportRecord,
    error,
    loading,
    saveWeeklyRecordSnapshot,
    savingRecord,
    weeklyReports,
  };
};

export default useWeeklyReportRecords;
