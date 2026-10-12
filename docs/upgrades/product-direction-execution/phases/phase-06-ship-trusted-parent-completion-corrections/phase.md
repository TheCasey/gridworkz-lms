# Phase 6: Ship Trusted Parent Completion Corrections (source Phase 5)

## Goal

Add append-only correction events and a server-owned effective block-state projection. Record household/student/week/plan/block identity, prior/new status, parent UID, server timestamp, reason/note, referenced submission/event, and idempotency key. Keep parent-only audit detail separate from the student-safe projection.

## Depends On

- Operational Phase 5 / source Phase 4

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add append-only correction events and a server-owned effective block-state projection. Record household/student/week/plan/block identity, prior/new status, parent UID, server timestamp, reason/note, referenced submission/event, and idempotency key. Keep parent-only audit detail separate from the student-safe projection.
- Implement trusted parent mark-complete/undo operations with ownership and assignment checks. Use transactional revision checks so concurrent parent/student actions cannot silently overwrite each other.
- Define precedence concretely: undo supersedes the prior accepted completion; a new valid student submission after undo may complete the block. Repeated retries do not create duplicate events. Parent completion bypasses required timer/response only as an explicit labeled correction, never as invented student evidence.
- Route existing Students controls through the new contract; remove destructive undo. Migrate legacy manual submissions as legacy parent records without inventing unknown actors/times.
- Add a compact shared block-detail/correction control in Weekly Plan and report details, showing effective status, actor/time, and history. Ensure it remains reachable on small screens.
- Make dashboard progress, live activity, student available blocks, reports, rollover, and Lockdown policy consume the same effective state. Completed timers become irrelevant after correction; undo never resumes an expired timer automatically.
- Close direct-write bypasses for the affected school flow. Recommended bounded approach: move new completion writes through the existing PIN-verified student trust pattern, validate block/timer/response context, and protect server audit fields and projections. Deny cross-household update/delete and correction spoofing in rules. Migrate deployed clients before enforcing write restrictions; keep legacy reads as needed.
- Append report amendment metadata when saved/archived history is corrected. Preserve originals; Phase 6 renders the version choice. A correction to an archived week does not reopen that week in the portal.

## Deliverables

- Complete source plan Phase 5 code/docs and validation evidence

## Files Or Areas To Touch

- See source plan phase file boundaries; orchestrator owns shared integration files

## Read First

- AGENTS.md
- docs/upgrades/product-direction-execution-plan-2026-09.md
- docs/upgrades/product-direction-execution/decisions.md

## Exit Criteria

- every completion-correction surface uses auditable events; undo never deletes original student work; persisted security and state-consistency tests pass. Broader public-read/student-session hardening remains documented separately, but no bypass of this new authority is accepted.

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

Confirm that Ship Trusted Parent Completion Corrections (source Phase 5) is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Use the accepted decisions. No commits, pushes, deployment, real billing changes, or production seeding.
- `tester`: Test integrated code independently; report runtime gaps as pending, never as passes.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
