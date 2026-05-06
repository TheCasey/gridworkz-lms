# Developer Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-01-entitlement-foundation/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-01-entitlement-foundation/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/architecture.md`
- `src/constants/schema.js`
- `src/pages/ParentDashboard.jsx`
- `src/pages/Curriculum.jsx`

## Your Task

Land only the shared catalog, entitlement document contract, and reusable read path. Preserve a safe free-plan fallback for missing entitlement docs, count only active subjects toward curriculum usage, and keep the new helper or hook entitlement-specific rather than turning it into a generic shared data layer.

## Constraints

- Stay inside Phase 1 only.
- Treat missing entitlements as free-plan fallback state until the trusted backend phase exists.
- Keep any new helper or hook narrowly scoped to entitlements and derived usage from the existing page-owned queries.
- Do not introduce a generic Firestore loader, central data layer, create gating, nav work, or lockdown UI changes in this phase.
- Count curriculum usage from active subjects only. Inactive or archived subjects must not consume the free-tier cap, even if a page still reads a broader `subjects` query.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_tester` and hand off to `tester`
