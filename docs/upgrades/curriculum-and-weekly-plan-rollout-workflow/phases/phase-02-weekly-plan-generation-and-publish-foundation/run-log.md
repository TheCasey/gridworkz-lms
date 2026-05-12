# Phase 2 Run Log

## Status Snapshot

- Phase: `phase-02-weekly-plan-generation-and-publish-foundation`
- Current status: `ready_for_tester`
- Current owner: `tester`
- Next downstream role: `tester`
- Last updated: `2026-05-10`

## Master Developer Reviews

- Confirmed Phase 1 passed developer and tester validation and the workflow can advance to Phase 2.
- Reality-checked Phase 2 against `src/constants/schema.js`, `src/utils/weekUtils.js`, `src/hooks/useSubjects.js`, `src/hooks/useSubjectMutations.js`, and `firestore.rules`.
- Confirmed the new planning contracts now exist, but there is still no live read or write path for `weeklyPlans`, `assignments`, or `curriculumTemplates` anywhere in `src`.
- Tightened Phase 2 scope to keep the slice narrow and consistent with the source plan:
  - persist and read `weeklyPlans` in this phase
  - derive assignment and block inputs from active subjects plus Phase 1 compatibility helpers
  - do not turn `curriculumTemplates` or `assignments` into a broader persisted authoring flow yet unless a narrow helper needs it internally
- Confirmed there is no immediate blocker:
  - `weekUtils.js` already provides the week-boundary contract needed for `week_key`, `week_start`, and `week_end`
  - `useSubjects.js` already provides the active subject listener shape needed as a source input
  - `useSubjectMutations.js` shows the current parent-owned mutation pattern, but Phase 2 does not need a new trusted callable path by default
  - `firestore.rules` can be extended narrowly for parent-owned `weeklyPlans` reads and writes without pulling broader hardening or portal access changes forward
- Keep this phase data-flow-first: build the reusable generation, read, and publish path for one student-week, but do not redesign `Curriculum.jsx`, `ParentDashboard.jsx`, the student portal, or reporting in this slice.
- Reviewed the delivered Phase 2 files after developer return: `src/utils/weeklyPlanUtils.js`, `src/hooks/useWeeklyPlanRecord.js`, `src/utils/weekUtils.js`, `src/constants/schema.js`, and `firestore.rules`.
- Confirmed the implementation stayed within the intended slice:
  - weekly-plan generation remains helper-driven and subject-derived
  - the new read/write path is hook-based rather than page-owned UI work
  - Firestore rules were extended only for parent-owned `weeklyPlans`
  - existing parent dashboard, curriculum, student portal, and reporting pages were not rewired to the new model yet
- Confirmed the Phase 2 scope tightening held: `weeklyPlans` became the live persisted object, while `assignments` and `curriculumTemplates` remain compatibility contracts and derivation inputs rather than a broader persisted authoring flow.
- Phase 2 is ready for downstream validation by `tester`.
## Developer Results

- Added `src/utils/weeklyPlanUtils.js` with the Phase 2 pure generation contract for one student-week:
  - stable week identity via `week_start`, `week_end`, `week_key`, and deterministic weekly-plan doc id `${parent_id}_${student_id}_${week_key}`
  - active-subject filtering and stable subject ordering for planning inputs
  - deterministic compatibility assignment ids derived from `student_id` + legacy subject id
  - generated weekly blocks that preserve `legacy_subject_id`, `legacy_subject_title`, and `legacy_block_index`
- Added `src/hooks/useWeeklyPlanRecord.js` as the first real parent-owned weekly-plan read/write path for one student-week:
  - direct document listener using the stable student-week doc id
  - `buildDraftPreview()` for reusable draft generation from current active subjects plus current week settings
  - `saveDraftWeeklyPlan()` to persist a draft weekly plan
  - `publishWeeklyPlan()` to move that student-week into `published` state, generating the draft on demand if needed
- Extended `src/constants/schema.js` to make the Phase 2 contract more explicit with `WeeklyPlanStatuses` plus clarified comments for the stable weekly-plan doc id and compatibility assignment ids.
- Added `getWeekKey()` to `src/utils/weekUtils.js` and repointed existing report/rollover hooks to that shared helper so week-key generation stays centralized.
- Added the narrow Firestore rule slice for `weeklyPlans` in `firestore.rules`:
  - parent-owned get/create/update only
  - no list or delete access in this phase
  - deterministic doc-id enforcement against parent + student + week identity
  - ownership check that the referenced student belongs to the authenticated parent
  - direct missing-doc lookup support for the owner’s `weeklyPlans/{parent}_{student}_{week}` path so the new hook can distinguish “not created yet” from “permission denied”
- Kept `Curriculum.jsx`, `ParentDashboard.jsx`, `StudentPortal.jsx`, and `Reports.jsx` off the new weekly-plan model in this phase.
## Tester Results

