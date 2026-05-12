# Developer Prompt

Read `../../../workflow-state.yaml`, `../phase.md`, and `../run-log.md` first.

## Your Task

Move student and parent-settings listeners/writes into hooks only. Reuse the existing trusted student create path.

## Constraints

- Stay inside Phase 3 only.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Implementation Guardrails

- Preserve the page-owned query pattern at the hook boundary. Do not introduce a global store, shared data layer, or broader architecture refactor.
- Extract only the student and parent-settings orchestration from `src/pages/ParentDashboard.jsx` into hooks under `src/hooks/`.
- The intended cut for this phase is:
  - `useStudents` for the parent-scoped student listener and student-loading state
  - `useStudentMutations` for trusted student create and delete behavior
  - `useParentSettings` for the parent profile/settings listener plus the existing save flow that also fans settings updates out to student records
- Keep Firestore listeners and writes inside those hooks.
- Reuse the current trusted student create path exactly as-is where it already exists.
- Keep `Settings.jsx` presentational. It should keep receiving `settings`, `onSave`, `saving`, and the current entitlement summary contract from the route container.
- Keep `Reports` receiving `parentSettings` from the route container.
- Do not extract subjects, submissions, rollover orchestration, rail behavior, entitlement logic, student-progress modal logic, or Lockdown behavior in this phase.
- The main success condition is a materially smaller `ParentDashboard.jsx` that assembles hook outputs rather than defining the student/settings listeners and mutations inline.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_tester` and hand off to `tester`
