import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { Collections } from '../constants/schema';
import { getWeekKey } from '../utils/weekUtils';
import { archiveTrustedWeeklyPlan, fileTrustedSchoolWeeklyReport } from '../firebase/trustedOperations';

export const useWeeklyReportRecords = ({
  currentUser = null,
  parentSettings = {},
  students = [],
  enabled = true,
  listen = true,
} = {}) => {
  const db = getFirestore(app);
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [reportAmendments, setReportAmendments] = useState([]);
  const [loading, setLoading] = useState(Boolean(listen && enabled && currentUser));
  const [error, setError] = useState(null);
  const [savingRecord, setSavingRecord] = useState(false);
  const pendingFilings = useRef(new Map());

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

  useEffect(() => {
    if (!listen || !enabled || !currentUser?.uid) { setReportAmendments([]); return undefined; }
    return onSnapshot(query(collection(db, 'weeklyReportAmendments'), where('parent_id', '==', currentUser.uid)),
      (snapshot) => setReportAmendments(snapshot.docs.map((record) => ({ ...record.data(), id: record.id }))), setError);
  }, [currentUser?.uid, db, enabled, listen]);

  const fileStudentReports = useCallback(async ({ batchStudents, weekStart, source }) => {
    const weekKey = getWeekKey(weekStart, parentSettings);
    let createdCount = 0;
    for (const student of batchStudents) {
      const key = JSON.stringify([currentUser.uid, student.id, weekKey, source]);
      const request = pendingFilings.current.get(key) || { student_id: student.id, week_key: weekKey, source, idempotency_key: nanoid() };
      pendingFilings.current.set(key, request);
      try {
        const response = await fileTrustedSchoolWeeklyReport(request);
        pendingFilings.current.delete(key);
        if (response.created && !response.replayed) createdCount++;
      } catch (nextError) {
        if (!['unavailable', 'deadline-exceeded', 'internal', 'unknown', 'cancelled'].includes(String(nextError?.code || '').replace(/^functions\//, ''))) pendingFilings.current.delete(key);
        if (nextError?.details?.code === 'historical-assignment-review-required') { setError(nextError); continue; }
        throw nextError;
      }
    }
    return createdCount;
  }, [currentUser?.uid, parentSettings]);

  const saveWeeklyRecordSnapshot = useCallback(async ({ weekStart, source = 'manual' }) => {
    if (!currentUser) return false;
    setSavingRecord(true);
    try {
      await fileStudentReports({ batchStudents: students, weekStart, source });
      return true;
    } catch (nextError) {
      setError(nextError);
      console.error('Error filing weekly record:', nextError);
      return false;
    } finally { setSavingRecord(false); }
  }, [currentUser, fileStudentReports, students]);

  const deleteWeeklyReportRecord = useCallback(async (reportId) => {
    try {
      await deleteDoc(doc(db, Collections.WEEKLY_REPORTS, reportId));
      return true;
    } catch (nextError) {
      console.error('Error deleting weekly record:', nextError);
      return false;
    }
  }, [db]);

  const createWeeklyRecordsForRange = useCallback(async ({ weekStart, source = 'automatic' }) => {
    if (!currentUser) return 0;
    const activeStudents = students.length ? students : (await getDocs(query(collection(db, Collections.STUDENTS),
      where('parent_id', '==', currentUser.uid), orderBy('created_at', 'desc')))).docs.map((record) => ({ ...record.data(), id: record.id }));
    const createdCount = await fileStudentReports({ batchStudents: activeStudents, weekStart, source });
    const weekKey = getWeekKey(weekStart, parentSettings);
    for (const student of activeStudents) {
      const plans = await getDocs(query(collection(db, Collections.WEEKLY_PLANS), where('parent_id', '==', currentUser.uid),
        where('student_id', '==', student.id), where('week_key', '==', weekKey)));
      for (const record of plans.docs) {
        const plan = record.data();
        if (plan.status !== 'published') continue;
        await archiveTrustedWeeklyPlan({ student_id: student.id, week_key: weekKey,
          expected_published_revision: plan.revision ?? 0, idempotency_key: `archive:${record.id}:${plan.revision ?? 0}` });
      }
    }
    return createdCount;
  }, [currentUser, db, fileStudentReports, parentSettings, students]);

  return {
    createWeeklyRecordsForRange,
    deleteWeeklyReportRecord,
    error,
    loading,
    saveWeeklyRecordSnapshot,
    savingRecord,
    weeklyReports,
    reportAmendments,
  };
};

export default useWeeklyReportRecords;
