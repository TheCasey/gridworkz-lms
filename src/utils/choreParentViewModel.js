import {
  ChoreCompletionStatuses,
  ChoreFrequencyPools,
} from '../constants/schema.js';
import {
  AllowancePaidStatuses,
  calculateAllowanceBalance,
  DEFAULT_ALLOWANCE_POLICY,
  normalizeAllowancePolicy,
  resolveAllowancePeriod,
} from './allowanceUtils.js';
import {
  DEFAULT_CHORE_SETTINGS,
  countAvailableChoreBlocksForStudent,
  getChoreAvailability,
  getRoutinePeriod,
  isStudentEligibleForChore,
  resolveRoutineTemplatesForStudent,
} from './choreUtils.js';
import {
  buildDateFromTimeZoneParts,
  getCurrentWeekRange,
  getDateTimePartsInTimeZone,
  getWeekConfig,
} from './weekUtils.js';

const ACTIVE_COMPLETION_STATUSES = new Set([
  ChoreCompletionStatuses.COMPLETED,
  ChoreCompletionStatuses.APPROVED,
]);

const DEFAULT_TIMEZONE = 'America/Chicago';

const trimString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const toComparableDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === 'function') {
    const resolved = value.toDate();
    return Number.isNaN(resolved?.getTime?.()) ? null : resolved;
  }

  const resolved = new Date(value);
  return Number.isNaN(resolved.getTime()) ? null : resolved;
};

const toBoundedInteger = (value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

const toBoolean = (value, fallback = false) => (
  typeof value === 'boolean' ? value : fallback
);

const toMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100) / 100;
};

const toStringArray = (value) => (
  Array.isArray(value)
    ? Array.from(new Set(value.map((entry) => trimString(entry)).filter(Boolean)))
    : []
);

const sortByTimestampDesc = (records = [], ...fields) => (
  [...(Array.isArray(records) ? records : [])].sort((left, right) => {
    const leftDate = fields.map((field) => toComparableDate(left?.[field])).find(Boolean);
    const rightDate = fields.map((field) => toComparableDate(right?.[field])).find(Boolean);
    return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
  })
);

const getMonthRange = (referenceDate = new Date(), timezone = '') => {
  const parts = getDateTimePartsInTimeZone(referenceDate, timezone);
  const monthStart = buildDateFromTimeZoneParts({
    year: parts.year,
    month: parts.month,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  }, timezone);
  const nextMonthStart = parts.month === 12
    ? buildDateFromTimeZoneParts({
        year: parts.year + 1,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      }, timezone)
    : buildDateFromTimeZoneParts({
        year: parts.year,
        month: parts.month + 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      }, timezone);

  return {
    monthStart,
    monthEnd: new Date(nextMonthStart.getTime() - 1),
  };
};

const isWithinRange = (value, start, end) => {
  const date = toComparableDate(value);
  if (!date) {
    return false;
  }

  return date >= start && date <= end;
};

const getChecklistItemId = (item = {}, index = 0) => (
  trimString(item.id) || `item_${index + 1}`
);

const getStudentLookup = (students = []) => new Map(
  (Array.isArray(students) ? students : []).map((student) => [student.id, student])
);

const getQuotaForStudent = (quotaMap = {}, studentId) => {
  const source = quotaMap?.[studentId] || {};

  return {
    required_routine_days: toBoundedInteger(source.required_routine_days, { fallback: 0 }),
    required_weekly_chore_blocks: toBoundedInteger(source.required_weekly_chore_blocks, { fallback: 0 }),
    required_monthly_chore_blocks: toBoundedInteger(source.required_monthly_chore_blocks, { fallback: 0 }),
  };
};

const buildEligibilityLabel = ({ allStudentsEligible, studentNames }) => {
  if (allStudentsEligible || !studentNames.length) {
    return 'All students';
  }

  return studentNames.join(', ');
};

const getPoolRequiredKey = (pool) => (
  pool === ChoreFrequencyPools.MONTHLY
    ? 'required_monthly_chore_blocks'
    : 'required_weekly_chore_blocks'
);

