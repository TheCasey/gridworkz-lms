import { serverTimestamp } from 'firebase/firestore';
import { isTimestampInWeek } from './weekUtils';
import { getSchoolYearMetadataForDate } from './schoolSettingsUtils';

export const getStudentSubjects = (subjects, studentId) => (
  subjects.filter(subject => {
    if (Array.isArray(subject.student_ids)) return subject.student_ids.includes(studentId);
    return subject.student_id === studentId;
  })
);

export const buildStudentWeeklySnapshot = ({ student, subjects, submissions, weekStart, weekEnd }) => {
  const studentSubjects = getStudentSubjects(subjects, student.id);
  const weekSubs = submissions.filter(submission => (
    submission.student_id === student.id &&
    submission.timestamp &&
    isTimestampInWeek(submission.timestamp, weekStart, weekEnd)
  ));

  const subjectData = studentSubjects.map(subject => {
    const subjectSubs = weekSubs
      .filter(submission => submission.subject_id === subject.id)
      .sort((a, b) => {
        const first = a.timestamp?.toDate?.() || new Date(a.timestamp);
        const second = b.timestamp?.toDate?.() || new Date(b.timestamp);
        return first - second;
      });
    const uniqueBlocks = [...new Set(subjectSubs.map(submission => submission.block_index).filter(index => index !== undefined))];

    return {
      subject,
      blocks: subjectSubs,
      completedCount: uniqueBlocks.length,
      totalCount: subject.block_count || 10,
      totalMinutes: subjectSubs.reduce((sum, submission) => sum + (submission.block_duration || 30), 0),
    };
  });

  const totalBlocks = subjectData.reduce((sum, subject) => sum + subject.completedCount, 0);
  const goalBlocks = subjectData.reduce((sum, subject) => sum + subject.totalCount, 0);
  const totalMinutes = subjectData.reduce((sum, subject) => sum + subject.totalMinutes, 0);

  return { student, subjectData, totalBlocks, goalBlocks, totalMinutes };
};

export const getWeekKey = (weekStart) => weekStart.toISOString().slice(0, 10);

export const buildWeeklyReportPayload = ({
  student,
  snapshot,
  weekStart,
  weekEnd,
  parentId,
  parentSettings,
  source = 'manual',
}) => {
  const subjectsData = {};
  const subjectTitles = [];
  const subjectIds = [];

  snapshot.subjectData.forEach(({ subject, blocks, completedCount, totalCount, totalMinutes }) => {
    subjectTitles.push(subject.title);
    subjectIds.push(subject.id);

    subjectsData[subject.id] = {
      subjectId: subject.id,
      subjectTitle: subject.title,
      totalBlocks: completedCount,
      goalBlocks: totalCount,
      totalMinutes,
      summaries: blocks
        .filter(block => block.summary_text)
        .map(block => ({
          text: block.summary_text,
          blockNumber: (block.block_index ?? 0) + 1,
          date: block.timestamp?.toDate?.() || new Date(block.timestamp),
          duration: block.block_duration || 30,
          manualOverride: Boolean(block.manual_override),
        })),
    };
  });

  const schoolYear = getSchoolYearMetadataForDate(weekEnd, parentSettings);
  const weekKey = getWeekKey(weekStart);

  return {
    student_id: student.id,
    student_name: student.name,
    parent_id: parentId,
    week_key: weekKey,
    week_start: weekStart,
    week_end: weekEnd,
    week_ending: weekEnd,
    weekly_goal: snapshot.goalBlocks,
    total_blocks: snapshot.totalBlocks,
    total_hours: Math.round(snapshot.totalMinutes / 60 * 10) / 10,
    subject_ids: subjectIds,
    subject_titles: subjectTitles,
    subjects_data: subjectsData,
    summaries: snapshot.subjectData.flatMap(subjectDatum => subjectDatum.blocks.map(block => block.summary_text).filter(Boolean)),
    attachments: [],
    school_year_label: schoolYear?.schoolYearLabel || '',
    school_year_start: schoolYear?.schoolYearStart || null,
    school_year_end: schoolYear?.schoolYearEnd || null,
    school_quarter: schoolYear?.quarter?.index || null,
    school_quarter_label: schoolYear?.quarter?.label || '',
    record_source: source,
    created_at: serverTimestamp(),
  };
};
