# Phase 9: Complete Production Acceptance And Operational Handoff (source Phase 8)

## Goal

Confirm each accepted unit is merged, CI-green, and deployed from the recorded commit. Use explicit Firebase target IDs and record Functions/rules/indexes versions and Cloudflare deployments for both hosts.

## Depends On

- Operational Phase 8 / source Phase 7

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Confirm each accepted unit is merged, CI-green, and deployed from the recorded commit. Use explicit Firebase target IDs and record Functions/rules/indexes versions and Cloudflare deployments for both hosts.
- Run the full acceptance matrix below on production with disposable households. Ordinary household data is read-only for validation; mutation, correction, subscription, and cleanup scenarios use the fixtures and accepted billing policy.
- Observe a household-local routine date rollover and a custom week reset, including report archival, no repeated awards, and continued student work. In staging, force boundary/DST scenarios; production must include an observed real rollover, not just date-helper checks.
- Observe production for at least 48 hours after the final activation and through one weekly reset, whichever is later. Review callable failures/denials, webhook lag/failure, award reconciliation, portal listener/read-volume regression, and report-save errors. Set numerical alert thresholds against Phase 0 baseline in the release checklist.
- Rehearse rollback in staging and document exact recovery steps. Roll back UI/flags when possible; retain additive backend compatibility and ledger/audit events. Never restore an old backend that cannot understand newly written data.
- Update the roadmap, architecture, impacted specs/features/upgrades, and support runbooks to actual shipped behavior. Separate this release's completed scope from deferred Lockdown/projects/attachments/session-hardening work.
- Publish a final internal release record with commit/deployment IDs, entitlement/catalog/schema versions, migrations and counts, acceptance results, redacted screenshots/PDFs, observation window, rollback procedure, and any remaining limitations.

## Deliverables

- Complete source plan Phase 8 code/docs and validation evidence

## Files Or Areas To Touch

- See source plan phase file boundaries; orchestrator owns shared integration files

## Read First

- AGENTS.md
- docs/upgrades/product-direction-execution-plan-2026-09.md
- docs/upgrades/product-direction-execution/decisions.md

## Exit Criteria

- all release-critical acceptance rows pass, observation and rollover checks are complete, and no unresolved data-loss, authorization, billing, award-duplication, or completion-consistency defect remains. A pending operational dependency stays pending; it is not a completed phase.

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

Confirm that Complete Production Acceptance And Operational Handoff (source Phase 8) is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Use the accepted decisions. No commits, pushes, deployment, real billing changes, or production seeding.
- `tester`: Test integrated code independently; report runtime gaps as pending, never as passes.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
