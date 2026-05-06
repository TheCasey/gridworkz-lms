# Developer Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-02-create-limit-gates/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-02-create-limit-gates/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `src/pages/ParentDashboard.jsx`
- `src/pages/Curriculum.jsx`
- the entitlement helper or hook added in Phase 1

## Your Task

Wire the current add-student and subject-create flows to the shared entitlement helpers. Block only new creates when over limit, keep edit, archive, and delete paths available so parents can get back under the cap, and surface concrete usage-versus-limit plus upgrade messaging at those two create surfaces.

## Constraints

- Stay inside Phase 2 only.
- Block only new creates when over limit.
- Keep edit, archive, and delete paths available.
- In `Curriculum.jsx`, the shared submit handler covers both create and edit. Gate only the create branch for new active subjects and preserve update behavior for existing subjects.
- Count only active subjects toward the curriculum cap.
- Show user-facing limit and upgrade-needed messaging near the existing add-student and subject-create entry points. Do not rely on silent failures or Firestore errors as the gate.
- Do not expand this work into account pages, nav changes, projects, or lockdown behavior.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_tester` and hand off to `tester`
