# Phase 3: Students Overview Refresh

## Goal

Keep Students as the family overview page while adding school and chores progress entry points per student and aligning the overview with the new grouped shell.

## Depends On

- Phase 2: Persistent Live Pulse Utility Rail

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Keep `Students` as the overview-first family dashboard rather than turning it into a buried subsection.
- Add clearly visible per-student school and chores progress entry points that align with the grouped shell.
- Keep the change set focused on the Students overview surface and nearby student-card wiring.
- Do not redesign the Homeschool dashboard, Chores dashboards, Account Settings, or Live Pulse drawer in this phase.
- Per-student school and chores `View progress` actions should stay in place as popup modal entry points rather than navigating into a new route.

## Deliverables

- Students page remains the main family overview
- Each student card exposes school and chores View progress actions
- The overview works cleanly with the new grouped shell and persistent Live Pulse

## Files Or Areas To Touch

- docs/specs/dashboard-shell-and-navigation.md
- src/pages/dashboard/StudentsRoute.jsx
- src/components/StudentCard.jsx
- src/pages/ParentDashboard.jsx

## Read First

- docs/specs/dashboard-shell-and-navigation.md
- src/pages/dashboard/StudentsRoute.jsx
- src/components/StudentCard.jsx
- src/pages/ParentDashboard.jsx

## Exit Criteria

- Students still feels like the main overview rather than a buried subsection.
- View progress actions are visible per student for both school and chores.
- The page layout remains coherent with the shell changes.

## Automated Test Expectation

No automated test changes required for this phase; validate with the declared validation modes and the no-test rationale.

## Test Files

- Not listed yet. Add likely files before dispatching developer work if automated tests are expected.

## Test Cases To Cover

- Not listed yet. Add focused regression or behavior cases before dispatching developer work if the phase changes behavior.

## No-Test Rationale

This phase is mostly parent overview UI behavior and route linking in a repo without component tests. Validate through build-health and browser smoke. A local ESLint config now exists, but lint is not a required acceptance gate for this workflow phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- http://127.0.0.1:3000/dashboard/students

## Evidence Required

- build output
- student-card route notes
- students overview screenshot

## Allowed Discovery

Start with the listed read-first files, then follow dashboard routes, shell helpers, adjacent section pages, and nearby UI state files only as needed for the active phase.

## Test Commands

- npm run build

## Manual Verification Follow-Up

- Confirm the View progress actions behave as intended once a real student list is present.

## Project Manager Questions

- Resolved on 2026-06-24:
  - each per-student school and chores `View progress` action should stay in place as a popup modal

## Human Assistance Triggers

- Use the documented disposable validation accounts if authenticated parent smoke is needed.

## Master Developer Review Focus

Confirm that Students Overview Refresh is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Students Overview Refresh. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Students Overview Refresh using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Updated family overview
- Student entry points into school and chores domains
