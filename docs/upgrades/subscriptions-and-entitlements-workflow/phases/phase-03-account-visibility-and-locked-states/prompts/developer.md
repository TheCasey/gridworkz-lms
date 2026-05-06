# Developer Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-03-account-visibility-and-locked-states/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-03-account-visibility-and-locked-states/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/architecture.md`
- `src/pages/Settings.jsx`
- `src/pages/ParentDashboard.jsx`

## Your Task

Add the plan summary in Settings and wire locked-state messaging into the current authenticated shell. Do not invent a projects UI; only make the existing shell and copy ready for future premium surfaces.

## Constraints

- Stay inside Phase 3 only.
- Match the established editorial dashboard styling and palette.
- Keep Settings as the primary account-summary surface.
- If you touch `ParentDashboard.jsx`, keep changes shell-level and limited to visibility or locked-state messaging patterns.
- Do not modify `src/components/LockdownPolicyPanel.jsx` in this phase, and do not add active lockdown gating or read-only lockdown-control behavior yet. That belongs to Phase 4.
- Do not invent a projects data model or launch new billing infrastructure here.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_tester` and hand off to `tester`
