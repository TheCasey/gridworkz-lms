# Phase 2: Policy Derivation And System Allowlist

## Goal

Move trusted policy derivation onto the production state contract and add an explicit Own Path system allowlist layer.

## Depends On

- Phase 1: State Vocabulary And Active Work Contract

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Update Cloud Function policy derivation and client preview parity for the production states.
- Add explicit Own Path system resources needed for student portal, extension pages, and trusted policy endpoints.
- Keep parent dashboard access from a paired student profile behind an explicit decision or blocked state.

## Deliverables

- Trusted device-policy payload includes production state and system allowlist context
- Dashboard derived preview mirrors backend policy derivation
- Focused derivation fixture/check script covering school-time, off-hours, no-plan, no-work, downgrade, and system-resource cases

## Files Or Areas To Touch

- functions/src/index.js
- src/utils/lockdownPolicyUtils.js
- src/utils/appHosts.js
- src/components/LockdownPolicyPanel.jsx
- extensions/chrome-lockdown-poc/background.js
- scripts/check-lockdown-derived-policy.mjs

## Read First

- functions/src/index.js
- src/utils/lockdownPolicyUtils.js
- src/components/LockdownPolicyPanel.jsx
- src/utils/appHosts.js
- extensions/chrome-lockdown-poc/background.js
- docs/specs/lockdown-production-behavior-contract.md

## Exit Criteria

- Backend and dashboard preview agree on every production state in the contract.
- Own Path system pages are modeled separately from parent-approved learning resources.
- No published plan, no active work, off-hours open, and off-hours closed produce distinct policy contexts.

## Automated Test Expectation

Add or update a deterministic derivation check script that exercises all production policy states and system allowlist behavior.

## Test Files

- scripts/check-lockdown-derived-policy.mjs
- scripts/seed-lockdown-phase4-validation.mjs

## Test Cases To Cover

- School time active work allows active block resources plus system resources.
- School time no active work allows only system resources.
- Off-hours closed allows only system resources.
- Entitlement inactive clears paid allowed resources but preserves readable context.
- Unsupported resource metadata is reported and not allowed.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence focused check script output. Run the existing focused automated tests that cover the active slice before widening scope.
- `api-smoke`: preferred tools `shell`, `curl`, `Firebase callable or HTTP function smoke`; default evidence request or response summary, command output. Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape.
- `build-health`: preferred tools `shell`; default evidence npm run lint output, npm run build output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- readLockdownDevicePolicy HTTP endpoint with seeded or disposable data when credentials are available

## Evidence Required

- derivation check output
- trusted policy response summary when API smoke is available
- lint/build output

## Allowed Discovery

Start with the listed read-first files, then follow imports, routes, existing check scripts, extension files, functions, and nearby docs only as needed for the active phase.

## Test Commands

- node scripts/check-lockdown-derived-policy.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- If Firebase credentials are unavailable, record the API smoke as staging/manual follow-up.

## Master Developer Review Focus

Confirm that Policy Derivation And System Allowlist is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Policy Derivation And System Allowlist. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Policy Derivation And System Allowlist using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Production policy payload and system-resource layer for parent resource tools.
