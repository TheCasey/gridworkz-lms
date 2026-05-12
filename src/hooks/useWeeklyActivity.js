import { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { getStudentSubjects } from '../utils/reportUtils';
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

  const getWeeklyProgress = useCallback((studentId, subjectId, weekOffset = 0) => {
    const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset, weekConfig);
    const subjectSubmissions = submissions.filter((submission) => (
      submission.student_id === studentId
      && submission.subject_id === subjectId
      && submission.timestamp
      && isTimestampInWeek(submission.timestamp, weekStart, weekEnd)
      && submission.block_index !== undefined
    ));
    const uniqueBlockIndices = [...new Set(subjectSubmissions.map((submission) => submission.block_index).filter((index) => index !== undefined))];
    const subject = subjects.find((subjectItem) => subjectItem.id === subjectId);
    const totalBlocks = subject?.block_count || 10;

    return {
      completed: uniqueBlockIndices.length,
      total: totalBlocks,
      percentage: Math.round((uniqueBlockIndices.length / totalBlocks) * 100),
    };
  }, [submissions, subjects, weekConfig]);

  const getRealTimeWeeklyProgress = useCallback((studentId, weekOffset = 0) => {
    const studentSubjects = getStudentSubjects(subjects, studentId);

    if (studentSubjects.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset, weekConfig);
    const completedBlocksBySubject = {};

    studentSubjects.forEach((subject) => {
      const subjectSubmissions = submissions.filter((submission) => (
        submission.student_id === studentId
        && submission.subject_id === subject.id
        && submission.timestamp
        && isTimestampInWeek(submission.timestamp, weekStart, weekEnd)
        && submission.block_index !== undefined
      ));

      completedBlocksBySubject[subject.id] = [
        ...new Set(subjectSubmissions.map((submission) => submission.block_index).filter((index) => index !== undefined)),
      ];
    });

    const totalBlocks = studentSubjects.reduce((sum, subject) => sum + (subject.block_count || 10), 0);
    const completedBlocks = Object.values(completedBlocksBySubject).reduce((sum, blocks) => sum + blocks.length, 0);

    return {
      completed: completedBlocks,
      total: totalBlocks,
      percentage: totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0,
    };
  }, [submissions, subjects, weekConfig]);

  const getWeekSubmissions = useCallback((weekOffset = 0) => {
    const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset, weekConfig);
    return submissions.filter((submission) => submission.timestamp && isTimestampInWeek(submission.timestamp, weekStart, weekEnd));
  }, [submissions, weekConfig]);

  const downloadWeeklyReport = useCallback(async (weekOffset = 0) => {
    if (!currentUser) return false;

    setIsGeneratingReport(true);

    try {
      const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset, weekConfig);
      const weekLabel = getWeekLabel(weekOffset);
      const weekRangeText = formatWeekRange(weekStart, weekEnd);
      let reportContent = `GridWorkz Weekly Report\nWeek: ${weekRangeText}\nGenerated: ${new Date().toLocaleString()}\n\n`;

      if (weekOffset < 0) {
        const pastSubmissionsSnapshot = await getDocs(query(
          collection(db, 'submissions'),
          where('parent_id', '==', currentUser.uid),
          where('timestamp', '>=', weekStart),
          where('timestamp', '<=', weekEnd),
          orderBy('timestamp', 'desc')
        ));

        const pastSubmissions = pastSubmissionsSnapshot.docs.map((submissionDoc) => ({ id: submissionDoc.id, ...submissionDoc.data() }));

        if (pastSubmissions.length === 0) {
          reportContent += 'No activity recorded for this week.\n';
        } else {
          for (const student of students) {
            const studentSubmissions = pastSubmissions.filter((submission) => submission.student_id === student.id);
            if (studentSubmissions.length === 0) continue;

            const studentSubjects = getStudentSubjects(subjects, student.id);
            reportContent += `═══════════════════════════════════════\nStudent: ${student.name}\nBlocks Completed: ${studentSubmissions.length}\n\n`;

            for (const subject of studentSubjects) {
              const subjectSubmissions = studentSubmissions.filter((submission) => submission.subject_id === subject.id);
              if (subjectSubmissions.length === 0) continue;

              reportContent += `📚 ${subject.title}\n   Blocks Completed: ${subjectSubmissions.length}\n`;
              subjectSubmissions.forEach((submission) => {
                const timestamp = submission.timestamp.toDate();
                reportContent += `   • Block ${(submission.block_index ?? 0) + 1} - ${timestamp.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n`;
                if (submission.summary_text) {
                  reportContent += `     Summary: ${submission.summary_text}\n`;
                }
              });
              reportContent += '\n';
            }
          }
        }
      } else {
        for (const student of students) {
          const studentProgress = getRealTimeWeeklyProgress(student.id, weekOffset);
          const studentSubjects = getStudentSubjects(subjects, student.id);
          reportContent += `═══════════════════════════════════════\nStudent: ${student.name}\nOverall Progress: ${studentProgress.completed}/${studentProgress.total} blocks (${studentProgress.percentage}%)\n\n`;

          for (const subject of studentSubjects) {
            const subjectProgress = getWeeklyProgress(student.id, subject.id, weekOffset);
            const weekSubmissions = getWeekSubmissions(weekOffset).filter((submission) => (
              submission.student_id === student.id && submission.subject_id === subject.id
            ));

            reportContent += `📚 ${subject.title}\n   Progress: ${subjectProgress.completed}/${subjectProgress.total} blocks (${subjectProgress.percentage}%)\n`;

            if (weekSubmissions.length > 0) {
              reportContent += '   Block Completions:\n';
              weekSubmissions.forEach((submission) => {
                const timestamp = submission.timestamp.toDate();
                reportContent += `   • Block ${submission.block_index + 1} - ${timestamp.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n`;
                if (submission.summary_text) {
                  reportContent += `     Summary: ${submission.summary_text}\n`;
                }
              });
            }

            reportContent += '\n';
          }
        }
      }

      const blob = new Blob([reportContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `GridWorkz-Weekly-Report-${weekLabel.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);

      return true;
    } catch (nextError) {
      console.error('Error generating weekly report:', nextError);
      alert('Failed to generate weekly report. Please try again.');
      return false;
    } finally {
      setIsGeneratingReport(false);
    }
  }, [currentUser, db, getRealTimeWeeklyProgress, getWeekSubmissions, getWeeklyProgress, students, subjects, weekConfig]);

  const completeBlockManually = useCallback(async ({
    studentId,
    subject,
    blockIndex,
    parentNote = '',
  }) => {
    if (!currentUser) return false;

    try {
      await addDoc(collection(db, 'submissions'), {
        student_id: studentId,
        subject_id: subject.id,
        subject_name: subject.title,
        block_index: blockIndex,
        status: 'parent_completed',
        summary_text: parentNote || 'Parent-led session',
        timestamp: serverTimestamp(),
        manual_override: true,
        parent_id: currentUser.uid,
      });

      return true;
    } catch (nextError) {
      console.error('Error marking block complete:', nextError);
      return false;
    }
  }, [currentUser, db]);

  const resetSubmission = useCallback(async (submissionId) => {
    try {
      await deleteDoc(doc(db, 'submissions', submissionId));
      return true;
    } catch (nextError) {
      console.error('Error resetting block:', nextError);
      return false;
    }
  }, [db]);

  const getCustomFieldLabel = useCallback((fieldId, subjectId) => {
    const subject = subjects.find((subjectItem) => subjectItem.id === subjectId);
    if (!subject || !subject.custom_fields) return fieldId;

    const field = subject.custom_fields.find((customField) => customField.id === fieldId);
    return field ? field.label : fieldId;
  }, [subjects]);

  return {
    completeBlockManually,
    downloadWeeklyReport,
    error,
    getCustomFieldLabel,
    getRealTimeWeeklyProgress,
    getWeeklyProgress,
    getWeekSubmissions,
    isGeneratingReport,
    loading,
    resetSubmission,
    submissions,
  };
};

export default useWeeklyActivity;
