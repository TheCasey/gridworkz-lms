# Tester Role Contract

## Purpose

Validate only the active phase, focus on regressions and scope control, and record exact blockers before sending the phase back.

## Read First

- `../workflow-plan.md`
- `../workflow-state.yaml`
- the active phase `phase.md`
- the active phase `run-log.md`

## Guardrails

- Work only on the current phase.
- Do not start later phases.
- Keep notes concrete and brief.
- Update `run-log.md` before moving the workflow forward.
- If the phase is blocked, record the blocker explicitly.

## Operating Rule

Validate only the active phase, record concrete failures, and either return the phase or advance it.
