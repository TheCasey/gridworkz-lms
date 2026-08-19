# Phase 5: Student Chore Workspace

## Goal

Add the student portal Chores area for routines, available chore pools, claimed chores, and completion actions while preserving sibling privacy.

## Depends On

- Phase 4: Parent Chore Setup

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add a Chores area or tab to the student portal when the entitlement and student-safe view allow it.
- Show today's grouped routine, weekly/monthly remaining counters, available chores, claimed chores, instructions, and completion flow.
- Use trusted claim and complete operations instead of direct client-authoritative writes.
- Use a separate student portal `Chores` area beside the existing school workspace, matching the source plan's `School`, `Chores`, and later `Rewards` areas.
- Keep allowance and reward/point teasers out of the first student chores implementation; later phases will add student-safe progress.
- Treat routine checklist item checks as UI guidance for one daily persisted routine completion, not separate item-level chore records.
- Require PIN-verified student context for trusted chore reads and student actions when a student has an access PIN.

## Deliverables

- Student portal chores navigation and workspace.
- Routine completion flow.
- Claim and complete chore interactions.
- Student-safe empty, locked, and all-done states.

## Files Or Areas To Touch

- src/pages/StudentPortal.jsx
- src/hooks/useStudentChores.js
- src/hooks/useStudentAccessPolicy.js
- src/firebase/trustedOperations.js
- src/utils/choreUtils.js

## Read First

- docs/specs/chores-and-rewards-module.md
- src/pages/StudentPortal.jsx
- src/hooks/useStudentAccessPolicy.js
- src/hooks/useStudentPortalWeeklyPlan.js
- src/firebase/trustedOperations.js
- firestore.rules

## Exit Criteria

- A student can complete today's grouped routine as one daily completion.
- A student can claim and complete eligible weekly/monthly chores.
- Sibling private data, allowance balances, and reward history are not exposed in the student view.
- The school workspace remains usable when chores are disabled.

## Automated Test Expectation

Add focused automated coverage for student-safe view derivation and claim/complete eligibility helpers; UI behavior must also receive browser-smoke validation.

## Test Files

- scripts/check-student-chores-view.mjs

## Test Cases To Cover

- Student view includes only eligible available chores and that student's claimed chores.
- Daily routine appears as one grouped completion record.
- Completed chores leave the available pool until the helper marks them eligible again.
- Disabled entitlement or missing student context hides or locks chores cleanly.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence runtime URL, screenshot or interaction notes. Load the live UI in a runtime and verify the main happy path for the active slice.
- `interaction-smoke`: preferred tools `browser-use`, `playwright`; default evidence interaction notes, console/error observations. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.
- `security-rules-review`: preferred tools `shell`, `code-review`; default evidence rules/code references, risk notes. Inspect Firestore rules, trusted callable boundaries, and public student portal exposure for the active slice.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- http://localhost:3000/student/:slug

## Evidence Required

- command output
- runtime URL
- screenshot or interaction notes
- privacy/rules notes

## Allowed Discovery

Follow student portal access-policy and weekly-plan hooks only as needed; do not implement allowance or rewards in this phase.

## Test Commands

- node scripts/check-student-chores-view.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Human check that the student experience stays warm, simple, and action-focused on mobile and desktop.

## Project Manager Questions

- None required before Phase 5 dispatch. The source plan already calls for a separate `Chores` student area beside `School`, and this phase keeps allowance, points, and rewards hidden until later phases.

## Human Assistance Triggers

- Provide a real or seeded student slug and PIN if browser validation cannot create one locally.

## Master Developer Review Focus

Confirm that Student Chore Workspace is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Student Chore Workspace. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Student Chore Workspace using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Run Log

- 2026-05-26 correction: tightened trusted public student chore access so a student record without `access_pin` no longer passes `validateTrustedStudentPinContext` by slug or student id alone. Updated `useStudentChores` so trusted chore reads and claim/complete/routine actions only run when the current student has an access PIN and the portal session has been authenticated with it.
- 2026-05-26 regression coverage: `scripts/check-chores-trusted-contracts.mjs` now covers pinless student rejection, missing PIN rejection, wrong PIN rejection, and matching PIN success. `scripts/check-student-chores-view.mjs` now covers locked non-interactive public chore context and trusted routine completion data rendering as completed after reload while preserving checklist items as UI guidance for one daily persisted routine completion.
- 2026-05-26 validation: `node scripts/check-student-chores-view.mjs` passed; `node scripts/check-chores-trusted-contracts.mjs` passed and still reports no callable emulator harness in `firebase.json`; `npm run lint` passed; `npm run build` passed.
- 2026-05-26 limitation: browser/manual seeded callable smoke was not run in this correction because no local callable emulator harness or seeded student slug/PIN was available in the phase files. A human or tester should still verify `http://localhost:3000/student/:slug` with a real PIN-protected student on mobile and desktop.

## Next Phase Inputs

- Student chore completion events.
- Student-safe chore progress model.
