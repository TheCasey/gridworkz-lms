# Phase 8: Ship Live Core Billing And Consistent Product Copy (source Phase 7)

## Goal

Confirm deployed Stripe mode and existing subscriptions against Phase 0 inventory. Add missing authenticated server endpoints for Core checkout and billing-portal sessions using server-approved prices and return hosts; reuse provider customer IDs and reject duplicate purchase attempts.

## Depends On

- Operational Phase 7 / source Phase 6

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Confirm deployed Stripe mode and existing subscriptions against Phase 0 inventory. Add missing authenticated server endpoints for Core checkout and billing-portal sessions using server-approved prices and return hosts; reuse provider customer IDs and reject duplicate purchase attempts.
- Tie checkout/customer/subscription metadata to the authenticated parent server-side. A success redirect does not grant Core; only verified trusted billing resolution does. Handle webhook retries, duplicates, and out-of-order events without regressing entitlements.
- Prove sandbox lifecycle first: successful purchase, abandoned checkout, delayed webhook, failure/past_due, recovery, renewal, cancel-at-period-end, expired cancellation, and customer portal. Test an operator override during billing changes and resolution when it is cleared/expires.
- Define accessible upgrade/manage/loading/error states in Settings and quota dialogs. Downgrade keeps existing students, curriculum, routines, cosmetics, and history; over-limit Free accounts can use/edit existing work but cannot create/reactivate above the accepted cap through a bypass.
- Configure live Core $5 monthly product/price, secrets, webhook endpoint, billing portal, Firebase allowed origins, and Cloudflare host environment settings. Keep credentials outside frontend bundles/logs. Keep Lockdown purchase disabled while preserving existing plan mappings.
- Update MarketingHome, Settings/upgrade copy, catalog copy, homepage feature examples, FAQs, and pricing docs together: full school/routines on Free, scale on Core, Lockdown coming soon. Remove premium chore/reward upsell copy from hidden routes and direct-link fallbacks.
- Release new billing endpoints/webhook mappings before checkout UI. Use the accepted customer-transition policy; do not change existing subscription price IDs merely to refresh public copy.
- Complete one owner-authorized real Core purchase with a disposable QA household, verify provider and entitlement state, manage/cancel it, and apply the agreed refund/cleanup policy. If unavailable, record live-billing acceptance as pending and do not mark this release complete or market active checkout as verified.

## Deliverables

- Complete source plan Phase 7 code/docs and validation evidence

## Files Or Areas To Touch

- See source plan phase file boundaries; orchestrator owns shared integration files

## Read First

- AGENTS.md
- docs/upgrades/product-direction-execution-plan-2026-09.md
- docs/upgrades/product-direction-execution/decisions.md

## Exit Criteria

- real purchase and management evidence exists, billing/entitlements/client/backend quotas agree, stale paid features remain hidden, and public messaging matches actual purchase availability. Chrome Web Store commercialization is not a gate for this Core-only release; existing extension regression checks are.

## Automated Test Expectation

Add meaningful policy/persistence tests for the source phase cases; static source assertions cannot replace declared runtime validation.

## Test Files

- Not listed yet. Add likely files before dispatching developer work if automated tests are expected.

## Test Cases To Cover

- Not listed yet. Add focused regression or behavior cases before dispatching developer work if the phase changes behavior.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `api-smoke`: preferred tools `shell`, `curl`; default evidence request or response summary, command output. Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- Firebase emulators on isolated demo-gridworkz-direction project; production requires orchestrator release gate

## Evidence Required

- Commands and outcomes, redacted persisted observations, environment and commit IDs

## Allowed Discovery

Follow active phase imports/consumers/tests; do not widen product scope.

## Test Commands

- npm run lint
- npm run build
- npm run check:student-timers

## Manual Verification Follow-Up

- None currently required. Add a follow-up here if the phase cannot be fully verified in-agent.

## Project Manager Questions

- None currently known. Ask only if product intent, acceptance criteria, or runtime setup is still underspecified.

## Human Assistance Triggers

- Request only missing external access or owner-authorized live purchase when it becomes required.

## Master Developer Review Focus

Confirm that Ship Live Core Billing And Consistent Product Copy (source Phase 7) is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Use the accepted decisions. No commits, pushes, deployment, real billing changes, or production seeding.
- `tester`: Test integrated code independently; report runtime gaps as pending, never as passes.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
