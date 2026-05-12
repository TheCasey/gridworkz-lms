# Phase 3: Parent Weekly Planning Surface

## Goal

Expose the narrowest useful parent review and publish surface for a generated weekly plan.

## Depends On

- weekly-plan-generation-and-publish-foundation

## Expected Downstream Role Sequence

`developer -> tester`

## Read First

- `docs/upgrades/curriculum-and-weekly-plan-rollout.md`
- `phases/phase-02-weekly-plan-generation-and-publish-foundation/phase.md`
- `src/pages/Curriculum.jsx`
- `src/pages/ParentDashboard.jsx`
- `src/constants/dashboardFeatures.js`
- any weekly-plan hooks or helpers introduced in Phase 2

## Scope

- Expose generated weekly-plan data in the dashboard or curriculum area.
- Support minimal review, direct edit, and publish behavior before a week goes live.
- Show publication status for a student-week.
- Avoid turning this phase into a broad curriculum-builder redesign.

## Phase Constraints

- Keep the current subject editor intact as the compatibility input path.
- Avoid inventing a new full-screen planner if a thin route or panel can carry the first release.
- Do not pull student portal or reporting work into this phase.

## Deliverables

- Parent weekly plan review surface
- Minimal edit-before-publish flow
- Visible student-week publication status

## Files Or Areas To Touch

- src/pages/Curriculum.jsx
- src/pages/ParentDashboard.jsx
- src/pages/dashboard
- src/hooks

## Exit Criteria

- A parent can inspect a generated weekly plan and publish it from an app surface.
- The UI stays narrow and operational rather than trying to solve the full long-term planning UX.
- The current subject editor remains intact for compatibility input.

## Test Commands

- npm run lint
- npm run build

## Master Developer Review Focus

Keep the UI thin and resist speculative redesign work that belongs to later product passes.

## Runtime Handoff Notes

- `developer`: Expose only the actions needed to review, edit lightly, and publish a week. Leave the broader curriculum UX alone.
- `tester`: Check that a parent can reach the weekly plan, review it, publish it, and avoid regressions in the surrounding dashboard flow.

## Next Phase Inputs

- Published weekly plans reachable from the parent experience
- Minimal edit and publication UX for one student-week
