# Phase 1: Trusted Policy Contract And Pairing

## Goal

Replace the PoC public-read policy fetch and loose pairing code with a production-safe browser-extension trust model.

## Depends On

- None

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Define the production browser-extension policy representation and the pairing or enrollment contract it depends on.
- Move the read path away from unauthenticated public Firestore document reads and away from pairing values that treat policy id plus public Firebase config as the effective secret.
- Establish the trusted backend contract in code now, but do not migrate the MV3 runtime or redesign the parent Lockdown management surface in this phase. Later phases consume the contract created here.
- Keep the work limited to the browser-extension trust boundary; do not pull kiosk-mode rollout into this phase.

## Deliverables

- Server-owned or otherwise trusted device-policy read contract for the browser extension
- Pairing or enrollment contract that replaces the current public-config PoC code path
- Explicit compatibility or migration notes for the current lockdownPolicies PoC document shape
- Clear separation between the new production contract and the still-temporary PoC sync path that Phase 4 will replace

## Files Or Areas To Touch

- src/constants/schema.js
- src/utils/lockdownPolicyUtils.js
- functions/src/index.js
- firestore.rules
- docs/specs/lockdown-browser-extension-plan.md

## Exit Criteria

- A production-safe browser-extension contract exists that does not depend on public Firestore get access to lockdownPolicies documents.
- The pairing or enrollment contract no longer treats raw policy id plus project id plus API key as the trust boundary.
- If the existing PoC extension still needs the old public-read path temporarily, that compatibility boundary is explicitly isolated and documented as non-production until Phase 4 swaps the runtime over.
- Repo docs and code make the production path and the temporary PoC boundary explicit.

## Test Commands

- npm run lint
- npm run build

## Master Developer Review Focus

Do not let this phase drift into weekly-plan derivation or parent-surface redesign before the production trust boundary is settled.

## Runtime Handoff Notes

- `developer`: Replace the public-read pairing assumption first. Establish the trusted contract and compatibility boundary without widening this phase into extension-runtime migration, dashboard UX polish, kiosk mode, or general security cleanup.
- `tester`: Verify that the old public-read assumption is actually removed or isolated from the production path, not just hidden behind new UI copy.

## Next Phase Inputs

- Stable trusted policy-read contract for browser-extension devices
- Resolved migration boundary from the current PoC pairing flow
