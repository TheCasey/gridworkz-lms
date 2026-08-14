# Phase 1: Entitlement And Route Foundation

## Goal

Add the feature-flag and dashboard-shell foundation for future chores and rewards without committing to final paid packaging.

## Depends On

- None

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add separate entitlement keys for chores and rewards using the existing entitlement catalog pattern.
- Register a locked, visible placeholder dashboard feature entry for the future chores module without building the full UI.
- Document the unresolved packaging choice in code comments or docs where the flag is introduced.
- Do not add the optional allowance tracking key in this phase; keep allowance semantics for the later allowance-ledger phase.

## Deliverables

- Entitlement constants and upgrade copy for chores and rewards.
- Dashboard feature registry metadata for a future chores route.
- A small placeholder route or locked-state entry point if the shell requires a routable target.

## Files Or Areas To Touch

- src/constants/entitlements.js
- src/constants/dashboardFeatures.js
- src/App.jsx
- src/constants/schema.js
- functions/src/index.js
- scripts/check-chores-entitlements.mjs
- docs/specs/chores-and-rewards-module.md

## Read First

- docs/specs/chores-and-rewards-module-workflow/phases/phase-01-entitlement-and-route-foundation/phase.md
- docs/specs/chores-and-rewards-module.md
- docs/upgrades/subscriptions-and-entitlements.md
- src/constants/entitlements.js
- src/constants/dashboardFeatures.js
- functions/src/index.js

## Exit Criteria

- The codebase has stable feature keys for chores and rewards.
- The dashboard shell can represent the future module through the existing feature registry.
- No paid packaging assumption is hardcoded beyond a configurable entitlement flag.

## Automated Test Expectation

Add `scripts/check-chores-entitlements.mjs` to cover the new entitlement keys, trusted feature normalization, and dashboard route metadata. Then run lint and build.

## Test Files

- scripts/check-chores-entitlements.mjs

## Test Cases To Cover

- Free-plan fallback keeps chores and rewards locked unless explicitly enabled.
- Feature override behavior can expose chores/rewards without changing route code or hardcoding paid-plan packaging.
- Dashboard feature metadata resolves a locked-state route safely.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `code-review`: preferred tools `shell`; default evidence code references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.

## Runtime Targets

- No explicit runtime targets listed. Add them before live validation if the phase needs them.

## Evidence Required

- command output
- code references

## Allowed Discovery

Follow imports to `src/App.jsx`, `src/constants/schema.js`, `src/hooks/useEntitlements.js`, `src/utils/entitlementUtils.js`, operator entitlement UI helpers, dashboard route wrappers, and nearby validation scripts only as needed.

## Test Commands

- node scripts/check-chores-entitlements.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- None currently required. Add a follow-up here if the phase cannot be fully verified in-agent.

## Project Manager Questions

- None required before Phase 1 dispatch. The source plan already recommends separate `can_use_chores` and `can_use_rewards` flags, and the current subscription guidance prefers explicit locked-state UI over hiding future premium surfaces.

## Human Assistance Triggers

- None currently known. Add device, simulator, credential, account, fixture, or manual setup needs here before validation if they appear.

## Master Developer Review Focus

Keep the implementation to separate chores and rewards flags, a locked visible placeholder, and synchronized frontend/backend entitlement normalization. Ask the PM only if implementation would change packaging, monetization, allowance semantics, reward economics, or student-facing behavior.

## Runtime Handoff Notes

- `developer`: Do not implement chore data, parent setup UI, student UI, allowance, or rewards in this phase.
- `tester`: Focus on proving the entitlement and route metadata cannot accidentally unlock unfinished surfaces.

## Next Phase Inputs

- Stable entitlement feature keys.
- Dashboard registry contract for the future chores surface.
