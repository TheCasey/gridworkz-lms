# Master Developer Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-plan.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-04-lockdown-entitlement-integration/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-04-lockdown-entitlement-integration/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/specs/lockdown-browser-extension-plan.md`
- `src/pages/ParentDashboard.jsx`
- `src/components/LockdownPolicyPanel.jsx`

## Your Task

Keep this phase tied to the current Lockdown PoC files, and make the downgrade-safe read-only behavior explicit so the implementation does not silently delete or hide existing policy state.

## Constraints

- Stay inside Phase 4 only.
- Keep this phase on client-side entitlement integration for the existing Lockdown PoC files.
- Preserve saved lockdown state for downgraded accounts while disabling active controls.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_developer` and hand off to `developer`
