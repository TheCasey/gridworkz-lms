# Phase 9: Integration Hardening And Launch QA

## Goal

Harden the cross-module chores/rewards release path with security review, downgrade behavior, seeded validation, documentation, and end-to-end browser smoke.

## Depends On

- Phase 8: Reward Store And Redemptions

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Review downgrade behavior for chores, allowance, points, and rewards.
- Implement and verify the PM-approved launch packaging split: daily routine access is free; chore pools, weekly/monthly chores, allowance tracking, achievements, rewards, and related cosmetics are paid.
- Verify student portal privacy and trusted callable enforcement across the full module.
- Add seed or validation scripts for a multi-student household with routines, weekly/monthly chores, allowance, points, and rewards.
- Update planning docs, support notes, and manual QA expectations.

## Deliverables

- Release hardening fixes from prior phases.
- Seeded validation script or runbook for a two-student household.
- Updated docs for module status, open rollout risks, and manual QA.
- Final build/lint/browser evidence.

## Files Or Areas To Touch

- docs/specs/chores-and-rewards-module.md
- docs/roadmap.md
- docs/architecture.md
- docs/support/chores-and-rewards-runbook.md
- scripts/check-chores-rewards-e2e.mjs
- firestore.rules
- src/constants/entitlements.js
- src/constants/dashboardFeatures.js
- src/utils/entitlementUtils.js
- functions/src/index.js

## Read First

- docs/specs/chores-and-rewards-module.md
- docs/roadmap.md
- docs/architecture.md
- firestore.rules
- src/pages/dashboard/ChoresRoute.jsx
- src/pages/StudentPortal.jsx

## Exit Criteria

- The full module can be validated against a realistic multi-student household scenario.
- Free accounts can access only daily routine behavior, while the first paid Core/Pro plan and Lockdown include chore pools, weekly/monthly chores, allowance, achievements, rewards, and related cosmetics.
- Downgrade behavior is read-mostly and non-destructive.
- Student-visible data remains scoped to the active student.
- Docs accurately describe shipped state, open risks, and manual rollout steps.
- Build and lint pass after all module slices are integrated.

## Automated Test Expectation

Add or update an end-to-end validation script for the full chores/rewards state model, including free daily-routine-only access and paid Core/Pro plus Lockdown access where possible; otherwise document why browser/manual validation remains required.

## Test Files

- scripts/check-chores-rewards-e2e.mjs

## Test Cases To Cover

- Two students can complete quotas from shared pools without seeing sibling private data.
- Monthly chore cooldown prevents immediate next-month repetition.
- Allowance and points are calculated from the accepted completions.
- Reward redemption spends or reserves points according to the accepted PM decision.
- Free plan allows daily routine use but locks paid chore/reward areas; Core/Pro and Lockdown allow the full module.
- Downgrade locks new creates but preserves history and parent cleanup paths.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `security-rules-review`: preferred tools `shell`, `code-review`; default evidence rules/code references, risk notes. Inspect Firestore rules, trusted callable boundaries, and public student portal exposure for the active slice.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence runtime URL, screenshot or interaction notes. Load the live UI in a runtime and verify the main happy path for the active slice.
- `interaction-smoke`: preferred tools `browser-use`, `playwright`; default evidence interaction notes, console/error observations. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `manual-qa`: preferred tools `human`; default evidence manual verification note. Document the manual follow-up that a human must complete before final merge or release confidence.

## Runtime Targets

- http://localhost:3000/dashboard/chores
- http://localhost:3000/student/:slug

## Evidence Required

- command output
- runtime URL
- screenshot or interaction notes
- rules/code references
- manual verification note

## Allowed Discovery

Inspect any module file touched by earlier phases, but keep changes limited to integration fixes, docs, validation, and release blockers.

## Test Commands

- node scripts/check-chores-rewards-e2e.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- PM/human pass through parent setup, student chores, allowance review, point balance, reward redemption, and downgrade behavior before production launch.

## Project Manager Questions

- Answered 2026-05-26: mark the module as implemented after final Phase 9 validation.
- Answered 2026-05-26: daily routines are free; chore pools, weekly/monthly chores, allowance tracking, achievements, rewards, and related cosmetics are locked behind the first paid Core/Pro plan and included in Lockdown.

## Human Assistance Triggers

- Provide staging credentials or a seeded Firebase project if local validation cannot cover trusted callables and rules.

## Master Developer Review Focus

Treat this as final integration review, not a chance to add new feature scope.

## Runtime Handoff Notes

- `developer`: Fix integration blockers, docs, and validation gaps only; do not add new chore/reward concepts.
- `tester`: Run full-story validation and explicitly call out any residual manual-only release risk.

## Next Phase Inputs

- Launch-ready chores/rewards module or documented beta state.
