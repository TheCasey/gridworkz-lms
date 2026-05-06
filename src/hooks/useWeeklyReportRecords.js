import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import {
  buildStudentWeeklySnapshot,
  buildWeeklyReportPayload,
  getWeekKey,
} from '../utils/reportUtils';

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
      collection(db, 'weeklyReports'),
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

  const buildRecordBatch = useCallback(({
    batchStudents,
    batchSubjects,
    batchSubmissions,
    weekStart,
    weekEnd,
    source,
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
      });

      if (!snapshot) return;

      const reportId = `${currentUser.uid}_${student.id}_${getWeekKey(weekStart)}`;
      batch.set(doc(db, 'weeklyReports', reportId), buildWeeklyReportPayload({
        student,
        snapshot,
        weekStart,
        weekEnd,
        parentId: currentUser.uid,
        parentSettings,
        source,
      }), { merge: true });
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
      const { batch, createdCount } = buildRecordBatch({
        batchStudents: students,
        batchSubjects: subjects,
        batchSubmissions: submissions,
        weekStart,
        weekEnd,
        source,
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
  }, [buildRecordBatch, currentUser, students, subjects]);

  const deleteWeeklyReportRecord = useCallback(async (reportId) => {
    try {
      await deleteDoc(doc(db, 'weeklyReports', reportId));
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
        collection(db, 'students'),
        where('parent_id', '==', currentUser.uid),
        orderBy('created_at', 'desc')
      ))).docs.map((studentDoc) => ({ id: studentDoc.id, ...studentDoc.data() }));

    const activeSubjects = subjects.length > 0
      ? subjects
      : (await getDocs(query(
        collection(db, 'subjects'),
        where('parent_id', '==', currentUser.uid),
        where('is_active', '==', true),
        orderBy('title')
      ))).docs.map((subjectDoc) => ({ id: subjectDoc.id, ...subjectDoc.data() }));

    if (activeStudents.length === 0) {
      return 0;
    }

    const submissionsSnapshot = await getDocs(query(
      collection(db, 'submissions'),
      where('parent_id', '==', currentUser.uid),
      where('timestamp', '>=', weekStart),
      where('timestamp', '<=', weekEnd),
      orderBy('timestamp', 'desc')
    ));

    const rangeSubmissions = submissionsSnapshot.docs.map((submissionDoc) => ({ id: submissionDoc.id, ...submissionDoc.data() }));
    const { batch, createdCount } = buildRecordBatch({
      batchStudents: activeStudents,
      batchSubjects: activeSubjects,
      batchSubmissions: rangeSubmissions,
      weekStart,
      weekEnd,
      source,
    });

    if (createdCount > 0) {
      await batch.commit();
    }

    return createdCount;
  }, [buildRecordBatch, currentUser, db, students, subjects]);

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