- Phase 2 passes validation for the active Phase 2 slice and is ready to return to `master-developer`.
- Verified `src/utils/weeklyPlanUtils.js` now provides deterministic one-student-week identity and stable ids:
  - `buildWeeklyPlanIdentity()` derives `week_start`, `week_end`, `week_key`, and the stable `${parent_id}_${student_id}_${week_key}` document id
  - subject ordering is stabilized before generation, so draft assignment and block output stays deterministic for the same subject set
  - compatibility assignment ids and weekly block ids are deterministic for the same student/subject/block inputs
- Verified the generation path is still subject-derived and compatibility-preserving:
  - `deriveWeeklyPlanSourceAssignments()` and `deriveWeeklyPlanBlocks()` are fed from active legacy subjects assigned to the requested student
  - generated weekly blocks preserve `legacy_subject_id`, `legacy_subject_title`, and `legacy_block_index` through the Phase 1 compatibility helpers
- Verified `src/hooks/useWeeklyPlanRecord.js` is a real parent-owned data path for one `weeklyPlans/{parent}_{student}_{week}` record:
  - direct document listener for the deterministic student-week doc id
  - `buildDraftPreview()` generates a draft from the current active subject input set plus current week settings
  - `saveDraftWeeklyPlan()` persists the draft record
  - `publishWeeklyPlan()` publishes that same student-week and can generate the draft on demand if the record does not exist yet
  - the hook is not wired to any page UI yet, which matches the Phase 2 constraint
- Verified `src/utils/weekUtils.js` now owns shared `getWeekKey()` generation, and existing reporting/rollover plumbing was only repointed to that shared helper:
  - `src/utils/reportUtils.js`
  - `src/hooks/useWeeklyReportRecords.js`
  - `src/hooks/useWeeklyRollover.js`
- Verified `src/constants/schema.js` exposes the Phase 2 status contract clearly enough for the hook/util path:
  - `WeeklyPlanStatuses`
  - `WeeklyPlanStatusValues`
  - `WeeklyBlockSchema`
  - `WeeklyPlanSchema`
  - `Collections.WEEKLY_PLANS`
- Verified `firestore.rules` stayed narrow and additive for Phase 2:
  - only helper additions needed for `weeklyPlans`
  - parent-owned `get/create/update` for `weeklyPlans`
  - explicit `list/delete` denial
  - deterministic doc-id enforcement via parent + student + `week_key`
  - student ownership check on writes via `studentOwnedByParent()`
  - no unrelated rule drift in the diff beyond the new helper functions and `weeklyPlans` match block
- Verified no Phase 2 scope drift into live pages or broader authoring flows:
  - `src/pages/Curriculum.jsx`, `src/pages/ParentDashboard.jsx`, and `src/pages/Reports.jsx` still read live subject data through `useSubjects`
  - `src/pages/StudentPortal.jsx` still queries `subjects` directly for the live student work queue
  - `useWeeklyPlanRecord` is not used by the live pages yet
  - there is still no persisted `assignments` or `curriculumTemplates` read/write path in `src`
- Required validation commands passed in this checkout:
  - `npm run lint`
  - `npm run build`
- Manual-only verification gap:
  - this validation did not execute an authenticated create/publish flow against a live Firestore project or emulator
  - there is still no Phase 2 page surface to manually click through, so end-to-end verification is limited to static code/rules review plus build/lint

## Next Handoff

- Tester validation passed for the active Phase 2 slice.
- Return control to `master-developer` for workflow-state advancement.
- Residual low-risk gap: the new Firestore path has not been runtime-exercised against a real backend or emulator in this validation pass.

## Open Questions Or Blockers

- No implementation blocker.
- No live parent UI surface was added in this phase by design; the new path is hook/helper-driven and ready for the Phase 3 parent weekly-planning surface.
- Repo reality changed from the older AGENTS note: `.eslintrc.cjs` now exists and `npm run lint` passes in this checkout.
- No blocker found in the active Phase 2 slice.
- Remaining gap is manual-only runtime confirmation of the authenticated Firestore read/create/publish path.

## Completion Summary

- Phase 2 developer work is complete for the requested data-flow-first slice:
  - weekly-plan generation from active legacy subjects
  - stable student-week weekly-plan identity and persistence path
  - published-state mutation for one student-week
  - narrow parent-only Firestore rules for `weeklyPlans`
- Phase 2 tester validation now also passes for the current repo state.
- Verification completed successfully:
  - `npm run lint`
  - `npm run build`
  - `npx vite build --ssr src/hooks/useWeeklyPlanRecord.js --outDir .vite-weekly-plan-check`
- Live parent dashboard, curriculum UI, student portal, and reporting behavior remain on the existing model pending later phases.
- Residual low-risk gap: no authenticated live Firestore or emulator run was performed in this validation pass.
