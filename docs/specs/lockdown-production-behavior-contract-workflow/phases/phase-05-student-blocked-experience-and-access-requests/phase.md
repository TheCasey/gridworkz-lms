# Phase 5: Student Blocked Experience And Access Requests

## Goal

Replace generic blocked pages with state-specific student guidance, current allowed-resource visibility, and an optional request-help/request-access path.

## Depends On

- Phase 4: Device Management And Revocation

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Update extension blocked page, YouTube overlay, allowlist page, popup copy, and relevant student portal messaging for the production states.
- Show allowed resources when safe, and give the student a useful next action.
- Implement request-help/request-access only if the product decision is accepted; otherwise record a deferred stub and keep no self-serve unlock.

## Deliverables

- State-specific block page and YouTube overlay copy
- Allowed-resource visibility tied to current policy context
- Optional request-access queue or explicit deferred decision note
- Extension smoke matrix for blocked URL, blocked YouTube creator, no active work, off-hours closed, stale cache, and revoked device states

## Files Or Areas To Touch

- extensions/chrome-lockdown-poc/blocked.html
- extensions/chrome-lockdown-poc/blocked.js
- extensions/chrome-lockdown-poc/youtube-content.js
- extensions/chrome-lockdown-poc/allowlist.js
- extensions/chrome-lockdown-poc/popup.js
- src/pages/StudentPortal.jsx
- scripts/check-lockdown-extension-states.mjs

## Read First

- extensions/chrome-lockdown-poc/blocked.js
- extensions/chrome-lockdown-poc/youtube-content.js
- extensions/chrome-lockdown-poc/popup.js
- extensions/chrome-lockdown-poc/allowlist.js
- src/pages/StudentPortal.jsx
- docs/specs/lockdown-production-behavior-contract.md

## Exit Criteria

- Blocked UI explains the specific state without raw policy IDs or developer jargon.
- Students can see current allowed resources where appropriate.
- No student path unlocks access without parent approval.
- YouTube unknown creator and blocked creator states remain fail-closed with clear copy.

## Automated Test Expectation

Add a focused extension-state check script for local render helpers or policy-to-copy mapping, then validate the runtime with extension smoke where possible.

## Test Files

- scripts/check-lockdown-extension-states.mjs

## Test Cases To Cover

- No active work shows start-work guidance.
- Off-hours closed shows window guidance.
- Blocked YouTube creator shows creator metadata when available.
- Stale cached policy shows cached status without claiming fresh sync.
- Revoked device directs parent action.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence focused check script output. Run the existing focused automated tests that cover the active slice before widening scope.
- `extension-smoke`: preferred tools `playwright`, `computer-use`, `Chrome extension manual load`; default evidence extension runtime evidence, screenshot or storage/policy summary. Validate the browser extension in a live browser context, including load, install, and core interaction paths.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot or DOM summary. Load the live UI in a runtime and verify the main happy path for the active slice.
- `build-health`: preferred tools `shell`; default evidence npm run lint output, npm run build output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- Chrome extension blocked page
- YouTube watch or shorts overlay
- Student portal current-work guidance

## Evidence Required

- copy/state check output
- extension smoke evidence or manual follow-up
- browser-smoke evidence for student portal messaging
- lint/build output

## Allowed Discovery

Start with the listed read-first files, then follow imports, routes, existing check scripts, extension files, functions, and nearby docs only as needed for the active phase.

## Test Commands

- node scripts/check-lockdown-extension-states.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Record any Chrome extension smoke steps that require a human-loaded unpacked extension or Web Store build.

## Master Developer Review Focus

Confirm that Student Blocked Experience And Access Requests is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Student Blocked Experience And Access Requests. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Student Blocked Experience And Access Requests using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- State-specific student copy and allowed-resource display for the embedded work launcher.
