# Phase 9: Integration QA And Store Readiness

## Goal

Validate the simplified Lockdown flow end to end and leave the Chrome Web Store package ready for manual upload.

## Depends On

- Phase 8: Extension Student Launcher

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Run the full Lockdown script suite, lint, and build.
- Validate the parent and extension flows with the test parent and student accounts when available.
- Update support docs, manual QA checklist, and Chrome Web Store package notes.
- Capture or identify final screenshots needed for listing submission.

## Deliverables

- Updated support runbook and upload plan reflecting the simplified UI and launcher.
- Full command evidence for package, policy, device, launcher, extension, lint, and build checks.
- Manual QA matrix for clean Chrome profile, pairing, resources, start/resume, blocking, Own Path allowlist, and local anti-tamper.
- Final list of remaining manual Chrome Web Store actions.

## Files Or Areas To Touch

- docs/support/lockdown-support-runbook.md
- docs/support/lockdown-chrome-web-store-upload-plan.md
- docs/specs/lockdown-production-behavior-contract.md
- scripts/check-lockdown-release-package.mjs
- extensions/chrome-lockdown-poc/manifest.json
- extensions/chrome-lockdown-poc/styles.css

## Read First

- docs/specs/lockdown-simplification-and-extension-launcher.md
- docs/support/lockdown-support-runbook.md
- docs/support/lockdown-chrome-web-store-upload-plan.md
- docs/specs/lockdown-production-behavior-contract.md
- scripts/check-lockdown-release-package.mjs
- extensions/chrome-lockdown-poc/manifest.json

## Exit Criteria

- Full automated Lockdown validation suite passes.
- npm run lint and npm run build pass.
- Unpacked-extension QA confirms pairing, resources, start/resume, blocking, Own Path allowlist, and paired anti-tamper behavior.
- Chrome Web Store screenshot and asset gaps are documented.
- Remaining manual publish actions are explicit.

## Automated Test Expectation

Run and update release-package checks so they enforce the simplified UI contract, no remote executable code, required icons, and docs coverage.

## Test Files

- scripts/check-lockdown-release-package.mjs
- scripts/check-lockdown-policy-states.mjs
- scripts/check-lockdown-derived-policy.mjs
- scripts/check-lockdown-resource-normalization.mjs
- scripts/check-lockdown-device-management.mjs
- scripts/check-lockdown-extension-states.mjs
- scripts/check-lockdown-work-launcher.mjs

## Test Cases To Cover

- Release package contains required icons and no remote executable code.
- Own Path system origins remain allowlisted.
- Resource assignments, device states, launcher contract, and extension states all pass focused checks.
- Parent UI and extension UI match the simplified product promise.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence screenshot, route or interaction notes. Load the live UI in a runtime and verify the main happy path for the active slice.
- `extension-smoke`: preferred tools `Chrome`, `computer-use`, `playwright`; default evidence Chrome profile notes, screenshot. Validate the browser extension in a live browser context, including load, install, and core interaction paths.
- `manual-qa`: preferred tools `human`, `Chrome`; default evidence manual verification note. Document the manual follow-up that a human must complete before final merge or release confidence.

## Runtime Targets

- http://localhost:3000/dashboard/lockdown
- extensions/chrome-lockdown-poc
- chrome://extensions
- Chrome Web Store developer dashboard

## Evidence Required

- all Lockdown script outputs
- npm run lint output
- npm run build output
- parent dashboard screenshot
- extension popup screenshot
- blocked page screenshot
- manual QA matrix notes

## Allowed Discovery

Inspect any Lockdown parent, function, extension, script, or support-doc file needed for final integration validation.

## Test Commands

- node scripts/check-lockdown-resource-normalization.mjs
- node scripts/check-lockdown-policy-states.mjs
- node scripts/check-lockdown-derived-policy.mjs
- node scripts/check-lockdown-device-management.mjs
- node scripts/check-lockdown-extension-states.mjs
- node scripts/check-lockdown-work-launcher.mjs
- node scripts/check-lockdown-release-package.mjs
- npm run lint
- npm run build
- npm run dev

## Manual Verification Follow-Up

- Load `extensions/chrome-lockdown-poc` unpacked in a clean student Chrome profile.
- Use the parent test account to pair the extension and assign resources.
- Start or resume a block from the extension and confirm approved resources are allowed immediately.
- Confirm `https://own-path.com` and `https://www.own-path.com` are allowed while enforcement is active.
- Attempt local paired disable and clear-pairing paths and record the result.
- Capture Chrome Web Store-ready screenshots after the UI is final.

## Project Manager Questions

- Confirm final Chrome Web Store listing screenshots and whether optional marquee/promo art should be generated before upload.

## Human Assistance Triggers

- Use the Chrome Web Store account for final upload only after QA acceptance.
- Provide or confirm deployed Functions if local extension cannot reach launcher endpoints in QA.

## Master Developer Review Focus

Treat this as final integration review. Do not accept the workflow if any remaining manual gate is vague.

## Runtime Handoff Notes

- `developer`: Only make release-readiness fixes and docs updates in this phase. Avoid new feature scope.
- `tester`: Validate the complete parent-to-extension story and record exact remaining manual publish actions.

## Next Phase Inputs

- Accepted simplified Lockdown workflow
- Chrome Web Store manual publish checklist
