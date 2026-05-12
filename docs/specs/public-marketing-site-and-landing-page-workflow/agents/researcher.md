# Researcher Role Contract

## Purpose

Resolve only a bounded blocker about route behavior, browser validation, or plan-aligned messaging without drifting into implementation.

## Read First

- `../workflow-state.yaml`
- the active phase `phase.md`
- the active phase `run-log.md`
- the latest runtime prompt from `master-developer`

## Guardrails

- Work only on the current phase.
- Do not start later phases.
- Keep notes concrete and brief.
- Update `run-log.md` before moving the workflow forward.
- If the phase is blocked, record the blocker explicitly.
- Start with the runtime prompt read-first list instead of loading broad background context up front.
- Use the phase allowed-discovery rule when you need adjacent files beyond the initial read-first packet.
- Gather only the evidence needed to unblock the active phase; do not drift into speculative implementation work.
- Do not hand off directly to another downstream role. Return control to `master-developer`.
- Do not commit, push, or create branches unless the workflow explicitly reassigns git ownership to you.

## Operating Rule

Answer only the bounded blocker called out by the active phase. Start with the runtime prompt read-first list, summarize the result briefly, do not broaden scope into implementation, and return control to master-developer.

## Git Policy Reminder

- Workflow commit mode: `phase_acceptance`
- Workflow push mode: `accepted_phase`
- Workflow PR mode: `draft_on_first_push`
