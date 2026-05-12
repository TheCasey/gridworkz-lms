# Lockdown Browser Extension Finalization Workflow

Source plan: `docs/specs/lockdown-browser-extension-plan.md`

## Summary

Finish the browser-extension track by replacing the PoC public-read pairing path with a trusted device-policy model, deriving device policy from published weekly plans and school-time rules, upgrading the parent Lockdown module away from prototype-only controls, and validating the browser extension end to end. Kiosk-mode follow-on stays out of scope until the browser-extension path is production-safe.

## Roles

- `master-developer`: Own the lockdown finalization sequence. Keep kiosk-mode work out of scope unless the active browser-extension phase proves it is required, and confirm the weekly-plan and entitlement assumptions still match repo reality before each handoff.
- `developer`: Implement only the active lockdown browser-extension phase. Preserve the route-backed dashboard shell, the shared entitlement rail, and the existing extension compatibility boundary until the production-safe path replaces it.
- `tester`: Validate only the active lockdown browser-extension phase with concrete build, lint, and extension-runtime checks. Record exact pass, fail, and manual-only gaps in the run log.
- `researcher`: Resolve bounded blockers around Chrome MV3 behavior, Firebase trust boundaries, or weekly-plan policy derivation without drifting into implementation.

## Phase Map

| Phase | Downstream Roles | Depends On | Status |
| --- | --- | --- | --- |
| [Phase 1: Trusted Policy Contract And Pairing](phases/phase-01-trusted-policy-contract-and-pairing/phase.md) | `developer -> tester` | None | `ready_for_master_developer` |
| [Phase 2: Published Weekly Plan Policy Derivation](phases/phase-02-published-weekly-plan-policy-derivation/phase.md) | `developer -> tester` | Phase 1: Trusted Policy Contract And Pairing | `pending` |
| [Phase 3: Parent Lockdown Management Surface](phases/phase-03-parent-lockdown-management-surface/phase.md) | `developer -> tester` | Phase 2: Published Weekly Plan Policy Derivation | `pending` |
| [Phase 4: Extension Secure Sync And Enforcement](phases/phase-04-extension-secure-sync-and-enforcement/phase.md) | `developer -> tester` | Phase 3: Parent Lockdown Management Surface | `pending` |
| [Phase 5: End-To-End Validation And Launch Docs](phases/phase-05-end-to-end-validation-and-launch-docs/phase.md) | `developer -> tester` | Phase 4: Extension Secure Sync And Enforcement | `pending` |

## Workflow Rules

- `master-developer` is the persistent orchestrator for the whole workflow.
- `workflow-state.yaml` is the source of truth for what should happen next.
- Each phase enters `ready_for_master_developer` before the first downstream handoff and after every downstream result.
- Each phase `role_sequence` is the expected downstream order under `master-developer` oversight.
- The scaffold does not prewrite downstream prompts. `master-developer` writes one runtime prompt at a time based on the live workflow state.
- Downstream agents should work only on the active phase and should return control to `master-developer` instead of handing off directly.
- Agents should update the current phase `run-log.md` before moving the workflow forward.
- `researcher` may be inserted for a bounded blocker even if it was not the originally expected next role. Record the reason in `run-log.md` and `workflow-state.yaml`.
- Do not start a later phase while the current phase is `blocked` or still active.
