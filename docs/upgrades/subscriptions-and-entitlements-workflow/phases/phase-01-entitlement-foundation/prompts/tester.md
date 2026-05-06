# Tester Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-01-entitlement-foundation/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-01-entitlement-foundation/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/architecture.md`
- the files changed in this phase

## Your Task

Validate the shared contract and helper behavior only. Confirm the phase does not already start gating create flows or premium UI, and confirm curriculum usage counts only active subjects.

## Constraints

- Stay inside Phase 1 only.
- Verify the helper and hook contract without expecting full paid-access enforcement yet.
- Confirm missing entitlement docs resolve through the safe free-plan fallback.
- Confirm inactive or archived subjects do not count toward curriculum usage.
- Confirm the implementation stays entitlement-specific and does not quietly centralize unrelated Firestore loading.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- mark the phase complete in `run-log.md` and advance the workflow state to the next phase
