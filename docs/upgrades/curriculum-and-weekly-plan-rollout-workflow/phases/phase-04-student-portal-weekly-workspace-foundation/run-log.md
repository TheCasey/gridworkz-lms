# Phase 4 Run Log

## Status Snapshot

- Phase: `phase-04-student-portal-weekly-workspace-foundation`
- Current status: `ready_for_tester`
- Current owner: `tester`
- Next downstream role: `tester`
- Last updated: `2026-05-10`

## Master Developer Reviews

- Confirmed Phase 3 passed developer and tester validation and the workflow can advance to Phase 4.
- Reality-checked Phase 4 against `src/pages/StudentPortal.jsx`, `src/hooks/useStudentAccessPolicy.js`, `src/utils/timerUtils.js`, and the existing weekly-plan helpers and hook path from earlier phases.
- Confirmed the repo still has two important current-shape constraints:
  - `StudentPortal.jsx` is deeply subject-shaped today: progress, timers, submissions, and modal flow are keyed off `subject.id` plus `block_index`
  - `weeklyPlans` currently have only the parent-owned read/write path from earlier phases, so the student portal cannot read published weekly plans yet without a narrow compatibility update
- Tightened the active scope to keep the portal migration controlled:
  - published weekly plans should become the primary student-week queue when available
  - preserve a clean fallback to the current raw-subject path when no published weekly plan exists
  - preserve timer and submission continuity through `legacy_subject_id`, `legacy_subject_title`, and `legacy_block_index`
  - prefer a bridge model or portal-specific adapter over a broad timer or access-policy rewrite
  - allow a narrow `firestore.rules` touch only if required to let the unauthenticated portal `get` a published weekly plan by deterministic student-week identity; do not broaden into list access or unrelated hardening work
- Confirmed there is no immediate blocker:
  - earlier phases already created deterministic weekly-plan identity and published block compatibility fields
  - the portal already computes the current week and has the student record needed to derive a deterministic weekly-plan doc id
  - the access-policy layer can remain the control point if this phase introduces a thin weekly-block compatibility adapter instead of replacing the whole guardrail model
- Keep this phase focused on student portal read and execution behavior only. Do not pull in projects, worksheet runtime, AI help, or reporting migration.
- Reviewed the delivered Phase 4 files after developer return: `src/hooks/useStudentPortalWeeklyPlan.js`, `src/utils/weeklyPlanUtils.js`, `src/hooks/useStudentAccessPolicy.js`, `src/pages/StudentPortal.jsx`, and `firestore.rules`.
- Confirmed the implementation stayed within the intended slice:
  - the portal reads only the deterministic current student-week published plan
  - published weekly blocks are adapted back onto compatibility-safe subject and block references instead of forcing a timer/submission rewrite
  - the existing subject-driven portal remains in place as the fallback branch
  - `firestore.rules` only widened enough for direct unauthenticated `get` on existing published weekly plans, with no list access or portal writes
- Phase 4 is ready for downstream validation by `tester`.
## Developer Results

- Added a portal-only published weekly-plan read path in `src/hooks/useStudentPortalWeeklyPlan.js`.
  - The hook derives the deterministic current student-week doc id from the public student record plus week settings.
  - It listens only to `weeklyPlans/{parent}_{student}_{week}` and only exposes the record to the portal when the plan is actually `published`.
  - It treats the unauthenticated `permission-denied` case as the compatibility fallback path so the portal can stay on raw subjects when no published plan is live.
- Added a thin published-week adapter in `src/utils/weeklyPlanUtils.js`.
  - Published blocks are normalized into portal work items carrying `compatibilitySubject` data built from `legacy_subject_id`, `legacy_subject_title`, and `legacy_block_index`.
  - The adapter keeps published block display fields such as title, instruction, duration, resources, and custom fields while preserving legacy subject identity for timers and submissions.
  - A companion subject dedupe helper provides the listener inputs used by the timer and submission continuity effects.
- Extended `src/hooks/useStudentAccessPolicy.js` with a narrow `getWorkItemPolicy()` bridge.
  - Published weekly blocks now route through the same access-policy guardrail layer instead of bypassing it.
  - The new helper simply evaluates a published work item through its compatibility subject and legacy block index; it does not replace or broaden the existing subject policy model.
