# Phase 3: Operator Functions

## Goal

Add the trusted backend operations needed by the operator console for search, detail, initialization, override apply, override clear, and usage warnings.

## Depends On

- entitlement-resolution-and-audit

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add search by uid, email, and school name through backend-only reads.
- Add entitlement detail response with effective state, billing state, manual override, usage summary, Lockdown summary, and recent audit entries.
- Add safe initialization for missing entitlement docs.
- Add manual override apply and clear functions with required reason and audit writes.
- Add usage and downgrade warnings for student/curriculum limit conflicts and saved Lockdown setup.

## Deliverables

- Operator callable functions
- Client trusted-operation wrappers
- Usage and downgrade warning helpers
- Audit writes for initialize/apply/clear

## Files Or Areas To Touch

- functions/src/index.js
- src/firebase/trustedOperations.js
- src/constants/schema.js

## Read First

- docs/specs/operator-entitlement-console.md
- functions/src/index.js
- src/firebase/trustedOperations.js
- src/constants/entitlements.js
- src/utils/entitlementUtils.js
- firestore.rules

## Exit Criteria

- Only active operators can call search/detail/mutation functions.
- Parent account search returns minimal identity metadata.
- Initialize creates a safe free/fallback entitlement record when missing.
- Apply override requires reason and records audit.
- Clear override restores billing-backed state and records audit.

## Automated Test Expectation

Add focused scriptable checks for request validation, override payload normalization, and downgrade warning helpers; emulator API checks should be added when practical.

## Test Files

- scripts/check-operator-entitlement-functions.mjs

## Test Cases To Cover

- Missing reason rejects mutation.
- Invalid plan/status rejects mutation.
- Free downgrade warning appears when usage exceeds free limits.
- Lockdown removal warning appears when a household has Lockdown setup.
- Non-operator receives permission-denied for all operator functions.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `api-smoke`: preferred tools `shell`, `curl`; default evidence request/response summary, command output. Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape.
- `code-review`: preferred tools `shell`; default evidence file and line references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.

## Runtime Targets

- Firebase callable functions in emulator or staging

## Evidence Required

- validation command output
- operator and non-operator callable response summaries
- audit log write evidence for at least one mutation path or emulator-unavailable note

## Allowed Discovery

Follow parent, student, subject, entitlement, and lockdown setup reads only as needed to build operator responses.

## Test Commands

- npm run lint
- npm run build
- node --check functions/src/index.js

## Manual Verification Follow-Up

- Exercise one internal account through initialize, apply override, and clear override in staging or emulator.

## Master Developer Review Focus

Confirm that Operator Functions is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Operator Functions. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Operator Functions using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
