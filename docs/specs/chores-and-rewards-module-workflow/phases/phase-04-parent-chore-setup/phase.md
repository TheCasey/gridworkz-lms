# Phase 4: Parent Chore Setup

## Goal

Build the parent dashboard setup and management surface for routines, weekly/monthly chore pools, quotas, and approval review.

## Depends On

- Phase 3: Trusted Chore Operations

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Build `/dashboard/chores` or the selected dashboard module route using the existing shell and palette conventions.
- Support routine templates, weekly chores, monthly chores, eligible students, instructions, definition of done, cooldown, quotas, and approval-required settings.
- Show basic progress and pending review without implementing allowance or rewards yet.
- Use the source-plan labels: Daily Routines, Weekly Chores, Monthly Chores, Quotas, and Pending Review.
- Default new routine templates to household-wide/all students while still allowing explicit per-student assignment.
- Treat quota warnings as advisory in MVP; they should not block saving setup records.

## Deliverables

- Parent chores page/module.
- Page-local or extracted hooks for chore setup data.
- Pending approval and quota/progress summaries.
- Empty and locked states aligned with existing dashboard design.

## Files Or Areas To Touch

- src/pages/dashboard/ChoresRoute.jsx
- src/constants/dashboardFeatures.js
- src/hooks/useChoreSetup.js
- src/firebase/trustedOperations.js
- scripts/check-chores-parent-view-model.mjs

## Read First

- docs/specs/chores-and-rewards-module-workflow/phases/phase-04-parent-chore-setup/phase.md
- docs/specs/chores-and-rewards-module.md
- src/pages/ParentDashboard.jsx
- src/pages/Settings.jsx
- src/pages/dashboard/ChoresRoute.jsx
- src/firebase/trustedOperations.js

## Exit Criteria

- A parent can create and edit daily routines, weekly chores, monthly chores, quotas, and approval flags.
- The parent can see pending chore reviews and current quota progress.
- The page respects entitlement locked states and does not expose unfinished allowance or reward controls.

## Automated Test Expectation

Add focused automated coverage for any extracted form normalization, quota-warning, or view-model helpers; if the phase remains UI-only, record the no-test rationale and require browser-smoke validation.

## Test Files

- scripts/check-chores-parent-view-model.mjs

## Test Cases To Cover

- Quota warnings fire when the pool cannot satisfy all eligible students.
- Archived chores are hidden from active pools but preserved for history.
- Approval-required chores appear in pending review after completion.
- Locked entitlement state blocks create actions while keeping read-only data visible.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence runtime URL, screenshot or interaction notes. Load the live UI in a runtime and verify the main happy path for the active slice.
- `interaction-smoke`: preferred tools `browser-use`, `playwright`; default evidence interaction notes, console/error observations. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- http://localhost:3000/dashboard/chores

## Evidence Required

- command output
- runtime URL
- screenshot or interaction notes

## Allowed Discovery

Follow dashboard shell, Settings entitlement UI, Curriculum form patterns, and trusted operation wrappers only as needed.

## Test Commands

- node scripts/check-chores-parent-view-model.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Human visual pass for dense parent setup ergonomics before accepting final UI polish.

## Project Manager Questions

- None required before Phase 4 dispatch. Use the source-plan labels, default new routine templates to household-wide/all students while keeping per-student assignment controls, and make quota warnings advisory.

## Human Assistance Triggers

- Provide or approve seeded parent/student data for browser validation if emulator data is not available.

## Master Developer Review Focus

Confirm the parent setup UI consumes the trusted Phase 3 wrappers, stays entitlement-aware/read-only when locked, and does not expose unfinished allowance, points, reward store, student portal behavior, or billing/packaging controls.

## Runtime Handoff Notes

- `developer`: Implement only Parent Chore Setup. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Parent Chore Setup using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Parent-managed chore definitions and routine templates.
- Quota and approval review UI contract.
