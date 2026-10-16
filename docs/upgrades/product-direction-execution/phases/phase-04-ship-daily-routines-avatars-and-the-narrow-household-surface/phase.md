# Phase 4: Ship Daily Routines, Avatars, And The Narrow Household Surface (source Phase 3)

## Goal

Change the dashboard registry/navigation and student workspace language to Daily Routines. Keep Morning/Afternoon/Evening and independent per-student checklist editing; preserve shared-template compatibility reads.

## Depends On

- Operational Phase 3 / source Phase 2

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Change the dashboard registry/navigation and student workspace language to Daily Routines. Keep Morning/Afternoon/Evening and independent per-student checklist editing; preserve shared-template compatibility reads.
- Remove normal weekly/monthly chores, allowance, bounty, and broad reward controls from parent and student navigation. Handle direct URLs and stale tabs intentionally. Keep the parent-only Household History view and accepted pending-obligation settlement actions usable.
- Show clear completion and once-per-day award state, wallet progress, and a compact cosmetic catalog. Empty-state setup must work for a new Free household without a premium settings page.
- Ship a small finished asset set, for example one usable base avatar and three cosmetic unlocks. Replace placeholder-only previews in the active loop; catalog IDs and costs are accepted in Phase 0. Use reviewed bundled assets or controlled storage-backed catalog assets. If Storage is chosen, add and validate its rules/deployment explicitly.
- Persist selection and unlock state through trusted operations. Reload and a second device must show the same choices. Keep already-owned legacy cosmetics visible or provide a documented compatible replacement rather than silently discarding them.
- Activate the backend capability migration and complete Free UI together. Verify downgrade from Core/Lockdown preserves routines, wallet/unlocks, and history; suspended modules must not keep background writes running from mounted hooks.
- Update chores/routines docs and support recovery instructions, then promote this shipping unit.

## Deliverables

- Complete source plan Phase 3 code/docs and validation evidence

## Files Or Areas To Touch

- See source plan phase file boundaries; orchestrator owns shared integration files

## Read First

- AGENTS.md
- docs/upgrades/product-direction-execution-plan-2026-09.md
- docs/upgrades/product-direction-execution/decisions.md

## Exit Criteria

- a new Free household can set up routines, complete a full day, earn once, unlock/equip a cosmetic, and retain it after reload. Existing households retain balances/history. Parent-only history is inaccessible to public student callers. Mobile, keyboard, loading/error/retry, and no-config cases pass.

## Automated Test Expectation

Add meaningful policy/persistence tests for the source phase cases; static source assertions cannot replace declared runtime validation.

## Test Files

- `tests/product-direction/routines.spec.js` (root/browser QA)
- Focused view-model checks when behavior is extracted

## Test Cases To Cover

- Parent Free setup/settings; student full day earns once, unlock/equip/reload and second page.
- Empty household, no routines, opt-out, errors/retry, keyboard/mobile.
- Activated stale broad URLs redirect to history; no broad background writes.
- Existing balances/unlocks visible; owner-only settlement after downgrade.

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

Confirm that Ship Daily Routines, Avatars, And The Narrow Household Surface (source Phase 3) is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Use the accepted decisions. No commits, pushes, deployment, real billing changes, or production seeding.
- `tester`: Test integrated code independently; report runtime gaps as pending, never as passes.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
