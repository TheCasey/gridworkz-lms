# Phase 8: Reward Store And Redemptions

## Goal

Add built-in/profile rewards, parent-stocked rewards, point-cost configuration, stock, redemption requests, approvals, and fulfillment tracking.

## Depends On

- Phase 7: Points And Wallet Foundation

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Build parent reward catalog management with stock, cost, eligibility, and fulfillment status.
- Build student reward store browsing and redemption request flow.
- Support immediate built-in cosmetic unlocks and approval-required parent rewards.
- Do not store gift-card secrets or payment credentials.
- Ship placeholder built-in cosmetic sets for avatars, badges, and profile themes; final images/assets are deferred.
- Parent-created reward requests reserve points at request time. Rejected or canceled requests must restore the reserved points; approval and fulfillment should not double-spend.

## Deliverables

- Parent reward catalog UI.
- Student Rewards area.
- Reward redemption lifecycle and trusted point-spend behavior.
- Built-in avatar, badge, and profile-theme placeholder unlock foundation.

## Files Or Areas To Touch

- src/pages/dashboard/ChoresRoute.jsx
- src/pages/StudentPortal.jsx
- src/components/StudentRewardStore.jsx
- src/utils/rewardUtils.js
- src/firebase/trustedOperations.js
- functions/src/index.js

## Read First

- docs/specs/chores-and-rewards-module.md
- src/utils/rewardUtils.js
- src/pages/dashboard/ChoresRoute.jsx
- src/pages/StudentPortal.jsx
- src/firebase/trustedOperations.js
- firestore.rules

## Exit Criteria

- Parents can add, edit, archive, and restock custom rewards.
- Students can request eligible rewards when they have enough points.
- Reward redemptions snapshot title, cost, stock, and fulfillment terms.
- Points are reserved or spent consistently and cannot go negative.
- Gift-card codes or sensitive fulfillment secrets are not stored.

## Automated Test Expectation

Add focused automated coverage for reward availability, stock depletion, redemption lifecycle transitions, and point spend/refund behavior.

## Test Files

- scripts/check-reward-redemptions.mjs

## Test Cases To Cover

- In-stock parent reward becomes unavailable when stock reaches zero.
- Student cannot redeem a reward above their point balance.
- Parent-created reward requests reserve points immediately; rejected or canceled redemptions restore reserved points.
- Fulfilled redemption snapshots remain stable after catalog edits.
- Built-in placeholder avatar, badge, and profile-theme unlocks can spend points immediately without parent fulfillment state.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence runtime URL, screenshot or interaction notes. Load the live UI in a runtime and verify the main happy path for the active slice.
- `interaction-smoke`: preferred tools `browser-use`, `playwright`; default evidence interaction notes, console/error observations. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.
- `security-rules-review`: preferred tools `shell`, `code-review`; default evidence rules/code references, risk notes. Inspect Firestore rules, trusted callable boundaries, and public student portal exposure for the active slice.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- http://localhost:3000/dashboard/chores
- http://localhost:3000/student/:slug

## Evidence Required

- command output
- runtime URL
- interaction notes
- rules/code references

## Allowed Discovery

Follow points ledger, chore dashboard, and student portal files only as needed.

## Test Commands

- node scripts/check-reward-redemptions.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Human visual pass for student reward store clarity and parent fulfillment workflow.

## Project Manager Questions

- Answered by PM on `2026-05-26`: ship placeholder sets for avatars, badges, and profile themes; final images/assets will be developed later.
- Answered by PM on `2026-05-26`: parent-created reward requests reserve points immediately.
- Answered by PM on `2026-05-26`: approve placeholder built-in reward costs of avatars `120`, badges `80`, and profile themes `140`.
- Future consideration from PM on `2026-05-26`: later evaluate chore module mode/options for points-based chores, allowance-based chores, or a parent-configurable mix after reviewing point earning economics against hours worked and chores done.

## Human Assistance Triggers

- Provide preferred sample rewards for seeded browser validation if needed.

## Master Developer Review Focus

Confirm that Reward Store And Redemptions is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Reward Store And Redemptions. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Reward Store And Redemptions using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Full reward catalog and redemption flow.
- Built-in reward unlock behavior.
