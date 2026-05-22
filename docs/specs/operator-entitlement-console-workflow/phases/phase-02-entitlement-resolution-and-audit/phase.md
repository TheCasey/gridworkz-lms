# Phase 2: Entitlement Resolution And Audit

## Goal

Extend entitlement state so billing truth, effective state, manual overrides, and audit events can coexist safely.

## Depends On

- operator-trust-boundary

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Extend entitlement schema with `billing_state`, `manual_override`, `resolution_source`, and `updated_via`.
- Refactor backend entitlement resolution into shared helpers used by billing and trusted create paths.
- Update Stripe webhook sync so billing always updates `billing_state` and does not stomp active manual overrides.
- Add server-owned `entitlementAuditLogs` writes for webhook sync and future operator actions.

## Deliverables

- Shared entitlement resolver
- Webhook-safe override semantics
- Audit log schema and backend write helper
- Backward-compatible effective top-level entitlement fields

## Files Or Areas To Touch

- functions/src/index.js
- src/constants/schema.js
- src/utils/entitlementUtils.js
- firestore.rules

## Read First

- docs/specs/operator-entitlement-console.md
- functions/src/index.js
- src/constants/entitlements.js
- src/utils/entitlementUtils.js
- src/constants/schema.js
- firestore.rules

## Exit Criteria

- Existing clients can still read top-level effective entitlement fields.
- Billing webhook updates `billing_state` under an active manual override without changing effective plan fields.
- Cleared or missing overrides resolve effective state from billing or safe fallback.
- Audit helper records shallow before/after state without exposing secrets.

## Automated Test Expectation

Extract pure entitlement resolution helpers where practical and add scriptable checks for billing sync with and without active manual overrides.

## Test Files

- scripts/check-entitlement-resolution.mjs

## Test Cases To Cover

- Webhook updates effective fields when no override is active.
- Webhook preserves effective fields but updates billing state under active override.
- Expired or cleared override resolves back to billing state.
- Feature overrides merge through the same plan catalog semantics as the current app.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `code-review`: preferred tools `shell`; default evidence file and line references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.
- `api-smoke`: preferred tools `shell`, `curl`; default evidence request/response summary, command output. Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape.

## Runtime Targets

- Stripe webhook handler in emulator/staging with synthetic subscription payloads

## Evidence Required

- helper check output or no-helper rationale
- lint/build/syntax output
- summary of webhook behavior for override and non-override states

## Allowed Discovery

Follow only entitlement, billing webhook, trusted create, and Firestore rule dependencies.

## Test Commands

- npm run lint
- npm run build
- node --check functions/src/index.js

## Manual Verification Follow-Up

- Use a staging or emulator entitlement document to confirm webhook sync does not remove an active manual override.

## Master Developer Review Focus

Confirm that Entitlement Resolution And Audit is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Entitlement Resolution And Audit. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Entitlement Resolution And Audit using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
