# Phase 3 Run Log

## Status Snapshot

- Phase: `phase-03-parent-weekly-planning-surface`
- Current status: `ready_for_tester`
- Current owner: `tester`
- Next downstream role: `tester`
- Last updated: `2026-05-10`

## Master Developer Reviews

- Confirmed Phase 2 passed developer and tester validation and the workflow can advance to Phase 3.
- Reality-checked Phase 3 against `src/pages/Curriculum.jsx`, `src/pages/ParentDashboard.jsx`, `src/constants/dashboardFeatures.js`, `src/hooks/useWeeklyPlanRecord.js`, and `src/utils/weeklyPlanUtils.js`.
- Confirmed the repo now has the Phase 2 weekly-plan contract and parent-owned hook path, but there is still no parent-facing app surface for reviewing, lightly editing, or publishing a student-week.
- Tightened the active scope to keep the Phase 3 surface thin and operational:
  - prefer exposing the first weekly-plan review and publish surface inside `Curriculum.jsx`
  - keep the current subject editor intact as the compatibility input path
  - treat `ParentDashboard.jsx`, `dashboardFeatures.js`, and `src/pages/dashboard` as supporting-touch files only if the thin curriculum surface truly needs shell wiring or route wrapping help
  - do not invent a new full-screen planner or broad dashboard redesign
- Confirmed there is no immediate blocker:
  - `Curriculum.jsx` already owns the most relevant parent context for subjects and students
  - `ParentDashboard.jsx` already provides the route-backed shell, but the current `curriculum` feature does not need new shell actions by default
  - Phase 2’s residual manual-only Firestore runtime gap is low risk and does not block the first parent surface
- Keep this phase focused on one useful student-week path: review the generated week, edit lightly before publish, surface status clearly, and publish from an app surface without moving the student portal or reports yet.
- Reviewed the delivered Phase 3 files after developer return: `src/pages/Curriculum.jsx`, `src/components/curriculum/WeeklyPlanReviewPanel.jsx`, and `src/hooks/useWeeklyPlanRecord.js`.
- Confirmed the UI surface stayed thin and correctly located in `Curriculum.jsx`, and the subject editor remains visibly separate as the compatibility input path.
- Found one Phase 3 correctness gap that needs another developer pass before tester handoff:
  - `WeeklyPlanReviewPanel` regenerates local block previews from current subjects via `handleRefreshFromSubjects()`, but `saveDraftWeeklyPlan()` and `publishWeeklyPlan()` only persist overridden `blocks`
  - when an existing weekly plan already exists, `useWeeklyPlanRecord` reuses `existingPlan.assignment_ids` unless `planOverrides.assignment_ids` is supplied
  - the current panel never supplies regenerated `assignment_ids`, so a refreshed plan can save or publish updated blocks while leaving stale assignment identity from the older subject set
  - that breaks the intended “refresh from current subjects” contract for an existing draft or published week
- Reviewed the narrowed follow-up in `src/hooks/useWeeklyPlanRecord.js`.
- Confirmed the regenerate/save/publish contract is now coherent for refreshed existing plans:
  - when overridden `blocks` are persisted without explicit `assignment_ids`, the hook now derives a de-duplicated `assignment_ids` array from those blocks
  - that closes the stale-identity gap after `WeeklyPlanReviewPanel.handleRefreshFromSubjects()`
  - the fix stays within the thin Curriculum-based surface and does not widen the Phase 3 planning contract
- Phase 3 is ready for downstream validation by `tester`.
## Developer Results

- Implemented the Phase 3 parent weekly-plan surface inside `Curriculum.jsx` without adding a new planner route or changing the dashboard shell:
  - inserted a dedicated `WeeklyPlanReviewPanel` above the existing subject editor
  - kept the subject editor intact and visibly separated as the compatibility input path
  - reused `ParentDashboard` outlet context only to read existing `parentSettings`, with no new shell actions or route wiring
- Added `src/components/curriculum/WeeklyPlanReviewPanel.jsx` as the thin parent review surface for one student-week:
  - student selector plus week selector for a single surfaced student-week
  - clear status treatment for preview-only, draft, published, and archived plan states
  - summary cards for the surfaced student-week, block count, last draft save, and publish state
  - narrow block review list with light inline edits limited to weekly-block `title` and `instruction`
  - subject-derived refresh action so the panel can regenerate from the current compatibility subject editor
  - parent-facing draft save and publish actions from the app surface
