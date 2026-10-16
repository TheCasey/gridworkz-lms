import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, getFirestore, onSnapshot, query, where } from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { getCurrentWeekRange, getWeekKey, getWeekRangeByOffset } from '../utils/weekUtils';
import { resolveParentSchoolWeek } from '../utils/parentSchoolStateUtils';

const sources = { plans: 'weeklyPlans', executions: 'schoolExecutionSnapshots', states: 'blockCompletionStates', bridges: 'schoolPublicationBridges',
  events: 'parentCorrectionEvents', history: 'schoolStateHistory', reports: 'weeklyReports', amendments: 'weeklyReportAmendments' };
export const ownerSchoolQueries = ({ db, parentId, studentId, weekKey }) => Object.entries(sources).map(([key, name]) => [key,
  query(collection(db, name), where('parent_id', '==', parentId), where('student_id', '==', studentId), where('week_key', '==', weekKey))]);
export const loadOwnerSchoolRecords = async (scope) => Object.fromEntries(await Promise.all(ownerSchoolQueries(scope).map(async ([key, target]) => {
  const snapshot = await getDocs(target);
  return [key, snapshot.docs.map((record) => ({ ...record.data(), id: record.id }))];
})));

export default function useParentSchoolState({ parentId, students = [], subjects = [], submissions = [], weekConfig = {}, weekOffset = 0, weekRange = null, weekKey: suppliedWeekKey = null, enabled = true }) {
  const db = getFirestore(app);
  const range = weekRange || getWeekRangeByOffset(weekOffset, weekConfig);
  const weekKey = suppliedWeekKey || getWeekKey(range.weekStart, weekConfig);
  const currentWeekKey = getWeekKey(getCurrentWeekRange(new Date(), weekConfig).weekStart, weekConfig);
  const studentIds = students.map((student) => student.id).sort().join('|');
  const scope = `${parentId || ''}:${weekKey}:${studentIds}`;
  const [records, setRecords] = useState({ scope: '', data: {}, loaded: [] });
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);
  useEffect(() => {
    setRecords({ scope, data: {}, loaded: [] }); setError(null);
    if (!enabled || !parentId || !studentIds) return undefined;
    let active = true;
    const subscriptions = studentIds.split('|').flatMap((studentId) => ownerSchoolQueries({ db, parentId, studentId, weekKey }).map(([key, target]) =>
      onSnapshot(target, (snapshot) => {
        if (!active) return;
        setRecords((previous) => ({ scope, data: { ...previous.data, [studentId]: { ...previous.data[studentId],
          [key]: snapshot.docs.map((record) => ({ ...record.data(), id: record.id })) } }, loaded: [...new Set([...previous.loaded, `${studentId}:${key}`])] }));
      }, (nextError) => { if (active) setError(nextError); })));
    return () => { active = false; subscriptions.forEach((unsubscribe) => unsubscribe()); };
  }, [db, enabled, parentId, reloadKey, scope, studentIds, weekKey]);
  const visible = records.scope === scope ? records : { data: {}, loaded: [] };
  const loading = !error && enabled && Boolean(parentId && studentIds) && visible.loaded.length < students.length * Object.keys(sources).length;
  const resolved = useMemo(() => {
    if (loading || error) return { byStudentId: {}, error: null };
    try { return { byStudentId: Object.fromEntries(students.map((student) => [student.id, { ...resolveParentSchoolWeek({ parentId, student, weekKey,
      weekStart: range.weekStart, weekEnd: range.weekEnd, currentWeekKey, subjects, submissions, ...visible.data[student.id] }),
      amendments: visible.data[student.id]?.amendments || [] }])), error: null }; }
    catch (resolutionError) { return { byStudentId: {}, error: resolutionError }; }
  }, [loading, error, students, parentId, weekKey, range.weekStart.getTime(), range.weekEnd.getTime(), currentWeekKey, subjects, submissions, visible.data]);
  return { byStudentId: resolved.byStudentId, loading, error: error || resolved.error, reload, weekKey };
}