const runMaxFlow = ({ chores = [], studentIds = [], capacitiesByStudent = {} } = {}) => {
  const graph = new Map();
  const residual = new Map();
  const source = '__source__';
  const sink = '__sink__';

  const ensureNode = (node) => {
    if (!graph.has(node)) {
      graph.set(node, new Set());
    }
  };

  const edgeKey = (from, to) => `${from}__${to}`;

  const addEdge = (from, to, capacity) => {
    ensureNode(from);
    ensureNode(to);
    graph.get(from).add(to);
    graph.get(to).add(from);
    residual.set(edgeKey(from, to), capacity);
    if (!residual.has(edgeKey(to, from))) {
      residual.set(edgeKey(to, from), 0);
    }
  };

  chores.forEach((chore) => {
    addEdge(source, `chore:${chore.id}`, 1);
    chore.eligible_student_ids.forEach((studentId) => {
      addEdge(`chore:${chore.id}`, `student:${studentId}`, 1);
    });
  });

  studentIds.forEach((studentId) => {
    addEdge(`student:${studentId}`, sink, capacitiesByStudent[studentId] || 0);
  });

  const visited = new Set();

  const dfs = (node, flow) => {
    if (node === sink) {
      return flow;
    }

    visited.add(node);
    const neighbors = Array.from(graph.get(node) || []);

    for (const neighbor of neighbors) {
      const residualCapacity = residual.get(edgeKey(node, neighbor)) || 0;
      if (visited.has(neighbor) || residualCapacity <= 0) {
        continue;
      }

      const nextFlow = dfs(neighbor, Math.min(flow, residualCapacity));
      if (nextFlow > 0) {
        residual.set(edgeKey(node, neighbor), residualCapacity - nextFlow);
        residual.set(edgeKey(neighbor, node), (residual.get(edgeKey(neighbor, node)) || 0) + nextFlow);
        return nextFlow;
      }
    }

    return 0;
  };

  let totalFlow = 0;
  let flow = Number.MAX_SAFE_INTEGER;

  while (flow > 0) {
    visited.clear();
    flow = dfs(source, Number.MAX_SAFE_INTEGER);
    if (!flow) {
      break;
    }
    totalFlow += flow;
  }

  return totalFlow;
};

const buildQuotaWarnings = ({
  students = [],
  choreDefinitions = [],
  choreClaims = [],
  choreCompletions = [],
  weekConfig = {},
  claimExpirationHours = DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
  quotas = {},
  now = new Date(),
} = {}) => {
  const activeStudents = (Array.isArray(students) ? students : []).filter((student) => student?.id);
  const warnings = [];

  [ChoreFrequencyPools.WEEKLY, ChoreFrequencyPools.MONTHLY].forEach((pool) => {
    const relevantChores = (Array.isArray(choreDefinitions) ? choreDefinitions : [])
      .filter((definition) => definition?.is_active !== false && definition?.frequency_pool === pool);
    const capacitiesByStudent = Object.fromEntries(
      activeStudents.map((student) => {
        const quota = getQuotaForStudent(quotas, student.id);
        return [student.id, quota[getPoolRequiredKey(pool)]];
      })
    );
    const studentIdsNeedingCapacity = activeStudents
      .map((student) => student.id)
      .filter((studentId) => capacitiesByStudent[studentId] > 0);

    if (!studentIdsNeedingCapacity.length) {
      return;
    }

    const choresWithEligibility = relevantChores.map((definition) => {
      const eligibleStudentIds = activeStudents
        .filter((student) => getChoreAvailability({
          choreDefinition: definition,
          studentId: student.id,
          claims: choreClaims,
          completions: choreCompletions,
          now,
          weekConfig,
          claimExpirationHours,
        }).is_available)
        .map((student) => student.id);

      return {
        id: definition.id || '',
        title: trimString(definition.title),
        eligible_student_ids: eligibleStudentIds,
      };
    }).filter((definition) => definition.id && definition.eligible_student_ids.length > 0);

    activeStudents.forEach((student) => {
      const availableCounts = countAvailableChoreBlocksForStudent({
        choreDefinitions: relevantChores,
        studentId: student.id,
        claims: choreClaims,
        completions: choreCompletions,
        now,
        weekConfig,
        claimExpirationHours,
      });
      const requiredBlocks = capacitiesByStudent[student.id];
      const availableBlocks = pool === ChoreFrequencyPools.MONTHLY
        ? availableCounts.monthly
        : availableCounts.weekly;

      if (requiredBlocks > availableBlocks) {
        warnings.push({
          id: `${pool}:${student.id}:individual`,
          tone: 'warning',
          type: 'individual_capacity',
          pool,
          student_ids: [student.id],
          title: `${student.name} does not have enough ${pool} chore capacity`,
          message: `${student.name} needs ${requiredBlocks} ${pool} block${requiredBlocks === 1 ? '' : 's'}, but only ${availableBlocks} active option${availableBlocks === 1 ? '' : 's'} are currently available.`,
        });
      }
    });

    const requiredTotal = studentIdsNeedingCapacity.reduce(
      (sum, studentId) => sum + capacitiesByStudent[studentId],
      0
    );
    const matchedTotal = runMaxFlow({
      chores: choresWithEligibility,
      studentIds: studentIdsNeedingCapacity,
      capacitiesByStudent,
    });

    if (matchedTotal < requiredTotal) {
      const impactedNames = activeStudents
        .filter((student) => studentIdsNeedingCapacity.includes(student.id))
        .map((student) => student.name);

      warnings.push({
        id: `${pool}:shared_capacity`,
        tone: 'accent',
        type: 'shared_capacity',
        pool,
        student_ids: studentIdsNeedingCapacity,
        title: `${pool === ChoreFrequencyPools.MONTHLY ? 'Monthly' : 'Weekly'} pool pressure`,
        message: `The active ${pool} pool can satisfy ${matchedTotal} of ${requiredTotal} required block${requiredTotal === 1 ? '' : 's'} across ${impactedNames.join(', ')}. This warning is advisory and will not block saving.`,
      });
    }
  });

  return warnings;
};

