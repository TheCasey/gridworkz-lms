import { buildWeeklyPlanDraft, buildPublishedWeeklyPlan } from '../src/utils/weeklyPlanUtils.js';
import { adoptLegacyWeeklyBlockInstances, buildStudentCosmeticStateId } from '../src/utils/productDirectionContracts.js';

export const DIRECTION_PROJECT_ID = 'demo-gridworkz-direction';
export const DIRECTION_FIXTURE_PASSWORD = 'Direction-emulator-only-2026!';
// Include generated effects even when a scenario starts with no documents there.
export const DIRECTION_RESET_COLLECTIONS = Object.freeze([
  'parents', 'accountEntitlements', 'students', 'subjects', 'weeklyPlans', 'weeklyPlanDrafts',
  'studentDefaultWeeks', 'submissions', 'timerSessions', 'weeklyReports', 'weeklyReportAmendments',
  'routineTemplates', 'routineCompletions', 'routineDaySnapshots', 'choreSettings', 'choreDefinitions',
  'choreClaims', 'choreCompletions', 'allowancePeriods', 'rewardSettings', 'rewardCatalogItems',
  'rewardRedemptions', 'pointLedgerEntries', 'studentPointWallets', 'studentCosmeticStates',
  'blockCompletionStates', 'parentCorrectionEvents', 'entitlementAuditLogs',
]);
export const DIRECTION_SCENARIOS = Object.freeze({
  empty: { plan: 'free', students: 0, subjects: 0 },
  single: { plan: 'free', students: 1, subjects: 1 },
  free: { plan: 'free', students: 2, subjects: 3 },
  core: { plan: 'core', students: 11, subjects: 4 },
  lockdown: { plan: 'lockdown', students: 2, subjects: 3 },
  legacy: { plan: 'core', students: 2, subjects: 3 },
});

export const buildDirectionFixture = ({ scenario = 'free', referenceDate = new Date() } = {}) => {
  const definition = DIRECTION_SCENARIOS[scenario];
  if (!definition) throw new Error(`Unknown direction fixture scenario: ${scenario}`);
  const parentId = `direction_${scenario}`;
  const settings = { week_reset_day: 1, week_reset_hour: 0, week_reset_minute: 0, timezone: 'America/Chicago' };
  const students = Array.from({ length: definition.students }, (_, index) => ({
    id: `${parentId}_student_${index + 1}`, parent_id: parentId,
    name: `Direction ${scenario} ${index + 1}`, slug: `${scenario}-student-${index + 1}`,
    access_pin: String(1111 + index), created_at: referenceDate, updated_at: referenceDate, ...settings,
  }));
  const subjects = Array.from({ length: definition.subjects }, (_, index) => ({
    id: `${parentId}_subject_${index + 1}`, parent_id: parentId, title: `Subject ${index + 1}`,
    ...(scenario === 'legacy' && index === 0
      ? { student_id: students[0].id }
      : { student_ids: index === 1 ? students.map((student) => student.id) : [students[0].id] }),
    is_active: true, status: 'active', block_count: 2, block_length: 1, created_at: referenceDate, updated_at: referenceDate,
    require_timer: index === 0, require_input: index === 0,
    resources: [], custom_fields: [], color: '#cbb7fb',
  }));
  const documents = [
    { collection: 'parents', id: parentId, data: { parent_id: parentId, email: `${parentId}@example.test`, ...settings } },
    { collection: 'accountEntitlements', id: parentId, data: {
      parent_id: parentId, plan_id: definition.plan,
      subscription_status: definition.plan === 'free' ? null : 'active',
      feature_overrides: {}, resolution_source: 'fallback_initialized',
    } },
    ...students.map((student) => ({ collection: 'students', id: student.id, data: student })),
    ...subjects.map((subject) => ({ collection: 'subjects', id: subject.id, data: subject })),
  ];
  for (const [index, student] of students.entries()) {
    const draft = buildWeeklyPlanDraft({ parentId, studentId: student.id, subjects, referenceDate, weekConfig: settings });
    draft.blocks = adoptLegacyWeeklyBlockInstances(draft);
    const published = { ...buildPublishedWeeklyPlan(draft), schema_version: 1, revision: 1, published_at: referenceDate };
    if (published.blocks.length) {
      documents.push({ collection: 'weeklyPlans', id: draft.id, data: published });
      documents.push({ collection: 'weeklyPlanDrafts', id: draft.id, data: {
        ...draft, schema_version: 1, revision: 2, base_published_revision: 1,
        blocks: draft.blocks.slice(0, 1), updated_at: referenceDate,
      } });
    }
    for (const period of ['morning', 'afternoon', 'evening']) {
      const id = `${student.id}_${period}`;
      documents.push({ collection: 'routineTemplates', id, data: {
        id, parent_id: parentId, title: `${period} routine`, routine_period: period,
        student_ids: [student.id], checklist_items: [{ id: 'ready', label: 'Complete this routine' }],
        is_active: true, counts_toward_points: true, counts_toward_allowance: false,
      } });
    }
    documents.push({ collection: 'studentPointWallets', id: student.id, data: {
      parent_id: parentId, student_id: student.id, total_points: index === 0 ? 40 : 20, lifetime_points: 40,
    } });
    const cosmeticId = buildStudentCosmeticStateId({ parentId, studentId: student.id });
    documents.push({ collection: 'studentCosmeticStates', id: cosmeticId, data: {
      id: cosmeticId,
      schema_version: 1, parent_id: parentId, student_id: student.id,
      owned_cosmetic_ids: index === 0 ? ['direction_starlight'] : [], selected_cosmetic_ids: {}, revision: 1,
    } });
  }
  if (scenario === 'legacy') {
    documents.push({ collection: 'routineTemplates', id: `${parentId}_shared`, data: {
      parent_id: parentId, student_ids: students.map((student) => student.id), title: 'Legacy shared routine',
      checklist_items: [{ id: 'legacy', label: 'Legacy household item' }], is_active: true,
    } });
    documents.push({ collection: 'rewardRedemptions', id: `${parentId}_pending`, data: {
      parent_id: parentId, student_id: students[0].id, status: 'requested', reserved_points: 25,
    } });
    documents.push({ collection: 'allowancePeriods', id: `${parentId}_unpaid`, data: {
      parent_id: parentId, student_id: students[0].id, paid_status: 'unpaid', calculated_earned_amount: 5, paid_amount: 0,
    } });
    documents.push({ collection: 'weeklyReports', id: `${parentId}_original`, data: {
      parent_id: parentId, student_id: students[0].id, week_key: '2026-09-28', total_blocks: 1,
      assigned_blocks_snapshot: [{ id: 'legacy_block', completed: true }], report_version: 1,
      snapshot_model: 'subjects', weekly_plan_id: '',
    } });
  }
  return {
    scenario, parentId, plan: definition.plan, settings, students, subjects, documents,
    auth: { uid: parentId, email: `${parentId}@example.test`, password: DIRECTION_FIXTURE_PASSWORD },
  };
};
