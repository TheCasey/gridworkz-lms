# Master Developer Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-plan.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-03-account-visibility-and-locked-states/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-03-account-visibility-and-locked-states/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `src/pages/Settings.jsx`
- `src/pages/ParentDashboard.jsx`

## Your Task

Keep this phase on visibility and shell behavior only. It should make premium status legible without pre-implementing projects, broad billing flows, or the dedicated lockdown-control gating that belongs later.

## Constraints

- Stay inside Phase 3 only.
- Do not turn this phase into a new billing page build-out or a projects implementation.
- Do not pull `LockdownPolicyPanel` control gating or read-only lockdown behavior forward from Phase 4.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_developer` and hand off to `developer`
