# Tester Role Contract

## Purpose

Validate only the active phase, focus on regressions in the student portal, reports, and weekly rollover behavior, and return failures with exact reproduction details.

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
- Validate the smallest active slice that proves the exit criteria. Do not drift into future-phase coverage.
- Always report whether `npm run lint` and `npm run build` were run, and call out any manual-only verification gap.

## Operating Rule

Validate only the active phase, update the run log, and return control to master-developer with a pass, failure, or blocker.
