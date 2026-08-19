# Phase 4: Device Management And Revocation

## Goal

Add trusted device listing, revocation, and explicit extension handling for revoked, unpaired, locally cleared, and stale cached states.

## Depends On

- Phase 3: Resource Normalization And Parent Testing

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add trusted Cloud Functions for parent-owned device list and revoke operations.
- Add device table and revoke or retire actions to the Lockdown dashboard.
- Align extension sync state with revoked, inactive, invalid credential, local unpair, and network failure cases.

## Deliverables

- Trusted list/revoke functions and client bridge
- Parent device list UI with status, student binding, paired time, last seen, last policy read, platform, and extension version
- Extension popup/options status copy for revoked, unpaired, and cached states
- Focused checks for trusted function authorization and extension sync-state transitions

## Files Or Areas To Touch

- functions/src/index.js
- src/firebase/trustedOperations.js
- src/components/LockdownPolicyPanel.jsx
- extensions/chrome-lockdown-poc/background.js
- extensions/chrome-lockdown-poc/policy.js
- extensions/chrome-lockdown-poc/popup.js
- extensions/chrome-lockdown-poc/options.js
- scripts/check-lockdown-device-management.mjs

## Read First

- functions/src/index.js
- src/firebase/trustedOperations.js
- src/components/LockdownPolicyPanel.jsx
- extensions/chrome-lockdown-poc/background.js
- extensions/chrome-lockdown-poc/policy.js
- docs/specs/lockdown-production-behavior-contract.md

## Exit Criteria

- Parents can list paired devices per student and revoke a selected device.
- Revoked credentials no longer receive active trusted policy reads.
- Extension UI distinguishes revoked/device inactive from ordinary network sync failure.
- Local clear-pairing behavior is explicitly aligned with the product decision recorded in the phase run log.

## Automated Test Expectation

Add or update trusted-operation checks for device list/revoke authorization and pure extension sync-state transition checks where they can run outside Chrome.

## Test Files

- scripts/check-lockdown-device-management.mjs
- scripts/seed-lockdown-phase4-validation.mjs

## Test Cases To Cover

- Parent can list only devices owned by their account.
- Revoking a device changes status and blocks subsequent trusted policy reads.
- Inactive device and invalid credential produce different extension sync states.
- Network failure keeps cached fallback only when a last good trusted policy exists.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence focused check script output. Run the existing focused automated tests that cover the active slice before widening scope.
- `api-smoke`: preferred tools `shell`, `curl`, `Firebase callable or HTTP function smoke`; default evidence request or response summary, command output. Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape.
- `extension-smoke`: preferred tools `playwright`, `computer-use`, `Chrome extension manual load`; default evidence extension runtime evidence, screenshot or storage/policy summary. Validate the browser extension in a live browser context, including load, install, and core interaction paths.
- `build-health`: preferred tools `shell`; default evidence npm run lint output, npm run build output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- Lockdown dashboard device table
- readLockdownDevicePolicy after revoke
- Chrome extension popup/options

## Evidence Required

- trusted-operation check output
- API smoke response summary when credentials are available
- extension status evidence
- lint/build output

## Allowed Discovery

Start with the listed read-first files, then follow imports, routes, existing check scripts, extension files, functions, and nearby docs only as needed for the active phase.

## Test Commands

- node scripts/check-lockdown-device-management.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Revocation against a real paired extension remains manual unless a disposable extension profile is available.

## Master Developer Review Focus

Confirm that Device Management And Revocation is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Device Management And Revocation. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Device Management And Revocation using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Device status and revocation state for student-facing blocked and setup experiences.
