# Master Developer Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-plan.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-01-entitlement-foundation/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-01-entitlement-foundation/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/roadmap.md`
- `docs/architecture.md`
- `src/constants/schema.js`
- `src/pages/ParentDashboard.jsx`
- `src/pages/Curriculum.jsx`

## Your Task

Keep this phase contract-only. Confirm the shared loader or hook does not quietly turn into a broader data-layer refactor, and make sure the active-subject counting rule is explicit in the prompts.

## Constraints

- Stay inside Phase 1 only.
- Keep this phase contract-only. No create gating, nav work, or lockdown UI changes belong here.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_developer` and hand off to `developer`
