# Phase 4: Lockdown Entitlement Integration

## Goal

Put the current Lockdown PoC controls behind the lockdown entitlement rail so the productized feature path does not diverge from the shared subscription model.

## Depends On

- Phase 3: Account Visibility And Locked States

## Role Sequence

`master-developer -> developer -> tester`

## Scope

- Gate the current LockdownPolicyPanel behind the shared lockdown entitlement flag.
- Show explicit upgrade or read-only messaging for parents who do not have lockdown access.
- Preserve saved policy data on downgrade while disabling new pairing and policy edits until re-upgrade.
- Keep the same entitlement source ready for future kiosk mode and device-management surfaces.

## Deliverables

- Lockdown-gated dashboard integration
- Read-only or locked-state handling for downgraded accounts with saved policy data
- Shared entitlement-driven entry point that future lockdown variants can reuse

## Files Or Areas To Touch

- src/pages/ParentDashboard.jsx
- src/components/LockdownPolicyPanel.jsx
- src/hooks/useEntitlements.js
- src/constants/entitlements.js

## Exit Criteria

- Non-lockdown accounts cannot use active lockdown management controls from the current dashboard flow.
- Parents who downgrade do not lose saved lockdown policy data.
- The lockdown UI explains why controls are unavailable and how access is restored.

## Test Commands

- npm run build

## Next Phase Inputs

- Client-side lockdown gating behavior aligned to plan entitlements
- Clear definition of which lockdown actions must move behind trusted enforcement next
