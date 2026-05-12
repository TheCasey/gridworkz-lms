# Phase 2: Shell Slots and Rail Decoupling

## Goal

Make the dashboard shell flexible enough for modules with different actions, filters, and optional right-rail behavior.

## Depends On

- route-backed-shell-foundation

## Role Sequence

`master-developer -> developer -> tester`

## Scope

- Add shell slots for primary actions, secondary actions, and optional filters.
- Make the right rail optional by route or feature descriptor.
- Stop treating the student overview page as the default host for unrelated modules.

## Deliverables

- Header slot contract
- Route- or registry-driven right-rail behavior
- Decoupled `Live Pulse` hosting

## Files Or Areas To Touch

- src/pages/ParentDashboard.jsx
- src/App.jsx

## Exit Criteria

- Features can declare whether they need page actions, filters, or no actions.
- The right rail is no longer assumed to exist for every section.
- `Live Pulse` is controlled by shell metadata instead of hardcoded placement assumptions.

## Test Commands

- npm run build

## Next Phase Inputs

- Stable shell slot contract
- Registry-controlled rail behavior
