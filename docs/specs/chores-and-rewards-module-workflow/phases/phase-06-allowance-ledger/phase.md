# Phase 6: Allowance Ledger

## Goal

Add allowance policy, period calculation, earned amount calculation, parent adjustments, and paid-status tracking without moving money.

## Depends On

- Phase 5: Student Chore Workspace

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add allowance settings for weekly, biweekly, and monthly periods.
- Calculate all-or-nothing and prorated earned amounts from completed routine/chore blocks.
- Snapshot allowance-period policy and support parent adjustments plus paid markers.
- Keep actual payouts, debit cards, and payment-provider integrations out of scope.
- Count routines toward allowance only when both the allowance policy includes routines and the routine template is explicitly marked `counts_toward_allowance`.
- Keep student allowance display out of scope until PM approves student-visible allowance copy and timing.
- Parent adjustments may be positive or negative bookkeeping adjustments, but the resulting child allowance balance must never go below zero.
- Parent payout is manual bookkeeping only: the parent presses a paid-out control, enters the amount sent outside the app, and the app records paid amount/status/timestamp without payment-provider integration.

## Deliverables

- Allowance utility helpers and trusted calculation path.
- Parent allowance summary and paid/unpaid controls.
- Student-safe earned/owed display if approved by PM.
- Validation script for calculation and period edge cases.

## Files Or Areas To Touch

- src/utils/allowanceUtils.js
- src/pages/dashboard/ChoresRoute.jsx
- src/hooks/useChoreSetup.js
- src/firebase/trustedOperations.js
- functions/src/index.js
- scripts/check-allowance-ledger.mjs

## Read First

- docs/specs/chores-and-rewards-module.md
- src/utils/choreUtils.js
- src/pages/dashboard/ChoresRoute.jsx
- src/firebase/trustedOperations.js
- functions/src/index.js
- firestore.rules

## Exit Criteria

- Allowance periods can be calculated for weekly, biweekly, and monthly settings.
- All-or-nothing and prorated policies produce correct earned amounts.
- Parents can mark allowance periods paid without integrating money movement.
- Student views do not expose sibling balances or private ledger details.

## Automated Test Expectation

Add a focused Node assertion script covering allowance period boundaries, all-or-nothing and prorated calculations, parent adjustments, and paid-state normalization.

## Test Files

- scripts/check-allowance-ledger.mjs

## Test Cases To Cover

- 50% completion earns zero under all-or-nothing and 50% under prorated.
- Over-completion caps base allowance at 100% unless a bonus policy is explicitly enabled.
- Monthly and biweekly period keys remain stable across week reset boundaries.
- Paid markers preserve calculated amount, adjustment amount, paid amount, and paid timestamp.
- Negative adjustments or overpayment floor the remaining child balance at zero instead of creating a negative balance.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence runtime URL, screenshot or interaction notes. Load the live UI in a runtime and verify the main happy path for the active slice.
- `security-rules-review`: preferred tools `shell`, `code-review`; default evidence rules/code references, risk notes. Inspect Firestore rules, trusted callable boundaries, and public student portal exposure for the active slice.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- http://localhost:3000/dashboard/chores

## Evidence Required

- command output
- runtime URL
- allowance calculation notes
- rules/code references

## Allowed Discovery

Follow chore setup/completion utilities and trusted operation wrappers only as needed.

## Test Commands

- node scripts/check-allowance-ledger.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- PM or human accounting sanity check for allowance language before release.

## Project Manager Questions

- Resolved from source plan: routine completion counts toward allowance only when explicitly enabled per routine and included by allowance policy.
- Answered by PM on `2026-05-26`: parent adjustments can reduce allowance, but child balances must never go below zero; payout is manual bookkeeping with a paid-out button and amount sent.

## Human Assistance Triggers

- None currently known. Add device, simulator, credential, account, fixture, or manual setup needs here before validation if they appear.

## Master Developer Review Focus

Confirm that Allowance Ledger is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Allowance Ledger. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Allowance Ledger using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Allowance policy snapshots.
- Completed chore/routine to allowance calculation contract.
