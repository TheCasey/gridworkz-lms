# Phase 8: Extension Student Launcher

## Goal

Turn the extension popup and blocked page into a compact student launcher over the trusted endpoint contract.

## Depends On

- Phase 7: Trusted Launcher Endpoints

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Render launcher state in the popup for paired students.
- Show available blocks, active block, allowed resources, and start or resume actions.
- Update blocked page actions to guide the student to Own Path or launcher start/resume.
- Keep raw policy details out of the default student UI.

## Deliverables

- Popup launcher UI for paired student states.
- Blocked page launcher-aware guidance and actions.
- Background message bridge for launcher reads and start/resume actions.
- Updated extension styling and state scripts.

## Files Or Areas To Touch

- extensions/chrome-lockdown-poc/popup.html
- extensions/chrome-lockdown-poc/popup.js
- extensions/chrome-lockdown-poc/blocked.html
- extensions/chrome-lockdown-poc/blocked.js
- extensions/chrome-lockdown-poc/background.js
- extensions/chrome-lockdown-poc/guidance.js
- extensions/chrome-lockdown-poc/styles.css
- scripts/check-lockdown-extension-states.mjs
- scripts/check-lockdown-work-launcher.mjs

## Read First

- docs/specs/lockdown-simplification-and-extension-launcher.md
- extensions/chrome-lockdown-poc/popup.js
- extensions/chrome-lockdown-poc/blocked.js
- extensions/chrome-lockdown-poc/background.js
- extensions/chrome-lockdown-poc/guidance.js
- scripts/check-lockdown-extension-states.mjs

## Exit Criteria

- The popup shows useful student launcher state once paired.
- A student can start or resume a block from the extension when trusted endpoint support is available.
- Allowed resources are visible in active and no-active-block states.
- The blocked page offers the correct next step without policy jargon.
- The extension remains visually usable in the Chrome popup viewport.

## Automated Test Expectation

Update extension-state and launcher scripts for launcher rendering inputs, blocked-page guidance, and start/resume messaging.

## Test Files

- scripts/check-lockdown-extension-states.mjs
- scripts/check-lockdown-work-launcher.mjs
- scripts/check-lockdown-release-package.mjs

## Test Cases To Cover

- Paired outside-schedule state shows Lockdown off and no local disable control.
- Paired school-time no-active-block state lists off-block resources and available blocks.
- Active block state lists current block resources.
- Blocked page shows a start/resume action when the URL is blocked because no block is active.
- Popup text fits in the extension viewport without obvious overflow.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `extension-smoke`: preferred tools `Chrome`, `computer-use`, `playwright`; default evidence Chrome profile notes, screenshot. Validate the browser extension in a live browser context, including load, install, and core interaction paths.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- extensions/chrome-lockdown-poc
- chrome://extensions

## Evidence Required

- extension-state script output
- launcher script output
- release-package output
- screenshots of popup and blocked page

## Allowed Discovery

Follow extension UI imports and background message handlers only as needed.

## Test Commands

- node scripts/check-lockdown-extension-states.mjs
- node scripts/check-lockdown-work-launcher.mjs
- node scripts/check-lockdown-release-package.mjs
- npm run build

## Manual Verification Follow-Up

- Reload the unpacked extension and verify popup and blocked page in a paired student Chrome profile.
- Capture at least one popup screenshot and one blocked-page screenshot suitable for review.

## Project Manager Questions

- Confirm whether the launcher should proactively open when school time starts, or remain click/open only for this first version.

## Human Assistance Triggers

- Use the paired student Chrome profile and a published weekly plan fixture for live extension validation.

## Master Developer Review Focus

Confirm that Extension Student Launcher is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Design for the small Chrome popup viewport. Keep copy short and actionable.
- `tester`: Check both behavior and fit. Text overflow or hidden primary actions are release blockers for this phase.

## Next Phase Inputs

- Student-facing extension launcher
- Launcher-aware blocked page
