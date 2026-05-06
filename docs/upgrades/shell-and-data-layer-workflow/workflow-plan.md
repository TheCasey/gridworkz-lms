# Shell And Data Layer Workflow

Source plan: `docs/upgrades/shell-and-data-layer.md`

## Summary

Refactor the parent shell into route-backed modules, introduce a feature registry and shell slots, extract domain hooks from the largest screens, and add a reusable student access-policy layer without redoing the already-live entitlement backend.

## Roles

- `master-developer`: Own phase decomposition, prompt quality, scope control, and workflow-state transitions for the shell and data-layer upgrade.
- `developer`: Implement only the active shell/data-layer phase, preserve current behavior, and reuse the existing entitlement and trusted-backend contracts instead of recreating them.
- `tester`: Validate only the active phase, focus on regressions and scope control, and record exact blockers before sending the phase back.

## Phase Map

| Phase | Roles | Depends On | Status |
| --- | --- | --- | --- |
| [Phase 1: Route-Backed Shell Foundation](phases/phase-01-route-backed-shell-foundation/phase.md) | `master-developer -> developer -> tester` | None | `complete` |
| [Phase 2: Shell Slots and Rail Decoupling](phases/phase-02-shell-slots-and-rail-decoupling/phase.md) | `master-developer -> developer -> tester` | route-backed-shell-foundation | `complete` |
| [Phase 3: Students and Settings Domain Hooks](phases/phase-03-students-and-settings-domain-hooks/phase.md) | `master-developer -> developer -> tester` | shell-slots-and-rail-decoupling | `complete` |
| [Phase 4: Subjects, Reports, and Rollover Hooks](phases/phase-04-subjects-reports-and-rollover-hooks/phase.md) | `master-developer -> developer -> tester` | students-and-settings-domain-hooks | `complete` |
| [Phase 5: Entitlement Shell Integration and Lockdown Route](phases/phase-05-entitlement-shell-integration-and-lockdown-route/phase.md) | `master-developer -> developer -> tester` | subjects-reports-and-rollover-hooks | `complete` |
| [Phase 6: Student Access-Policy Layer](phases/phase-06-student-access-policy-layer/phase.md) | `master-developer -> developer -> tester` | entitlement-shell-integration-and-lockdown-route | `complete` |

## Workflow Rules

- `workflow-state.yaml` is the source of truth for what should happen next.
- Each phase starts with the first role in that phase's `role_sequence`.
- Agents should work only on the active phase.
- Agents should update the current phase `run-log.md` before moving the workflow forward.
- On validation failure, return the phase to the smallest earlier role that can fix the issue.
- Do not start a later phase while the current phase is `blocked` or still active.
