# Developer Prompt

Read these first:

1. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer-workflow/workflow-state.yaml`
2. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer-workflow/phases/phase-01-route-backed-shell-foundation/phase.md`
3. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer-workflow/phases/phase-01-route-backed-shell-foundation/run-log.md`
4. `/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/upgrades/shell-and-data-layer.md`
5. `/Users/caseyburesh/caseyrepo/gridworkz-lms/src/App.jsx`
6. `/Users/caseyburesh/caseyrepo/gridworkz-lms/src/pages/ParentDashboard.jsx`
7. `/Users/caseyburesh/caseyrepo/gridworkz-lms/src/pages/Curriculum.jsx`
8. `/Users/caseyburesh/caseyrepo/gridworkz-lms/src/pages/Reports.jsx`
9. `/Users/caseyburesh/caseyrepo/gridworkz-lms/src/pages/Settings.jsx`

## Your Task

Implement only the route-backed shell and registry contract. Keep current screens functional with minimal behavioral change.

## Constraints

- Stay inside Phase 1 only.
- Do not start shell slots, hook extraction, Lockdown route moves, or student access-policy work.
- Preserve current behavior and reuse the live entitlement/trusted-backend contracts as-is.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Implementation Guardrails

- Replace `activeNav` routing responsibility with nested `/dashboard/*` routes, not with a new internal state switch.
- Add one shared dashboard feature registry as the source of truth for nav label, child path, and header title/description metadata for `students`, `curriculum`, `reports`, and `settings`.
- Make `/dashboard` resolve to `/dashboard/students`.
- Keep the current students overview content inside the shell for this phase; do not extract new domain hooks or move Lockdown into its own route yet.
- Keep `Curriculum`, `Reports`, and `Settings` largely intact; only change what is required to mount them through the new route-backed shell contract.
- Preserve the current `Reports` `parentSettings` prop flow and the current `Settings` save/entitlement wiring.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_tester` and hand off to `tester`
