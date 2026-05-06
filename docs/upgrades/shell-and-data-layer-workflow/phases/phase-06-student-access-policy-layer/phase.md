# Phase 6: Student Access-Policy Layer

## Goal

Add one reusable student access-policy resolver so future prerequisite features can block lesson access without invasive portal rewrites.

## Depends On

- entitlement-shell-integration-and-lockdown-route

## Role Sequence

`master-developer -> developer -> tester`

## Scope

- Create a structured access-policy hook or resolver for the student portal.
- Return explicit allow/deny state plus reason metadata instead of booleans only.
- Wire the layer into subject availability, timer start, and submission flow in the current portal.

## Deliverables

- Student access-policy hook or resolver
- Portal integration points for subject availability, timer start, and submission behavior
- Structured blocked-reason contract for future chores or prerequisite modules

## Files Or Areas To Touch

- src/pages/StudentPortal.jsx
- src/hooks/
- src/utils/

## Exit Criteria

- The student portal evaluates prerequisite state through one structured policy layer.
- The policy layer can explain what is blocked and how it is resolved.
- Future prerequisite modules can extend one contract instead of modifying each student action separately.

## Test Commands

- npm run build

## Next Phase Inputs

- Reusable policy contract for chores or other blockers
- Portal gating boundary ready for future prerequisite modules
