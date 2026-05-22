# Phase 1: Operator Trust Boundary

## Goal

Add the server-owned operator authorization foundation and a minimal session check without exposing entitlement mutations yet.

## Depends On

- None

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add `supportOperators` schema/constants and Firestore rules that keep operator records server-owned.
- Add a backend `getOperatorSession` callable that verifies an authenticated user against `supportOperators/{uid}`.
- Add a client trusted-operation wrapper for the session check.
- Add a lightweight route guard or route skeleton only as needed for later `/ops/entitlements` work.

## Deliverables

- Server-side operator authorization helper
- `getOperatorSession` callable
- Client wrapper and route-guard foundation
- Rules/schema updates for server-owned operator records

## Files Or Areas To Touch

- functions/src/index.js
- firestore.rules
- src/constants/schema.js
- src/firebase/trustedOperations.js
- src/App.jsx

## Read First

- docs/specs/operator-entitlement-console.md
- docs/upgrades/subscriptions-and-entitlements.md
- functions/src/index.js
- firestore.rules
- src/firebase/trustedOperations.js
- src/App.jsx

## Exit Criteria

- Non-authenticated callers cannot get an operator session.
- Authenticated non-operators and inactive operators are denied by the backend.
- Active operators receive only non-sensitive session metadata.
- No client write path exists for `supportOperators` or `accountEntitlements`.

## Automated Test Expectation

Add focused scriptable checks for any pure operator helper logic introduced; if emulator-backed callable tests are not added, record the no-emulator rationale and keep lint/build plus syntax checks as required validation.

## Test Files

- scripts/check-operator-session-helpers.mjs

## Test Cases To Cover

- Active support/admin operator is accepted.
- Missing, inactive, or malformed operator records are denied.
- Session response excludes secrets and raw provider config.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `code-review`: preferred tools `shell`; default evidence file and line references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.
- `api-smoke`: preferred tools `shell`, `curl`; default evidence request/response summary, command output. Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape.

## Runtime Targets

- Firebase callable `getOperatorSession` when emulator or staging credentials are available

## Evidence Required

- lint/build/syntax output
- rules review showing operator records are server-owned
- callable denial/allowance evidence or explicit emulator-unavailable note

## Allowed Discovery

Follow existing callable patterns, trusted operation wrappers, and route/auth guard patterns only.

## Test Commands

- npm run lint
- npm run build
- node --check functions/src/index.js

## Manual Verification Follow-Up

- Seed one `supportOperators/{uid}` document in staging or emulator and verify active/inactive/non-operator behavior before accepting the phase.

## Master Developer Review Focus

Confirm that Operator Trust Boundary is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Operator Trust Boundary. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Operator Trust Boundary using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