const buildRoutineCards = ({ routineTemplates = [], routineCompletions = [], studentLookup } = {}) => {
  const completionCounts = (Array.isArray(routineCompletions) ? routineCompletions : []).reduce(
    (counts, completion) => ({
      ...counts,
      [completion.routine_template_id]: (counts[completion.routine_template_id] || 0) + 1,
    }),
    {}
  );

  return (Array.isArray(routineTemplates) ? routineTemplates : []).map((template) => {
    const studentIds = toStringArray(template.student_ids);
    const studentNames = studentIds
      .map((studentId) => studentLookup.get(studentId)?.name)
      .filter(Boolean);

    return {
      id: template.id || '',
      title: trimString(template.title),
      is_active: template.is_active !== false,
      counts_toward_allowance: toBoolean(template.counts_toward_allowance, false),
      checklist_count: Array.isArray(template.checklist_items)
        ? template.checklist_items.filter((item) => trimString(item?.label)).length
        : 0,
      student_ids: studentIds,
      student_names: studentNames,
      assignment_label: buildEligibilityLabel({
        allStudentsEligible: studentIds.length === 0,
        studentNames,
      }),
      completion_count: completionCounts[template.id] || 0,
      updated_at: toComparableDate(template.updated_at || template.created_at),
    };
  });
};

const buildChoreCards = ({ choreDefinitions = [], students = [], studentLookup } = {}) => (
  (Array.isArray(choreDefinitions) ? choreDefinitions : []).map((definition) => {
    const eligibleStudentIds = toBoolean(definition.all_students_eligible, false)
      ? students.map((student) => student.id)
      : toStringArray(definition.eligible_student_ids);
    const studentNames = eligibleStudentIds
      .map((studentId) => studentLookup.get(studentId)?.name)
      .filter(Boolean);

    return {
      id: definition.id || '',
      title: trimString(definition.title),
      frequency_pool: definition.frequency_pool || ChoreFrequencyPools.WEEKLY,
      is_active: definition.is_active !== false,
      all_students_eligible: toBoolean(definition.all_students_eligible, false),
      eligible_student_ids: eligibleStudentIds,
      eligibility_label: buildEligibilityLabel({
        allStudentsEligible: toBoolean(definition.all_students_eligible, false),
        studentNames,
      }),
      instructions: trimString(definition.instructions),
      definition_of_done: trimString(definition.definition_of_done),
      proof_requirement: trimString(definition.proof_requirement),
      effort_label: trimString(definition.effort_label),
      minimum_cooldown_days: toBoundedInteger(definition.minimum_cooldown_days, { fallback: 0 }),
      requires_parent_approval: definition.requires_parent_approval === true,
      updated_at: toComparableDate(definition.updated_at || definition.created_at),
    };
  })
);

