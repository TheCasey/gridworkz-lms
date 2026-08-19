# Phase 2: Persistent Live Pulse Utility Rail

## Goal

Move Live Pulse out of Students-only rendering and turn it into a persistent right-side utility drawer that can be shown or hidden without compressing the main content and can filter by student and school vs chores domain.

## Depends On

- Phase 1: Shell Route And Navigation Foundation

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Replace the current Students-only Live Pulse rail with a shell-level utility drawer that can be opened from multiple dashboard routes.
- Preserve the current weekly-progress and activity-feed data sources unless a narrow shell-state change is required.
- Add closed-by-default drawer state, route-persistent UI state, and student/domain filters needed for the shell contract.
- Do not redesign the Students page content, Homeschool dashboard content, chores child routes, or Account Settings page in this phase.

## Deliverables

- Persistent Live Pulse utility panel rendered across dashboard routes
- Closed-by-default open/close state that persists while navigating
- Student filter and school-vs-chores filter controls
- Layout behavior that avoids compressing page content awkwardly

## Files Or Areas To Touch

- docs/specs/dashboard-shell-and-navigation.md
- src/pages/ParentDashboard.jsx
- src/constants/dashboardFeatures.js

## Read First

- docs/specs/dashboard-shell-and-navigation.md
- src/pages/ParentDashboard.jsx
- src/constants/dashboardFeatures.js
- docs/architecture.md

## Exit Criteria

- Live Pulse is no longer limited to the Students route.
- The panel can be toggled without destabilizing the main shell layout.
- Filter controls are visible and scoped to the declared shell contract.

## Automated Test Expectation

No automated test changes required for this phase; validate with the declared validation modes and the no-test rationale.

## Test Files

- None required for this phase.

## Test Cases To Cover

- No automated route or component harness is required for this phase.

## No-Test Rationale

The repo still lacks an automated UI harness that would meaningfully cover a shell-wide live drawer. This workflow phase should validate with `npm run build` plus interaction smoke. A local ESLint script and config now exist, but lint is not a required acceptance gate for this workflow phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `interaction-smoke`: preferred tools `browser-use`, `playwright`, `computer-use`; default evidence test output, screenshot. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.

## Runtime Targets

- http://127.0.0.1:3000/dashboard/students
- http://127.0.0.1:3000/dashboard/homeschool

## Evidence Required

- build output
- toggle and filter interaction notes
- screenshots with drawer closed and open

## Allowed Discovery

Start with the listed read-first files, then follow dashboard routes, shell helpers, adjacent section pages, and nearby UI state files only as needed for the active phase.

## Test Commands

- npm run build

## Manual Verification Follow-Up

- Verify the Live Pulse drawer persists while navigating between dashboard routes and preserves filter state.

## Project Manager Questions

- None currently known. Ask only if product intent, acceptance criteria, or runtime setup is still underspecified.

## Human Assistance Triggers

- Use the documented disposable validation accounts if an authenticated parent session is needed for interaction smoke.

## Master Developer Review Focus

Confirm that Persistent Live Pulse Utility Rail is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Persistent Live Pulse Utility Rail. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Persistent Live Pulse Utility Rail using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Persistent pulse panel
- Cross-route utility state model
