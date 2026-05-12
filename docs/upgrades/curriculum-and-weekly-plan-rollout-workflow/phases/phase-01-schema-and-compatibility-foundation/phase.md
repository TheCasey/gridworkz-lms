# Phase 1: Schema And Compatibility Foundation

## Goal

Add the future planning contracts and legacy-subject compatibility layer without changing the live parent or student surfaces yet.

## Depends On

- None

## Expected Downstream Role Sequence

`developer -> tester`

## Read First

- `docs/upgrades/curriculum-and-weekly-plan-rollout.md`
- `src/constants/schema.js`
- `src/pages/Curriculum.jsx`
- `src/pages/StudentPortal.jsx`
- `src/utils/reportUtils.js`
- `firestore.rules`

## Scope

- Add collection constants and schema definitions for curriculum templates, assignments, and weekly plans.
- Add shared planning vocabulary for weekly block category and completion mode.
- Add compatibility helpers that derive student-specific planning inputs from current multi-student and legacy single-student subject records.
- Keep all live UI and query behavior unchanged in this phase.

## Phase Constraints

- Do not change route structure, dashboard navigation, or page-level Firestore query behavior yet.
- Do not switch `StudentPortal.jsx`, `Reports.jsx`, or `ParentDashboard.jsx` to the new model in this phase.
- If new helpers are introduced, keep them pure and unused by live pages until the next phase activates them.

## Deliverables

- Updated schema and collection definitions
- Shared weekly planning vocabulary constants
- Legacy subject-to-assignment and block compatibility helpers

## Files Or Areas To Touch

- src/constants/schema.js
- src/constants
- src/utils

## Exit Criteria

- The repo contains explicit code contracts for curriculum templates, assignments, and weekly plans.
- Compatibility helpers cover both student_ids and legacy student_id subject assignment shapes.
- No parent or student workflow has switched to the new model yet.

## Test Commands

- npm run lint
- npm run build

## Master Developer Review Focus

Keep this phase data-contract-only and reject any attempt to start parent or student UI work early.

## Runtime Handoff Notes

- `developer`: Implement the new planning contracts and compatibility helpers only. Do not wire them into the live app yet.
- `tester`: Verify the contracts are present, compatibility covers both subject assignment shapes, and the app still builds cleanly without behavior changes.

## Next Phase Inputs

- Stable planning schemas and collection names
- Legacy compatibility contract for subject-derived planning inputs
