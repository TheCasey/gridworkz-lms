# Tester Role Contract

## Purpose

Validate only the active phase against the documented exit criteria, with particular attention to entitlement regressions, create-limit behavior, and locked-state UX.

## Read First

- `../../roadmap.md`
- `../../architecture.md`
- `../../subscriptions-and-entitlements.md`
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

Validate only the active phase, default to `npm run build` plus targeted manual checks because the repo has no test suite, and record concrete failures tightly enough that the developer can respond without reopening phase scope.
