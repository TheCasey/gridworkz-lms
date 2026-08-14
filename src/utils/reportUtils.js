import { serverTimestamp } from 'firebase/firestore';
import { WeeklyPlanStatuses } from '../constants/schema.js';
import { getWeekKey, isTimestampInWeek } from './weekUtils.js';
import { getSchoolYearMetadataForDate } from './schoolSettingsUtils.js';
import { getStudentSubjectsFromLegacyRecords } from './planningCompatibilityUtils.js';

const DEFAULT_SUBJECT_BLOCK_COUNT = 10;
const REPORTABLE_WEEKLY_PLAN_STATUSES = new Set([
  WeeklyPlanStatuses.PUBLISHED,
  WeeklyPlanStatuses.ARCHIVED,
]);
const REPORT_HTML_ESCAPE_CHARS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const toComparableDate = (value) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNonEmptyString = (value) => (
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : ''
);

const clonePlainArray = (value) => (
  Array.isArray(value)
    ? value.map(item => (
        item && typeof item === 'object' && !Array.isArray(item)
          ? { ...item }
          : item
      ))
    : []
);

const buildSubmissionSummarySnapshot = (submission) => {
  if (!submission) {
    return null;
  }

  return {
    submissionId: submission.id || '',
    summaryText: submission.summary_text || '',
    submittedAt: submission.timestamp || null,
    durationMinutes: submission.block_duration || 30,
    manualOverride: Boolean(submission.manual_override),
    resourcesUsed: clonePlainArray(submission.resources_used),
    customFieldResponses: (
      submission.custom_field_responses
      && typeof submission.custom_field_responses === 'object'
      && !Array.isArray(submission.custom_field_responses)
    )
      ? { ...submission.custom_field_responses }
      : {},
  };
};

const buildAssignedBlockSnapshots = ({ weeklyPlan, weekSubmissions }) => (
  (Array.isArray(weeklyPlan?.blocks) ? weeklyPlan.blocks : []).map((block, index) => {
    const legacySubjectId = toNonEmptyString(block?.legacy_subject_id);
    const legacyBlockIndex = Number.isInteger(block?.legacy_block_index)
      ? block.legacy_block_index
      : null;
    const matchedSubmissions = legacySubjectId && legacyBlockIndex !== null
      ? sortSubmissionsByTimestamp(weekSubmissions.filter((submission) => (
          submission.subject_id === legacySubjectId
          && submission.block_index === legacyBlockIndex
        )))
      : [];
    const matchedSubmission = matchedSubmissions[matchedSubmissions.length - 1] || null;
    const completed = Boolean(matchedSubmission);

    return {
      blockId: block?.id || `block-${index + 1}`,
      assignmentId: block?.assignment_id || '',
      title: block?.title || '',
      instruction: block?.instruction || '',
      category: block?.category || '',
      completionMode: block?.completion_mode || '',
      plannedDurationMinutes: block?.planned_duration_minutes || 0,
      requireTimer: Boolean(block?.require_timer),
      requireInput: Boolean(block?.require_input),
      completed,
      completionStatus: completed ? 'completed' : 'incomplete',
      resources: clonePlainArray(block?.resources),
      legacySubjectId,
      legacySubjectTitle: toNonEmptyString(block?.legacy_subject_title),
      legacyBlockIndex,
      matchedSubmissionSummary: buildSubmissionSummarySnapshot(matchedSubmission),
    };
  })
);

export const escapeReportHtml = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/[&<>"']/g, character => REPORT_HTML_ESCAPE_CHARS[character]);
};

export const getReportSnapshotAssignedBlockCount = (snapshot) => {
  const subjectAssignedBlocks = (Array.isArray(snapshot?.subjectData) ? snapshot.subjectData : [])
    .reduce((sum, subjectDatum) => {
      const totalCount = Number(subjectDatum?.totalCount);
      return sum + (Number.isFinite(totalCount) && totalCount > 0 ? totalCount : 0);
    }, 0);
  const goalBlocks = Number(snapshot?.goalBlocks);

  return Math.max(
    subjectAssignedBlocks,
    Number.isFinite(goalBlocks) && goalBlocks > 0 ? goalBlocks : 0
  );
};

export const canSaveWeeklyReportSnapshot = (snapshot) => {
  const completedBlocks = Number(snapshot?.totalBlocks);
  if (Number.isFinite(completedBlocks) && completedBlocks > 0) {
    return true;
  }

  return snapshot?.snapshotModel === 'weekly_plan'
    && getReportSnapshotAssignedBlockCount(snapshot) > 0;
};

