# Phase 1: Extract Block Objectives Editor

## Goal

Move the Step 4 block-objective UI into a focused component without changing behavior or saved data shape.

## Depends On

- None

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Create `src/components/curriculum/BlockObjectivesEditor.jsx`.
- Move the existing block-objective rendering into the component.
- Pass existing state and handlers through props.
- Avoid changing block objective behavior beyond tiny markup cleanup required by extraction.

## Deliverables

- Extracted block objective component
- Smaller `Curriculum.jsx`
- Behavior-preserving prop interface

## Files Or Areas To Touch

- src/pages/Curriculum.jsx
- src/components/curriculum/BlockObjectivesEditor.jsx

## Read First

- docs/upgrades/curriculum-modal-cleanup.md
- src/pages/Curriculum.jsx
- src/components/curriculum/WeeklyPlanReviewPanel.jsx
- src/hooks/useSubjectMutations.js
- src/utils/planningCompatibilityUtils.js
- src/utils/weeklyPlanUtils.js

## Exit Criteria

- Step 4 renders through the new component.
- Subject create/edit payload shape is unchanged.
- Existing block instruction, custom-field, and student override controls remain available.
- No weekly-plan, portal, report, or Firestore rule behavior changes.

## Automated Test Expectation

No component test runner exists; add no automated UI test in this phase. Rely on lint/build and browser smoke because this is an extraction with unchanged behavior.

## Test Files

- None for this phase.

## Test Cases To Cover

- Manual/browser validation should cover opening Step 4, editing an existing instruction, and confirming nested custom-field and student-override controls still render.

## No-Test Rationale

The repo has no component test runner, and this phase is intended as behavior-preserving extraction. Browser smoke is the meaningful validation.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `code-review`: preferred tools `shell`; default evidence file and line references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- http://localhost:3000/dashboard/curriculum

## Evidence Required

- lint/build output
- code references showing extraction boundaries
- browser screenshot or notes for opening Step 4

## Allowed Discovery

Follow only Curriculum imports, subject mutation paths, and current block-objective helpers.

## Test Commands

- npm run lint
- npm run build

## Manual Verification Follow-Up

- Open an existing subject with block objectives and confirm Step 4 still displays existing instructions, custom fields, and student overrides.

## Master Developer Review Focus

Confirm that Extract Block Objectives Editor is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Extract Block Objectives Editor. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Extract Block Objectives Editor using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
