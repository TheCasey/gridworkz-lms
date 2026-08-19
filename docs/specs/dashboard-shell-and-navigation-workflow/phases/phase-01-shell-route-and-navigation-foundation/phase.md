# Phase 1: Shell Route And Navigation Foundation

## Goal

Establish grouped dashboard navigation, default Students landing, section-level route structure, single-expanded-section behavior, visible Lockdown coming-soon state, and a dedicated Account Settings route contract.

## Depends On

- None

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Replace the current flat dashboard module list with a grouped shell foundation around `Students`, `Homeschool`, `Chores`, and `Lockdown`.
- Keep `Students` as the default `/dashboard` landing and preserve existing page-owned data loading.
- Add the top-level `Homeschool` route and move shell-level account access to the top-right `Account Settings` entry.
- Do not implement the persistent Live Pulse drawer behavior, the Students overview redesign, the Homeschool dashboard content buildout, the Chores child-route split, or final shell polish in this phase.

## Deliverables

- Grouped Homeschool and Chores navigation contract wired into the dashboard shell
- Students remains the default post-login landing route
- Single-expanded-section navigation behavior for Homeschool and Chores
- Visible Lockdown coming-soon shell state
- Dedicated Account Settings route placeholder or initial page contract

## Files Or Areas To Touch

- docs/specs/dashboard-shell-and-navigation.md
- src/App.jsx
- src/constants/dashboardFeatures.js
- src/pages/ParentDashboard.jsx

## Read First

- docs/specs/dashboard-shell-and-navigation.md
- src/App.jsx
- src/constants/dashboardFeatures.js
- src/pages/ParentDashboard.jsx
- docs/architecture.md

## Exit Criteria

- The dashboard shell no longer depends on a flat module list alone.
- The grouped navigation is rendered coherently with Students, Homeschool, Chores, and Lockdown.
- Account Settings is reachable as a dedicated route from the top-right chrome.
- The shell build passes and route smoke covers the new structure.

## Automated Test Expectation

No automated test changes required for this phase; validate with the declared validation modes and the no-test rationale.

## Test Files

- None required for this phase.

## Test Cases To Cover

- No automated route or component harness is required for this phase.

## No-Test Rationale

The repo still has no established automated component or route test harness for dashboard-shell behavior. This workflow phase should validate with `npm run build` plus live browser route smoke. A local ESLint script and config now exist, but lint is not a required acceptance gate for this workflow phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- http://127.0.0.1:3000/dashboard
- http://127.0.0.1:3000/dashboard/students
- http://127.0.0.1:3000/dashboard/homeschool
- http://127.0.0.1:3000/dashboard/settings

## Evidence Required

- build output
- grouped navigation route notes
- account-settings entry note
- dashboard screenshot

## Allowed Discovery

Start with the listed read-first files, then follow dashboard routes, shell helpers, adjacent section pages, and nearby UI state files only as needed for the active phase.

## Test Commands

- npm run build

## Manual Verification Follow-Up

- Confirm grouped nav behavior, default landing, and Account Settings entry in a live dashboard session.

## Project Manager Questions

- None currently known. Ask only if product intent, acceptance criteria, or runtime setup is still underspecified.

## Human Assistance Triggers

- Provide a logged-in parent session or perform a manual browser login if dashboard-only validation cannot be completed in-agent.

## Master Developer Review Focus

Confirm that Shell Route And Navigation Foundation is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Shell Route And Navigation Foundation. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Shell Route And Navigation Foundation using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Grouped shell structure
- Stable route names
- Top-right account action contract
