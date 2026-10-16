# Phase 3: Implement Routine Reward And Entitlement Authority (source Phase 2)

## Goal

Add a narrowly scoped routine reward/cosmetic capability available on all plans. Do not simply flip the broad `can_use_rewards` flag for Free: that would expose custom catalogs, general point adjustments, and tabled reward workflows.

## Depends On

- Operational Phase 2 / source Phase 1

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add a narrowly scoped routine reward/cosmetic capability available on all plans. Do not simply flip the broad `can_use_rewards` flag for Free: that would expose custom catalogs, general point adjustments, and tabled reward workflows.
- Update client catalog, backend `PLAN_LIMITS`, entitlement normalization/resolution, support override handling, trusted creates, and quota copy together. Core and Lockdown receive unlimited scale; Free keeps the accepted limits.
- Make the routine settings, full-day award, student-safe wallet/catalog/unlock reads, and approved cosmetic mutations work on Free. Continue denying broad chore/allowance/reward mutations according to the accepted suspension policy.
- Reuse the existing ledger and `routine_day:<date_key>` identity. Ensure completion and award are atomic or recoverable through idempotent retry/reconciliation so a crash after completion cannot permanently lose the award. Concurrent device requests cannot double-credit.
- Implement catalog-ID validation, ownership/unlock checks, atomic wallet/unlock changes if cosmetics cost points, and trusted per-student selection persistence. Never accept a client-supplied balance, price, arbitrary asset URL, or another student's unlock.
- Separate new capabilities from broad legacy reward settings. Preserve old balances, catalogs, redemptions, and cosmetic IDs; provide compatible defaults for households that never configured rewards. Template/date snapshots and timezone boundaries must follow the Phase 0 award policy.
- Write a versioned migration with dry-run, redacted count summary, checkpoints, retry, and post-run invariants. Refresh stored entitlement features/limits through the trusted resolver; a catalog edit alone may leave stale `accountEntitlements` records. Preserve billing provider state and valid operator overrides.
- Deploy additive backend/rules support dormant; validate callable behavior in staging before activating the UI and entitlement version together with Phase 3.

## Deliverables

- Complete source plan Phase 2 code/docs and validation evidence

## Files Or Areas To Touch

- See source plan phase file boundaries; orchestrator owns shared integration files

## Read First

- AGENTS.md
- docs/upgrades/product-direction-execution-plan-2026-09.md
- docs/upgrades/product-direction-execution/decisions.md

## Exit Criteria

- persisted backend tests pass, migration is reversible by configuration/forward repair without deleting ledgers, and new UI can consume the contract safely.

## Automated Test Expectation

Add meaningful policy/persistence tests for the source phase cases; static source assertions cannot replace declared runtime validation.

## Test Files

- `scripts/check-routine-reward-helpers.mjs`
- `scripts/check-routine-entitlement-parity.mjs`
- `scripts/check-routine-reward-callables.mjs`
- `scripts/check-product-direction-rules.mjs`

## Test Cases To Cover

- Exact frozen checklists/day identity; concurrent full-day completion and missing-ledger reconciliation.
- Built-in catalog debit/ownership/selection, sibling/PIN isolation, capability overrides.
- Empty/evening-only days, configured settings/opt-out, household timezone changes and DST skipped midnight.
- Owner settlement after downgrade, audit history and refund replay.
- Unlimited paid creates, Free quota, legacy override expiry, billing/support-preserving migration dry-run/replay/deactivation.

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
- npm run check:routine-reward-helpers
- npm run check:routine-entitlements
- npm run check:direction-emulators

## Manual Verification Follow-Up

- None currently required. Add a follow-up here if the phase cannot be fully verified in-agent.

## Project Manager Questions

- None currently known. Ask only if product intent, acceptance criteria, or runtime setup is still underspecified.

## Human Assistance Triggers

- Request only missing external access or owner-authorized live purchase when it becomes required.

## Master Developer Review Focus

Confirm that Implement Routine Reward And Entitlement Authority (source Phase 2) is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Use the accepted decisions. No commits, pushes, deployment, real billing changes, or production seeding.
- `tester`: Test integrated code independently; report runtime gaps as pending, never as passes.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
