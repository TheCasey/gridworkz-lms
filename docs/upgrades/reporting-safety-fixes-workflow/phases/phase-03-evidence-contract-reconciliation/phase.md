# Phase 3: Evidence Contract Reconciliation

## Goal

Make report evidence metadata naming consistent across schema, payload, and docs without implementing Storage uploads.

## Depends On

- saved-snapshot-enrichment

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Keep `attachments` as the current code-facing field unless implementation review finds a strong migration reason.
- Update docs that still refer to `evidence_files` as the implemented field.
- Add a small attachment metadata placeholder contract if needed for future Evidence Drawer work.
- Do not add Firebase Storage UI or rules in this workflow.

## Deliverables

- Consistent schema and docs for report attachment metadata
- Future Evidence Drawer handoff note
- No Storage implementation

## Files Or Areas To Touch

- docs/upgrades/reporting-safety-fixes.md
- docs/specs/report-evidence-drawer.md
- src/constants/schema.js
- src/utils/reportUtils.js

## Read First

- docs/upgrades/reporting-safety-fixes.md
- docs/specs/report-evidence-drawer.md
- docs/specs/reporting-and-compliance-contract.md
- src/constants/schema.js
- src/utils/reportUtils.js
- scripts/check-report-snapshot-payload.mjs

## Exit Criteria

- Docs and code agree on the report attachment metadata field name.
- Saved report payloads preserve the chosen field.
- Future Storage work has a clear handoff note.
- No upload UI or Storage rules are introduced.

## Automated Test Expectation

No new automated tests required unless code changes alter report payload defaults; if payload defaults change, extend the snapshot payload helper check.

## Test Files

- scripts/check-report-snapshot-payload.mjs

## Test Cases To Cover

- Saved report payload includes the chosen attachment field default.

## No-Test Rationale

This phase is mostly documentation and schema contract reconciliation; behavior coverage belongs to the report payload checks if code changes are made.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `code-review`: preferred tools `shell`; default evidence file and line references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.

## Runtime Targets

- No explicit runtime targets listed. Add them before live validation if the phase needs them.

## Evidence Required

- doc/schema references showing consistent field naming
- lint/build output if code changed

## Allowed Discovery

Stay within reporting docs, schema, and report payload helpers.

## Test Commands

- node scripts/check-report-snapshot-payload.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Confirm the generated Evidence Drawer follow-up remains out of scope for this workflow.

## Master Developer Review Focus

Confirm that Evidence Contract Reconciliation is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Evidence Contract Reconciliation. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Evidence Contract Reconciliation using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
