# Phase 2: Fix Shared Contracts And Build Persisted QA Fixtures (source Phase 1)

## Goal

Define versioned contracts for private drafts/defaults, published revisions, routine reward capability, cosmetic ownership/selection, parent correction events, effective block state, and report amendments.

## Depends On

- Operational Phase 1 / source Phase 0

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Define versioned contracts for private drafts/defaults, published revisions, routine reward capability, cosmetic ownership/selection, parent correction events, effective block state, and report amendments.
- Recommended planning storage: retain `weeklyPlans/{planId}` as the portal-readable published/archived snapshot; use separate parent-private `weeklyPlanDrafts/{planId}` and student-specific default-week records. Never place private draft fields inside a publicly readable published document.
- Define stable block identities across publish, repeated copies, republish, completion, timers, and corrections. Retain IDs for unchanged instances; do not renumber completed work into different assignments. Specify legacy `(student, week, subject, block_index)` mapping and ambiguous-record review.
- Define authorization and compatibility matrices for old clients/records, Free/Core/Lockdown, expired overrides, legacy Pro handling, and unavailable backend state. Choose additive rollout flags/configuration before implementation; product visibility and entitlement enforcement remain separate concerns.
- Extend existing fixture writers with zero/one/multi-student households, all plan levels, quota boundaries, legacy subjects/routines, midweek published edits, archived reports, pending rewards, and timed/non-timed blocks. Make repeated seeding/reset deterministic.
- Add a reproducible browser test harness and actual rules/callable emulator tests for these contracts; reuse existing Node assertion scripts for pure helpers. Record which checks execute backend writes and which only inspect source text.
- Add relevant gates to CI, including Functions dependencies and emulator prerequisites where required. Establish named scripts for the new planning, corrections, cosmetic, report, and billing scenarios as they are implemented.

## Deliverables

- Complete source plan Phase 1 code/docs and validation evidence

## Files Or Areas To Touch

- See source plan phase file boundaries; orchestrator owns shared integration files

## Read First

- AGENTS.md
- docs/upgrades/product-direction-execution-plan-2026-09.md
- docs/upgrades/product-direction-execution/decisions.md

## Exit Criteria

- contracts and representative persisted fixtures are reviewed; tests can prove both success and denied access. No production migration yet.

## Automated Test Expectation

Add meaningful policy/persistence tests for the source phase cases; static source assertions cannot replace declared runtime validation.

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

Confirm that Fix Shared Contracts And Build Persisted QA Fixtures (source Phase 1) is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Use the accepted decisions. No commits, pushes, deployment, real billing changes, or production seeding.
- `tester`: Test integrated code independently; report runtime gaps as pending, never as passes.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
