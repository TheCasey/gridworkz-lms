# Phase 4: Schedule And Allowed Preview

## Goal

Move weekly schedule editing into a focused modal and make the effective allowed-right-now preview clear to parents.

## Depends On

- Phase 3: Household Resource Library

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Implement the edit-schedule modal.
- Show concise schedule summary on the main Lockdown page.
- Show allowed-right-now by source: system, off-block parent resources, and active block resources.
- Keep outside-schedule blocking-off behavior visible and understandable.
- Tighten away from legacy off-hours resource-window editing in the default parent workflow. Preserve backward-compatible reads/normalization of existing saved window data, but do not keep it as a first-class editing surface unless the PM changes the model.
- Use the source-plan behavior for outside schedule: Lockdown network blocking is off outside scheduled school time unless a later product decision reintroduces approved off-hours enforcement windows.

## Deliverables

- Weekly schedule edit modal.
- Allowed-right-now summary card or modal.
- Updated derived-preview copy with no raw policy IDs in the default view.
- Focused policy-state tests for schedule and preview behavior.
- Updated extension guidance/tests so outside-schedule copy no longer implies approved off-hours windows are active first-version behavior.

## Files Or Areas To Touch

- src/components/LockdownPolicyPanel.jsx
- src/utils/lockdownPolicyUtils.js
- functions/src/index.js
- extensions/chrome-lockdown-poc/guidance.js
- scripts/check-lockdown-policy-states.mjs
- scripts/check-lockdown-derived-policy.mjs

## Read First

- docs/specs/lockdown-simplification-and-extension-launcher.md
- src/components/LockdownPolicyPanel.jsx
- src/utils/lockdownPolicyUtils.js
- extensions/chrome-lockdown-poc/guidance.js
- scripts/check-lockdown-policy-states.mjs
- scripts/check-lockdown-derived-policy.mjs

## Exit Criteria

- Parents edit schedule from a modal instead of a long inline editor.
- Parents can understand which resources are allowed right now and why.
- School time with no active block clearly shows parent-approved off-block resources and the next step to start work.
- Outside schedule shows Lockdown is off unless product scope changes.

## Automated Test Expectation

Update derived policy scripts and extension-state guidance checks for the simplified state copy and allowed-resource source groups.

## Test Files

- scripts/check-lockdown-policy-states.mjs
- scripts/check-lockdown-derived-policy.mjs
- scripts/check-lockdown-extension-states.mjs

## Test Cases To Cover

- Schedule summary reflects selected days and hours.
- Allowed-right-now groups system resources separately from parent-approved and active block resources.
- No-active-block school-time state stays enforced but explains how to start work.
- Outside-schedule state says blocking is off.
- Legacy off-hours windows do not appear as the default schedule-editing workflow and do not make outside-schedule blocking look active.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence screenshot, route or interaction notes. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- http://localhost:3000/dashboard/lockdown

## Evidence Required

- Lockdown script output
- npm run build output
- screenshot of schedule modal and allowed preview
- notes if screenshot capture is blocked by the browser tool

## Allowed Discovery

Follow schedule helper imports and adjacent guidance code only as needed.

## Test Commands

- node scripts/check-lockdown-policy-states.mjs
- node scripts/check-lockdown-derived-policy.mjs
- node scripts/check-lockdown-extension-states.mjs
- npm run build
- npm run dev

## Manual Verification Follow-Up

- Edit the schedule for a test student and confirm the summary and allowed-right-now preview update.
- Confirm outside-schedule preview says Lockdown blocking is off and does not show legacy off-hours resources as active allowlist inputs.

## Project Manager Questions

- Exact release wording for the outside-schedule Lockdown-off state should be PM-reviewed before public release. For implementation, use the source-plan promise: outside scheduled school time, Lockdown network blocking is off.

## Human Assistance Triggers

- Provide a logged-in parent profile if route smoke cannot authenticate automatically.

## Master Developer Review Focus

Confirm that Schedule And Allowed Preview is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Keep schedule editing focused. Do not reintroduce off-hours resource windows unless PM explicitly changes the model.
- `tester`: Confirm the modal workflow is usable and that preview language matches the current enforcement behavior.

## Next Phase Inputs

- Compact schedule workflow
- Parent-readable allowed-right-now preview
