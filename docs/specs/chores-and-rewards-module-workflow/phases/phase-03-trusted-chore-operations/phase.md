# Phase 3: Trusted Chore Operations

## Goal

Build trusted callable and rules foundations for chore settings, claims, completions, approvals, and student-safe reads.

## Depends On

- Phase 2: Schema And Availability Helpers

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add callable wrappers and Cloud Functions for parent-owned chore setup mutations and student claim/complete actions.
- Enforce parent ownership, student eligibility, availability, claim status, and approval requirements server-side.
- Add Firestore rules for the new collections without exposing household-wide data through public reads.
- Keep parent and student presentation UI out of this phase except minimal wiring needed to call helpers.
- Under the current public slug portal model, student chore callables must require PIN-verified student context and must reject missing or mismatched PINs.
- Default parent approval to off only when the chore definition does not explicitly require approval; do not infer approval from effort labels in this phase.

## Deliverables

- Trusted operation wrappers in the frontend.
- Cloud Function handlers or shared validator helpers for chore operations.
- Firestore rules coverage for new chore/routine collections.
- Validation script for pure server-side chore validators where emulator coverage is unavailable.

## Files Or Areas To Touch

- src/firebase/trustedOperations.js
- functions/src/index.js
- firestore.rules
- scripts/check-chores-trusted-contracts.mjs

## Read First

- docs/specs/chores-and-rewards-module-workflow/phases/phase-03-trusted-chore-operations/phase.md
- docs/specs/chores-and-rewards-module.md
- src/firebase/trustedOperations.js
- functions/src/index.js
- firestore.rules
- src/utils/choreUtils.js

## Exit Criteria

- Student chore claim and completion cannot be client-authoritative Firestore writes.
- Parents can manage chore/routine definitions only inside their account boundary.
- Rules and trusted validators reflect the student-safe privacy requirements from the spec.

## Automated Test Expectation

Add focused validation coverage for callable input normalization and server-side chore validator decisions; use emulator-backed tests only if the repo already supports them or the phase explicitly adds the minimal harness.

## Test Files

- scripts/check-chores-trusted-contracts.mjs

## Test Cases To Cover

- Student cannot claim an ineligible or unavailable chore.
- Sibling cannot complete another student's active claim.
- Expired claims are rejected or released consistently.
- Parent approval-required completions do not award final credit before approval.
- Student-safe reads exclude sibling allowance and private reward data.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `security-rules-review`: preferred tools `shell`, `code-review`; default evidence rules/code references, risk notes. Inspect Firestore rules, trusted callable boundaries, and public student portal exposure for the active slice.
- `api-smoke`: preferred tools `shell`, `firebase emulator when configured`; default evidence request or response summary, command output. Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- Firebase callable emulator if configured

## Evidence Required

- command output
- rules/code references
- callable contract notes

## Allowed Discovery

Follow existing trusted create/student/subject/entitlement callable patterns and Firestore rule helpers only as needed.

## Test Commands

- node scripts/check-chores-trusted-contracts.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- If callable emulator setup is unavailable, record the missing emulator path and require a later seeded Firebase smoke before launch.

## Project Manager Questions

- None required before Phase 3 dispatch. The source plan requires at least PIN-verified student context under the current public slug model, and recommends auto-approved chores by default with parent-approval-required as an explicit option.

## Human Assistance Triggers

- Provide Firebase emulator or staging credentials if live callable smoke validation is needed.

## Master Developer Review Focus

Confirm trusted operations do not inherit the current public Firestore posture. Keep direct client writes closed, route parent and student mutations through trusted functions, require PIN-verified student context for student actions, and record emulator/manual smoke limitations if no callable emulator harness is available.

## Runtime Handoff Notes

- `developer`: Implement only Trusted Chore Operations. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Trusted Chore Operations using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Trusted chore mutation path.
- Rules posture for parent and student-safe data.
