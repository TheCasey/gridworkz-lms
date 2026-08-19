# Phase 2: Schema And Availability Helpers

## Goal

Add future chore, routine, allowance, point, and reward contracts plus pure helper logic for period boundaries and cooldown availability.

## Depends On

- Phase 1: Entitlement And Route Foundation

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add schema constants for chore settings, routine templates, chore definitions, claims, completions, allowance periods, point ledger entries, wallets, reward catalog items, and redemptions.
- Add pure utility helpers for daily routine dates, weekly/monthly period boundaries, claim expiration, next eligible time, quota counting, and student-safe view derivation.
- Keep Firestore writes, UI, and callable functions out of this phase.
- Keep routine checklist item checks under one daily routine completion shape; do not create item-level completion records.
- Treat one completed chore as one quota block for MVP. Do not ship effort weighting behavior in this phase.

## Deliverables

- Schema source-of-truth additions in `src/constants/schema.js`.
- Pure chore/reward utility module.
- Focused deterministic validation script for availability and cooldown edge cases.

## Files Or Areas To Touch

- src/constants/schema.js
- src/utils/choreUtils.js
- src/utils/rewardUtils.js
- scripts/check-chores-availability.mjs

## Read First

- docs/specs/chores-and-rewards-module-workflow/phases/phase-02-schema-and-availability-helpers/phase.md
- docs/specs/chores-and-rewards-module.md
- src/constants/schema.js
- src/utils/weekUtils.js
- src/utils/schoolSettingsUtils.js
- scripts/seed-reporting-validation.mjs

## Exit Criteria

- All planned collection shapes have documented schema constants.
- `max(next_period_boundary, completed_at + minimum_cooldown)` behavior is implemented in a pure helper.
- Weekly and monthly edge cases from the spec are covered by an automated script.

## Automated Test Expectation

Add a focused Node assertion script for chore availability, routine date keys, quota counting, and reward/point defaults.

## Test Files

- scripts/check-chores-availability.mjs

## Test Cases To Cover

- Weekly chore completed near reset stays unavailable until both the next period and cooldown permit it.
- Monthly chore completed near month end does not become available on the first of the next month when cooldown remains active.
- Monthly chore completed early waits for the next month boundary when cooldown ends first.
- Quota counting ignores unavailable or sibling-claimed chores.
- Student-safe chore view omits sibling private allowance/reward state.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `code-review`: preferred tools `shell`; default evidence code references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.

## Runtime Targets

- No explicit runtime targets listed. Add them before live validation if the phase needs them.

## Evidence Required

- command output
- helper/code references

## Allowed Discovery

Follow imports from week and school-setting utilities only; do not start Firestore or UI work.

## Test Commands

- node scripts/check-chores-availability.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- None currently required. Add a follow-up here if the phase cannot be fully verified in-agent.

## Project Manager Questions

- None required before Phase 2 dispatch. The source plan says persisted routine completion is one routine completion for the day, and one completed chore normally equals one block while effort weighting is later work.

## Human Assistance Triggers

- None currently known. Add device, simulator, credential, account, fixture, or manual setup needs here before validation if they appear.

## Master Developer Review Focus

Confirm schema/helper work stays pure and deterministic. Do not let this phase introduce Firestore writes, callable functions, UI, approval defaults, allowance calculations, point-award behavior, reward redemption behavior, or student portal exposure.

## Runtime Handoff Notes

- `developer`: Implement only Schema And Availability Helpers. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Schema And Availability Helpers using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Stable schema vocabulary.
- Pure availability and quota helper behavior.
