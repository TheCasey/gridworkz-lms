# Phase 5: Ship Correct Weekly Plan Persistence And Conditional Timers (source Phase 4)

## Goal

Implement private draft/default storage and atomic published revisions. Saving a draft after publication cannot change published status, student work, current timer scope, reports, or Lockdown policy.

## Depends On

- Operational Phase 4 / source Phase 3

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Implement private draft/default storage and atomic published revisions. Saving a draft after publication cannot change published status, student work, current timer scope, reports, or Lockdown policy.
- Publish the validated on-screen state and corresponding draft together with optimistic revision checks. Detect concurrent-tab edits and offer reload/review. Include clear student/week identity in confirmation and reject archived-week publication.
- Save the per-student default atomically. Future generated weeks use it; existing weeks do not change. Keep legacy subject defaults as fallback, and define carry-forward of defaults when a subject/block is archived or removed.
- Put status and actions in a persistent accessible header/bar: Save Draft; Save as Default Week; Publish This Week. Indicate unsaved edits, draft-versus-published differences, and differences from defaults independently. Confirm exactly what was saved/published after success.
- Handle intentional empty-week publication. Once a household uses published plans, an empty/missing plan must not accidentally re-expose raw-subject fallback work; legacy fallback remains only where the compatibility contract permits it.
- Use `require_timer`/the accepted completion contract consistently in builder, normalized weekly blocks, policy, launcher, and UI. Render the timer panel only for timed blocks; show No timer and direct completion for non-timed blocks while still requiring configured response fields.
- Retain target-end-time accuracy, one-timer policy where applicable, and the recent stale-session fixes. Handle timer requirement removal, block removal, and republish during an active session without stranding progress or silently transferring time to another block.
- Update client rollover/report and Lockdown derivation to consume published state, never private drafts. Deploy compatible readers/backend/rules before enabling new writers.

## Deliverables

- Complete source plan Phase 4 code/docs and validation evidence

## Files Or Areas To Touch

- See source plan phase file boundaries; orchestrator owns shared integration files

## Read First

- AGENTS.md
- docs/upgrades/product-direction-execution-plan-2026-09.md
- docs/upgrades/product-direction-execution/decisions.md

## Exit Criteria

- all three actions match their promises in persisted browser/backend tests, timed/non-timed flows pass, and existing Lockdown policy regressions pass. Promote the unit before contextual correction UI.

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

Confirm that Ship Correct Weekly Plan Persistence And Conditional Timers (source Phase 4) is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Use the accepted decisions. No commits, pushes, deployment, real billing changes, or production seeding.
- `tester`: Test integrated code independently; report runtime gaps as pending, never as passes.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
