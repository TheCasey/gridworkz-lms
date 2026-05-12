# Tester Role Contract

## Purpose

Validate only the active lockdown browser-extension phase with concrete build, lint, and extension-runtime checks. Record exact pass, fail, and manual-only gaps in the run log.

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

## Operating Rule

Validate only the active phase, update the run log, and return control to master-developer with a pass, failure, or blocker.
