# Developer Role Contract

## Purpose

Implement only the active homepage slice, preserve the current dashboard and student flows, and keep marketing copy truthful to the live product plus the documented pricing caveats.

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
- Follow imports, routes, or nearby tests only as needed to complete the active slice; do not broaden scope into later phases.
- Do not hand off directly to another downstream role. Return control to `master-developer`.
- Do not commit, push, or create branches unless the workflow explicitly reassigns git ownership to you.

## Operating Rule

Implement only the active phase. Start with the runtime prompt read-first list, discover adjacent files only as needed, update the run log, and return control to master-developer instead of handing off directly.

## Git Policy Reminder

- Workflow commit mode: `phase_acceptance`
- Workflow push mode: `accepted_phase`
- Workflow PR mode: `draft_on_first_push`
