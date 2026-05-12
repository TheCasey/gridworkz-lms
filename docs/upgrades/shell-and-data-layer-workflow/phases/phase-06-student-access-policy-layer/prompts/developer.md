# Developer Prompt

Read `../../../workflow-state.yaml`, `../phase.md`, and `../run-log.md` first.

## Your Task

Add the access-policy layer with minimal portal UX churn. Do not broaden into future module implementation.

## Constraints

- Stay inside Phase 6 only.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Implementation Guardrails

- Keep this phase about policy structure, not future module implementation. Do not broaden into chores, student-auth overhaul, or new backend enforcement work.
- Add one structured student access-policy hook or resolver under `src/hooks/` or `src/utils/` and make `src/pages/StudentPortal.jsx` consume it.
- Replace the scattered inline access checks in `StudentPortal.jsx` with the shared policy layer at the current integration points only:
  - subject availability/render state
  - timer-start eligibility
  - block-submission eligibility
- Preserve the current portal behavior in this phase. The new policy layer should encode today’s effective rules before it grows to support future chores or prerequisite modules.
- Return explicit structured allow/deny state plus reason metadata instead of booleans only. The contract should be stable enough for future rules to extend without rewriting each action separately.
- The structured policy contract should cover fields such as:
  - `canViewSubjects`
  - `canStartTimer`
  - `canSubmitBlock`
  - `blockedReason`
  - `resolutionPath`
  or equivalent structured shapes that preserve the same meaning.
- Keep existing duplicate-submission protection, timer-finished requirements, and current completion/lock semantics intact while moving the decision logic behind the policy layer.
- Do not change the current shell, entitlement-shell, or Lockdown module boundaries from earlier phases unless a minimal interface adjustment is required for this policy integration.
- The main success condition is that the student portal evaluates prerequisite/access state through one reusable policy layer rather than embedding separate gating rules in each subject row, timer action, and submission path.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_tester` and hand off to `tester`
