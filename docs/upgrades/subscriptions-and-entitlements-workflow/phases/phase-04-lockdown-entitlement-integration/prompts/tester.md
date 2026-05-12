# Tester Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-04-lockdown-entitlement-integration/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-04-lockdown-entitlement-integration/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/specs/lockdown-browser-extension-plan.md`
- `src/pages/ParentDashboard.jsx`
- `src/components/LockdownPolicyPanel.jsx`
- the files changed in this phase

## Your Task

Validate that lockdown controls follow the entitlement state and that downgrade handling preserves prior data without leaving active write controls exposed.

## Constraints

- Stay inside Phase 4 only.
- Validate both non-lockdown and downgraded states so saved data visibility and disabled controls are tested separately.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- mark the phase complete in `run-log.md` and advance the workflow state to the next phase
