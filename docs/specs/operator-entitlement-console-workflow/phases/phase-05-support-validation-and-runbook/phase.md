# Phase 5: Support Validation And Runbook

## Goal

Validate the MVP support workflows end to end and document how to use temporary overrides, permanent repairs, and billing-backed state.

## Depends On

- ops-entitlements-ui

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add a short operator support runbook under docs.
- Validate missing entitlement repair, free/core/lockdown test overrides, clear override, and downgrade warnings.
- Document live-mode billing limitations and sandbox assumptions.
- Capture manual follow-up for live Stripe rollout.

## Deliverables

- Operator console support runbook
- Validation checklist
- Known limitations section
- Final workflow handoff notes

## Files Or Areas To Touch

- docs/specs/operator-entitlement-console.md
- docs/upgrades/subscriptions-and-entitlements.md
- docs/support/operator-entitlement-console-runbook.md

## Read First

- docs/specs/operator-entitlement-console.md
- docs/upgrades/subscriptions-and-entitlements.md
- src/pages/OpsEntitlements.jsx
- functions/src/index.js
- firestore.rules

## Exit Criteria

- Runbook explains temporary override versus billing-backed repair.
- Runbook explains how to initialize missing records and clear overrides.
- Validation checklist covers Free/Core/Lockdown behavior and Lockdown downgrade state.
- Source docs reflect implemented MVP status and remaining live-billing work.

## Automated Test Expectation

No new automated tests required for docs/runbook updates; rerun lint/build if any source code changes are made during validation fixes.

## Test Files

- None for this docs and manual validation phase.

## Test Cases To Cover

- Manual validation should cover missing-doc repair, Free/Core/Lockdown override, clear override, non-operator denial, and webhook-under-override behavior.

## No-Test Rationale

This phase is documentation and manual support validation; automated coverage belongs to earlier backend/UI phases.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `manual-qa`: preferred tools `human`; default evidence manual verification note. Document the manual follow-up that a human must complete before final merge or release confidence.

## Runtime Targets

- Operator console against staging or emulator data

## Evidence Required

- runbook file path
- manual workflow checklist results
- lint/build output if code changed

## Allowed Discovery

Follow only docs and files needed to verify operator support workflows.

## Test Commands

- npm run lint
- npm run build

## Manual Verification Follow-Up

- Validate missing-doc repair, Free/Core/Lockdown override, clear override, non-operator denial, and Stripe webhook-under-override behavior before accepting the workflow.

## Master Developer Review Focus

Confirm that Support Validation And Runbook is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Support Validation And Runbook. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Support Validation And Runbook using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
