# Phase 2: Saved Snapshot Enrichment

## Goal

Preserve planned weekly-block detail in saved report records while keeping existing `subjects_data` compatibility outputs.

## Depends On

- print-and-save-record-safety

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add an assigned block snapshot field to `WeeklyReportSchema` and saved report payloads.
- Populate it from reportable `weeklyPlans.blocks` when a weekly plan backs the report.
- Include completion status, category, completion mode, instruction, resources, legacy subject references, and matched submission summary where available.
- Preserve current official record list and print behavior, adding planned-block detail only where safely useful.

## Deliverables

- Schema update for assigned block snapshots
- Report payload builder update
- Compatibility-preserving saved-record rendering updates

## Files Or Areas To Touch

- src/constants/schema.js
- src/utils/reportUtils.js
- src/pages/Reports.jsx
- src/hooks/useWeeklyReportRecords.js

## Read First

- docs/upgrades/reporting-safety-fixes.md
- docs/specs/reporting-and-compliance-contract.md
- src/constants/schema.js
- src/utils/reportUtils.js
- src/hooks/useWeeklyReportRecords.js
- src/pages/Reports.jsx

## Exit Criteria

- Weekly-plan-backed saved reports include assigned block snapshots.
- Subject-derived fallback reports keep working.
- Existing saved records without the new field still render.
- Incomplete assigned blocks are represented explicitly.

## Automated Test Expectation

Add a focused node script or helper-level check that builds a report payload from a weekly plan with completed and incomplete blocks and verifies the assigned block snapshot.

## Test Files

- scripts/check-report-snapshot-payload.mjs

## Test Cases To Cover

- Completed weekly-plan block includes matched submission summary.
- Incomplete weekly-plan block remains in the assigned snapshot.
- Subject fallback report omits or safely defaults the assigned block snapshot.
- Existing `subjects_data` shape remains compatible.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `code-review`: preferred tools `shell`; default evidence file and line references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- Reports saved-record browser with old and new records

## Evidence Required

- payload check output or no-helper rationale
- lint/build output
- sample saved payload shape summary

## Allowed Discovery

Follow report utility dependencies and weekly-plan compatibility helpers only as needed.

## Test Commands

- node scripts/check-report-snapshot-payload.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Inspect one newly saved weekly-plan-backed report and one older saved report to confirm both render.

## Master Developer Review Focus

Confirm that Saved Snapshot Enrichment is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Saved Snapshot Enrichment. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Saved Snapshot Enrichment using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
