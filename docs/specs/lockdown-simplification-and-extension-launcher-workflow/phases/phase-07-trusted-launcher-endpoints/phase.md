# Phase 7: Trusted Launcher Endpoints

## Goal

Add credential-authenticated launcher reads and active block start/resume actions for the paired extension.

## Depends On

- Phase 6: Extension Paired-State Hardening

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Expose a trusted launcher-state read for the bound student.
- Expose start or resume actions for published weekly blocks through the device credential.
- Ensure launcher actions write or update the same timer/session state used by policy derivation.
- Return updated policy data or a clear refresh signal so the extension can apply changes immediately.

## Deliverables

- Cloud Function endpoints or extensions to existing trusted policy endpoint for launcher state and start/resume.
- Shared client/extension contract helpers for launcher payloads.
- Timer/work-session write path scoped to the bound student.
- Focused Node script for launcher contract behavior.

## Files Or Areas To Touch

- functions/src/index.js
- src/utils/workLauncherUtils.js
- src/utils/timerUtils.js
- src/utils/lockdownPolicyUtils.js
- extensions/chrome-lockdown-poc/background.js
- extensions/chrome-lockdown-poc/policy.js
- scripts/check-lockdown-work-launcher.mjs
- firestore.rules

## Read First

- docs/specs/lockdown-simplification-and-extension-launcher.md
- functions/src/index.js
- src/utils/workLauncherUtils.js
- src/utils/timerUtils.js
- src/utils/lockdownPolicyUtils.js
- scripts/check-lockdown-work-launcher.mjs

## Exit Criteria

- A paired device credential can read only its bound student's launcher state.
- A paired device credential can start or resume an allowed published weekly block for that student.
- Starting or resuming a block updates timer/session state used by derived policy.
- The response lets the extension refresh or apply policy immediately.

## Automated Test Expectation

Add or update a launcher contract script that exercises auth scoping, published-plan filtering, start/resume behavior, and policy refresh output.

## Test Files

- scripts/check-lockdown-work-launcher.mjs
- scripts/check-lockdown-derived-policy.mjs
- scripts/check-lockdown-policy-states.mjs

## Test Cases To Cover

- Credential for student A cannot start student B's block.
- Draft or unpublished weekly blocks are not startable.
- Completed or unavailable blocks return a structured denial.
- Starting a block creates or resumes the expected timer/session state.
- Returned policy includes active block resources immediately.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `api-smoke`: preferred tools `shell`, `curl`; default evidence request or response summary, command output. Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- Firebase Functions emulator or deployed staging functions

## Evidence Required

- launcher script output
- derived policy script output
- npm run build output
- emulator or deployed endpoint smoke note if available

## Allowed Discovery

Follow trusted endpoint, timer, and weekly-plan helper imports only as needed.

## Test Commands

- node scripts/check-lockdown-work-launcher.mjs
- node scripts/check-lockdown-derived-policy.mjs
- npm run build

## Manual Verification Follow-Up

- Smoke the endpoint against emulator or staging before relying on a paired Chrome profile.

## Project Manager Questions

- Confirm whether launcher start should create a timer with a default duration, use the block duration, or resume only when the student portal has already created a session.

## Human Assistance Triggers

- Provide deployed Functions endpoint or emulator setup if local callable smoke cannot run in-agent.

## Master Developer Review Focus

Confirm that Trusted Launcher Endpoints is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Keep all extension launcher reads and mutations on the trusted device credential path. Do not add Firestore direct reads to the extension.
- `tester`: Focus on auth scoping and whether policy changes are available immediately after start/resume.

## Next Phase Inputs

- Trusted launcher contract
- Immediate policy refresh behavior after start/resume
