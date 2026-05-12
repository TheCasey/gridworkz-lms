# Master Developer Prompt

Read these first:

1. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer-workflow/workflow-state.yaml`
2. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer-workflow/phases/phase-01-route-backed-shell-foundation/phase.md`
3. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer-workflow/phases/phase-01-route-backed-shell-foundation/run-log.md`
4. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer.md`
5. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/roadmap.md`
6. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/architecture.md`
7. `/Users/caseyburesh/caseyrepo/gridworkz-lms/src/App.jsx`
8. `/Users/caseyburesh/caseyrepo/gridworkz-lms/src/pages/ParentDashboard.jsx`

## Your Task

Keep this phase structural. Do not start hook extraction, entitlement-shell gating, or UI redesign here.

## Constraints

- Stay inside Phase 1 only.
- Tighten the route-backed shell scope so the developer can implement it in one pass.
- Preserve the live entitlement/trusted-backend work as a dependency, not as work to redo here.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_developer` and hand off to `developer`
