// Presentation uses only the frozen server day, never a student or browser clock.
export function buildFrozenRoutineCards(state) {
  if (state?.contract !== 'routine_rewards_v1') return [];
  const periodOrder = { morning: 0, afternoon: 1, evening: 2 };
  return (state.routines || []).map((routine) => {
    const required = (routine.checklist_items || []).map((item) => item.id);
    const completion = (routine.completions || []).find((record) => {
      const ids = new Set(record.completed_item_ids || []);
      return Boolean(record.completed_at) && (!state.routine_day?.date_key || record.date_key === state.routine_day.date_key)
        && required.length > 0 && new Set(required).size === required.length
        && Array.isArray(record.completed_item_ids) && record.completed_item_ids.length === required.length
        && ids.size === required.length && required.every((id) => ids.has(id));
    });
    return { ...routine, complete: Boolean(completion), date_key: state.routine_day?.date_key || state.routine_rewards?.day?.date_key || completion?.date_key || null };
  }).sort((left, right) => (periodOrder[left.routine_period] ?? periodOrder[left.legacy_routine_period] ?? 3) - (periodOrder[right.routine_period] ?? periodOrder[right.legacy_routine_period] ?? 3));
}

// Known historic aliases receive their matching bundled art; unknown identifiers
// retain a visible archive card and a seedling compatibility preview.
const aliases = {
  stargazer: 'builtin_avatar_stargazer', avatar_stargazer: 'builtin_avatar_stargazer',
  comet: 'builtin_badge_comet', badge_comet: 'builtin_badge_comet',
  twilight: 'builtin_theme_twilight', theme_twilight: 'builtin_theme_twilight', profile_theme_twilight: 'builtin_theme_twilight',
  seedling: 'builtin_avatar_seedling', avatar_seedling: 'builtin_avatar_seedling',
};
export const resolveCosmeticPreviewId = (id) => aliases[id] || id;

export function getEditableRoutinePeriod(template = {}) {
  if (['morning', 'afternoon', 'evening'].includes(template.routine_period)) return template.routine_period;
  const title = String(template.title || '').toLowerCase();
  if (title.includes('morning')) return 'morning';
  if (title.includes('afternoon')) return 'afternoon';
  if (title.includes('evening') || title.includes('night')) return 'evening';
  return '';
}
export function selectParentRoutineTemplates(templates = [], studentId) {
  const assigned = templates.filter((template) => template.is_active !== false && (!template.student_ids?.length || template.student_ids.includes(studentId)));
  const canonical = (template) => ['morning', 'afternoon', 'evening'].includes(template.routine_period) && template.student_ids?.length === 1 && template.student_ids[0] === studentId;
  const replaced = new Set(assigned.filter(canonical).map((template) => template.routine_period));
  return assigned.filter((template) => canonical(template) || !replaced.has(getEditableRoutinePeriod(template)));
}