const buildPendingReviewCards = ({ choreCompletions = [], choreLookup, studentLookup } = {}) => (
  sortByTimestampDesc(
    (Array.isArray(choreCompletions) ? choreCompletions : [])
      .filter((completion) => completion?.status === ChoreCompletionStatuses.COMPLETED)
      .map((completion) => {
        const chore = choreLookup.get(completion.chore_definition_id) || null;
        const student = studentLookup.get(completion.student_id) || null;

        return {
          id: completion.id || '',
          completion_id: completion.id || '',
          chore_definition_id: completion.chore_definition_id || '',
          chore_title: trimString(chore?.title) || 'Archived chore',
          student_id: completion.student_id || '',
          student_name: trimString(student?.name) || 'Unknown student',
          frequency_pool: chore?.frequency_pool || ChoreFrequencyPools.WEEKLY,
          proof_note: trimString(completion.proof_note),
          review_note: trimString(completion.review_note),
          status: completion.status || ChoreCompletionStatuses.COMPLETED,
          quota_blocks: toBoundedInteger(completion.quota_blocks, { min: 0, fallback: 1 }),
          completed_at: toComparableDate(completion.completed_at || completion.created_at),
          chore_is_archived: chore?.is_active === false,
          requires_parent_approval: chore?.requires_parent_approval === true,
        };
      }),
    'completed_at',
    'created_at',
    'updated_at'
  )
);

const buildProgressCards = ({
  students = [],
  routineTemplates = [],
  routineCompletions = [],
  choreDefinitions = [],
  choreClaims = [],
  choreCompletions = [],
  quotas = {},
  weekConfig = {},
  claimExpirationHours = DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
  now = new Date(),
} = {}) => {
  const { weekStart, weekEnd } = getCurrentWeekRange(now, weekConfig);
  const { monthStart, monthEnd } = getMonthRange(now, weekConfig.timezone);
  const choreLookup = new Map((Array.isArray(choreDefinitions) ? choreDefinitions : []).map((definition) => [definition.id, definition]));

  return (Array.isArray(students) ? students : []).map((student) => {
    const studentQuota = getQuotaForStudent(quotas, student.id);
    const availableCounts = countAvailableChoreBlocksForStudent({
      choreDefinitions,
      studentId: student.id,
      claims: choreClaims,
      completions: choreCompletions,
      now,
      weekConfig,
      claimExpirationHours,
    });
    const effectiveRoutineTemplates = resolveRoutineTemplatesForStudent({
      routineTemplates,
      studentId: student.id,
    });
    const routineCompletionIdsByDay = new Map();
    (Array.isArray(routineCompletions) ? routineCompletions : [])
      .filter((completion) => (
        completion?.student_id === student.id
        && isWithinRange(completion.completed_at || completion.created_at, weekStart, weekEnd)
      ))
      .forEach((completion) => {
        const dateKey = trimString(completion.date_key);
        if (!dateKey) return;
        const completedIds = routineCompletionIdsByDay.get(dateKey) || new Set();
        completedIds.add(trimString(completion.routine_template_id));
        routineCompletionIdsByDay.set(dateKey, completedIds);
      });
    const routineDays = new Set(
      effectiveRoutineTemplates.length > 0
        ? [...routineCompletionIdsByDay.entries()]
          .filter(([, completedIds]) => (
            effectiveRoutineTemplates.every((template) => completedIds.has(trimString(template.id)))
          ))
          .map(([dateKey]) => dateKey)
        : []
    );
    const weeklyCompleted = (Array.isArray(choreCompletions) ? choreCompletions : []).reduce((sum, completion) => {
      if (completion?.student_id !== student.id || !ACTIVE_COMPLETION_STATUSES.has(completion?.status)) {
        return sum;
      }

      const definition = choreLookup.get(completion.chore_definition_id);
      if (!definition || definition.frequency_pool !== ChoreFrequencyPools.WEEKLY) {
        return sum;
      }

      if (!isWithinRange(completion.completed_at || completion.created_at, weekStart, weekEnd)) {
        return sum;
      }

      return sum + toBoundedInteger(completion.quota_blocks, { min: 0, fallback: 1 });
    }, 0);
    const monthlyCompleted = (Array.isArray(choreCompletions) ? choreCompletions : []).reduce((sum, completion) => {
      if (completion?.student_id !== student.id || !ACTIVE_COMPLETION_STATUSES.has(completion?.status)) {
        return sum;
      }

      const definition = choreLookup.get(completion.chore_definition_id);
      if (!definition || definition.frequency_pool !== ChoreFrequencyPools.MONTHLY) {
        return sum;
      }

      if (!isWithinRange(completion.completed_at || completion.created_at, monthStart, monthEnd)) {
        return sum;
      }

      return sum + toBoundedInteger(completion.quota_blocks, { min: 0, fallback: 1 });
    }, 0);
    const pendingReviewCount = (Array.isArray(choreCompletions) ? choreCompletions : []).filter(
      (completion) => completion?.student_id === student.id && completion?.status === ChoreCompletionStatuses.COMPLETED
    ).length;
    const routineCount = new Set(effectiveRoutineTemplates.map(getRoutinePeriod)).size;

    return {
      student_id: student.id,
      student_name: trimString(student.name) || 'Student',
      quotas: studentQuota,
      progress: {
        routine_days_completed: routineDays.size,
        weekly_blocks_completed: weeklyCompleted,
        monthly_blocks_completed: monthlyCompleted,
      },
      available_counts: availableCounts,
      pending_review_count: pendingReviewCount,
      active_routine_count: routineCount,
    };
  });
};

