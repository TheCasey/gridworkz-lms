import {
  WeeklyBlockCategories,
  WeeklyBlockCompletionModes,
} from '../constants/schema.js';

const DEFAULT_SUBJECT_BLOCK_COUNT = 10;
const DEFAULT_SUBJECT_BLOCK_LENGTH = 30;
const DEFAULT_SUBJECT_COLOR = '#3B82F6';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const cloneCompatValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(cloneCompatValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneCompatValue(nestedValue)])
    );
  }

  return value;
};

const cloneArray = (value) => (Array.isArray(value) ? value.map(cloneCompatValue) : []);

const buildLegacySubjectReferences = (subject) => ({
  legacy_subject_id: subject?.id || '',
  legacy_subject_title: subject?.title || '',
});

const hasGuidedObjective = (subject) => Object.values(subject?.block_objectives || {}).some((objective) => (
  isNonEmptyString(objective?.instruction)
  || Object.values(objective?.student_overrides || {}).some((override) => isNonEmptyString(override?.instruction))
));

export const getAssignedStudentIdsFromSubject = (subject) => {
  if (Array.isArray(subject?.student_ids) && subject.student_ids.length > 0) {
    return [...new Set(subject.student_ids.filter(isNonEmptyString))];
  }

  return isNonEmptyString(subject?.student_id) ? [subject.student_id] : [];
};

export const isSubjectAssignedToStudent = (subject, studentId) => (
  isNonEmptyString(studentId) && getAssignedStudentIdsFromSubject(subject).includes(studentId)
);

export const getStudentSubjectsFromLegacyRecords = (subjects, studentId) => (
  (Array.isArray(subjects) ? subjects : []).filter((subject) => isSubjectAssignedToStudent(subject, studentId))
);

export const getSubjectBlockCount = (subject) => (
  toPositiveInt(subject?.block_count, DEFAULT_SUBJECT_BLOCK_COUNT)
);

export const getSubjectBlockLengthMinutes = (subject) => (
  toPositiveInt(subject?.block_length ?? subject?.block_duration, DEFAULT_SUBJECT_BLOCK_LENGTH)
);

export const getSubjectBlockObjective = (subject, blockIndex) => {
  if (blockIndex === null || blockIndex === undefined) {
    return null;
  }

  return subject?.block_objectives?.[blockIndex] || null;
};

export const getEffectiveSubjectInstruction = ({ subject, blockIndex, studentId }) => {
  const blockObjective = getSubjectBlockObjective(subject, blockIndex);
  const instruction = blockObjective?.student_overrides?.[studentId]?.instruction || blockObjective?.instruction;

  return isNonEmptyString(instruction) ? instruction.trim() : null;
};

export const getEffectiveSubjectCustomFields = ({ subject, blockIndex, studentId }) => {
  const blockObjective = getSubjectBlockObjective(subject, blockIndex);
  const studentOverride = blockObjective?.student_overrides?.[studentId];

  if (Array.isArray(studentOverride?.custom_fields) && studentOverride.custom_fields.length > 0) {
    return cloneArray(studentOverride.custom_fields);
  }

  if (Array.isArray(blockObjective?.custom_fields) && blockObjective.custom_fields.length > 0) {
    return cloneArray(blockObjective.custom_fields);
  }

  return cloneArray(subject?.custom_fields);
};

export const inferLegacySubjectWeeklyBlockCategory = ({ subject, blockIndex, studentId }) => (
  getEffectiveSubjectInstruction({ subject, blockIndex, studentId })
    ? WeeklyBlockCategories.LESSON
    : WeeklyBlockCategories.PRACTICE
);

export const inferLegacySubjectCompletionMode = ({ subject, blockIndex, studentId }) => {
  const hasCustomFieldRequirements = getEffectiveSubjectCustomFields({ subject, blockIndex, studentId }).length > 0;
  const requiresSummary = subject?.require_input !== false;

  return hasCustomFieldRequirements || requiresSummary
    ? WeeklyBlockCompletionModes.HYBRID
    : WeeklyBlockCompletionModes.TIME_BOXED;
};