export const buildWeeklyReportReadinessSummary = (snapshot) => {
  const assignedBlocks = Array.isArray(snapshot?.assignedBlocksSnapshot)
    ? snapshot.assignedBlocksSnapshot
    : [];
  const isWeeklyPlanSnapshot = snapshot?.snapshotModel === 'weekly_plan' && assignedBlocks.length > 0;

  if (!isWeeklyPlanSnapshot) {
    return {
      assignedBlockCount: getReportSnapshotAssignedBlockCount(snapshot),
      incompleteBlockCount: 0,
      missingRequiredDetailCount: 0,
      needsReview: false,
      checked: false,
    };
  }

  const missingRequiredDetailCount = assignedBlocks.filter((block) => {
    if (!block?.completed || !block?.requireInput) {
      return false;
    }

    const summaryText = toNonEmptyString(block?.matchedSubmissionSummary?.summaryText);
    const customFieldResponses = block?.matchedSubmissionSummary?.customFieldResponses || {};
    const hasCustomFieldResponse = Object.values(customFieldResponses).some((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return toNonEmptyString(value).length > 0;
    });

    return !summaryText && !hasCustomFieldResponse;
  }).length;
  const incompleteBlockCount = assignedBlocks.filter((block) => !block?.completed).length;

  return {
    assignedBlockCount: assignedBlocks.length,
    incompleteBlockCount,
    missingRequiredDetailCount,
    needsReview: incompleteBlockCount > 0 || missingRequiredDetailCount > 0,
    checked: true,
  };
};

const sortSubmissionsByTimestamp = (submissions) => (
  [...(Array.isArray(submissions) ? submissions : [])].sort((left, right) => {
    const first = toComparableDate(left?.timestamp);
    const second = toComparableDate(right?.timestamp);

    if (!first && !second) return 0;
    if (!first) return -1;
    if (!second) return 1;
    return first - second;
  })
);

const buildWeekSubmissionsForStudent = ({ studentId, submissions, weekStart, weekEnd }) => (
  (Array.isArray(submissions) ? submissions : []).filter((submission) => (
    submission.student_id === studentId
    && submission.timestamp
    && isTimestampInWeek(submission.timestamp, weekStart, weekEnd)
  ))
);

const getSubmissionMinutesTotal = (submissions) => (
  (Array.isArray(submissions) ? submissions : []).reduce(
    (sum, submission) => sum + (submission.block_duration || 30),
    0
  )
);

const buildSubjectDerivedSubjectData = ({ subjects, weekSubmissions }) => (
  (Array.isArray(subjects) ? subjects : []).map((subject) => {
    const subjectSubmissions = sortSubmissionsByTimestamp(
      weekSubmissions.filter((submission) => submission.subject_id === subject.id)
    );
    const completedBlockIndices = new Set(
      subjectSubmissions
        .map((submission) => submission.block_index)
        .filter((blockIndex) => blockIndex !== undefined)
    );

    return {
      subject,
      blocks: subjectSubmissions,
      completedCount: completedBlockIndices.size,
      totalCount: toPositiveInt(subject?.block_count, DEFAULT_SUBJECT_BLOCK_COUNT),
      totalMinutes: getSubmissionMinutesTotal(subjectSubmissions),
    };
  })
);

export const isReportableWeeklyPlan = (weeklyPlan) => (
  Boolean(weeklyPlan?.id) && REPORTABLE_WEEKLY_PLAN_STATUSES.has(weeklyPlan.status)
);

export const getStudentSubjects = (subjects, studentId) => (
  getStudentSubjectsFromLegacyRecords(subjects, studentId)
);

export const buildSubjectWeeklySnapshot = ({ student, subjects, submissions, weekStart, weekEnd }) => {
  const studentSubjects = getStudentSubjects(subjects, student.id);
  const weekSubmissions = buildWeekSubmissionsForStudent({
    studentId: student.id,
    submissions,
    weekStart,
    weekEnd,
  });
  const subjectData = buildSubjectDerivedSubjectData({
    subjects: studentSubjects,
    weekSubmissions,
  });

  const totalBlocks = subjectData.reduce((sum, subjectDatum) => sum + subjectDatum.completedCount, 0);
  const goalBlocks = subjectData.reduce((sum, subjectDatum) => sum + subjectDatum.totalCount, 0);
  const totalMinutes = subjectData.reduce((sum, subjectDatum) => sum + subjectDatum.totalMinutes, 0);

  return {
    student,
    subjectData,
    totalBlocks,
    goalBlocks,
    totalMinutes,
    snapshotModel: 'subjects',
    weeklyPlanId: '',
    assignedBlocksSnapshot: [],
  };
};