const buildAllowanceOverview = ({
  students = [],
  studentLookup,
  choreSettings = {},
  allowancePeriods = [],
  parentSettings = {},
  now = new Date(),
} = {}) => {
  const allowancePolicy = normalizeAllowancePolicy(choreSettings.allowance_policy || DEFAULT_ALLOWANCE_POLICY);
  const period = resolveAllowancePeriod({
    referenceDate: now,
    allowancePolicy,
    weekConfig: {
      ...DEFAULT_CHORE_SETTINGS,
      ...parentSettings,
      ...choreSettings,
    },
  });
  const currentPeriodLookup = new Map(
    (Array.isArray(allowancePeriods) ? allowancePeriods : [])
      .filter((record) => (
        record?.period_type === period.period_type &&
        record?.period_key === period.period_key
      ))
      .map((record) => [record.student_id, record])
  );
  const cards = (Array.isArray(students) ? students : [])
    .filter((student) => student?.id)
    .map((student) => {
      const record = currentPeriodLookup.get(student.id) || null;
      const balance = calculateAllowanceBalance({
        calculatedEarnedAmount: record?.calculated_earned_amount || 0,
        parentAdjustmentAmount: record?.parent_adjustment_amount || 0,
        paidAmount: record?.paid_amount || 0,
      });

      return {
        id: record?.id || `${student.id}_${period.period_type}_${period.period_key}`,
        student_id: student.id,
        student_name: trimString(studentLookup.get(student.id)?.name || student.name) || 'Student',
        period_type: period.period_type,
        period_key: period.period_key,
        period_label: period.period_label,
        period_start: toComparableDate(record?.period_start || period.period_start),
        period_end: toComparableDate(record?.period_end || period.period_end),
        allowance_amount: record?.policy_snapshot?.allowance_amount ?? allowancePolicy.allowance_amount,
        completion_policy: record?.policy_snapshot?.completion_policy || allowancePolicy.completion_policy,
        include_routines: record?.policy_snapshot?.include_routines ?? allowancePolicy.include_routines,
        required_counts: record?.required_counts || {
          routine_days: 0,
          weekly_chore_blocks: 0,
          monthly_chore_blocks: 0,
          total_blocks: 0,
        },
        completed_counts: record?.completed_counts || {
          routine_days: 0,
          weekly_chore_blocks: 0,
          monthly_chore_blocks: 0,
          total_blocks: 0,
          completion_ratio: 0,
        },
        calculated_earned_amount: toMoney(record?.calculated_earned_amount || 0),
        parent_adjustment_amount: toMoney(record?.parent_adjustment_amount || 0),
        paid_amount: toMoney(record?.paid_amount || 0),
        paid_status: record?.paid_status || (record ? balance.paid_status : AllowancePaidStatuses.UNPAID),
        paid_at: toComparableDate(record?.paid_at),
        adjusted_earned_amount: toMoney(record?.adjusted_earned_amount ?? balance.adjusted_earned_amount),
        remaining_amount: toMoney(record?.remaining_amount ?? balance.remaining_amount),
        completion_ratio: Number(record?.completed_counts?.completion_ratio || 0),
        is_missing: !record,
      };
    })
    .sort((left, right) => left.student_name.localeCompare(right.student_name));
  const summary = cards.reduce((totals, card) => ({
    synced_count: totals.synced_count + (card.is_missing ? 0 : 1),
    calculated_total: toMoney(totals.calculated_total + card.calculated_earned_amount),
    adjusted_total: toMoney(totals.adjusted_total + card.adjusted_earned_amount),
    paid_total: toMoney(totals.paid_total + card.paid_amount),
    remaining_total: toMoney(totals.remaining_total + card.remaining_amount),
    paid_count: totals.paid_count + (card.paid_status === AllowancePaidStatuses.PAID ? 1 : 0),
    unpaid_count: totals.unpaid_count + (card.remaining_amount > 0 ? 1 : 0),
  }), {
    synced_count: 0,
    calculated_total: 0,
    adjusted_total: 0,
    paid_total: 0,
    remaining_total: 0,
    paid_count: 0,
    unpaid_count: 0,
  });

  return {
    policy: allowancePolicy,
    current_period: period,
    cards,
    summary: {
      ...summary,
      student_count: cards.length,
      unsynced_count: cards.length - summary.synced_count,
    },
  };
};

