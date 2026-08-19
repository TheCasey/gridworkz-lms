# Phase 5: Expandable Chores Section Shell

## Goal

Reshape the Chores shell so the top-level `Chores` route becomes a section dashboard and the already-implemented chores management surface is reachable through real child routes for `Daily Routines`, `Weekly Chores`, `Monthly Chores`, `Allowance`, and `Rewards`.

## Depends On

- Phase 4: Homeschool Section Dashboard

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Convert the existing chores child placeholders in `src/constants/dashboardFeatures.js` into real navigable shell entries using the already-established labels and placeholder slugs:
  - `daily-routines`
  - `weekly-chores`
  - `monthly-chores`
  - `allowance`
  - `rewards`
- Add the shell route structure for `/dashboard/chores/*` so:
  - `/dashboard/chores` acts like a section dashboard and launch surface
  - each chores child route renders the corresponding slice of the existing chores parent surface
- Reuse the current chores data model, entitlement-aware read-only states, and trusted operations already implemented in `src/pages/dashboard/ChoresRoute.jsx`.
- Keep child-route ownership aligned with the locked dashboard-shell spec:
  - `Daily Routines`: grouped routine setup and review
  - `Weekly Chores`: weekly pool definitions and review
  - `Monthly Chores`: monthly pool definitions and review
  - `Allowance`: allowance policy and ledger review
  - `Rewards`: points, reward catalog, redemptions, and fulfillment review
- Keep the change focused on shell routing and section framing. Do not redesign chores product behavior, rewards economics, student portal flows, or billing/packaging behavior in this phase.

## Deliverables

- Top-level Chores section dashboard route that summarizes the live chores module and launches deeper routes
- Real child routes for `Daily Routines`, `Weekly Chores`, `Monthly Chores`, `Allowance`, and `Rewards`
- Navigation expansion wired to real child routes instead of placeholder labels
- Scoped child-route rendering that reuses the existing chores sections and preserves current entitlement-aware behavior

## Files Or Areas To Touch

- src/App.jsx
- src/constants/dashboardFeatures.js
- src/pages/ParentDashboard.jsx
- src/pages/dashboard/ChoresRoute.jsx
- src/pages/dashboard/chores/

## Read First

- docs/specs/dashboard-shell-and-navigation.md
- docs/specs/chores-and-rewards-module.md
- src/App.jsx
- src/constants/dashboardFeatures.js
- src/pages/ParentDashboard.jsx
- src/pages/dashboard/ChoresRoute.jsx

## Exit Criteria

- The Chores section expands into the declared child pages through real routes instead of placeholders.
- The top-level Chores route acts like a section dashboard rather than carrying the full chores management surface by itself.
- Each child route reuses the corresponding existing chores management slice instead of inventing new chores content.
- The grouped shell nav and route tree match the locked dashboard-shell model.

## Automated Test Expectation

No automated test changes required for this phase; validate with the declared validation modes and the no-test rationale.

## Test Files

- Not listed yet. Add likely files before dispatching developer work if automated tests are expected.

## Test Cases To Cover

- Not listed yet. Add focused regression or behavior cases before dispatching developer work if the phase changes behavior.

## No-Test Rationale

This phase restructures shell routing and section framing around an already-implemented chores surface in a repo without focused route or dashboard component tests for the shell split. A local ESLint config now exists, but lint is not a required acceptance gate for this workflow phase. Validate with build-health and browser smoke against the chores dashboard plus child routes.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- http://127.0.0.1:3000/dashboard/chores
- http://127.0.0.1:3000/dashboard/chores/daily-routines
- http://127.0.0.1:3000/dashboard/chores/weekly-chores
- http://127.0.0.1:3000/dashboard/chores/monthly-chores
- http://127.0.0.1:3000/dashboard/chores/allowance
- http://127.0.0.1:3000/dashboard/chores/rewards

## Evidence Required

- build output
- chores dashboard route notes
- child-route render notes
- nav expansion notes
- chores dashboard screenshot

## Allowed Discovery

Start with the listed read-first files, then follow dashboard routes, shell helpers, adjacent section pages, and nearby UI state files only as needed for the active phase.

## Test Commands

- npm run build

## Manual Verification Follow-Up

- Confirm the expanded Chores nav and child-route labels feel right in a live dashboard session, preferably with both free and paid disposable households if available.

## Project Manager Questions

- None currently known. Reuse the existing chores summary signals and locked child labels instead of inventing new chores dashboard content in this phase.

## Human Assistance Triggers

- Use the documented disposable validation accounts if authenticated parent smoke is needed.

## Master Developer Review Focus

Confirm that Expandable Chores Section Shell is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Expandable Chores Section Shell. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Expandable Chores Section Shell using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Route-backed chores section dashboard
- Chores child-route structure
