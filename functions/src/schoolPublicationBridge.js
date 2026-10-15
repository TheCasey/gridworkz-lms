// Browser-safe, immutable first-publication school authority bridge.
import { buildBlockCompletionStateId, resolveEffectiveSchoolBlockState } from './schoolCompletionFoundation.js';
const requireValue = (condition, code) => { if (!condition) { const error = new Error(code); error.code = code; throw error; } };
const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value || {}, key);
const text = (value) => typeof value === 'string' && value.length > 0 && value === value.trim() && !value.includes('/');
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : record(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
export const SCHOOL_PUBLICATION_BRIDGES = 'schoolPublicationBridges';
export const schoolExecutionContentSignature = (block) => JSON.stringify(canonical({
  assignment_id: block.assignment_id, student_id: block.student_id, legacy_subject_id: block.legacy_subject_id,
  curriculum_block_id: block.curriculum_block_id || '', title: block.title || '', instruction: block.instruction || '',
  resources: block.resources || [], custom_fields: block.custom_fields || [], category: block.category || 'lesson',
  completion_mode: block.completion_mode || 'task_complete', planned_duration_minutes: block.planned_duration_minutes || 0,
  require_timer: Boolean(block.require_timer), require_input: Boolean(block.require_input),
}));
export const validateLegacySourceLinks = (links) => {
  requireValue(record(links) && Object.keys(links).length <= 2000, 'invalid-legacy-source-links');
  requireValue(Object.entries(links).every(([target, source]) => text(target) && (source === null || text(source))), 'invalid-legacy-source-links');
  const sources = Object.values(links).filter((source) => source !== null);
  requireValue(new Set(sources).size === sources.length, 'legacy-source-reused');
  return true;
};
export const resolveSchoolPublicationLinks = ({ plan, sourceExecution = null, requestedLinks = {}, retainedLinks = {}, existingBridge = null, firstPublication = false }) => {
  validateLegacySourceLinks(requestedLinks); validateLegacySourceLinks(retainedLinks);
  const sourceBlocks = new Map((sourceExecution?.blocks || []).map((block) => [block.id, block]));
  const previous = { ...(existingBridge?.legacy_source_links || {}), ...retainedLinks };
  if (existingBridge) Object.entries(existingBridge.legacy_source_links).forEach(([id, source]) => {
    requireValue(!own(retainedLinks, id) || retainedLinks[id] === source, 'legacy-source-remap');
  });
  Object.entries(requestedLinks).forEach(([id, source]) => {
    requireValue(firstPublication && !existingBridge || !own(previous, id) || previous[id] === source, 'legacy-source-remap');
    requireValue(plan.blocks.some((block) => block.id === id) || own(previous, id), 'invalid-legacy-source-links');
  });
  const links = { ...previous, ...requestedLinks };
  plan.blocks.forEach((block) => {
    if (!own(links, block.id)) {
      const source = sourceBlocks.get(block.id);
      if (firstPublication && sourceExecution?.blocks.length) {
        requireValue(source && schoolExecutionContentSignature(source) === schoolExecutionContentSignature(block), 'legacy-link-review-required');
        links[block.id] = source.id;
      } else links[block.id] = null;
    }
    const sourceId = links[block.id];
    if (sourceId !== null && firstPublication) {
      const source = sourceBlocks.get(sourceId);
      requireValue(source && schoolExecutionContentSignature(source) === schoolExecutionContentSignature(block), 'legacy-link-review-required');
    } else if (sourceId !== null && !firstPublication) {
      requireValue(own(previous, block.id) && previous[block.id] === sourceId, 'legacy-source-remap');
    }
  });
  // A source cannot attach to a new identity later, even after its original target retires.
  if (!firstPublication) Object.entries(links).forEach(([id, source]) => requireValue(source === null || own(previous, id) && previous[id] === source, 'legacy-source-remap'));
  validateLegacySourceLinks(links);
  return links;
};
export const buildSchoolPublicationBridge = ({ plan, sourceExecution, sourceStates = [], evidence = [], legacySourceLinks, serverTime }) => {
  requireValue(plan && sourceExecution && plan.parent_id === sourceExecution.parent_id && plan.student_id === sourceExecution.student_id
    && plan.week_key === sourceExecution.week_key && sourceExecution.status === 'published'
    && (sourceExecution.authority_kind === 'legacy_execution' && sourceExecution.id === `legacy-execution:${plan.id}`
      || sourceExecution.id === plan.id && sourceExecution.authority_kind !== 'legacy_execution' && sourceExecution.school_completion_version == null), 'scope-mismatch');
  requireValue(plan.blocks.length <= 500 && sourceExecution.blocks.length <= 500 && sourceStates.length <= 1000, 'publication-bridge-size-limit');
  const links = resolveSchoolPublicationLinks({ plan, sourceExecution, requestedLinks: {}, retainedLinks: legacySourceLinks, firstPublication: true });
  Object.values(links).forEach((source) => requireValue(source === null || sourceExecution.blocks.some((block) => block.id === source), 'legacy-link-review-required'));
  const statesById = new Map(sourceStates.map((state) => [state.id, state]));
  const sourceBlocks = new Map(sourceExecution.blocks.map((block) => [block.id, block]));
  const inherited = {}; const linkedSources = {};
  plan.blocks.forEach((block) => {
    const sourceId = links[block.id]; if (sourceId === null) return;
    const sourceBlock = sourceBlocks.get(sourceId);
    const sourceStateId = buildBlockCompletionStateId({ planId: sourceExecution.id, blockId: sourceId });
    const original = resolveEffectiveSchoolBlockState({ plan: sourceExecution, block: sourceBlock, state: statesById.get(sourceStateId), evidence });
    const id = buildBlockCompletionStateId({ planId: plan.id, blockId: block.id });
    inherited[id] = { ...original, id, weekly_plan_id: plan.id, weekly_block_id: block.id, source_state_id: sourceStateId,
      source_execution_id: sourceExecution.id, source_weekly_block_id: sourceId };
    linkedSources[sourceId] = { ...sourceBlock };
  });
  const bridge = { id: plan.id, parent_id: plan.parent_id, student_id: plan.student_id, week_key: plan.week_key,
    weekly_plan_id: plan.id, source_execution_id: sourceExecution.id,
    source_kind: sourceExecution.id === plan.id ? 'published' : 'legacy_execution',
    source_revision: sourceExecution.revision ?? 0, schema_version: 1, recorded_at: serverTime,
    legacy_source_links: links, inherited_states: inherited, source_blocks: linkedSources };
  requireValue(JSON.stringify(bridge).length <= 750000, 'publication-bridge-size-limit');
  return bridge;
};
export const assertSchoolPublicationBridge = (bridge, plan) => {
  if (!bridge) return;
  requireValue(bridge.schema_version === 1 && bridge.id === plan.id && bridge.weekly_plan_id === plan.id
    && bridge.parent_id === plan.parent_id && bridge.student_id === plan.student_id && bridge.week_key === plan.week_key
    && (bridge.source_execution_id === `legacy-execution:${plan.id}` && (bridge.source_kind == null || bridge.source_kind === 'legacy_execution')
      || bridge.source_execution_id === plan.id && bridge.source_kind === 'published' && Number.isSafeInteger(bridge.source_revision) && bridge.source_revision >= 0)
    && record(bridge.inherited_states) && record(bridge.source_blocks), 'invalid-publication-bridge');
  validateLegacySourceLinks(bridge.legacy_source_links);
};
export const getInheritedSchoolPublicationState = ({ bridge, plan, block }) => {
  assertSchoolPublicationBridge(bridge, plan);
  return bridge?.inherited_states[buildBlockCompletionStateId({ planId: plan.id, blockId: block.id })] || null;
};
// Report lineage never substitutes a correction event's scope. The explicit link
// authorizes applying that event to the old frozen assignment in its own report.
export const resolveSchoolReportCorrectionTarget = ({ report, plan, block, bridge = null }) => {
  requireValue(report.parent_id === plan.parent_id && report.student_id === plan.student_id && report.week_key === plan.week_key, 'scope-mismatch');
  if (!report.weekly_plan_id || report.weekly_plan_id === plan.id) {
    const assigned = report.assigned_blocks_snapshot || [];
    const matches = assigned.filter((item) => item.blockId === block.id);
    requireValue(matches.length <= 1, 'report-lineage-review-required');
    if (matches.length === 1) requireValue(matches[0].legacySubjectId === block.legacy_subject_id
      && matches[0].legacyBlockIndex === block.legacy_block_index
      && (!matches[0].assignmentId || matches[0].assignmentId === block.assignment_id), 'report-lineage-review-required');
    if (!matches.length && assigned.length) {
      if (!bridge || report.weekly_plan_id !== bridge.source_execution_id || !bridge.legacy_source_links[block.id]) return null;
      return resolveLinkedSchoolReportCorrectionTarget({ report, plan, block, bridge });
    }
    if (!matches.length && report.snapshot_model !== 'subjects') return null;
    if (!matches.length && !report.subjects_data?.[block.legacy_subject_id]) return null;
    return { block, lineage: null };
  }
  return resolveLinkedSchoolReportCorrectionTarget({ report, plan, block, bridge });
};
const resolveLinkedSchoolReportCorrectionTarget = ({ report, plan, block, bridge }) => {
  assertSchoolPublicationBridge(bridge, plan);
  if (!bridge || report.weekly_plan_id !== bridge.source_execution_id) return null;
  const sourceId = bridge.legacy_source_links[block.id];
  if (!sourceId) return null;
  const source = bridge.source_blocks[sourceId];
  requireValue(source && schoolExecutionContentSignature(source) === schoolExecutionContentSignature(block), 'report-lineage-review-required');
  const matches = (report.assigned_blocks_snapshot || []).filter((item) => item.blockId === sourceId);
  if (!matches.length && (report.assigned_blocks_snapshot || []).length) return null;
  requireValue(matches.length === 1 && matches[0].legacySubjectId === source.legacy_subject_id
    && matches[0].legacyBlockIndex === source.legacy_block_index
    && (!matches[0].assignmentId || matches[0].assignmentId === source.assignment_id), 'report-lineage-review-required');
  return { block: source, lineage: { publication_bridge_id: bridge.id, source_execution_id: bridge.source_execution_id,
    source_weekly_block_id: sourceId, target_weekly_plan_id: plan.id, target_weekly_block_id: block.id } };
};
