# Phase 5: End-To-End Validation And Launch Docs

## Goal

Fully test the browser-extension product path with real weekly-plan data and update the current-state docs once the feature is no longer just a PoC.

## Depends On

- Phase 4: Extension Secure Sync And Enforcement

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Run the authenticated browser plus extension validation matrix against real parent, student, published-weekly-plan, and submission data.
- Verify pairing, entitlement gating, downgrade behavior, policy propagation, restart persistence, and denied stale access under the production contract.
- Promote the browser-extension path into current-state docs only if the runtime behavior is production-safe.

## Deliverables

- Recorded manual validation matrix for the production browser-extension path
- Current-state docs updated to reflect live Lockdown behavior and remaining follow-on scope
- Explicit separation between completed browser-extension work and still-future kiosk-mode work

## Files Or Areas To Touch

- docs/architecture.md
- docs/features/parent-dashboard.md
- docs/features/student-portal.md
- docs/specs/lockdown-browser-extension-plan.md
- docs/roadmap.md

## Exit Criteria

- A real-account manual validation pass covers pairing, derived policy propagation, weekly-block transitions, off-hours behavior, restart persistence, and downgrade handling.
- The browser-extension path is documented as current state only if the PoC trust and public-read limitations are gone.
- Any remaining kiosk-mode or broader hardening work is called out as follow-on scope rather than hidden inside the browser-extension closeout.

## Test Commands

- npm run lint
- npm run build
- npm run dev -- --host 127.0.0.1 --port 3000

## Master Developer Review Focus

Require concrete runtime evidence in this phase. Do not let the workflow close on build-only confidence.

## Runtime Handoff Notes

- `developer`: Support the validation pass by filling only the gaps exposed by the active test matrix; do not reopen broad earlier-phase redesign.
- `tester`: Treat this as the launch gate for the browser-extension track. Record exact runtime coverage, failures, and any manual-only residual risk.

## Next Phase Inputs

- Reusable device-trust and policy-derivation foundation for future kiosk-mode follow-on
