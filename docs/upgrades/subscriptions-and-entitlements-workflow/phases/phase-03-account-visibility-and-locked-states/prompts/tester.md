# Tester Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-03-account-visibility-and-locked-states/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-03-account-visibility-and-locked-states/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `src/pages/Settings.jsx`
- `src/pages/ParentDashboard.jsx`
- the files changed in this phase

## Your Task

Validate that plan information is visible and that premium states are explained clearly. Check for regressions in the editorial dashboard styling while testing the new account surface.

## Constraints

- Stay inside Phase 3 only.
- Check both clarity of the locked-state copy and visual fit with the existing dashboard shell.
- Expect visibility and messaging work here, not active lockdown gating. If `LockdownPolicyPanel` controls are being gated or made read-only in this phase, treat that as later-phase spill.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- mark the phase complete in `run-log.md` and advance the workflow state to the next phase
