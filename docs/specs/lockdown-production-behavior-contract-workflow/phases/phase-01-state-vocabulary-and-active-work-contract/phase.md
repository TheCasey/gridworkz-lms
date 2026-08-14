# Phase 1: State Vocabulary And Active Work Contract

## Goal

Create the shared Lockdown state vocabulary and active-work-session contract that the dashboard, functions, extension, future kiosk mode, and embedded launcher can all consume.

## Depends On

- None

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Define the production Lockdown state enum and state metadata without changing enforcement behavior yet.
- Define the active work session shape for timer-backed, task-complete, future project, and future worksheet contexts.
- Keep the launcher as a contract target only in this phase; do not build UI yet.
- Keep system allowlist wiring, device list/revocation behavior, extension blocked-page copy, parent URL testing, and embedded launcher UI in later phases.

## Deliverables

- Shared constants/schema comments for production policy states and active work sessions
- Client and function-side normalization helpers for state metadata and active-work-session payloads
- Focused check script proving state normalization and active-work-session compatibility cases

## Files Or Areas To Touch

- src/constants/schema.js
- src/utils/lockdownPolicyUtils.js
- functions/src/index.js
- src/hooks/useStudentAccessPolicy.js
- scripts/check-lockdown-policy-states.mjs
- docs/specs/lockdown-production-behavior-contract.md

## Read First

- docs/specs/lockdown-production-behavior-contract.md
- src/utils/lockdownPolicyUtils.js
- functions/src/index.js
- src/constants/schema.js
- src/hooks/useStudentAccessPolicy.js
- docs/architecture.md

## Exit Criteria

- Production states distinguish active block, no active session, no published plan, no active work, off-hours open, off-hours closed, entitlement inactive, device revoked, unpaired, and stale cached policy.
- Active work session contract can be started by the student portal now and by extension or kiosk launchers later.
- Existing policy derivation remains behavior-compatible until later phases intentionally change enforcement.

## Automated Test Expectation

Add a focused check script for Lockdown state normalization and active-work-session compatibility, then run it with lint and build. No browser or extension smoke is required in this phase.

## Test Files

- scripts/check-lockdown-policy-states.mjs

## Test Cases To Cover

- Published plan plus matching timer resolves to active work.
- School time without active work resolves to the no-active-session state.
- No published plan and no active work are distinct states.
- Off-hours open and off-hours closed normalize as distinct state metadata.
- Device revoked, unpaired, and stale cached policy normalize as distinct metadata states without implementing the device-management flow.
- Future project or worksheet session fields survive normalization without becoming legacy-only.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence focused check script output. Run the existing focused automated tests that cover the active slice before widening scope.
- `build-health`: preferred tools `shell`; default evidence npm run lint output, npm run build output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `code-review`: preferred tools `shell`; default evidence code references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.

## Runtime Targets

- No browser or extension runtime target in Phase 1

## Evidence Required

- check script output
- lint/build output
- code references for shared state contract

## Allowed Discovery

Start with the listed read-first files, then follow imports, routes, existing check scripts, extension files, functions, and nearby docs only as needed for the active phase.

## Test Commands

- node scripts/check-lockdown-policy-states.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Confirm no parent, student, or extension UI copy claims the new states before enforcement and blocked-state UI are updated.

## Master Developer Review Focus

Confirm that State Vocabulary And Active Work Contract is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only State Vocabulary And Active Work Contract. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only State Vocabulary And Active Work Contract using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Production state vocabulary and active-work-session contract for policy derivation.
