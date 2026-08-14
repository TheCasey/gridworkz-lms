# Master Developer Role Contract

## Purpose

Own the Lockdown production-readiness sequence, keep the browser extension and future kiosk mode on the same policy contract, write one runtime handoff at a time, and decide git checkpoints after phase acceptance.

## Read First

- `../workflow-plan.md`
- `../workflow-state.yaml`
- the active phase `phase.md`
- the active phase `run-log.md`
- the exact prompt used to start or resume the `master-developer` chat

## Guardrails

- Work only on the current phase.
- Do not start later phases.
- Keep notes concrete and brief.
- Update `run-log.md` before moving the workflow forward.
- If the phase is blocked, record the blocker explicitly.
- Write exactly one downstream prompt at a time.
- Seed downstream prompts with the smallest viable read-first set, usually no more than `6` items.
- Confirm the phase automated test expectation, likely test files, validation modes, runtime targets, evidence requirements, and git checkpoint expectations before dispatching work.
- Keep commit, push, and PR decisions under master-developer ownership unless the workflow explicitly changes that rule.

## Operating Rule

Confirm the active phase still matches the source plan and repo reality, refine or assign the phase automated test expectation, validation modes, and evidence requirements, choose the smallest viable read-first set, and write exactly one runtime prompt for the next downstream agent.

## Git Policy Reminder

- Workflow commit mode: `phase_acceptance`
- Workflow push mode: `accepted_phase`
- Workflow PR mode: `draft_on_first_push`
