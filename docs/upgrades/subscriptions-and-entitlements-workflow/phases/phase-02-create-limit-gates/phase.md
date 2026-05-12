# Phase 2: Create-Limit Gates

## Goal

Apply the shared entitlement rules to the current billable create paths so student creation and active-subject creation respect plan limits without deleting or blocking access to existing data.

## Depends On

- Phase 1: Entitlement Foundation

## Role Sequence

`master-developer -> developer -> tester`

## Scope

- Gate the existing add-student flow in the parent dashboard.
- Gate active subject creation in the curriculum flow while preserving edit, archive, and delete actions.
- Show concrete usage-versus-limit messaging where the user attempts to create gated records.
- Keep downgrade handling read-mostly and non-destructive.

## Deliverables

- Plan-aware student-create gate in ParentDashboard
- Plan-aware active-subject-create gate in Curriculum
- Usage and upgrade-needed messaging near the affected create surfaces
- Downgrade-safe behavior that still lets parents edit, archive, or delete existing records

## Files Or Areas To Touch

- src/pages/ParentDashboard.jsx
- src/pages/Curriculum.jsx
- src/hooks/useEntitlements.js
- src/utils/entitlementUtils.js

## Exit Criteria

- Accounts at the student limit cannot create another student through the current dashboard flow.
- Accounts at the curriculum limit cannot create another active subject, but can still edit, archive, or delete existing ones.
- Curriculum limit checks count only active subjects and ignore inactive records kept for history.
- User-facing messaging explains the limit and upgrade path instead of failing silently.

## Test Commands

- npm run build

## Next Phase Inputs

- Verified student and curriculum gating behavior
- Reusable locked-state and upsell copy patterns for plan-limited actions
