# Tester Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-02-create-limit-gates/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-02-create-limit-gates/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `src/pages/ParentDashboard.jsx`
- `src/pages/Curriculum.jsx`
- the files changed in this phase

## Your Task

Validate the gating paths and downgrade behavior with attention to active-subject counting. Confirm that existing data remains manageable even when the account is over limit, and confirm the new messaging appears at the affected create surfaces instead of failing silently.

## Constraints

- Stay inside Phase 2 only.
- Validate the exact create boundaries, not future premium navigation or lockdown behavior.
- Confirm student creation is blocked only at the existing dashboard add-student flow.
- Confirm subject gating blocks only new active-subject creation and does not block edit, archive, or delete behavior for existing subjects.
- Confirm inactive or archived subjects do not count toward the curriculum cap.
- Confirm user-facing usage-versus-limit and upgrade messaging appears near the two gated create surfaces.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- mark the phase complete in `run-log.md` and advance the workflow state to the next phase
