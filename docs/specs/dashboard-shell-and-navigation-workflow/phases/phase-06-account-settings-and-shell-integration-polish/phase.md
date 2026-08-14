# Phase 6: Account Settings And Shell Integration Polish

## Goal

Finish the grouped dashboard shell with a narrow coherence pass around `Account Settings`, section and child active-state behavior, and Lockdown launch-positioning copy without reopening deeper Settings, Lockdown, Homeschool, or Chores behavior.

## Depends On

- Phase 5: Expandable Chores Section Shell

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Keep `/dashboard/settings` as the dedicated full-page destination for the top-right `Account Settings` action, and align route/page naming plus nearby shell copy to that current ownership.
- Preserve the existing settings surface in `src/pages/Settings.jsx`, including plan visibility, usage cards, school-year controls, and weekly reset controls. Do not redesign settings into new subroutes or new billing/account-management flows.
- Audit and polish grouped shell behavior so section expansion, top-level active states, child highlighting, and the top-right account action feel coherent across direct loads and in-shell navigation.
- Preserve the live `/dashboard/lockdown` route and current entitlement-aware Lockdown behavior while keeping its shell-level positioning aligned with the Core-first launch docs: visible in nav, still framed as `coming soon` for broad launch where appropriate, and not hidden.
- Keep the change focused on shell chrome, route-state coherence, naming, and launch-positioning polish. Do not redesign Live Pulse, student cards, homeschool dashboards, chores slices, Lockdown device-management flows, or the underlying settings data model.

## Deliverables

- `Account Settings` route and page copy aligned with the top-right account action
- Coherent grouped-nav expansion and active/highlight behavior across shell routes
- Lockdown shell placement and copy that stays consistent with current launch-positioning docs without hiding the live route
- Final shell-level polish needed for a coherent grouped-dashboard experience

## Files Or Areas To Touch

- docs/specs/dashboard-shell-and-navigation.md
- docs/specs/core-pricing-and-launch-positioning.md
- src/App.jsx
- src/constants/dashboardFeatures.js
- src/pages/Settings.jsx
- src/pages/dashboard/SettingsRoute.jsx
- src/pages/Lockdown.jsx
- src/pages/ParentDashboard.jsx

## Read First

- docs/specs/dashboard-shell-and-navigation.md
- docs/specs/core-pricing-and-launch-positioning.md
- src/constants/dashboardFeatures.js
- src/pages/ParentDashboard.jsx
- src/pages/Settings.jsx
- src/pages/Lockdown.jsx

## Exit Criteria

- `Account Settings` remains reachable as a full-page route from the shell chrome and the route reads coherently as account settings rather than a generic leftover settings page.
- Grouped nav states, section expansion, child highlighting, and the top-right account action behave coherently across direct loads and route-to-route navigation.
- Lockdown remains visible in the shell with launch-positioning treatment that does not imply broad general availability, while the live route and entitlement-aware behavior continue to work.
- Final build and dashboard route smoke pass for the shell succeeds.

## Automated Test Expectation

No automated test changes required for this phase; validate with the declared validation modes and the no-test rationale.

## Test Files

- Not listed yet. Add likely files before dispatching developer work if automated tests are expected.

## Test Cases To Cover

- Not listed yet. Add focused regression or behavior cases before dispatching developer work if the phase changes behavior.

## No-Test Rationale

This final integration phase is dominated by shell behavior, route-state polish, and copy alignment in a repo without focused route or dashboard shell automation. Required validation remains build-health, browser smoke, and manual QA notes; `npm run lint` is not a required acceptance gate for this workflow phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.
- `manual-qa`: preferred tools `human`; default evidence manual verification note. Document the manual follow-up that a human must complete before final merge or release confidence.

## Runtime Targets

- http://127.0.0.1:3000/dashboard/students
- http://127.0.0.1:3000/dashboard/homeschool
- http://127.0.0.1:3000/dashboard/curriculum
- http://127.0.0.1:3000/dashboard/reports
- http://127.0.0.1:3000/dashboard/chores
- http://127.0.0.1:3000/dashboard/chores/daily-routines
- http://127.0.0.1:3000/dashboard/settings
- http://127.0.0.1:3000/dashboard/lockdown

## Evidence Required

- build output
- shell-wide route smoke notes
- header and nav active-state notes
- screenshots for core shell surfaces
- manual QA note

## Allowed Discovery

Start with the listed read-first files, then follow dashboard routes, shell helpers, adjacent section pages, and nearby UI state files only as needed for the active phase.

## Test Commands

- npm run build

## Manual Verification Follow-Up

- Review the final grouped shell across Students, Homeschool, a representative Homeschool child route, Chores, a representative Chores child route, Account Settings, and Lockdown in a live browser session before accepting the workflow.

## Project Manager Questions

- None currently known. Ask only if product intent, acceptance criteria, or runtime setup is still underspecified.

## Human Assistance Triggers

- Use the documented disposable validation accounts if authenticated parent smoke is needed.

## Master Developer Review Focus

Confirm that Account Settings And Shell Integration Polish is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Account Settings And Shell Integration Polish. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Account Settings And Shell Integration Polish using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Accepted grouped dashboard shell
- Implementation-ready shell and section routing foundation for later deeper page work
