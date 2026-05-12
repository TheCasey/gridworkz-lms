# Developer Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-05-trusted-entitlement-enforcement/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-05-trusted-entitlement-enforcement/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/upgrades/security-hardening.md`
- `firestore.rules`
- the researcher handoff from this phase

## Your Task

Implement the trusted path selected for this phase, move entitlement authority off client-owned docs, and add server or rule backstops for student creates, active-subject creates, and lockdown policy writes. Do not broaden into unrelated security-hardening work.

## Constraints

- Stay inside Phase 5 only.
- Use the chosen trusted authority path; do not reopen the platform decision during implementation.
- Limit enforcement work to entitlement state, gated creates, and lockdown writes.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_tester` and hand off to `tester`
