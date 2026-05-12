# Master Developer Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-plan.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-05-trusted-entitlement-enforcement/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-05-trusted-entitlement-enforcement/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/upgrades/security-hardening.md`
- `firestore.rules`

## Your Task

Frame the missing backend authority model as a bounded blocker, not an invitation to re-architect the product. The research output should decide the smallest viable trusted path and hand that straight into implementation.

## Constraints

- Stay inside Phase 5 only.
- Treat the missing backend authority model as a bounded blocker that must be resolved before developer work starts.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_researcher` and hand off to `researcher`
