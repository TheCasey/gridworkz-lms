# Phase 5: Pairing Wizard And Device Summaries

## Goal

Convert trusted enrollment and device management into a parent-friendly wizard and compact device summaries.

## Depends On

- Phase 4: Schedule And Allowed Preview

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Build the pair-browser wizard modal.
- Keep trusted enrollment issuance student-bound.
- Summarize paired, stale, revoked, and inactive device counts.
- Move the full device table into a manage-devices modal.
- Add clear hardening guidance without overpromising consumer Chrome controls.

## Deliverables

- Pair-browser wizard with student confirmation, enrollment code, extension setup steps, sync confirmation, and hardening guidance.
- Device summary card and manage-devices modal.
- Stale-device threshold helper or documented constant.
- Updated support/runbook copy for parent setup and managed Chrome guidance.

## Files Or Areas To Touch

- src/components/LockdownPolicyPanel.jsx
- src/firebase/trustedOperations.js
- functions/src/index.js
- docs/support/lockdown-support-runbook.md
- docs/support/lockdown-chrome-web-store-upload-plan.md
- scripts/check-lockdown-device-management.mjs

## Read First

- docs/specs/lockdown-simplification-and-extension-launcher.md
- src/components/LockdownPolicyPanel.jsx
- src/firebase/trustedOperations.js
- functions/src/index.js
- docs/support/lockdown-support-runbook.md
- scripts/check-lockdown-device-management.mjs

## Exit Criteria

- A parent can pair a browser through a wizard rather than raw enrollment controls.
- The selected student's device summary shows useful counts and risk states.
- Full device details and revoke controls are available in a modal.
- Hardening guidance explains managed Chrome requirements and consumer Chrome limits.

## Automated Test Expectation

Update device-management scripts for stale, revoked, inactive, selected-student summary behavior, and read-only entitlement disabling pairing/revocation.

## Test Files

- scripts/check-lockdown-device-management.mjs
- scripts/check-lockdown-parent-view-model.mjs

## Test Cases To Cover

- Device counts filter by selected student.
- Revoked devices are distinct from stale devices.
- Stale threshold labels are deterministic using a 7-day stale-device warning threshold.
- Read-only entitlement disables pairing and revocation.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence screenshot, route or interaction notes. Load the live UI in a runtime and verify the main happy path for the active slice.
- `manual-qa`: preferred tools `human`, `Chrome`; default evidence manual verification note. Document the manual follow-up that a human must complete before final merge or release confidence.

## Runtime Targets

- http://localhost:3000/dashboard/lockdown
- chrome://extensions

## Evidence Required

- device-management script output
- npm run build output
- screenshot or detailed browser-smoke notes for the pairing wizard and manage-devices modal
- manual pairing note or explicit paired-device fixture blocker

## Allowed Discovery

Follow trusted enrollment and device-management imports only as needed.

## Test Commands

- node scripts/check-lockdown-device-management.mjs
- node scripts/check-lockdown-parent-view-model.mjs
- npm run build
- npm run dev

## Manual Verification Follow-Up

- Generate a trusted enrollment code for the test student and pair the unpacked extension in a clean student Chrome profile when a device/profile fixture is available.

## Project Manager Decisions

- External Chrome management links are allowed in the pairing wizard and support guidance.
- Stale-device warnings should use a 7-day threshold since the paired browser last checked in or synced policy.

## Human Assistance Triggers

- Use the parent test account for browser smoke without persisting the password in repo files.
- A real paired Chrome profile or enrolled device credential is needed for full manual pairing/device validation.
- Reload `extensions/chrome-lockdown-poc` unpacked after extension changes.

## Master Developer Review Focus

Confirm that Pairing Wizard And Device Summaries is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and dispatch the next downstream prompt when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Do not weaken the trusted enrollment path. This is a UX layer over existing trusted operations.
- `tester`: Prefer real Chrome pairing validation if endpoints are deployed; otherwise record the exact manual blocker.

## Next Phase Inputs

- Parent-friendly pairing workflow
- Device state summaries
- Hardening copy baseline
