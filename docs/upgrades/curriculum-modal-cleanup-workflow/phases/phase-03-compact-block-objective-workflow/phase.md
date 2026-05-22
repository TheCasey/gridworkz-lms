# Phase 3: Compact Block Objective Workflow

## Goal

Replace the all-expanded block-objective list with a compact block selector and one active block detail editor.

## Depends On

- stable-modal-shell

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Show all blocks as compact selectable rows or buttons.
- Render one active block detail editor at a time.
- Keep instruction editing visible by default.
- Move block-specific custom fields and per-student overrides behind explicit collapsible advanced sections.
- Add concise state indicators for configured instruction, block fields, and student overrides.

## Deliverables

- Compact block selector
- Active block detail editor
- Advanced sections for nested custom fields and student overrides
- State indicators for configured blocks

## Files Or Areas To Touch

- src/components/curriculum/BlockObjectivesEditor.jsx
- src/pages/Curriculum.jsx

## Read First

- docs/upgrades/curriculum-modal-cleanup.md
- src/components/curriculum/BlockObjectivesEditor.jsx
- src/pages/Curriculum.jsx
- src/constants/schema.js
- src/utils/planningCompatibilityUtils.js
- scripts/check-block-objective-editor-helpers.mjs

## Exit Criteria

- Parents can select and edit one block at a time.
- Instruction editing is the default visible path.
- Block custom fields and student overrides remain available but collapsed by default.
- Saved `block_objectives` shape remains compatible with existing portal and weekly-plan helpers.

## Automated Test Expectation

If selector/status helper functions are extracted, add a node script to verify configured-block indicators from representative `block_objectives` data; otherwise use lint/build and browser smoke.

## Test Files

- scripts/check-block-objective-editor-helpers.mjs

## Test Cases To Cover

- Block with instruction shows configured indicator.
- Block with custom fields shows advanced indicator.
- Block with student override shows student-specific indicator.
- Empty block shows unconfigured state.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.
- `interaction-smoke`: preferred tools `playwright`, `computer-use`; default evidence test output, screenshot. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.

## Runtime Targets

- http://localhost:3000/dashboard/curriculum

## Evidence Required

- lint/build output
- browser screenshots of compact selector and detail editor
- notes showing nested advanced controls still work

## Allowed Discovery

Follow only block-objective data helpers, schema, and current Curriculum state dependencies.

## Test Commands

- npm run lint
- npm run build

## Manual Verification Follow-Up

- Edit one block instruction, one block-specific custom field, and one student override; save and reopen to confirm persistence.

## Master Developer Review Focus

Confirm that Compact Block Objective Workflow is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Compact Block Objective Workflow. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Compact Block Objective Workflow using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
