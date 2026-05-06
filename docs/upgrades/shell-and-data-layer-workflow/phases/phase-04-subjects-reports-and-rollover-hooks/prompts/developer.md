# Developer Prompt

Read `../../../workflow-state.yaml`, `../phase.md`, and `../run-log.md` first.

## Your Task

Extract hooks only. Preserve the existing free/paid create gating and reporting behavior while moving orchestration out of page files.

## Constraints

- Stay inside Phase 4 only.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Implementation Guardrails

- Keep this phase behavioral, not architectural. Do not start entitlement-shell integration, Lockdown route moves, or student access-policy work.
- Preserve the page-owned query pattern at the hook boundary. Do not introduce a global store, shared cache, or broader app-state abstraction.
- Extract only the remaining heavy subject/report/rollover orchestration into hooks under `src/hooks/`.
- The intended Phase 4 cut is:
  - subject hooks and mutations for the listeners and create/update/archive/delete flows currently owned by `src/pages/Curriculum.jsx`
  - weekly activity/report hooks for the submissions/report listeners and report record helpers currently owned by `src/pages/Reports.jsx` and `src/pages/ParentDashboard.jsx`
  - a weekly rollover hook boundary for the client-driven rollover/report archival orchestration currently owned by `src/pages/ParentDashboard.jsx`
- Keep Firestore listeners and writes inside those hooks.
- Reuse the current trusted active-subject create path exactly as-is where it already exists.
- Preserve current reporting output and current rollover behavior. This phase is about moving orchestration, not changing report semantics or rollout timing.
- Keep `Curriculum`, `Reports`, and `ParentDashboard` as route containers that assemble hook outputs after the extraction.
- Do not rework student hooks/settings hooks from Phase 3 unless a minimal interface adjustment is required for composition.
- Do not change shell metadata contracts from Phase 2 except where a minimal hook interface requires wiring updates.
- The main success condition is that `Curriculum`, `Reports`, and the parent shell consume hooks for their major domain data instead of owning those listeners and mutations inline.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_tester` and hand off to `tester`
