# Phase 3: Account Visibility And Locked States

## Goal

Expose current plan and usage in the authenticated shell, and establish explicit locked-state UX for premium capabilities instead of silent omission.

## Depends On

- Phase 2: Create-Limit Gates

## Role Sequence

`master-developer -> developer -> tester`

## Scope

- Add a visible account or plan summary surface in Settings.
- Surface current plan, usage, and upgrade-needed messaging in a way that matches the existing dashboard design language.
- Make the authenticated shell consume entitlement flags for premium visibility decisions.
- Prepare future project-gated surfaces without inventing a projects feature that does not exist yet.

## Deliverables

- Plan and usage summary in Settings
- Shared locked-state messaging pattern for premium capabilities
- Dashboard-shell entitlement consumption that future premium work can reuse

## Files Or Areas To Touch

- src/pages/Settings.jsx
- src/pages/ParentDashboard.jsx
- src/hooks/useEntitlements.js
- src/constants/entitlements.js

## Exit Criteria

- Parents can see their current plan, usage, and relevant limits in the authenticated experience.
- Premium-gated UI uses explicit locked states or upgrade messaging instead of disappearing without explanation.
- The phase does not invent a standalone billing system or a new projects data model.

## Test Commands

- npm run build

## Next Phase Inputs

- Stable account-summary surface
- Reusable locked-state UX pattern for lockdown and future premium features
