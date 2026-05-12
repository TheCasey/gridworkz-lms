# Developer Prompt

Read `../../../workflow-state.yaml`, `../phase.md`, and `../run-log.md` first.

## Your Task

Implement shell slots and rail decoupling with minimal visual churn. Do not start domain hook extraction.

## Constraints

- Stay inside Phase 2 only.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Implementation Guardrails

- Keep this phase shell-only. Do not extract new hooks, move Lockdown into its own route, or change entitlement behavior.
- Extend the dashboard feature contract so features can declare shell-level header actions, optional filters, and right-rail behavior.
- Replace the current students-only shell branching in `src/pages/ParentDashboard.jsx` with a slot-style shell contract driven by the active feature metadata.
- Make the right rail optional by feature or route metadata. `Live Pulse` can remain the only active rail in this phase, but it must no longer be assumed for every section.
- Keep behavior conservative: `students` may still be the only feature with active primary actions, week filters, download/report shortcuts, usage notice, and `Live Pulse`, while the other sections explicitly declare no shell actions or no rail.
- Preserve the existing nested `/dashboard/*` route structure from Phase 1 and keep `Reports` and `Settings` using their current outlet-context contracts unless a minimal shell interface change is required.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_tester` and hand off to `tester`
