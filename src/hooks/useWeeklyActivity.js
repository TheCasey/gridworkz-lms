import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { schoolTimestampMillis } from '../utils/parentSchoolStateUtils';
import useParentSchoolState from './useParentSchoolState';
import { app } from '../firebase/firebaseConfig';
import {
  formatWeekRange,
  getWeekLabel,
  getWeekRangeByOffset,
  isTimestampInWeek,
} from '../utils/weekUtils';

const getComparableDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();

  const nextDate = new Date(value);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
};

export const useWeeklyActivity = ({
  currentUser = null,
  parentId = null,
  enabled = true,
  students = [],
  subjects = [],
  weekConfig,
  startAt = null,
  endAt = null,
  weekOffset: selectedWeekOffset = 0,
} = {}) => {
  const db = getFirestore(app);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && (parentId || currentUser?.uid)));
  const [error, setError] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const startAtKey = getComparableDate(startAt)?.getTime() ?? null;
  const endAtKey = getComparableDate(endAt)?.getTime() ?? null;

  useEffect(() => {
    const scopeParentId = parentId || currentUser?.uid;
    const startAtDate = startAtKey != null ? new Date(startAtKey) : null;
    const endAtDate = endAtKey != null ? new Date(endAtKey) : null;

    if (!enabled || !scopeParentId) {
      setSubmissions([]);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const constraints = [where('parent_id', '==', scopeParentId)];
    if (startAtDate) {
      constraints.push(where('timestamp', '>=', startAtDate));
    }
    if (endAtDate) {
      constraints.push(where('timestamp', '<=', endAtDate));
    }
    constraints.push(orderBy('timestamp', 'desc'));

    const submissionsQuery = query(collection(db, 'submissions'), ...constraints);
    const unsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
      setSubmissions(snapshot.docs.map((submissionDoc) => ({ id: submissionDoc.id, ...submissionDoc.data() })));
      setError(null);
      setLoading(false);
    }, (nextError) => {
      console.error('Error fetching submissions:', nextError.code, nextError.message);
      setError(nextError);
      setLoading(false);
    });

    const loadingTimeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, [currentUser?.uid, db, enabled, endAtKey, parentId, startAtKey]);

  const school = useParentSchoolState({ parentId: parentId || currentUser?.uid, students, subjects, submissions, weekConfig, weekOffset: selectedWeekOffset, enabled });
  const getProgress = useCallback((studentId, subjectId, weekOffset = 0) => {
    const entries = weekOffset === selectedWeekOffset ? school.byStudentId[studentId]?.entries || [] : [];
    const blocks = subjectId ? entries.filter((entry) => entry.block.legacy_subject_id === subjectId) : entries;
    const completed = blocks.filter((entry) => entry.state.status === 'completed').length;
    return { completed, total: blocks.length, percentage: blocks.length ? Math.round(completed / blocks.length * 100) : 0 };
  }, [school.byStudentId, selectedWeekOffset]);
  const getWeeklyProgress = useCallback((studentId, subjectId, weekOffset = 0) => getProgress(studentId, subjectId, weekOffset), [getProgress]);
  const getRealTimeWeeklyProgress = useCallback((studentId, weekOffset = 0) => getProgress(studentId, null, weekOffset), [getProgress]);

  const getWeekSubmissions = useCallback((weekOffset = 0) => {
    const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset, weekConfig);
    return submissions.filter((submission) => submission.timestamp && isTimestampInWeek(submission.timestamp, weekStart, weekEnd));
  }, [submissions, weekConfig]);

  const getWeekActivity = useCallback((weekOffset = 0) => {
    const evidence = getWeekSubmissions(weekOffset).map((item) => {
      const entry = school.byStudentId[item.student_id]?.entries.find((candidate) => candidate.state.original_evidence_ids.includes(item.id));
      return { ...item, activity_kind: 'evidence', effective_status: entry?.state.status || null };
    });
    const corrections = weekOffset === selectedWeekOffset ? Object.values(school.byStudentId).flatMap((week) => week.entries.flatMap((entry) => entry.events.map((event) => ({
      ...event, activity_kind: 'parent_correction', timestamp: event.recorded_at, subject_name: entry.block.title || 'School block',
      subject_id: entry.block.legacy_subject_id, effective_status: entry.state.status,
    })))) : [];
    const unique = new Map([...evidence, ...corrections].map((item) => [item.id, item]));
    return [...unique.values()].sort((a, b) => schoolTimestampMillis(b.timestamp) - schoolTimestampMillis(a.timestamp));
  }, [getWeekSubmissions, school.byStudentId, selectedWeekOffset]);

  const downloadWeeklyReport = useCallback(async (weekOffset = 0) => {
    if (!currentUser || weekOffset !== selectedWeekOffset || school.loading || school.error) return false;
    setIsGeneratingReport(true);
    try {
      const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset, weekConfig);
      let reportContent = `Own Path Weekly Report\nWeek: ${formatWeekRange(weekStart, weekEnd)}\nGenerated: ${new Date().toLocaleString()}\n\n`;
      for (const student of students) {
        const week = school.byStudentId[student.id];
        if (!week) continue;
        reportContent += `${student.name}: ${week.completed}/${week.total} completed\n`;
        for (const entry of week.entries) {
          reportContent += `• ${entry.block.title || 'School block'}: ${entry.state.status} (${entry.state.provenance || 'no evidence'})\n`;
          for (const evidence of entry.evidence) if (evidence.summary_text) reportContent += `  Original evidence: ${evidence.summary_text}\n`;
          for (const event of entry.events) reportContent += `  Parent correction: ${event.new_status}; ${event.reason}${event.note ? ` — ${event.note}` : ''}\n`;
        }
        reportContent += '\n';
      }
      const url = window.URL.createObjectURL(new Blob([reportContent], { type: 'text/plain' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `Own-Path-Weekly-Report-${getWeekLabel(weekOffset).replace(/\s+/g, '-')}.txt`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.URL.revokeObjectURL(url);
      return true;
    } finally { setIsGeneratingReport(false); }
  }, [currentUser, school.byStudentId, school.loading, school.error, selectedWeekOffset, students, weekConfig]);

  const getCustomFieldLabel = useCallback((fieldId, subjectId) => {
    const subject = subjects.find((subjectItem) => subjectItem.id === subjectId);
    if (!subject || !subject.custom_fields) return fieldId;

    const field = subject.custom_fields.find((customField) => customField.id === fieldId);
    return field ? field.label : fieldId;
  }, [subjects]);

  return {
    downloadWeeklyReport,
    error: error || school.error,
    schoolWeeksByStudentId: school.byStudentId,
    reloadSchoolState: school.reload,
    getCustomFieldLabel,
    getRealTimeWeeklyProgress,
    getWeeklyProgress,
    getWeekSubmissions,
    getWeekActivity,
    isGeneratingReport,
    loading: loading || school.loading,
    submissions,
  };
};

export default useWeeklyActivity;
