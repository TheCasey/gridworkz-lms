# Phase 6: Extension Paired-State Hardening

## Goal

Remove self-service paired-browser controls that let a student disable enforcement or clear pairing without parent involvement.

## Depends On

- Phase 5: Pairing Wizard And Device Summaries

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Remove or lock local turn-blocking-off behavior when a trusted pairing exists.
- Remove or lock local clear-pairing behavior when a trusted pairing exists unless a parent-issued recovery code is validated.
- Add a parent-authorized local recovery token flow for paired browser recovery.
- Keep unpaired setup and legacy migration behavior understandable.
- Preserve cached fallback and distinct revoked or inactive states.

## Deliverables

- Popup and options UI without paired self-service disable or unpair actions.
- Parent dashboard recovery-code action for a selected paired device.
- Background/options handling that refuses local paired clear requests without a valid parent recovery code.
- Updated extension guidance copy for paired, revoked, inactive, stale, and unpaired states.
- Extension-state script coverage.

## Files Or Areas To Touch

- extensions/chrome-lockdown-poc/popup.html
- extensions/chrome-lockdown-poc/popup.js
- extensions/chrome-lockdown-poc/options.html
- extensions/chrome-lockdown-poc/options.js
- extensions/chrome-lockdown-poc/background.js
- extensions/chrome-lockdown-poc/policy.js
- extensions/chrome-lockdown-poc/guidance.js
- src/components/LockdownPolicyPanel.jsx
- src/firebase/trustedOperations.js
- functions/src/index.js
- scripts/check-lockdown-extension-states.mjs
- scripts/check-lockdown-device-management.mjs

## Read First

- docs/specs/lockdown-simplification-and-extension-launcher-workflow/phases/phase-06-extension-paired-state-hardening/phase.md
- src/components/LockdownPolicyPanel.jsx
- src/firebase/trustedOperations.js
- functions/src/index.js
- extensions/chrome-lockdown-poc/options.js
- scripts/check-lockdown-extension-states.mjs

## Exit Criteria

- A paired student cannot clear pairing from the normal extension UI.
- A paired student cannot turn local blocking off from the popup.
- A paired browser can clear local pairing only with a valid one-time, 15-minute parent-issued recovery code tied to the same parent, student, and device.
- Local recovery does not become a broad emergency unlock or open-browsing state.
- Revoked and inactive states do not silently become open browsing states.
- Unpaired setup remains possible for initial pairing or parent-directed recovery.

## Automated Test Expectation

Update extension-state and device-management scripts to assert paired disable and paired clear controls are absent or rejected, parent-authorized recovery code behavior is one-time and device-bound, and package checks still pass.

## Test Files

- scripts/check-lockdown-extension-states.mjs
- scripts/check-lockdown-release-package.mjs
- scripts/check-lockdown-device-management.mjs

## Test Cases To Cover

- Trusted paired popup labels blocking as parent-managed.
- Trusted paired options page does not expose self-service clear-pairing without a parent recovery code.
- Background clear-pairing message rejects paired credentials unless a valid one-time 15-minute parent recovery code validates for the same parent, student, and device.
- Recovery code clears local pairing only; cached policy is not treated as open browsing until re-paired.
- Legacy pairing replacement remains possible.
- Package check still passes after UI changes.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `extension-smoke`: preferred tools `Chrome`, `computer-use`, `playwright`; default evidence Chrome profile notes, screenshot. Validate the browser extension in a live browser context, including load, install, and core interaction paths.

## Runtime Targets

- extensions/chrome-lockdown-poc
- chrome://extensions

## Evidence Required

- extension-state script output
- release-package script output
- device-management script output
- screenshot of paired popup/options state

## Allowed Discovery

Follow extension imports and current background message handlers only as needed.

## Test Commands

- node scripts/check-lockdown-extension-states.mjs
- node scripts/check-lockdown-release-package.mjs
- node scripts/check-lockdown-device-management.mjs
- npm run build

## Manual Verification Follow-Up

- Reload the unpacked extension in a paired student profile and confirm paired popup/options do not provide student disable actions and only allow local clear with a valid parent recovery code.

## Project Manager Decisions

- Implement a parent-authorized local recovery token in Phase 6 rather than only removing self-service clear/disable controls.
- Approved recovery-token contract: parent dashboard issues a one-time 15-minute recovery code tied to parent, student, and device; extension options accepts it once to clear local pairing for that device; cached policy is not treated as open browsing until the browser is re-paired; no broad emergency unlock is added.

## Human Assistance Triggers

- Provide access to the paired student Chrome profile or confirm manual screenshots after reload.

## Master Developer Review Focus

Confirm that Extension Paired-State Hardening is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Treat this as bypass reduction, not impossible anti-tamper. Do not claim unmanaged Chrome can prevent uninstall.
- `tester`: Try the obvious local disable and clear-pairing paths in UI and message handlers.

## Next Phase Inputs

- Hardened paired extension controls
- Clear extension state copy for launcher work
