# Phase 4: Homeschool Section Dashboard

## Goal

Implement the top-level Homeschool section dashboard with student selector, period controls, planned-vs-completed progress graph, recent activity, large wizard launch cards, alerts, and quick links into Curriculum, Weekly Blocking, and Reports.

## Depends On

- Phase 3: Students Overview Refresh

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Replace the current placeholder `HomeschoolRoute` with a real top-level Homeschool dashboard.
- Keep the page student-specific, overview-first, and clearly separate from deeper Curriculum, Weekly Blocking, and Reports work.
- Add a student selector, time-range controls, a planned-vs-completed progress view, recent school activity, prominent wizard launch cards, and quick links into the deeper school pages.
- Keep Weekly Blocking as a launch surface or placeholder action where a full route is still not implemented; do not invent a full Weekly Blocking page in this phase.
- Do not redesign the Students overview, Chores shell, Account Settings, or Live Pulse drawer in this phase.

## Deliverables

- Top-level Homeschool dashboard route and page
- Student selector and time-range controls
- Planned-vs-completed progress graph with time spent secondary
- Recent school activity plus alerts
- Large New curriculum, Weekly blocking, and Report wizard launch cards
- Quick links into Curriculum, Weekly Blocking, and Reports

## Files Or Areas To Touch

- docs/specs/dashboard-shell-and-navigation.md
- docs/specs/homeschool-dashboard.md
- docs/specs/weekly-blocking-and-assignment-templates.md
- src/pages/dashboard/HomeschoolRoute.jsx
- src/pages/ParentDashboard.jsx

## Read First

- docs/specs/homeschool-dashboard.md
- docs/specs/weekly-blocking-and-assignment-templates.md
- docs/specs/dashboard-shell-and-navigation.md
- src/pages/dashboard/HomeschoolRoute.jsx
- src/pages/ParentDashboard.jsx

## Exit Criteria

- Homeschool no longer behaves like a redirect or empty section.
- The page matches the approved dashboard role rather than duplicating deeper pages.
- Wizard launchers and quick links are visibly distinct and actionable.

## Automated Test Expectation

No automated test changes required for this phase; validate with the declared validation modes and the no-test rationale.

## Test Files

- Not listed yet. Add likely files before dispatching developer work if automated tests are expected.

## Test Cases To Cover

- Not listed yet. Add focused regression or behavior cases before dispatching developer work if the phase changes behavior.

## No-Test Rationale

This phase is a new dashboard surface in a repo without a graph or dashboard component test harness. Validate with build-health and browser smoke. A local ESLint config now exists, but lint is not a required acceptance gate for this workflow phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- http://127.0.0.1:3000/dashboard/homeschool

## Evidence Required

- build output
- homeschool dashboard route notes
- graph and selector interaction notes
- wizard-launch and quick-link notes
- homeschool dashboard screenshot

## Allowed Discovery

Start with the listed read-first files, then follow dashboard routes, shell helpers, adjacent section pages, and nearby UI state files only as needed for the active phase.

## Test Commands

- npm run build

## Manual Verification Follow-Up

- Review the homeschool dashboard with at least one real student to confirm graph, activity, and wizard-entry coherence.

## Project Manager Questions

- None currently known. Ask only if product intent, acceptance criteria, or runtime setup is still underspecified.

## Human Assistance Triggers

- Use the documented disposable validation accounts if authenticated parent smoke is needed.

## Master Developer Review Focus

Confirm that Homeschool Section Dashboard is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Homeschool Section Dashboard. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Homeschool Section Dashboard using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Homeschool section landing
- School workflow launch surface
