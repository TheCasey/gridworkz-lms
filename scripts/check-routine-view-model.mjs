import assert from 'node:assert/strict';
import { buildFrozenRoutineCards, getEditableRoutinePeriod, resolveCosmeticPreviewId, selectParentRoutineTemplates } from '../src/utils/routineViewModel.js';
let assertions = 0;
const equal = (actual, expected) => { assert.deepEqual(actual, expected); assertions += 1; };
const templates = [
  { id: 'shared', title: 'Morning routine', parent_id: 'p', student_ids: [], checklist_items: [{ id: 'brush', label: 'Brush teeth' }] },
  { id: 'canonical', routine_period: 'morning', student_ids: ['s'], checklist_items: [] },
  { id: 'unknown', title: 'After breakfast', student_ids: [], checklist_items: [{ id: 'water', label: 'Water plants' }] },
  { id: 'sibling', routine_period: 'evening', student_ids: ['other'], checklist_items: [{ id: 'sleep', label: 'Bedtime' }] },
];
equal(selectParentRoutineTemplates(templates, 's').map((item) => item.id), ['canonical', 'unknown']);
equal(selectParentRoutineTemplates(templates.map((item) => item.id === 'canonical' ? { ...item, is_active: false } : item), 's').map((item) => item.id), ['shared', 'unknown']);
equal(getEditableRoutinePeriod(templates[2]), '');
equal(getEditableRoutinePeriod({ title: 'Evening wind down' }), 'evening');
equal(getEditableRoutinePeriod({ title: 'Morning music', routine_period: 'afternoon' }), 'afternoon');
const state = {
  contract: 'routine_rewards_v1', routine_day: { date_key: '2026-10-12' }, routine_rewards: null,
  routines: [{ id: 'r', title: 'Morning', checklist_items: [{ id: 'a' }, { id: 'b' }], completions: [{ date_key: '2026-10-12', completed_at: '2026-10-12T16:00:00Z', completed_item_ids: ['a'] }] }],
};
equal(buildFrozenRoutineCards(state)[0].complete, false);
state.routines[0].completions[0].completed_item_ids = ['a', 'b'];
equal(buildFrozenRoutineCards(state)[0].complete, true);
equal(buildFrozenRoutineCards(state)[0].date_key, '2026-10-12');
state.routines[0].completions[0].completed_item_ids = ['a', 'b', 'extra'];
equal(buildFrozenRoutineCards(state)[0].complete, false);
state.routines[0].completions[0].completed_item_ids = ['a', 'a'];
equal(buildFrozenRoutineCards(state)[0].complete, false);
state.routines[0].completions[0].completed_item_ids = ['a', 'b'];
state.routines[0].completions[0].completed_at = null;
equal(buildFrozenRoutineCards(state)[0].complete, false);
state.routines[0].completions[0].completed_at = '2026-10-12T16:00:00Z';
state.routines[0].completions[0].date_key = '2026-10-13';
equal(buildFrozenRoutineCards(state)[0].complete, false);
equal(buildFrozenRoutineCards({ ...state, contract: 'legacy' }), []);
equal(buildFrozenRoutineCards({ ...state, routines: [{ id: 'empty', checklist_items: [], completions: [{ date_key: '2026-10-12', completed_item_ids: [] }] }] })[0].complete, false);
equal(buildFrozenRoutineCards({ contract: 'routine_rewards_v1', routines: [{ id: 'e', routine_period: 'evening' }, { id: 'unknown', routine_period: 'legacy:u' }, { id: 'm', routine_period: 'morning' }, { id: 'a', routine_period: 'legacy:a', legacy_routine_period: 'afternoon' }] }).map((item) => item.id), ['m', 'a', 'e', 'unknown']);
equal(resolveCosmeticPreviewId('stargazer'), 'builtin_avatar_stargazer');
equal(resolveCosmeticPreviewId('badge_comet'), 'builtin_badge_comet');
equal(resolveCosmeticPreviewId('unknown_owned'), 'unknown_owned');
equal(resolveCosmeticPreviewId('builtin_theme_twilight'), 'builtin_theme_twilight');
console.log(`Routine presentation checks passed (${assertions} assertions). Frozen dates, empty shared overrides, unknown legacy routines and artwork aliases covered.`);
