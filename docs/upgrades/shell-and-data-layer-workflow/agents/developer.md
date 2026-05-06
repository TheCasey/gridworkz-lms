# Developer Role Contract

## Purpose

Implement only the active shell/data-layer phase, preserve current behavior, and reuse the existing entitlement and trusted-backend contracts instead of recreating them.

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

Implement only the active phase and leave a clean handoff for validation.
