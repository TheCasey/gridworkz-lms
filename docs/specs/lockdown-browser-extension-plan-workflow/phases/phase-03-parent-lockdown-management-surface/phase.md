# Phase 3: Parent Lockdown Management Surface

## Goal

Upgrade the dedicated Lockdown dashboard module from a prototype policy editor into a production management surface for derived policy visibility, off-hours controls, and device enrollment.

## Depends On

- Phase 2: Published Weekly Plan Policy Derivation

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Keep the dedicated /dashboard/lockdown route and shared entitlement rail as the parent-facing entry point.
- Replace prototype-only copy and raw allowlist editing assumptions with production-safe controls that match the new derived-policy model.
- Preserve downgrade-safe read-only behavior for non-Lockdown plans.

## Deliverables

- Parent Lockdown module that reflects the derived production contract instead of the current prototype policy editor
- Enrollment or pairing UI aligned to the trusted device contract
- Off-hours approved-resource management surface if that remains a parent-managed concern

## Files Or Areas To Touch

- src/pages/Lockdown.jsx
- src/components/LockdownPolicyPanel.jsx
- src/hooks/useEntitlements.js
- src/pages/Settings.jsx
- src/utils/lockdownPolicyUtils.js

## Exit Criteria

- The Lockdown dashboard surface no longer presents the browser-extension path as a prototype-only raw policy editor.
- Parents can manage the browser-extension setup through the dedicated Lockdown module without bypassing the entitlement rail.
- Downgraded parents still keep visible saved state while active editing or pairing stays disabled.

## Test Commands

- npm run lint
- npm run build
- npm run dev -- --host 127.0.0.1 --port 3000

## Master Developer Review Focus

Keep this phase on the Lockdown module itself. Avoid redesigning unrelated dashboard surfaces or broad subscription flows.

## Runtime Handoff Notes

- `developer`: Reuse the existing route-backed Lockdown module and entitlement rail. Replace prototype assumptions rather than adding a second management surface.
- `tester`: Exercise both entitled and downgraded states so the production surface does not regress the existing read-only downgrade behavior.

## Next Phase Inputs

- Stable parent-facing management surface for enrollment and derived policy review
- Locked-state and downgrade behavior aligned to the production browser-extension path
