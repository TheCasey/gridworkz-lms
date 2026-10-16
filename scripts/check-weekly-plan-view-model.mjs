import assert from 'node:assert/strict';
import {
  buildStudentDefaultQuantities, buildDefaultWeekQuantitiesWrite, deriveWeeklyPlanBlocks,
  buildWeeklyPlanDraft, weeklyPlanContentSignature,
} from '../src/utils/weeklyPlanUtils.js';
const studentId = 'student-a';
const subjects = [{
  id: 'math', parent_id: 'parent', student_ids: [studentId, 'student-b'], title: 'Math', block_length: 30,
  require_timer: false, require_input: false,
  curriculum_blocks: [
    { id: 'review', title: 'Review', default_quantity: 2 },
    { id: 'lesson', title: 'Lesson', default_quantity: 1, require_timer: true },
    { id: 'retired', title: 'Retired', default_quantity: 9, status: 'archived' },
  ],
}];
const defaults = { revision: 1, student_id: studentId, default_block_quantities: {
  math: { review: 1, lesson: 2, retired: 7, missing: 3 }, removed_subject: { old: 4 },
} };
const sourceSnapshot = structuredClone(subjects);
const defaultsSnapshot = structuredClone(defaults);
const quantities = buildStudentDefaultQuantities({ subjects, defaults });
assert.deepEqual(quantities, { math: { review: 1, lesson: 2 } });
assert.deepEqual(buildStudentDefaultQuantities({ subjects }), { math: { review: 2, lesson: 1 } });
let sequence = 0;
const allocateInstanceKey = () => `opaque-${++sequence}`;
const first = deriveWeeklyPlanBlocks({ subjects, studentId, quantitiesBySubjectId: quantities, allocateInstanceKey });
assert.equal(first.length, 3);
assert.equal(first[0].require_timer, false);
assert.equal(first[1].require_timer, true);
assert.equal(new Set(first.map((block) => block.instance_key)).size, 3);
const edited = first.map((block, index) => index === 1 ? { ...block, title: 'Keep this copied lesson', instruction: 'Saved snapshot' } : block);
const reduced = deriveWeeklyPlanBlocks({ subjects, studentId, quantitiesBySubjectId: { math: { review: 0, lesson: 1 } }, previousBlocks: edited, identityHistory: first, allocateInstanceKey });
assert.deepEqual(reduced, [edited[1]]);
const grown = deriveWeeklyPlanBlocks({ subjects, studentId, quantitiesBySubjectId: { math: { review: 1, lesson: 2 } }, previousBlocks: reduced, identityHistory: first, allocateInstanceKey });
assert.equal(grown[1].id, first[1].id);
assert.equal(grown[1].legacy_block_index, first[1].legacy_block_index);
assert.equal(grown[1].instruction, 'Saved snapshot');
assert.notEqual(grown[0].id, first[0].id);
assert.notEqual(grown[2].id, first[2].id);
assert.ok(grown[0].legacy_block_index > 2);
assert.ok(grown[2].legacy_block_index > 2);
const legacy = first.map(({ instance_key, ...block }) => block);
const adopted = deriveWeeklyPlanBlocks({ subjects, studentId, quantitiesBySubjectId: quantities, previousBlocks: legacy, allocateInstanceKey });
assert.deepEqual(adopted.map((block) => block.id), first.map((block) => block.id));
assert.deepEqual(adopted.map((block) => block.instance_key), first.map((block) => `legacy:${block.id}`));
const empty = deriveWeeklyPlanBlocks({ subjects, studentId, quantitiesBySubjectId: { math: {} }, allocateInstanceKey });
assert.deepEqual(empty, []);
const legacySubjects = [{ id: 'legacy', student_id: studentId, title: 'Legacy', block_count: 2, require_input: false }];
assert.equal(deriveWeeklyPlanBlocks({ subjects: legacySubjects, studentId, quantitiesBySubjectId: { legacy: {} }, allocateInstanceKey }).length, 0);
const writtenDefaults = buildDefaultWeekQuantitiesWrite({ currentDefaults: defaults, subjects, quantities: { math: { review: 0, lesson: 1 } } });
assert.deepEqual(writtenDefaults, { math: { review: 0, lesson: 1, retired: 7, missing: 3 }, removed_subject: { old: 4 } });
const generated = buildWeeklyPlanDraft({ parentId: 'parent', studentId, subjects, defaults, referenceDate: new Date(2026, 9, 19) });
assert.equal(generated.blocks.length, 3);
assert.deepEqual(subjects, sourceSnapshot);
assert.deepEqual(defaults, defaultsSnapshot);
assert.equal(weeklyPlanContentSignature({ blocks: [{ id: 'a', title: 'A', color: 'blue' }] }), weeklyPlanContentSignature({ blocks: [{ title: 'A', id: 'a' }] }));
console.log('Weekly Plan view-model checks passed: student defaults, empty generation, stable retained identities, new opaque copies, historical defaults, and immutable sources.');