export const buildLegacySubjectTemplateSeed = (subject) => ({
  ...buildLegacySubjectReferences(subject),
  parent_id: subject?.parent_id || '',
  title: subject?.title || '',
  subject_area: subject?.title || '',
  curriculum_mode: 'manual_recurring',
  default_block_count: getSubjectBlockCount(subject),
  default_block_length: getSubjectBlockLengthMinutes(subject),
  default_category: hasGuidedObjective(subject)
    ? WeeklyBlockCategories.LESSON
    : WeeklyBlockCategories.PRACTICE,
  default_completion_mode: subject?.require_input !== false || cloneArray(subject?.custom_fields).length > 0
    ? WeeklyBlockCompletionModes.HYBRID
    : WeeklyBlockCompletionModes.TIME_BOXED,
  color: subject?.color || DEFAULT_SUBJECT_COLOR,
  require_timer: Boolean(subject?.require_timer),
  require_input: subject?.require_input !== false,
  resources: cloneArray(subject?.resources),
  custom_fields: cloneArray(subject?.custom_fields),
  block_objectives: cloneCompatValue(subject?.block_objectives || {}),
  is_active: subject?.is_active !== false,
});

export const buildLegacySubjectAssignmentSeed = ({ subject, studentId }) => ({
  ...buildLegacySubjectReferences(subject),
  parent_id: subject?.parent_id || '',
  student_id: studentId,
  title: subject?.title || '',
  assignment_mode: 'weekly_custom',
  status: subject?.is_active === false ? 'paused' : 'active',
  weekly_block_count: getSubjectBlockCount(subject),
  block_length: getSubjectBlockLengthMinutes(subject),
  default_category: hasGuidedObjective(subject)
    ? WeeklyBlockCategories.LESSON
    : WeeklyBlockCategories.PRACTICE,
  default_completion_mode: subject?.require_input !== false || cloneArray(subject?.custom_fields).length > 0
    ? WeeklyBlockCompletionModes.HYBRID
    : WeeklyBlockCompletionModes.TIME_BOXED,
  color: subject?.color || DEFAULT_SUBJECT_COLOR,
  require_timer: Boolean(subject?.require_timer),
  require_input: subject?.require_input !== false,
  resources: cloneArray(subject?.resources),
  custom_fields: cloneArray(subject?.custom_fields),
  block_objectives: cloneCompatValue(subject?.block_objectives || {}),
});

export const buildLegacySubjectWeeklyBlockSeeds = ({ subject, studentId }) => {
  const totalBlocks = getSubjectBlockCount(subject);
  const blockLength = getSubjectBlockLengthMinutes(subject);

  return Array.from({ length: totalBlocks }, (_, blockIndex) => ({
    ...buildLegacySubjectReferences(subject),
    student_id: studentId,
    title: subject?.title || '',
    color: subject?.color || DEFAULT_SUBJECT_COLOR,
    planned_duration_minutes: blockLength,
    category: inferLegacySubjectWeeklyBlockCategory({ subject, blockIndex, studentId }),
    completion_mode: inferLegacySubjectCompletionMode({ subject, blockIndex, studentId }),
    require_timer: Boolean(subject?.require_timer),
    require_input: subject?.require_input !== false,
    instruction: getEffectiveSubjectInstruction({ subject, blockIndex, studentId }) || '',
    resources: cloneArray(subject?.resources),
    custom_fields: getEffectiveSubjectCustomFields({ subject, blockIndex, studentId }),
    legacy_block_index: blockIndex,
  }));
};

export const derivePlanningInputsFromLegacySubject = (subject) => {
  const curriculumTemplate = buildLegacySubjectTemplateSeed(subject);

  return getAssignedStudentIdsFromSubject(subject).map((studentId) => ({
    student_id: studentId,
    curriculum_template: curriculumTemplate,
    assignment: buildLegacySubjectAssignmentSeed({ subject, studentId }),
    weekly_blocks: buildLegacySubjectWeeklyBlockSeeds({ subject, studentId }),
  }));
};

export const derivePlanningInputsFromLegacySubjects = (subjects) => (
  (Array.isArray(subjects) ? subjects : []).flatMap((subject) => derivePlanningInputsFromLegacySubject(subject))
);
