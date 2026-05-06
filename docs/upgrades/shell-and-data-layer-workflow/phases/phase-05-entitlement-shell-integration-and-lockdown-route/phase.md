# Phase 5: Entitlement Shell Integration and Lockdown Route

## Goal

Make premium gating structural in the shell and move Lockdown into its own gated module instead of leaving it embedded in the students surface.

## Depends On

- subjects-reports-and-rollover-hooks

## Role Sequence

`master-developer -> developer -> tester`

## Scope

- Consume `useEntitlements` from the shell and feature registry.
- Show visible, locked, or hidden module states from shared metadata.
- Move Lockdown into its own route-backed module while preserving the existing entitlement-aware panel behavior.

## Deliverables

- Entitlement-aware feature registry fields
- Locked-state shell behavior for premium modules
- Dedicated Lockdown route/module

## Files Or Areas To Touch

- src/pages/ParentDashboard.jsx
- src/components/LockdownPolicyPanel.jsx
- src/pages/Settings.jsx
- src/hooks/useEntitlements.js

## Exit Criteria

- Premium modules can be shown as visible, locked, or hidden from one shared shell contract.
- Lockdown no longer lives as a special-case panel inside the students section.
- The existing `Settings` plan summary remains the primary account summary surface.

## Test Commands

- npm run build

## Next Phase Inputs

- Structural shell-level premium gating
- Dedicated Lockdown module contract
