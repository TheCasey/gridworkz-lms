# Phase 2: Weekly Plan Generation And Publish Foundation

## Goal

Create the first writable weekly-plan generation and publish path for one student-week from current active subject data.

## Depends On

- schema-and-compatibility-foundation

## Expected Downstream Role Sequence

`developer -> tester`

## Read First

- `docs/upgrades/curriculum-and-weekly-plan-rollout.md`
- `phases/phase-01-schema-and-compatibility-foundation/phase.md`
- `src/constants/schema.js`
- `src/utils/weekUtils.js`
- `src/hooks/useSubjects.js`
- `src/hooks/useSubjectMutations.js`
- `firestore.rules`

## Scope

- Introduce weekly plan draft and published states with stable read and write helpers.
- Generate weekly blocks from current subject-derived planning inputs plus existing week settings.
- Preserve legacy subject references needed by timers, submissions, and later portal migration.
- Keep this phase focused on data flow and mutations rather than polished parent UI.

## Phase Constraints

- Do not turn this phase into a UI redesign of `Curriculum.jsx` or `ParentDashboard.jsx`.
- Do not switch the student portal or reports to weekly plans yet.
- Keep the first successful path to one student-week from current active subject data.

## Deliverables

- Weekly plan generation helpers
- Weekly plan read and write path
- Published student-week contract with legacy compatibility references

## Files Or Areas To Touch

- src/hooks
- src/utils
- src/constants/schema.js
- firestore.rules

## Exit Criteria

- A parent-owned weekly plan can be created and published for one student-week from current active subject data.
- Published weekly blocks retain the compatibility fields needed for timer and submission continuity.
- The phase does not yet depend on a polished weekly planning UI.

## Test Commands

- npm run lint
- npm run build

## Master Developer Review Focus

Keep the slice narrow: a real published-week contract, not a full planning experience.

## Runtime Handoff Notes

- `developer`: Build the weekly-plan generation and publish path first. Avoid redesigning curriculum screens in this phase.
- `tester`: Validate the one-student weekly-plan creation and publish path and confirm the build remains healthy.

## Next Phase Inputs

- Stable published weekly-plan contract
- Reusable read and mutation path for parent weekly planning
