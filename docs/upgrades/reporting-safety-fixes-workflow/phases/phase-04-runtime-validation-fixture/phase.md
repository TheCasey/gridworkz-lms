# Phase 4: Runtime Validation Fixture

## Goal

Create a practical fixture or runbook for validating publish to portal to report to rollover behavior with realistic reporting data.

## Depends On

- evidence-contract-reconciliation

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add a script, fixture notes, or runbook for creating/reporting against a parent, student, active subject, current published weekly plan, submission, and previous-week published plan.
- Use the fixture to validate live report cards, saved official records, incomplete-week records, and rollover archival when credentials are available.
- Record any remaining manual-only gaps clearly.

## Deliverables

- Reporting validation fixture script or runbook
- Runtime validation checklist
- Final documentation status update

## Files Or Areas To Touch

- scripts/*
- docs/upgrades/reporting-safety-fixes.md
- docs/features/reporting-and-rollover.md

## Read First

- docs/upgrades/reporting-safety-fixes.md
- scripts/seed-lockdown-phase4-validation.mjs
- src/hooks/useWeeklyReportRecords.js
- src/hooks/useWeeklyRollover.js
- src/utils/reportUtils.js
- firestore.rules

## Exit Criteria

- There is a repeatable path to validate report behavior with realistic weekly-plan data.
- Fixture or runbook covers current-week published plans, zero-completion weeks, submitted work, saved records, and previous-week rollover.
- Remaining staging/manual prerequisites are documented.

## Automated Test Expectation

If a script is added, include a dry-run or validation mode where practical; otherwise document why live Firebase credentials are required.

## Test Files

- scripts/seed-reporting-validation.mjs

## Test Cases To Cover

- Seed or document current published weekly plan with no submissions.
- Seed or document current published weekly plan with one submission.
- Seed or document previous-week published weekly plan for rollover archival.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.
- `manual-qa`: preferred tools `human`; default evidence manual verification note. Document the manual follow-up that a human must complete before final merge or release confidence.

## Runtime Targets

- http://localhost:3000/dashboard/reports
- http://localhost:3000/student/:slug

## Evidence Required

- fixture/runbook path
- lint/build output
- browser validation notes or credentials-unavailable note

## Allowed Discovery

Follow existing seed script patterns, report hooks, weekly-plan helpers, and student portal route only as needed.

## Test Commands

- node scripts/seed-reporting-validation.mjs --dry-run
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Run the fixture against emulator or staging and validate save, print, and rollover behavior before treating reporting as beta-ready.

## Master Developer Review Focus

Confirm that Runtime Validation Fixture is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Runtime Validation Fixture. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Runtime Validation Fixture using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
