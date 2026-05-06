# Developer Prompt

Read `../../../workflow-state.yaml`, `../phase.md`, and `../run-log.md` first.

## Your Task

Reuse the live entitlement rail and existing Lockdown panel behavior. Move the module boundary, not the enforcement model.

## Constraints

- Stay inside Phase 5 only.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Implementation Guardrails

- Keep this phase focused on shell integration and route/module boundaries. Do not reopen billing sync, trusted-backend enforcement, or entitlement document semantics.
- Reuse the live entitlement rail and existing Lockdown panel behavior. Move the module boundary, not the enforcement model.
- Extend the dashboard feature registry with entitlement-aware shell metadata so features can resolve to structural states such as `visible`, `locked`, or `hidden` from one shared contract.
- Add a dedicated route-backed Lockdown module under `/dashboard/*` instead of leaving `LockdownPolicyPanel` embedded inside the students route.
- The dedicated Lockdown module should preserve the current entitlement-aware panel behavior:
  - entitled accounts keep the existing editable/read-only panel behavior already implemented by the live entitlement path
  - non-entitled accounts should get an explicit locked-state shell/module experience rather than the module silently disappearing
- Shell navigation and route handling should derive premium-module visibility/locked behavior from shared registry metadata plus `useEntitlements`, not from special-case inline conditions.
- Keep `Settings` as the primary plan/account summary surface. Do not turn this phase into a second billing or account-management redesign.
- Do not invent a new projects UI, billing page, or alternate entitlement system in this phase. Hidden-state support can exist in the shared contract without shipping unfinished modules.
- Keep route and shell contracts stable outside this premium-gating work. Only make the minimal `App.jsx`, registry, shell, and Lockdown module changes required to land the dedicated route and structural gating behavior.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_tester` and hand off to `tester`
