import { WeeklyPlanStatuses } from '../constants/schema.js';
import {
  buildLegacySubjectAssignmentSeed,
  buildLegacySubjectWeeklyBlockSeeds,
  getSubjectBlockLengthMinutes,
  getStudentSubjectsFromLegacyRecords,
} from './planningCompatibilityUtils.js';
import { getWeekKey, getWeekRangeForDate } from './weekUtils.js';

const LEGACY_ASSIGNMENT_PREFIX = 'legacy-assignment';

const compareStrings = (left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' });

const clonePlanValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(clonePlanValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, clonePlanValue(nestedValue)])
    );
  }

  return value;
};

const clonePlanArray = (value) => (Array.isArray(value) ? value.map(clonePlanValue) : []);

const toNonEmptyString = (value) => (
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : ''
);

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeReferenceDate = (value) => {
  if (!value) {
    return new Date();
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export const sortSubjectsForWeeklyPlanning = (subjects) => (
  [...(Array.isArray(subjects) ? subjects : [])].sort((left, right) => {
    const titleComparison = compareStrings(left?.title || '', right?.title || '');

    if (titleComparison !== 0) {
      return titleComparison;
    }

    return compareStrings(left?.id || '', right?.id || '');
  })
);

export const getActiveStudentSubjectsForWeek = ({ subjects, studentId }) => (
  sortSubjectsForWeeklyPlanning(
    getStudentSubjectsFromLegacyRecords(subjects, studentId).filter((subject) => subject?.is_active !== false)
  )
);

export const buildWeeklyPlanDocumentId = ({ parentId, studentId, weekKey }) => (
  [parentId, studentId, weekKey].filter(Boolean).join('_')
);

export const buildLegacyAssignmentId = ({ studentId, legacySubjectId }) => (
  `${LEGACY_ASSIGNMENT_PREFIX}_${studentId}_${legacySubjectId}`
);

export const buildWeeklyPlanBlockId = ({ assignmentId, legacyBlockIndex }) => (
  `${assignmentId}_block_${legacyBlockIndex}`
);

export const buildWeeklyPlanIdentity = ({
  parentId,
  studentId,
  referenceDate,
  weekConfig = {},
}) => {
  const normalizedReferenceDate = normalizeReferenceDate(referenceDate);
  const { weekStart, weekEnd } = getWeekRangeForDate(normalizedReferenceDate, weekConfig);
  const weekKey = getWeekKey(weekStart, weekConfig);

  return {
    planId: buildWeeklyPlanDocumentId({ parentId, studentId, weekKey }),
    parentId,
    studentId,
    weekEnd,
    weekKey,
    weekStart,
  };
};

export const deriveWeeklyPlanSourceAssignments = ({ subjects, studentId }) => (
  getActiveStudentSubjectsForWeek({ subjects, studentId }).map((subject) => {
    const assignmentId = buildLegacyAssignmentId({
      studentId,
      legacySubjectId: subject.id,
    });

    return {
      id: assignmentId,
      ...buildLegacySubjectAssignmentSeed({ subject, studentId }),
      curriculum_template_id: '',
    };
  })
);

export const deriveWeeklyPlanBlocks = ({ subjects, studentId }) => (
  getActiveStudentSubjectsForWeek({ subjects, studentId }).flatMap((subject) => {
    const assignmentId = buildLegacyAssignmentId({
      studentId,
      legacySubjectId: subject.id,
    });

    return buildLegacySubjectWeeklyBlockSeeds({ subject, studentId }).map((blockSeed) => ({
      ...blockSeed,
      id: buildWeeklyPlanBlockId({
        assignmentId,
        legacyBlockIndex: blockSeed.legacy_block_index,
      }),
      assignment_id: assignmentId,
    }));
  })
);

export const buildWeeklyPlanDraft = ({
  parentId,
  studentId,
  subjects,
  referenceDate,
  weekConfig = {},
  existingPlan = null,
}) => {
  const identity = buildWeeklyPlanIdentity({
    parentId,
    studentId,
    referenceDate,
    weekConfig,
  });
  const assignments = deriveWeeklyPlanSourceAssignments({ subjects, studentId });
  const blocks = deriveWeeklyPlanBlocks({ subjects, studentId });

  return {
    id: identity.planId,
    parent_id: parentId,
    student_id: studentId,
    week_key: identity.weekKey,
    week_start: identity.weekStart,
    week_end: identity.weekEnd,
    status: WeeklyPlanStatuses.DRAFT,
    assignment_ids: assignments.map((assignment) => assignment.id),
    weekly_exceptions: Array.isArray(existingPlan?.weekly_exceptions)
      ? [...existingPlan.weekly_exceptions]
      : [],
    blocks,
    published_at: null,
    archived_at: null,
  };
};

export const buildPublishedWeeklyPlan = (weeklyPlan) => ({
  ...weeklyPlan,
  status: WeeklyPlanStatuses.PUBLISHED,
  archived_at: null,
});

export const isPublishedWeeklyPlan = (weeklyPlan) => (
  weeklyPlan?.status === WeeklyPlanStatuses.PUBLISHED
);

export const findWeeklyPlanBlockByCompatibilityReference = (
  weeklyPlan,
  {
    legacySubjectId = '',
    legacyBlockIndex = null,
  } = {}
) => {
  const normalizedSubjectId = toNonEmptyString(legacySubjectId);
  const normalizedBlockIndex = Number.isInteger(legacyBlockIndex)
    ? legacyBlockIndex
    : Number.parseInt(legacyBlockIndex, 10);

  if (!normalizedSubjectId || !Number.isInteger(normalizedBlockIndex)) {
    return null;
  }

  return (Array.isArray(weeklyPlan?.blocks) ? weeklyPlan.blocks : []).find((block) => (
    toNonEmptyString(block?.legacy_subject_id) === normalizedSubjectId
    && Number.isInteger(block?.legacy_block_index)
    && block.legacy_block_index === normalizedBlockIndex
  )) || null;
};

export const buildPublishedWeeklyPlanPortalWorkItems = ({
  weeklyPlan,
  subjectsById = {},
} = {}) => {
  const blocks = Array.isArray(weeklyPlan?.blocks) ? weeklyPlan.blocks : [];
  const planBlockCountBySubject = blocks.reduce((counts, block) => {
    const legacySubjectId = toNonEmptyString(block?.legacy_subject_id);
    const legacyBlockIndex = Number.isInteger(block?.legacy_block_index)
      ? block.legacy_block_index
      : null;

    if (!legacySubjectId || legacyBlockIndex === null) {
      return counts;
    }

    counts[legacySubjectId] = Math.max(counts[legacySubjectId] || 0, legacyBlockIndex + 1);
    return counts;
  }, {});

  return blocks.reduce((workItems, block, index) => {
    const legacySubjectId = toNonEmptyString(block?.legacy_subject_id);
    const legacyBlockIndex = Number.isInteger(block?.legacy_block_index)
      ? block.legacy_block_index
      : null;

    if (!legacySubjectId || legacyBlockIndex === null) {
      return workItems;
    }

    const legacySubject = subjectsById[legacySubjectId] || null;
    const displayTitle = toNonEmptyString(block?.title)
      || toNonEmptyString(block?.legacy_subject_title)
      || toNonEmptyString(legacySubject?.title)
      || `Block ${index + 1}`;
    const legacySubjectTitle = toNonEmptyString(block?.legacy_subject_title)
      || toNonEmptyString(legacySubject?.title)
      || displayTitle;
    const plannedDurationMinutes = toPositiveInt(
      block?.planned_duration_minutes,
      getSubjectBlockLengthMinutes(legacySubject)
    );
    const requireTimer = typeof block?.require_timer === 'boolean'
      ? block.require_timer
      : Boolean(legacySubject?.require_timer);
    const requireInput = typeof block?.require_input === 'boolean'
      ? block.require_input
      : legacySubject?.require_input !== false;
    const resources = clonePlanArray(
      Array.isArray(block?.resources)
        ? block.resources
        : legacySubject?.resources
    );
    const customFields = clonePlanArray(block?.custom_fields);
    const instruction = toNonEmptyString(block?.instruction);
    const compatibilitySubject = {
      ...(legacySubject || {}),
      id: legacySubjectId,
      title: displayTitle,
      portal_display_title: displayTitle,
      legacy_subject_id: legacySubjectId,
      legacy_subject_title: legacySubjectTitle,
      block_count: toPositiveInt(
        legacySubject?.block_count,
        planBlockCountBySubject[legacySubjectId] || (legacyBlockIndex + 1)
      ),
      block_length: plannedDurationMinutes,
      require_timer: requireTimer,
      require_input: requireInput,
      resources,
      custom_fields: customFields,
      block_objectives: {
        [legacyBlockIndex]: {
          instruction,
          custom_fields: clonePlanArray(customFields),
          student_overrides: {},
        },
      },
    };

    workItems.push({
      id: toNonEmptyString(block?.id) || `${legacySubjectId}_block_${legacyBlockIndex}`,
      title: displayTitle,
      legacySubjectId,
      legacySubjectTitle,
      compatibilityBlockIndex: legacyBlockIndex,
      plannedDurationMinutes,
      requireTimer,
      requireInput,
      resources,
      customFields,
      instruction: instruction || null,
      color: toNonEmptyString(block?.color) || legacySubject?.color || '',
      compatibilitySubject,
    });

    return workItems;
  }, []);
};

export const buildPublishedWeeklyPlanPortalSubjects = (workItems = []) => (
  (Array.isArray(workItems) ? workItems : []).reduce((subjects, workItem) => {
    const compatibilitySubject = workItem?.compatibilitySubject || null;

    if (!compatibilitySubject?.id || subjects.some((subject) => subject.id === compatibilitySubject.id)) {
      return subjects;
    }

    subjects.push(compatibilitySubject);
    return subjects;
  }, [])
);
