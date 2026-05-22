# Phase 1: Print And Save-Record Safety

## Goal

Escape user-controlled content in report print output and allow official records for assigned but incomplete weeks.

## Depends On

- None

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add a shared HTML escaping helper for report print builders.
- Apply escaping to live report print, saved-record print, and filtered-record print paths.
- Change save-record enablement so assigned weekly-plan work can be archived even when completed blocks are zero.
- Keep existing report cards, filters, school-year/quarter labels, and print layout mostly unchanged.

## Deliverables

- Escaped report print output
- Updated week-has-data/save-record logic
- Focused helper checks if escaping logic is isolated

## Files Or Areas To Touch

- src/pages/Reports.jsx
- src/utils/reportUtils.js

## Read First

- docs/upgrades/reporting-safety-fixes.md
- docs/features/reporting-and-rollover.md
- src/pages/Reports.jsx
- src/utils/reportUtils.js
- src/hooks/useWeeklyPlansForWeek.js
- firestore.rules

## Exit Criteria

- Printed report HTML escapes student names, subject titles, summaries, and instructions.
- Assigned-but-incomplete weeks can be saved as official records.
- No-data state remains disabled when there is neither assigned nor completed work.
- Existing filters and print actions remain usable.

## Automated Test Expectation

Extract escaping and report-data checks into pure helpers if practical and add a node script that verifies escaping and assigned-incomplete save eligibility.

## Test Files

- scripts/check-reporting-safety.mjs

## Test Cases To Cover

- HTML-like summary text is escaped in generated print output.
- A weekly-plan-backed week with assigned blocks and zero completions is save-eligible.
- A week with no assignments and no submissions remains not save-eligible.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `code-review`: preferred tools `shell`; default evidence file and line references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- http://localhost:3000/dashboard/reports

## Evidence Required

- focused reporting safety script output
- lint/build output
- code references for escaped interpolation
- browser or fixture evidence for incomplete-week save eligibility

## Allowed Discovery

Follow report helpers, print builders, weekly-plan snapshot data, and existing report UI state only.

## Test Commands

- node scripts/check-reporting-safety.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Use a parent account or seeded fixture with a published weekly plan and zero submissions to confirm Save official record is available.

## Master Developer Review Focus

Confirm that Print And Save-Record Safety is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Print And Save-Record Safety. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Print And Save-Record Safety using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
