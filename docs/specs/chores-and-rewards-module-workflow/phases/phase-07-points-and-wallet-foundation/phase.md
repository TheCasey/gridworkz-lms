# Phase 7: Points And Wallet Foundation

## Goal

Add shared points settings, append-only point ledger entries, student wallets, and award hooks for school and chore activity.

## Depends On

- Phase 6: Allowance Ledger

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add point settings for school blocks, chore blocks, and routine days.
- Create append-only point ledger and wallet update behavior.
- Award points from trusted chore/routine completions without double-awarding.
- Keep school block point settings configurable, but defer automatic school-block awards until school completion moves off the current public `submissions` write path and onto a trusted server-owned path.
- Keep reward catalog and redemption UI out of this phase.
- Use one shared student point wallet with source-attributed ledger entries, as specified in the source plan.
- Defer suggested points-per-block recommendations until PM approves the reward economics and UX; Phase 7 should expose configurable values, not generated suggestions.

## Deliverables

- Reward/point utility helpers.
- Trusted point-award path or shared award service.
- Parent point settings surface.
- Student point balance display if rewards are enabled and the existing trusted student chore state is available.

## Files Or Areas To Touch

- src/utils/rewardUtils.js
- src/pages/dashboard/ChoresRoute.jsx
- src/hooks/useChoreSetup.js
- src/pages/StudentPortal.jsx
- src/firebase/trustedOperations.js
- functions/src/index.js
- scripts/check-points-ledger.mjs

## Read First

- docs/specs/chores-and-rewards-module.md
- src/utils/rewardUtils.js
- src/pages/dashboard/ChoresRoute.jsx
- src/pages/StudentPortal.jsx
- functions/src/index.js
- firestore.rules

## Exit Criteria

- Point settings can be configured separately for school, chores, and routines.
- Ledger entries are append-only and source-attributed.
- Wallet totals are derived or updated through trusted logic, not arbitrary client writes.
- School completion and chore completion cannot double-award points for the same source event.

## Automated Test Expectation

Add a focused Node assertion script for point settings defaults, ledger normalization, idempotent awards, and wallet totals.

## Test Files

- scripts/check-points-ledger.mjs

## Test Cases To Cover

- School block point settings normalize and persist, while automatic school-block awards remain disabled from public `submissions` writes.
- A chore completion awards the configured chore points once.
- Routine completion awards points only when reward settings enable routine points and the routine template is marked `counts_toward_points`.
- Manual adjustments are represented as separate ledger entries.
- Wallet totals match ledger sums for one student without exposing sibling data.
- Point-award idempotency prevents duplicate ledger entries for the same source event.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `security-rules-review`: preferred tools `shell`, `code-review`; default evidence rules/code references, risk notes. Inspect Firestore rules, trusted callable boundaries, and public student portal exposure for the active slice.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence runtime URL, screenshot or interaction notes. Load the live UI in a runtime and verify the main happy path for the active slice.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- http://localhost:3000/dashboard/chores
- http://localhost:3000/student/:slug

## Evidence Required

- command output
- runtime URL
- ledger/idempotency notes
- rules/code references

## Allowed Discovery

Follow existing submission, report, chore completion, and trusted operation paths only as needed.

## Test Commands

- node scripts/check-points-ledger.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- PM sanity check on point-setting language before release.
- PM approval is required before adding suggested points-per-block economics or UX.
- PM or master-developer approval is required before enabling school-block point awards from any path that has not been hardened as a trusted server-owned completion flow.

## Project Manager Questions

- Resolved from source plan: school, project, chore, routine, and future achievement points share one student point wallet with source attribution.
- Suggested points-per-block recommendations are deferred from Phase 7; ask PM before adding generated point suggestions or reward-economics defaults beyond configurable zero-default fields.
- Security refinement on `2026-05-26`: automatic school-block point awards are deferred because existing `submissions` creates are public and cannot safely mint points. A later trusted school-completion flow can enable those awards.

## Human Assistance Triggers

- None currently known. Add device, simulator, credential, account, fixture, or manual setup needs here before validation if they appear.

## Master Developer Review Focus

Confirm that Points And Wallet Foundation is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Points And Wallet Foundation. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Points And Wallet Foundation using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Student point wallet.
- Source-attributed point ledger.
- Configurable point settings.
- Trusted-school-completion follow-up for school block point awards.
