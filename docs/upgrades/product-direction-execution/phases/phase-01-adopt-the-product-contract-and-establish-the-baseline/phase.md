# Phase 1: Adopt The Product Contract And Establish The Baseline (source Phase 0)

## Goal

Record the decisions above, conflicts with older specs, scope exclusions, and migration policy in this plan's companion decision log.

## Depends On

- None

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Record the decisions above, conflicts with older specs, scope exclusions, and migration policy in this plan's companion decision log.
- Confirm current production Firebase project/region, public and dashboard Cloudflare Pages projects, build branch, environment configuration, Stripe mode, and rollback deployment IDs. The repo has no `.firebaserc`; always resolve the target explicitly.
- Inventory entitlement versions, legacy subject records, shared routine templates, wallets/unlocks, pending redemptions, outstanding allowance, published/archived weeks, and saved reports. Use counts/redacted samples; keep credentials and household content out of committed logs.
- Install existing lockfiles, rerun baseline under Node 20, and resolve the entitlement-test failure by checking actual intended feature behavior. Preserve failing-case evidence.
- Refresh stale repository guidance about lint, routes/hooks, and emulator support when implementation begins; do not use old notes as release authority.
- Write the acceptance matrix, environment inventory, decision log, and release checklist under a companion `product-direction-execution/` folder.

## Deliverables

- Complete source plan Phase 0 code/docs and validation evidence

## Files Or Areas To Touch

- See source plan phase file boundaries; orchestrator owns shared integration files

## Read First

- AGENTS.md
- docs/upgrades/product-direction-execution-plan-2026-09.md
- docs/upgrades/product-direction-execution/decisions.md

## Exit Criteria

- accepted decisions, identified deployment targets, reproducible baseline, existing-data inventory, and test fixtures identified. If live customers exist, their billing transition is documented before billing changes.

## Automated Test Expectation

Run supported Node 20 baseline and correct stale assertion; document counts without household data.

## Test Files

- Not listed yet. Add likely files before dispatching developer work if automated tests are expected.

## Test Cases To Cover

- Not listed yet. Add focused regression or behavior cases before dispatching developer work if the phase changes behavior.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `code-review`: preferred tools `shell`; default evidence code references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.

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

Confirm that Adopt The Product Contract And Establish The Baseline (source Phase 0) is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Use the accepted decisions. No commits, pushes, deployment, real billing changes, or production seeding.
- `tester`: Test integrated code independently; report runtime gaps as pending, never as passes.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
