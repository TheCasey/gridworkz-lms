import {
  WeeklyBlockCategories,
  WeeklyBlockCompletionModes,
} from '../constants/schema.js';

const DEFAULT_SUBJECT_BLOCK_COUNT = 10;
const DEFAULT_SUBJECT_BLOCK_LENGTH = 30;
const DEFAULT_SUBJECT_COLOR = '#3B82F6';
const DEFAULT_CURRICULUM_BLOCK_TYPE = 'standard';

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
  Array.isArray(subject?.curriculum_blocks)
    ? (
      subject?.default_block_quantities
      && typeof subject.default_block_quantities === 'object'
      && !Array.isArray(subject.default_block_quantities)
      && Object.keys(subject.default_block_quantities).length > 0
        ? Object.values(subject.default_block_quantities).reduce((total, quantity) => (
          total + Math.max(0, Number.parseInt(quantity, 10) || 0)
        ), 0)
        : subject.curriculum_blocks.reduce((total, block) => (
          total + Math.max(0, Number.parseInt(block?.default_quantity, 10) || 0)
        ), 0)
    )
    : toPositiveInt(subject?.block_count, DEFAULT_SUBJECT_BLOCK_COUNT)
);

export const getSubjectBlockLengthMinutes = (subject) => (
  toPositiveInt(subject?.block_length ?? subject?.block_duration, DEFAULT_SUBJECT_BLOCK_LENGTH)
);

export const normalizeSubjectCurriculumBlock = (block = {}, index = 0) => {
  const title = isNonEmptyString(block?.title)
    ? block.title.trim()
    : `Block ${index + 1}`;
  const defaultQuantity = Number.parseInt(block?.default_quantity, 10);

  return {
    id: isNonEmptyString(block?.id) ? block.id.trim() : `block_${index + 1}`,
    title,
    type: isNonEmptyString(block?.type) ? block.type.trim() : DEFAULT_CURRICULUM_BLOCK_TYPE,
    instruction: isNonEmptyString(block?.instruction) ? block.instruction.trim() : '',
    resources: cloneArray(block?.resources),
    require_timer: typeof block?.require_timer === 'boolean' ? block.require_timer : null,
    require_input: typeof block?.require_input === 'boolean' ? block.require_input : null,
    custom_fields: cloneArray(block?.custom_fields),
    default_quantity: Number.isFinite(defaultQuantity) && defaultQuantity >= 0 ? defaultQuantity : 0,
    pinned: block?.pinned !== false,
  };
};

export const getSubjectCurriculumBlocks = (subject) => {
  if (Array.isArray(subject?.curriculum_blocks)) {
    return subject.curriculum_blocks.map(normalizeSubjectCurriculumBlock);
  }

  const totalBlocks = getSubjectBlockCount(subject);

  return Array.from({ length: totalBlocks }, (_, blockIndex) => {
    const objective = getSubjectBlockObjective(subject, blockIndex) || {};
    return normalizeSubjectCurriculumBlock({
      id: `legacy_${blockIndex + 1}`,
      title: isNonEmptyString(objective?.instruction)
        ? `Block ${blockIndex + 1}`
        : `${subject?.title || 'Subject'} block`,
      type: DEFAULT_CURRICULUM_BLOCK_TYPE,
      instruction: objective?.instruction || '',
      resources: cloneArray(subject?.resources),
      require_timer: Boolean(subject?.require_timer),
      require_input: subject?.require_input !== false,
      custom_fields: objective?.custom_fields || [],
      default_quantity: 1,
      pinned: blockIndex < 2 || isNonEmptyString(objective?.instruction),
    }, blockIndex);
  });
};

export const getSubjectDefaultBlockQuantities = (subject) => {
  if (
    subject?.default_block_quantities
    && typeof subject.default_block_quantities === 'object'
    && !Array.isArray(subject.default_block_quantities)
    && Object.keys(subject.default_block_quantities).length > 0
  ) {
    return Object.fromEntries(
      Object.entries(subject.default_block_quantities).map(([blockId, quantity]) => [
        blockId,
        Math.max(0, Number.parseInt(quantity, 10) || 0),
      ])
    );
  }

  return Object.fromEntries(
    getSubjectCurriculumBlocks(subject).map((block) => [
      block.id,
      Math.max(0, Number.parseInt(block.default_quantity, 10) || 0),
    ])
  );
};

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
  const blockLength = getSubjectBlockLengthMinutes(subject);
  const curriculumBlocks = getSubjectCurriculumBlocks(subject);
  const defaultQuantities = getSubjectDefaultBlockQuantities(subject);
  const blockDefinitions = curriculumBlocks.flatMap((block, blockDefinitionIndex) => (
    Array.from({ length: Math.max(0, Number.parseInt(defaultQuantities[block.id], 10) || 0) }, (_, occurrenceIndex) => ({
      block,
      blockDefinitionIndex,
      occurrenceIndex,
    }))
  ));
  const fallbackDefinitions = blockDefinitions.length > 0 || Array.isArray(subject?.curriculum_blocks)
    ? blockDefinitions
    : Array.from({ length: getSubjectBlockCount(subject) }, (_, blockIndex) => ({
      block: normalizeSubjectCurriculumBlock({
        id: `legacy_${blockIndex + 1}`,
        title: `${subject?.title || 'Subject'} block`,
        resources: cloneArray(subject?.resources),
        require_timer: Boolean(subject?.require_timer),
        require_input: subject?.require_input !== false,
        default_quantity: 1,
      }, blockIndex),
      blockDefinitionIndex: blockIndex,
      occurrenceIndex: 0,
    }));

  return fallbackDefinitions.map(({ block, blockDefinitionIndex, occurrenceIndex }, blockIndex) => {
    const customFields = block.custom_fields?.length
      ? cloneArray(block.custom_fields)
      : getEffectiveSubjectCustomFields({ subject, blockIndex: blockDefinitionIndex, studentId });
    const requireInput = typeof block.require_input === 'boolean'
      ? block.require_input
      : subject?.require_input !== false;

    return {
      ...buildLegacySubjectReferences(subject),
      student_id: studentId,
      title: block.title || subject?.title || '',
      color: subject?.color || DEFAULT_SUBJECT_COLOR,
      planned_duration_minutes: blockLength,
      category: block.type === 'project'
        ? WeeklyBlockCategories.PROJECT_WORK
        : block.type === 'test'
          ? WeeklyBlockCategories.ASSESSMENT
          : inferLegacySubjectWeeklyBlockCategory({ subject, blockIndex: blockDefinitionIndex, studentId }),
      completion_mode: requireInput || customFields.length
        ? WeeklyBlockCompletionModes.HYBRID
        : WeeklyBlockCompletionModes.TIME_BOXED,
      require_timer: typeof block.require_timer === 'boolean' ? block.require_timer : Boolean(subject?.require_timer),
      require_input: requireInput,
      instruction: block.instruction || getEffectiveSubjectInstruction({ subject, blockIndex: blockDefinitionIndex, studentId }) || '',
      resources: block.resources?.length ? cloneArray(block.resources) : cloneArray(subject?.resources),
      custom_fields: customFields,
      legacy_block_index: blockIndex,
      curriculum_block_id: block.id,
      curriculum_block_title: block.title,
      curriculum_block_type: block.type,
      curriculum_block_source_index: blockDefinitionIndex,
      curriculum_block_occurrence: occurrenceIndex,
    };
  });
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
