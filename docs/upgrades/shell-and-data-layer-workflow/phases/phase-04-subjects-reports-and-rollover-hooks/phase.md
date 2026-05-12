# Phase 4: Subjects, Reports, and Rollover Hooks

## Goal

Extract the remaining heavy parent-domain orchestration so feature containers compose hooks instead of owning Firestore logic directly.

## Depends On

- students-and-settings-domain-hooks

## Role Sequence

`master-developer -> developer -> tester`

## Scope

- Extract subject hooks and mutations from `Curriculum`.
- Extract weekly activity, reports, and rollover orchestration behind hook boundaries.
- Keep current reporting and rollover behavior intact in this phase.

## Deliverables

- Subject domain hooks
- Weekly activity/report hooks
- Weekly rollover hook boundary

## Files Or Areas To Touch

- src/pages/Curriculum.jsx
- src/pages/Reports.jsx
- src/pages/ParentDashboard.jsx
- src/hooks/

## Exit Criteria

- `Curriculum`, `Reports`, and the parent shell consume hooks for their major domain data instead of owning listeners inline.
- Trusted active-subject create behavior remains intact.
- Weekly activity and rollover logic are no longer buried directly inside the shell page.

## Test Commands

- npm run build

## Next Phase Inputs

- Portable subject/report/rollover hook contracts
- Cleaner feature containers for shell-level entitlement integration
