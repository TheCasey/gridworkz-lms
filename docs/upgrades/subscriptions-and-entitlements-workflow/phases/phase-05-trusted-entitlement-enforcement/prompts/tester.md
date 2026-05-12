# Tester Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-05-trusted-entitlement-enforcement/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-05-trusted-entitlement-enforcement/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/upgrades/security-hardening.md`
- `firestore.rules`
- the files changed in this phase

## Your Task

Validate the trusted enforcement path and verify that client-only bypasses no longer grant paid access. Keep testing focused on subscription enforcement rather than unrelated portal security concerns.

## Constraints

- Stay inside Phase 5 only.
- Test entitlement enforcement boundaries, not unrelated student-portal or rollover hardening work.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- mark the phase complete in `run-log.md` and advance the workflow state to the next phase
