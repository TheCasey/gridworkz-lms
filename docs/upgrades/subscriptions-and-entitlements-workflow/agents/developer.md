# Developer Role Contract

## Purpose

Implement only the active phase, preserve the current page-owned Firestore query pattern unless the phase explicitly introduces a shared helper or hook, and keep downgrade behavior non-destructive.

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

Implement only the active phase, preserve the existing page-owned Firestore query pattern unless the phase explicitly adds a shared entitlement helper or hook, and leave a concrete validation handoff in the phase run log.
