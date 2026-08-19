# Phase 6: Embedded Work Launcher Foundation

## Goal

Build the first shared work-launcher foundation so kiosk mode and a future extension popup/sidebar can show published work, start or resume an active block, and display allowed resources without becoming a second curriculum source.

## Depends On

- Phase 5: Student Blocked Experience And Access Requests

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Define a reusable work-launcher data adapter over published weekly plans and active work sessions.
- Add a student-facing launcher view in the safest current surface first, then expose the contract for extension popup/sidebar or kiosk shell.
- Do not implement full kiosk mode in this phase.

## Deliverables

- Shared work-launcher helper or hook that lists published weekly blocks and allowed-resource status
- Active work start/resume pathway compatible with the policy contract
- Minimal UI target for launcher behavior in student portal or extension popup as accepted by master-developer
- Focused checks for published-plan block listing, active-work start, and allowed-resource display

## Files Or Areas To Touch

- src/hooks/useStudentPortalWeeklyPlan.js
- src/hooks/useStudentAccessPolicy.js
- src/pages/StudentPortal.jsx
- src/utils/lockdownPolicyUtils.js
- extensions/chrome-lockdown-poc/popup.js
- extensions/chrome-lockdown-poc/popup.html
- scripts/check-lockdown-work-launcher.mjs

## Read First

- docs/specs/lockdown-production-behavior-contract.md
- src/pages/StudentPortal.jsx
- src/hooks/useStudentPortalWeeklyPlan.js
- src/hooks/useStudentAccessPolicy.js
- src/utils/lockdownPolicyUtils.js
- extensions/chrome-lockdown-poc/popup.js

## Exit Criteria

- Launcher reads published weekly-plan work and does not duplicate curriculum state.
- Student can select a block and create or resume an active work context compatible with trusted policy derivation.
- Allowed resources displayed by the launcher match the derived policy for that active work.
- Future kiosk mode can reuse the launcher adapter without depending on the web student portal component tree.

## Automated Test Expectation

Add a focused work-launcher check script for published-plan listing, active-work start/resume shape, and allowed-resource display mapping.

## Test Files

- scripts/check-lockdown-work-launcher.mjs

## Test Cases To Cover

- Published weekly blocks render in stable order.
- Completed or unavailable blocks are not startable.
- Starting a block produces active-work-session data used by policy derivation.
- Allowed-resource status matches active block resources and system resources.
- Legacy subject compatibility remains a bridge, not the primary launcher source.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence focused check script output. Run the existing focused automated tests that cover the active slice before widening scope.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot or DOM summary. Load the live UI in a runtime and verify the main happy path for the active slice.
- `extension-smoke`: preferred tools `playwright`, `computer-use`, `Chrome extension manual load`; default evidence extension runtime evidence, screenshot or storage/policy summary. Validate the browser extension in a live browser context, including load, install, and core interaction paths.
- `build-health`: preferred tools `shell`; default evidence npm run lint output, npm run build output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- Student portal weekly work surface
- Chrome extension popup/sidebar candidate if implemented
- Future kiosk shell contract documented but not built

## Evidence Required

- work-launcher check output
- browser-smoke evidence for selecting a block
- extension popup evidence if touched
- lint/build output

## Allowed Discovery

Start with the listed read-first files, then follow imports, routes, existing check scripts, extension files, functions, and nearby docs only as needed for the active phase.

## Test Commands

- node scripts/check-lockdown-work-launcher.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Kiosk-mode UI remains future work; record the reusable contract and any remaining native/kiosk decisions.

## Master Developer Review Focus

Confirm that Embedded Work Launcher Foundation is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Embedded Work Launcher Foundation. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Embedded Work Launcher Foundation using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Reusable launcher contract and active-work source for release hardening and kiosk planning.