export const buildWeeklyPlanWeeklySnapshot = ({
  student,
  subjects,
  submissions,
  weekStart,
  weekEnd,
  weeklyPlan,
}) => {
  const weekSubmissions = buildWeekSubmissionsForStudent({
    studentId: student.id,
    submissions,
    weekStart,
    weekEnd,
  });
  const subjectsById = Object.fromEntries(
    (Array.isArray(subjects) ? subjects : []).map((subject) => [subject.id, subject])
  );
  const groupedPlanSubjects = [];
  const groupsBySubjectId = new Map();

  (Array.isArray(weeklyPlan?.blocks) ? weeklyPlan.blocks : []).forEach((block) => {
    const legacySubjectId = toNonEmptyString(block?.legacy_subject_id);
    const legacyBlockIndex = Number.isInteger(block?.legacy_block_index)
      ? block.legacy_block_index
      : null;

    if (!legacySubjectId || legacyBlockIndex === null) {
      return;
    }

    let subjectGroup = groupsBySubjectId.get(legacySubjectId);

    if (!subjectGroup) {
      const legacySubject = subjectsById[legacySubjectId] || null;
      const subjectTitle = toNonEmptyString(block?.legacy_subject_title)
        || toNonEmptyString(block?.title)
        || toNonEmptyString(legacySubject?.title)
        || `Subject ${groupedPlanSubjects.length + 1}`;

      subjectGroup = {
        subject: {
          ...(legacySubject || {}),
          id: legacySubjectId,
          title: subjectTitle,
          color: toNonEmptyString(block?.color) || legacySubject?.color || '',
        },
        plannedBlocks: [],
      };

      groupsBySubjectId.set(legacySubjectId, subjectGroup);
      groupedPlanSubjects.push(subjectGroup);
    }

    subjectGroup.plannedBlocks.push({
      key: `${legacySubjectId}:${legacyBlockIndex}`,
    });
  });

  const subjectData = groupedPlanSubjects.map(({ subject, plannedBlocks }) => {
    const plannedBlockKeys = new Set(plannedBlocks.map((plannedBlock) => plannedBlock.key));
    const planMatchedSubmissions = sortSubmissionsByTimestamp(
      weekSubmissions.filter((submission) => (
        plannedBlockKeys.has(`${submission.subject_id}:${submission.block_index}`)
      ))
    );
    const completedBlockKeys = new Set(
      planMatchedSubmissions.map((submission) => `${submission.subject_id}:${submission.block_index}`)
    );

    return {
      subject,
      blocks: planMatchedSubmissions,
      completedCount: completedBlockKeys.size,
      totalCount: plannedBlocks.length,
      totalMinutes: getSubmissionMinutesTotal(planMatchedSubmissions),
    };
  });

  const totalBlocks = subjectData.reduce((sum, subjectDatum) => sum + subjectDatum.completedCount, 0);
  const goalBlocks = subjectData.reduce((sum, subjectDatum) => sum + subjectDatum.totalCount, 0);
  const totalMinutes = subjectData.reduce((sum, subjectDatum) => sum + subjectDatum.totalMinutes, 0);
  const assignedBlocksSnapshot = buildAssignedBlockSnapshots({
    weeklyPlan,
    weekSubmissions,
  });

  return {
    student,
    subjectData,
    totalBlocks,
    goalBlocks,
    totalMinutes,
    snapshotModel: 'weekly_plan',
    weeklyPlanId: weeklyPlan?.id || '',
    assignedBlocksSnapshot,
  };
};

export const buildStudentWeeklySnapshot = ({
  student,
  subjects,
  submissions,
  weekStart,
  weekEnd,
  weeklyPlan = null,
}) => (
  isReportableWeeklyPlan(weeklyPlan)
    ? buildWeeklyPlanWeeklySnapshot({
        student,
        subjects,
        submissions,
        weekStart,
        weekEnd,
        weeklyPlan,
      })
    : buildSubjectWeeklySnapshot({
        student,
        subjects,
        submissions,
        weekStart,
        weekEnd,
      })
);

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
    assigned_blocks_snapshot: Array.isArray(snapshot.assignedBlocksSnapshot)
      ? snapshot.assignedBlocksSnapshot
      : [],
    summaries: snapshot.subjectData.flatMap(subjectDatum => subjectDatum.blocks.map(block => block.summary_text).filter(Boolean)),
    attachments: [],
    snapshot_model: snapshot.snapshotModel || 'subjects',
    weekly_plan_id: snapshot.weeklyPlanId || '',
    school_year_label: schoolYear?.schoolYearLabel || '',
    school_year_start: schoolYear?.schoolYearStart || null,
    school_year_end: schoolYear?.schoolYearEnd || null,
    school_quarter: schoolYear?.quarter?.index || null,
    school_quarter_label: schoolYear?.quarter?.label || '',
    record_source: source,
    created_at: serverTimestamp(),
  };
};
