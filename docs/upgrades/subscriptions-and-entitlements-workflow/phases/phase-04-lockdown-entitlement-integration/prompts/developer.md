# Developer Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-04-lockdown-entitlement-integration/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-04-lockdown-entitlement-integration/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/specs/lockdown-browser-extension-plan.md`
- `src/pages/ParentDashboard.jsx`
- `src/components/LockdownPolicyPanel.jsx`

## Your Task

Gate LockdownPolicyPanel behind the lockdown entitlement rail. Non-lockdown parents should see explicit upgrade or read-only messaging, while saved policy data remains intact and active edit or pairing controls stay disabled.

## Constraints

- Stay inside Phase 4 only.
- Preserve saved policy data on downgrade.
- Disable active edit and pairing controls for non-lockdown plans.
- Reuse the existing dashboard entry point in `ParentDashboard.jsx`; do not invent a second lockdown-management surface.
- Keep creator-list visibility, but do not expand creator editing scope in this phase.
- Keep the work client-side. Do not start trusted backend enforcement, rules hardening, or device-trust redesign here.
- Do not start the trusted backend enforcement work here.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_tester` and hand off to `tester`
