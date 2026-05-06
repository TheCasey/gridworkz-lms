# Subscriptions And Entitlements Workflow

Source plan: `docs/upgrades/subscriptions-and-entitlements.md`

## Summary

Implement the subscription and entitlement foundation in bounded phases that match the roadmap: shared plan contracts first, then create limits, then visible account states, then lockdown gating, and finally trusted backend enforcement.

## Implementation Notes

- This workflow follows the roadmap ordering in `docs/roadmap.md`: shared entitlement scaffolding first, then product-facing gating, then lockdown productization, then trusted enforcement.
- The free-tier curriculum cap counts only active `subjects` records. Inactive or archived subjects may remain for history without consuming the cap.
- Do not invent a `projects` data model or launch-facing UI in this workflow. The goal is to make future projects work consume the shared entitlement layer from day one.
- Phase 4 assumes downgrade-safe lockdown behavior: saved policy data may remain visible, but pairing and edit controls stay disabled until re-upgrade.
- Phase 5 includes a `researcher` handoff because the trusted backend authority path is still unresolved in the current repo.
- There is no automated test suite or working lint baseline yet. Default validation is `npm run build` plus targeted manual checks tied to each phase.

## Roles

- `master-developer`: Own phase scope, keep the workflow aligned with the roadmap and source plan, and make sure each handoff stays narrow enough for one implementation pass and one validation pass.
- `developer`: Implement only the active phase, preserve the current page-owned Firestore query pattern unless the phase explicitly introduces a shared helper or hook, and keep downgrade behavior non-destructive.
- `tester`: Validate only the active phase against the documented exit criteria, with particular attention to entitlement regressions, create-limit behavior, and locked-state UX.
- `researcher`: Resolve only the bounded platform or architecture blocker for the active phase so implementation can proceed without guessing.

## Phase Map

| Phase | Roles | Depends On | Status |
| --- | --- | --- | --- |
| [Phase 1: Entitlement Foundation](phases/phase-01-entitlement-foundation/phase.md) | `master-developer -> developer -> tester` | None | `pending` |
| [Phase 2: Create-Limit Gates](phases/phase-02-create-limit-gates/phase.md) | `master-developer -> developer -> tester` | Phase 1: Entitlement Foundation | `pending` |
| [Phase 3: Account Visibility And Locked States](phases/phase-03-account-visibility-and-locked-states/phase.md) | `master-developer -> developer -> tester` | Phase 2: Create-Limit Gates | `pending` |
| [Phase 4: Lockdown Entitlement Integration](phases/phase-04-lockdown-entitlement-integration/phase.md) | `master-developer -> developer -> tester` | Phase 3: Account Visibility And Locked States | `pending` |
| [Phase 5: Trusted Entitlement Enforcement](phases/phase-05-trusted-entitlement-enforcement/phase.md) | `master-developer -> researcher -> developer -> tester` | Phase 4: Lockdown Entitlement Integration | `pending` |

## Workflow Rules

- `workflow-state.yaml` is the source of truth for what should happen next.
- Each phase starts with the first role in that phase's `role_sequence`.
- Agents should work only on the active phase.
- Keep `docs/upgrades/subscriptions-and-entitlements.md` unchanged unless a contradiction or missing decision requires a user confirmation.
- Agents should update the current phase `run-log.md` before moving the workflow forward.
- On validation failure, return the phase to the smallest earlier role that can fix the issue.
- Do not start a later phase while the current phase is `blocked` or still active.
