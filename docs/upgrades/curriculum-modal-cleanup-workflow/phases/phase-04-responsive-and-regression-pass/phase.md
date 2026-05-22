# Phase 4: Responsive And Regression Pass

## Goal

Validate the cleaned modal against create/edit flows, weekly-plan preview derivation, and desktop/mobile usability.

## Depends On

- compact-block-objective-workflow

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Make small polish fixes found during validation.
- Verify subject create/edit/archive/delete surfaces still work.
- Verify weekly-plan preview still derives from edited subjects.
- Document remaining known limitations without broadening into template/assignment authoring.

## Deliverables

- Final modal polish fixes
- Validation notes
- Updated source plan status or follow-up notes

## Files Or Areas To Touch

- src/pages/Curriculum.jsx
- src/components/curriculum/BlockObjectivesEditor.jsx
- docs/upgrades/curriculum-modal-cleanup.md

## Read First

- docs/upgrades/curriculum-modal-cleanup.md
- src/pages/Curriculum.jsx
- src/components/curriculum/BlockObjectivesEditor.jsx
- src/components/curriculum/WeeklyPlanReviewPanel.jsx
- src/hooks/useWeeklyPlanRecord.js

## Exit Criteria

- Lint and build pass.
- Create and edit flows work on desktop and mobile.
- Block objectives persist and still feed weekly-plan preview.
- No obvious text overlap or unreachable controls remain.
- Source cleanup doc reflects final status and remaining follow-up.

## Automated Test Expectation

No new automated tests required unless this phase changes helper logic; use browser smoke and manual QA for the UI regression pass.

## Test Files

- None for this phase unless a helper change is introduced during polish.

## Test Cases To Cover

- Browser/manual validation should cover create, edit, save, reopen, archive, delete, and weekly-plan preview behavior.

## No-Test Rationale

Final responsive validation is UI/runtime focused and the repo has no configured component test runner.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.
- `interaction-smoke`: preferred tools `playwright`, `computer-use`; default evidence test output, screenshot. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.
- `manual-qa`: preferred tools `human`; default evidence manual verification note. Document the manual follow-up that a human must complete before final merge or release confidence.

## Runtime Targets

- http://localhost:3000/dashboard/curriculum
- desktop width
- mobile widths 375 and 430

## Evidence Required

- lint/build output
- screenshots for desktop/mobile modal
- notes for create/edit/save/reopen and weekly-plan preview behavior

## Allowed Discovery

Follow only curriculum page, weekly-plan panel, and subject mutation paths needed for regression verification.

## Test Commands

- npm run lint
- npm run build

## Manual Verification Follow-Up

- Use a real or seeded parent account with at least one student and one subject to verify edit, save, reopen, publish preview, archive, and delete still behave as expected.

## Master Developer Review Focus

Confirm that Responsive And Regression Pass is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Responsive And Regression Pass. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Responsive And Regression Pass using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
