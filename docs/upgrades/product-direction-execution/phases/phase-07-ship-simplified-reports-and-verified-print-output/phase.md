# Phase 7: Ship Simplified Reports And Verified Print Output (source Phase 6)

## Goal

Use a clear student/week-first report hierarchy: assigned, completed/incomplete, corrections, notes, then evidence/export. Keep school-year/quarter filters without competing overview panels.

## Depends On

- Operational Phase 6 / source Phase 5

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Use a clear student/week-first report hierarchy: assigned, completed/incomplete, corrections, notes, then evidence/export. Keep school-year/quarter filters without competing overview panels.
- Build live, saved, rollover, print, and export summaries from the common effective-completion resolver. Persist published revision, assigned block snapshots, correction watermark/version, and original-versus-amended report links.
- Show student submissions and parent corrections separately; parent overrides cannot count as fabricated timed minutes. Assigned-but-incomplete work and missing required responses remain explicit.
- Provide original/amended report selection. Saved and archived content stays stable after later subject/template edits; amended exports visibly identify amendment date and relevant corrections.
- Retain HTML escaping in every print path. Consolidate shared report rendering only as needed to prevent screen/print divergence; preserve legacy report reads and evidence references.
- Verify browser print preview and generated PDFs for US Letter and A4 with long names, long response text, many subjects/blocks, zero completions, legacy records, notes, evidence references, and amendments. Avoid oversized unbreakable student sections; verify page breaks, repeated headings, and no clipping/blank-page surprises.
- Inspect representative real household output with authorized local data, without committing it. Use synthetic long-content fixtures in reproducible tests. Include a physical print spot check if a printer is available; rendered preview/PDF checks remain mandatory.
- Exercise custom reset/rollover with a disposable household and verify saved/archived reports and amendments survive. Update reporting docs and promote the unit.

## Deliverables

- Complete source plan Phase 6 code/docs and validation evidence

## Files Or Areas To Touch

- See source plan phase file boundaries; orchestrator owns shared integration files

## Read First

- AGENTS.md
- docs/upgrades/product-direction-execution-plan-2026-09.md
- docs/upgrades/product-direction-execution/decisions.md

## Exit Criteria

- on-screen, saved, exported, and printed totals agree; long-content pages have been visually inspected; original history remains readable. Attach redacted screenshots/PDF artifacts and test results to the release evidence.

## Automated Test Expectation

Add meaningful policy/persistence tests for the source phase cases; static source assertions cannot replace declared runtime validation.

## Test Files

- Not listed yet. Add likely files before dispatching developer work if automated tests are expected.

## Test Cases To Cover

- Not listed yet. Add focused regression or behavior cases before dispatching developer work if the phase changes behavior.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `api-smoke`: preferred tools `shell`, `curl`; default evidence request or response summary, command output. Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- Firebase emulators on isolated demo-gridworkz-direction project; production requires orchestrator release gate

## Evidence Required

- Commands and outcomes, redacted persisted observations, environment and commit IDs

## Allowed Discovery

Follow active phase imports/consumers/tests; do not widen product scope.

## Test Commands

- npm run lint
- npm run build
- npm run check:student-timers

## Manual Verification Follow-Up

- None currently required. Add a follow-up here if the phase cannot be fully verified in-agent.

## Project Manager Questions

- None currently known. Ask only if product intent, acceptance criteria, or runtime setup is still underspecified.

## Human Assistance Triggers

- Request only missing external access or owner-authorized live purchase when it becomes required.

## Master Developer Review Focus

Confirm that Ship Simplified Reports And Verified Print Output (source Phase 6) is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Use the accepted decisions. No commits, pushes, deployment, real billing changes, or production seeding.
- `tester`: Test integrated code independently; report runtime gaps as pending, never as passes.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
