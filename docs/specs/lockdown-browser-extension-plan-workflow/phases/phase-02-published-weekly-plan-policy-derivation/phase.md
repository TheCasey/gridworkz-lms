# Phase 2: Published Weekly Plan Policy Derivation

## Goal

Derive the device-facing lockdown policy from published weekly plans, project-work blocks, and school-time or off-hours rules.

## Depends On

- Phase 1: Trusted Policy Contract And Pairing

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Use the new weekly-plan model as the authoritative input for active-browser policy instead of manual ad hoc subject records.
- Represent the three planned lockdown states: active block, no active block, and outside school time.
- Support off-hours approved-resource windows without reintroducing raw-subject-driven policy behavior.

## Deliverables

- Policy-derivation helpers or backend publish flow from published weekly plans to a device-facing contract
- Schema fields for off-hours approved resources or schedule windows if the chosen design needs them
- Clear derivation behavior for WeeklyBlock resources, project_work, and approved domains or origins

## Files Or Areas To Touch

- src/constants/schema.js
- src/utils/lockdownPolicyUtils.js
- src/utils/weekUtils.js
- src/utils/schoolSettingsUtils.js
- src/utils/weeklyPlanUtils.js
- functions/src/index.js

## Exit Criteria

- Published weekly-plan data is the authoritative source for active device policy.
- The derivation path covers active block, idle block window, and outside-school-time behavior.
- The production extension path no longer needs to infer active resources directly from raw subject records.

## Test Commands

- npm run lint
- npm run build

## Master Developer Review Focus

Keep this phase on policy derivation. Do not redesign the dashboard surface until the derived contract is stable.

## Runtime Handoff Notes

- `developer`: Use published weekly plans and current school-time helpers as the source of truth. Do not fall back to a permanent subject-driven contract.
- `tester`: Validate the derivation boundary carefully, especially the three lockdown states and the absence of raw-subject dependence in the production path.

## Next Phase Inputs

- Stable derived policy contract the dashboard can display and the extension can consume
- Defined behavior for active-block resources, project work, and off-hours windows