export const createDefaultRoutineTemplateDraft = () => ({
  id: '',
  title: '',
  routine_period: '',
  assign_to_all_students: true,
  student_ids: [],
  checklist_items: [
    { id: 'item_1', label: '' },
  ],
  counts_toward_allowance: false,
  counts_toward_points: false,
  is_active: true,
});

export const createDefaultChoreDefinitionDraft = (frequencyPool = ChoreFrequencyPools.WEEKLY) => ({
  id: '',
  title: '',
  frequency_pool: frequencyPool,
  all_students_eligible: true,
  eligible_student_ids: [],
  instructions: '',
  definition_of_done: '',
  proof_requirement: '',
  effort_label: '',
  minimum_cooldown_days: 0,
  requires_parent_approval: false,
  is_active: true,
});

export const buildRoutineTemplateDraft = (record = {}) => ({
  id: trimString(record.id),
  title: trimString(record.title),
  routine_period: trimString(record.routine_period),
  assign_to_all_students: toStringArray(record.student_ids).length === 0,
  student_ids: toStringArray(record.student_ids),
  checklist_items: Array.isArray(record.checklist_items) && record.checklist_items.length > 0
    ? record.checklist_items.map((item, index) => ({
        id: getChecklistItemId(item, index),
        label: trimString(item?.label),
      }))
    : [{ id: 'item_1', label: '' }],
  counts_toward_allowance: toBoolean(record.counts_toward_allowance, false),
  counts_toward_points: toBoolean(record.counts_toward_points, false),
  is_active: record.is_active !== false,
});

export const buildChoreDefinitionDraft = (record = {}) => ({
  id: trimString(record.id),
  title: trimString(record.title),
  frequency_pool: record.frequency_pool || ChoreFrequencyPools.WEEKLY,
  all_students_eligible: toBoolean(record.all_students_eligible, false),
  eligible_student_ids: toStringArray(record.eligible_student_ids),
  instructions: trimString(record.instructions),
  definition_of_done: trimString(record.definition_of_done),
  proof_requirement: trimString(record.proof_requirement),
  effort_label: trimString(record.effort_label),
  minimum_cooldown_days: toBoundedInteger(record.minimum_cooldown_days, {
    min: 0,
    max: 365,
    fallback: 0,
  }),
  requires_parent_approval: record.requires_parent_approval === true,
  is_active: record.is_active !== false,
});

