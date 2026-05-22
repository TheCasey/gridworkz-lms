# Phase 4: Ops Entitlements UI

## Goal

Build `/ops/entitlements` with search, detail, diff preview, manual override, clear override, and audit timeline.

## Depends On

- operator-functions

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add an operator-only route outside the normal parent dashboard shell.
- Build search, account detail, state cards, warnings, override form, diff preview, and audit timeline.
- Always distinguish Effective State, Billing State, and Manual Override.
- Never expose secrets or raw Stripe config.
- Keep normal parent dashboard nav unchanged.

## Deliverables

- `/ops/entitlements` route
- Operator guard and loading/denied states
- Search/detail UI
- Override and clear forms with required reason and diff preview
- Audit timeline UI

## Files Or Areas To Touch

- src/App.jsx
- src/pages/OpsEntitlements.jsx
- src/components/ops/*
- src/firebase/trustedOperations.js

## Read First

- docs/specs/operator-entitlement-console.md
- src/App.jsx
- src/pages/ParentDashboard.jsx
- src/pages/Settings.jsx
- src/firebase/trustedOperations.js
- src/constants/entitlements.js

## Exit Criteria

- Non-operators see a clear denied state and cannot load account data.
- Operators can search and open account detail.
- Override form shows diff preview and requires reason before apply.
- Clear override path is obvious.
- Audit timeline renders webhook and operator events.

## Automated Test Expectation

No component test runner exists; keep logic-heavy formatting/diff helpers pure and add scriptable checks if introduced. Otherwise require lint/build plus browser smoke.

## Test Files

- scripts/check-operator-ui-helpers.mjs

## Test Cases To Cover

- Diff preview identifies plan/status/feature changes.
- Required reason validation blocks mutation.
- Manual override and billing state labels remain distinct.

## No-Test Rationale

The repo currently has no component test runner. UI behavior is validated with lint/build plus browser smoke unless pure helper checks are introduced.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.
- `interaction-smoke`: preferred tools `playwright`, `computer-use`; default evidence test output, screenshot. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.

## Runtime Targets

- http://localhost:3000/ops/entitlements

## Evidence Required

- lint/build output
- desktop and mobile screenshots
- non-operator denied state
- operator search/detail/override/clear interaction notes

## Allowed Discovery

Follow only route, auth context, trusted operation, entitlement catalog, and nearby component dependencies.

## Test Commands

- npm run lint
- npm run build

## Manual Verification Follow-Up

- Use an internal operator account to verify search, override, clear override, and audit display against real or emulator data.

## Master Developer Review Focus

Confirm that Ops Entitlements UI is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Ops Entitlements UI. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Ops Entitlements UI using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
