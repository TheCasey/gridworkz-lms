# Phase 4: Student Portal Weekly Workspace Foundation

## Goal

Move the student portal onto published weekly plans while preserving current timer, submission, and access-policy behavior.

## Depends On

- parent-weekly-planning-surface

## Expected Downstream Role Sequence

`developer -> tester`

## Read First

- `docs/upgrades/curriculum-and-weekly-plan-rollout.md`
- `phases/phase-03-parent-weekly-planning-surface/phase.md`
- `src/pages/StudentPortal.jsx`
- `src/hooks/useStudentAccessPolicy.js`
- `src/utils/timerUtils.js`
- any weekly-plan read helpers introduced in earlier phases

## Scope

- Read published weekly plans before falling back to raw subject-driven work.
- Render weekly blocks as the primary live work queue.
- Preserve timer and submission continuity through legacy compatibility references during the rollout.
- Keep the shared student access-policy layer in control of visibility and completion guardrails.

## Phase Constraints

- Do not add project views, worksheet runtime, or AI help flows here.
- Preserve a clean fallback path when no published weekly plan exists.
- Do not rewrite timer persistence unless it is required to keep the compatibility contract working.

## Deliverables

- Weekly-plan-aware student portal read path
- Published weekly block queue in the student portal
- Compatibility path for timers and submissions during the transition

## Files Or Areas To Touch

- src/pages/StudentPortal.jsx
- src/hooks/useStudentAccessPolicy.js
- src/utils/timerUtils.js
- src/hooks

## Exit Criteria

- The student portal can execute a published weekly plan as the primary path for the covered student-week flow.
- Timer and submission behavior still works without a subject-id regression.
- The portal can still fall back cleanly if a published weekly plan is unavailable.

## Test Commands

- npm run lint
- npm run build

## Master Developer Review Focus

Keep this phase focused on portal read and execution behavior, not on projects, AI help, or worksheet runtime.

## Runtime Handoff Notes

- `developer`: Switch the portal to published weekly plans first and use compatibility fields to preserve current completion behavior.
- `tester`: Validate published-week execution in the portal, including timer continuity, submission flow, and fallback behavior when no plan exists.

## Next Phase Inputs

- Published weekly-plan student execution path
- Verified compatibility behavior for timers and submissions