export const buildChoreSettingsDraft = ({ choreSettings = {}, parentSettings = {}, students = [] } = {}) => {
  const weekConfig = getWeekConfig({
    ...DEFAULT_CHORE_SETTINGS,
    ...parentSettings,
    ...choreSettings,
  });

  return {
    claim_expiration_hours: toBoundedInteger(choreSettings.claim_expiration_hours, {
      min: 1,
      max: 168,
      fallback: DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
    }),
    timezone: trimString(choreSettings.timezone)
      || trimString(parentSettings.timezone)
      || DEFAULT_TIMEZONE,
    week_reset_day: weekConfig.resetDay,
    week_reset_hour: weekConfig.resetHour,
    week_reset_minute: weekConfig.resetMinute,
    allowance_policy: normalizeAllowancePolicy(choreSettings.allowance_policy),
    quotas: Object.fromEntries(
      (Array.isArray(students) ? students : []).map((student) => [
        student.id,
        getQuotaForStudent(choreSettings.quotas, student.id),
      ])
    ),
  };
};

export const normalizeRoutineTemplateDraft = (draft = {}) => ({
  id: trimString(draft.id),
  title: trimString(draft.title),
  routine_period: ['morning', 'afternoon', 'evening'].includes(trimString(draft.routine_period).toLowerCase())
    ? trimString(draft.routine_period).toLowerCase()
    : '',
  student_ids: draft.assign_to_all_students
    ? []
    : toStringArray(draft.student_ids),
  checklist_items: (Array.isArray(draft.checklist_items) ? draft.checklist_items : [])
    .map((item, index) => ({
      id: getChecklistItemId(item, index),
      label: trimString(item?.label),
    }))
    .filter((item) => item.label),
  counts_toward_allowance: toBoolean(draft.counts_toward_allowance, false),
  counts_toward_points: toBoolean(draft.counts_toward_points, false),
  is_active: draft.is_active !== false,
});

export const normalizeChoreDefinitionDraft = (draft = {}) => ({
  id: trimString(draft.id),
  title: trimString(draft.title),
  frequency_pool: draft.frequency_pool === ChoreFrequencyPools.MONTHLY
    ? ChoreFrequencyPools.MONTHLY
    : ChoreFrequencyPools.WEEKLY,
  eligible_student_ids: draft.all_students_eligible
    ? []
    : toStringArray(draft.eligible_student_ids),
  all_students_eligible: draft.all_students_eligible !== false,
  instructions: trimString(draft.instructions),
  definition_of_done: trimString(draft.definition_of_done),
  proof_requirement: trimString(draft.proof_requirement),
  effort_label: trimString(draft.effort_label),
  minimum_cooldown_days: toBoundedInteger(draft.minimum_cooldown_days, {
    min: 0,
    max: 365,
    fallback: 0,
  }),
  requires_parent_approval: draft.requires_parent_approval === true,
  is_active: draft.is_active !== false,
});

export const normalizeChoreSettingsDraft = ({ draft = {}, parentSettings = {}, students = [] } = {}) => {
  const normalizedWeekConfig = getWeekConfig({
    ...DEFAULT_CHORE_SETTINGS,
    ...parentSettings,
    week_reset_day: toBoundedInteger(draft.week_reset_day, { min: 0, max: 6, fallback: DEFAULT_CHORE_SETTINGS.week_reset_day }),
    week_reset_hour: toBoundedInteger(draft.week_reset_hour, { min: 0, max: 23, fallback: DEFAULT_CHORE_SETTINGS.week_reset_hour }),
    week_reset_minute: toBoundedInteger(draft.week_reset_minute, { min: 0, max: 59, fallback: DEFAULT_CHORE_SETTINGS.week_reset_minute }),
    timezone: trimString(draft.timezone),
  });

  return {
    claim_expiration_hours: toBoundedInteger(draft.claim_expiration_hours, {
      min: 1,
      max: 168,
      fallback: DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
    }),
    timezone: normalizedWeekConfig.timezone || trimString(parentSettings.timezone) || DEFAULT_TIMEZONE,
    week_reset_day: normalizedWeekConfig.resetDay,
    week_reset_hour: normalizedWeekConfig.resetHour,
    week_reset_minute: normalizedWeekConfig.resetMinute,
    allowance_policy: normalizeAllowancePolicy(draft.allowance_policy),
    quotas: Object.fromEntries(
      (Array.isArray(students) ? students : []).map((student) => [
        student.id,
        getQuotaForStudent(draft.quotas, student.id),
      ])
    ),
  };
};

