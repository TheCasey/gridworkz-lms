# Developer Role Contract

## Purpose

Implement only the active phase, preserve the current route-backed shell and subject-driven app behavior unless the phase explicitly replaces a slice, and favor compatibility-first changes over destructive migrations.

## Read First

- `../workflow-plan.md`
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
- Do not hand off directly to another downstream role. Return control to `master-developer`.
- Do not remove legacy subject compatibility unless the active phase explicitly calls for that replacement.
- Default verification is `npm run lint` and `npm run build` unless the runtime prompt narrows it further.

## Operating Rule

Implement only the active phase, update the run log, and return control to master-developer instead of handing off directly.
