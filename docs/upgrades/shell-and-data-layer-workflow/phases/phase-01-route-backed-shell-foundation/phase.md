# Phase 1: Route-Backed Shell Foundation

## Goal

Turn the parent experience into a nested `/dashboard/*` shell with a single feature registry while keeping the existing screens mostly intact.

## Depends On

- None

## Role Sequence

`master-developer -> developer -> tester`

## Scope

- Replace `activeNav` switching with route-backed dashboard children.
- Create one dashboard feature registry for nav labels, routes, and header metadata.
- Keep the existing feature screens largely intact in this phase.

## Deliverables

- Nested dashboard route structure
- Dashboard feature registry
- Default `/dashboard` redirect or route behavior to `students`

## Files Or Areas To Touch

- src/App.jsx
- src/pages/ParentDashboard.jsx
- src/pages/Curriculum.jsx
- src/pages/Reports.jsx
- src/pages/Settings.jsx

## Exit Criteria

- The parent experience uses nested `/dashboard/*` routes instead of one internal nav switch.
- Nav, page title, and page description metadata come from one registry.
- The default dashboard landing section is `students`.

## Test Commands

- npm run build

## Next Phase Inputs

- Stable dashboard shell route structure
- Shared registry for shell metadata