export const buildParentChoreViewModel = ({
  students = [],
  parentSettings = {},
  choreSettings = {},
  routineTemplates = [],
  routineCompletions = [],
  choreDefinitions = [],
  choreClaims = [],
  choreCompletions = [],
  allowancePeriods = [],
  isLocked = false,
  now = new Date(),
} = {}) => {
  const studentLookup = getStudentLookup(students);
  const weekConfig = getWeekConfig({
    ...DEFAULT_CHORE_SETTINGS,
    ...parentSettings,
    ...choreSettings,
  });
  const claimExpirationHours = toBoundedInteger(choreSettings.claim_expiration_hours, {
    min: 1,
    max: 168,
    fallback: DEFAULT_CHORE_SETTINGS.claim_expiration_hours,
  });
  const routineCards = buildRoutineCards({
    routineTemplates,
    routineCompletions,
    studentLookup,
  });
  const choreCards = buildChoreCards({
    choreDefinitions,
    students,
    studentLookup,
  });
  const choreLookup = new Map((Array.isArray(choreDefinitions) ? choreDefinitions : []).map((definition) => [definition.id, definition]));
  const pendingReview = buildPendingReviewCards({
    choreCompletions,
    choreLookup,
    studentLookup,
  });
  const quotaWarnings = buildQuotaWarnings({
    students,
    choreDefinitions,
    choreClaims,
    choreCompletions,
    weekConfig,
    claimExpirationHours,
    quotas: choreSettings.quotas,
    now,
  });
  const progressByStudent = buildProgressCards({
    students,
    routineTemplates,
    routineCompletions,
    choreDefinitions,
    choreClaims,
    choreCompletions,
    quotas: choreSettings.quotas,
    weekConfig,
    claimExpirationHours,
    now,
  });
  const allowance = buildAllowanceOverview({
    students,
    studentLookup,
    choreSettings,
    allowancePeriods,
    parentSettings,
    now,
  });

  return {
    permissions: {
      is_read_only: Boolean(isLocked),
      can_create: !isLocked,
      can_edit: !isLocked,
      can_review: !isLocked,
    },
    summaries: {
      active_routine_count: routineCards.filter((card) => card.is_active).length,
      active_weekly_chore_count: choreCards.filter((card) => card.is_active && card.frequency_pool === ChoreFrequencyPools.WEEKLY).length,
      active_monthly_chore_count: choreCards.filter((card) => card.is_active && card.frequency_pool === ChoreFrequencyPools.MONTHLY).length,
      pending_review_count: pendingReview.length,
      quota_warning_count: quotaWarnings.length,
    },
    settings: {
      claim_expiration_hours: claimExpirationHours,
      timezone: trimString(choreSettings.timezone) || trimString(parentSettings.timezone) || DEFAULT_TIMEZONE,
      week_reset_day: weekConfig.resetDay,
      week_reset_hour: weekConfig.resetHour,
      week_reset_minute: weekConfig.resetMinute,
      allowance_policy: allowance.policy,
    },
    routines: {
      active: routineCards.filter((card) => card.is_active).sort((left, right) => left.title.localeCompare(right.title)),
      archived: routineCards.filter((card) => !card.is_active).sort((left, right) => left.title.localeCompare(right.title)),
    },
    chores: {
      weekly: {
        active: choreCards
          .filter((card) => card.is_active && card.frequency_pool === ChoreFrequencyPools.WEEKLY)
          .sort((left, right) => left.title.localeCompare(right.title)),
        archived: choreCards
          .filter((card) => !card.is_active && card.frequency_pool === ChoreFrequencyPools.WEEKLY)
          .sort((left, right) => left.title.localeCompare(right.title)),
      },
      monthly: {
        active: choreCards
          .filter((card) => card.is_active && card.frequency_pool === ChoreFrequencyPools.MONTHLY)
          .sort((left, right) => left.title.localeCompare(right.title)),
        archived: choreCards
          .filter((card) => !card.is_active && card.frequency_pool === ChoreFrequencyPools.MONTHLY)
          .sort((left, right) => left.title.localeCompare(right.title)),
      },
    },
    pending_review: pendingReview,
    progress_by_student: progressByStudent,
    quota_warnings: quotaWarnings,
    allowance,
  };
};

export const isChoreEligibleForStudent = (choreDefinition, studentId) => (
  isStudentEligibleForChore(choreDefinition, studentId)
);
