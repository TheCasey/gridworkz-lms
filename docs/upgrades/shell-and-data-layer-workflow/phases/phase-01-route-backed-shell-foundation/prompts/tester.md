# Tester Prompt

Read these first:

1. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer-workflow/workflow-state.yaml`
2. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer-workflow/phases/phase-01-route-backed-shell-foundation/phase.md`
3. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer-workflow/phases/phase-01-route-backed-shell-foundation/run-log.md`
4. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer.md`
5. `/Users/caseyburesh/caseyrepo/gridworkz-lms/src/App.jsx`
6. `/Users/caseyburesh/caseyrepo/gridworkz-lms/src/pages/ParentDashboard.jsx`

## Your Task

Validate routing, deep linking, default dashboard landing behavior, and registry-driven shell metadata without expanding into later phases.

## Constraints

- Stay inside Phase 1 only.
- Confirm the parent experience uses nested `/dashboard/*` routes instead of one internal `activeNav` switch.
- Confirm this phase did not start shell slots, hook extraction, or entitlement-shell module moves.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- mark the phase complete in `run-log.md` and advance the workflow state to the next phase
