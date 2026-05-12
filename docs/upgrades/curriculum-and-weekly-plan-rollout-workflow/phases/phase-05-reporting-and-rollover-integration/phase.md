# Phase 5: Reporting And Rollover Integration

## Goal

Reconnect weekly reporting and rollover behavior to published weekly plans instead of implicit subject-only state.

## Depends On

- student-portal-weekly-workspace-foundation

## Expected Downstream Role Sequence

`developer -> tester`

## Read First

- `docs/upgrades/curriculum-and-weekly-plan-rollout.md`
- `phases/phase-04-student-portal-weekly-workspace-foundation/phase.md`
- `src/pages/Reports.jsx`
- `src/utils/reportUtils.js`
- `src/pages/ParentDashboard.jsx`
- `src/utils/weekUtils.js`

## Scope

- Snapshot the published weekly plan into weekly reports.
- Update reporting helpers and report surfaces to summarize assigned versus completed work from weekly plans.
- Adapt rollover behavior so weekly-plan publication and report archival stay aligned.
- Keep trusted backend archival automation out of scope for this workflow.

## Phase Constraints

- Do not add Evidence Drawer uploads, Firebase Storage work, or archival hardening in this phase.
- Preserve the current report browsing, filtering, and print surfaces while shifting the data contract underneath them.
- Keep backend-owned rollover automation on the security-hardening track rather than expanding this workflow.

## Deliverables

- Weekly report snapshot path tied to published weekly plans
- Updated report summary behavior for assigned and completed weekly blocks
- Weekly-plan-aware rollover integration

## Files Or Areas To Touch

- src/pages/Reports.jsx
- src/utils/reportUtils.js
- src/pages/ParentDashboard.jsx
- src/utils/weekUtils.js

## Exit Criteria

- Weekly reports archive a published-week snapshot rather than relying only on implicit subject state.
- Report views still support the current browsing and print flows after the contract shift.
- Rollover behavior stays aligned with weekly-plan publication without requiring backend automation yet.

## Test Commands

- npm run lint
- npm run build

## Master Developer Review Focus

Treat this as the bridge to the reporting contract, not as the place to add Evidence Drawer, storage uploads, or backend hardening.

## Runtime Handoff Notes

- `developer`: Move reports and rollover onto published weekly plans while keeping current report browsing and print behavior intact.
- `tester`: Validate weekly report generation, archival behavior, and rollover alignment against the new published-week contract.

## Next Phase Inputs

- Weekly-plan-backed report archival behavior
- Clear compatibility boundary for future hardening and Evidence Drawer work