- Extended `src/hooks/useWeeklyPlanRecord.js` just enough to support Phase 3 light-edit persistence while preserving the Phase 2 hook path:
  - added override-aware draft and publish payload handling
  - allowed the weekly-plan UI to save or publish edited block arrays without introducing a broader planning contract or new collection flow
  - preserved the stable student-week identity and existing Phase 2 read/write behavior
- Completed the narrow Phase 3 correctness follow-up for refreshed existing plans:
  - tightened the draft/publish mutation payload so when the weekly-plan surface persists overridden `blocks` without explicit `assignment_ids`, the hook now derives a de-duplicated `assignment_ids` array from those blocks
  - this closes the stale-identity gap for `WeeklyPlanReviewPanel.handleRefreshFromSubjects()` while keeping the panel thin inside `Curriculum.jsx`
  - the existing light-edit flow remains limited to block `title` and `instruction`, with no broader planning-contract or UI expansion
- Kept Phase 3 scoped correctly:
  - no `StudentPortal.jsx` migration to `weeklyPlans`
  - no `Reports.jsx` migration to `weeklyPlans`
  - no new standalone planner route
  - no Firestore or rules changes were needed for this UI slice
## Tester Results

- Validation result: `pass`
- Confirmed the thin parent-facing weekly-plan review surface now lives inside `src/pages/Curriculum.jsx` and stays clearly separate from the existing subject editor:
  - `WeeklyPlanReviewPanel` is rendered above the labeled `Subject Editor` compatibility section
  - the subject editor remains intact below the weekly-plan surface rather than being replaced or merged into a planner shell
- Confirmed `src/components/curriculum/WeeklyPlanReviewPanel.jsx` matches the Phase 3 contract:
  - one-student, one-week review surface via a single student selector and single week selector
  - visible status treatment for preview-only, draft, published, and archived states
  - light inline edits limited to block `title` and `instruction`
  - refresh from current subjects plus draft save and publish actions
- Confirmed `src/hooks/useWeeklyPlanRecord.js` supports the light-edit persistence path without widening the planning contract:
  - `saveDraftWeeklyPlan()` and `publishWeeklyPlan()` both accept overridden `blocks`
  - when overridden `blocks` are saved without explicit `assignment_ids`, the hook derives a de-duplicated `assignment_ids` array from `block.assignment_id`
  - the hook still stays centered on one existing student-week record and does not introduce broader planning-authoring behavior
- Confirmed no Phase 3 scope drift in the validated repo state:
  - no new standalone planner route was added; `src/App.jsx` still routes weekly planning through the existing dashboard curriculum path
  - `src/pages/ParentDashboard.jsx` shows no weekly-plan shell redesign or new planner chrome
  - `src/pages/StudentPortal.jsx` and `src/pages/Reports.jsx` remain on the existing subject/submission path and were not migrated to `weeklyPlans`
  - `firestore.rules` contains weekly-plan support in the working tree, but the thin Phase 3 UI slice did not require additional rules expansion beyond that existing weekly-plan foundation
- Repo-command validation in the current repo state:
  - `npm run lint` passed
  - `npm run build` passed
- Residual low-risk gaps:
  - this tester pass still did not exercise an authenticated Firestore save/publish flow against a live backend or emulator, so runtime confirmation remains manual-only
  - repo guidance that says `npm run lint` is unusable is now stale because `.eslintrc.cjs` exists and the lint command exits successfully

## Next Handoff

- Return control to `master-developer`.
- Tester validation passed for the active Phase 3 slice.
- Remaining runtime risk is unchanged: no live authenticated Firestore save/publish round-trip was exercised in this pass.

## Open Questions Or Blockers

- No implementation blocker.
- Residual manual-only validation gap:
  - this pass still did not exercise an authenticated Firestore save/publish flow against a live backend or emulator, so runtime verification remains limited to code review plus build/lint.

## Completion Summary

- Phase 3 developer work is complete for the requested thin surface:
  - parent-facing weekly-plan review lives in `Curriculum.jsx`
  - publication status is visible for one student-week
  - minimal edit-before-publish flow is limited to light block-field edits
  - draft save and publish actions are available from the parent experience
  - refreshed plans now persist regenerated `assignment_ids` and regenerated `blocks` together when saving or publishing an existing student-week
  - the current subject editor remains intact and clearly separate
- Verification completed successfully:
  - `npm run lint`
  - `npm run build`
  - in-app browser smoke check on `http://127.0.0.1:3000/dashboard/curriculum` confirmed the new weekly-plan panel renders inside the curriculum surface and stays visibly separate from the subject editor
- Manual verification limit:
  - the available signed-in browser state had no students or subjects, so runtime UI verification covered the new empty-state path but did not exercise a real save-draft or publish action against live weekly-plan data