- Updated `src/pages/StudentPortal.jsx` to prefer published weekly blocks when a current published weekly plan exists.
  - The portal now loads the published-week queue first, shows a published-plan banner, and renders live weekly blocks as the primary execution surface.
  - Timer listeners, completed-block listeners, timer actions, completion modal flow, and submission writes still use legacy `subject_id` plus `block_index` continuity.
  - Submission writes keep the legacy subject name while the UI can show the published block title.
  - The existing subject-card portal remains intact as the full fallback branch when no published weekly plan is available.
- Narrowed `firestore.rules` for weekly-plan portal reads only.
  - `weeklyPlans` now allow direct unauthenticated `get` only for existing published weekly-plan documents at deterministic doc ids.
  - No list access, no portal writes, and no unrelated rules work were added.
## Tester Results

- Phase 4 passes validation for the requested slice and is ready to return to `master-developer`.
- `src/hooks/useStudentPortalWeeklyPlan.js` passed the hook-level checks:
  - deterministic current student-week lookup is derived from `parent_id`, `student.id`, and the current week key via `buildWeeklyPlanIdentity()` before reading `weeklyPlans/{planId}`
  - the hook only exposes a plan to the portal when `status === published`
  - `permission-denied` resolves to `weeklyPlan = null` with no surfaced error, which preserves the intended raw-subject compatibility fallback when the portal cannot read a published current-week plan
- `src/utils/weeklyPlanUtils.js` passed the adapter checks:
  - published weekly blocks are adapted into portal work items with published display fields plus compatibility-safe legacy references
  - the adapter requires `legacy_subject_id` and `legacy_block_index` before a block becomes a live portal work item
  - `buildPublishedWeeklyPlanPortalSubjects()` dedupes compatibility subjects by legacy subject id so timer and submission listeners stay subject-keyed instead of duplicating listeners per published block
- `src/hooks/useStudentAccessPolicy.js` passed the policy-bridge check:
  - `getWorkItemPolicy()` is a thin wrapper over `getSubjectPolicy()` using `compatibilitySubject` plus `compatibilityBlockIndex`
  - the existing subject policy model remains the enforcement surface; no replacement policy system was introduced
- `src/pages/StudentPortal.jsx` passed the portal-slice checks:
  - the portal prefers published weekly blocks when `useStudentPortalWeeklyPlan()` returns a current published plan
  - timers, timer-session ids, submission lookups, submission writes, and completion checks still key off legacy `subject.id` plus `block_index`
  - the original subject-card branch is still intact when no published weekly plan is available
  - no Phase 5/reporting migration, project runtime, worksheet runtime, or AI-help surface was introduced
- `src/utils/timerUtils.js` still preserves the legacy timer identity contract:
  - local-storage keys remain `timer_${studentId}_${subjectId}`
  - Firestore timer-session ids remain `${studentId}_${subjectId}`
- `firestore.rules` passed the scope check:
  - unauthenticated weekly-plan access is limited to direct `get` on existing published weekly-plan docs that satisfy the deterministic identity and ownership shape checks
  - `weeklyPlans` still deny `list`
  - no unauthenticated create, update, or delete path was introduced
  - no unrelated rules drift was found in this phase slice beyond the weekly-plan helpers and match block
- Command validation:
  - `npm run lint` passed
  - `npm run build` passed
- Runtime validation:
  - live-data inspection against current deterministic student-week ids returned `permission-denied` for all sampled student-week plan lookups, which is the expected compatibility fallback signal when no published plan is readable to the unauthenticated portal
  - browser check passed on `/student/test-dummy-oCcLZF`: after PIN entry, the portal rendered the legacy subject-driven weekly workspace with subject cards and weekly progress, confirming the fallback branch still works in current local state
  - manual-only gap remains for the published-plan runtime branch because no readable current published weekly plan was available in the connected Firebase project during validation

## Next Handoff

- Tester validation is complete for Phase 4.
- Return control to `master-developer`.
- Residual low-risk gap: published-plan runtime behavior still needs one manual browser pass in an environment that contains a readable current published weekly plan.

## Open Questions Or Blockers

- None

## Completion Summary

- `npm run lint` passed.
- `npm run build` passed.
- Phase 4 passes tester validation for the active slice and is ready to return to `master-developer`.
- Remaining validation gap is runtime-only and low risk: current local data did not include a readable published weekly plan for direct portal verification.
