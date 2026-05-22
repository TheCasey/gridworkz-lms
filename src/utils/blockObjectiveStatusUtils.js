const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

const hasConfiguredField = (field) => (
  hasText(field?.label)
);

const countConfiguredFields = (fields) => (
  Array.isArray(fields) ? fields.filter(hasConfiguredField).length : 0
);

export const getBlockObjectiveStatus = (objective) => {
  const instructionConfigured = hasText(objective?.instruction);
  const customFieldCount = countConfiguredFields(objective?.custom_fields);
  const studentOverrideCount = Object.values(objective?.student_overrides || {}).filter((override) => (
    hasText(override?.instruction) || countConfiguredFields(override?.custom_fields) > 0
  )).length;
  const configured = instructionConfigured || customFieldCount > 0 || studentOverrideCount > 0;

  return {
    configured,
    instructionConfigured,
    customFieldCount,
    studentOverrideCount,
    labels: [
      instructionConfigured ? 'Instruction' : null,
      customFieldCount > 0 ? `${customFieldCount} field${customFieldCount === 1 ? '' : 's'}` : null,
      studentOverrideCount > 0 ? `${studentOverrideCount} student${studentOverrideCount === 1 ? '' : 's'}` : null,
    ].filter(Boolean),
  };
};

export const getBlockObjectiveStatusLabel = (objective) => {
  const status = getBlockObjectiveStatus(objective);
  return status.configured ? status.labels.join(' + ') : 'Not configured';
};
