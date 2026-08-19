# Phase 3: Household Resource Library

## Goal

Build the parent resource modal for websites and YouTube creators with per-student assignments.

## Depends On

- Phase 2: Parent Summary Shell

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Implement the manage-resources modal over the contract from Phase 1.
- Support website origins and YouTube creators.
- Let parents assign resources to all students or selected students.
- Keep unsupported resource types clearly rejected or marked future scope.
- Use the PM-approved resource-library trust boundary: trusted callables write parent-owned Firestore records, parent reads are owner-only, public student reads are disallowed, and trusted device-policy derivation reads the library server-side.
- Treat YouTube watch URLs as creator hints only in this phase; do not implement video-level approvals or add a YouTube Data API dependency.

## Deliverables

- Resource library modal with add, edit, archive or remove, filter, and assignment controls.
- Trusted callable persistence path and helper functions for parent-owned resources.
- Validation feedback for unsupported URLs or incomplete YouTube creator entries.
- Updated policy preview inputs so assigned resources appear in effective allowlists.

## Files Or Areas To Touch

- src/components/LockdownPolicyPanel.jsx
- src/firebase/trustedOperations.js
- src/utils/lockdownPolicyUtils.js
- functions/src/index.js
- firestore.rules
- scripts/check-lockdown-resource-normalization.mjs

## Read First

- docs/specs/lockdown-simplification-and-extension-launcher.md
- src/components/LockdownPolicyPanel.jsx
- src/firebase/trustedOperations.js
- src/utils/lockdownPolicyUtils.js
- firestore.rules
- scripts/check-lockdown-resource-normalization.mjs

## Exit Criteria

- A parent can add a supported website or YouTube creator from a focused modal.
- A parent can assign a resource to all students or selected students.
- The selected student's summary counts update from saved resources.
- Invalid resources do not silently enter the allowlist.

## Automated Test Expectation

Update resource normalization and assignment scripts; add parent-resource view-model checks if assignment summaries are extracted.

## Test Files

- scripts/check-lockdown-resource-normalization.mjs
- scripts/check-lockdown-policy-states.mjs
- scripts/check-lockdown-parent-view-model.mjs

## Test Cases To Cover

- Resource assigned to all students appears for every selected student.
- Resource assigned to one student does not appear for siblings.
- Archived or inactive resource does not appear in derived policy.
- YouTube creator entries require channel identity or a supported fallback before they are enforceable.
- Raw youtube.com is not treated as an approved website origin.
- YouTube watch URLs can seed creator metadata but do not create video-level approvals.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence screenshot, route or interaction notes. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- http://localhost:3000/dashboard/lockdown

## Evidence Required

- Lockdown script output
- npm run build output
- screenshot of resource modal

## Allowed Discovery

Follow resource helper imports, current student update paths, and Firestore rule patterns only as needed.

## Test Commands

- node scripts/check-lockdown-resource-normalization.mjs
- node scripts/check-lockdown-policy-states.mjs
- node scripts/check-lockdown-parent-view-model.mjs
- npm run build
- npm run dev

## Manual Verification Follow-Up

- In a parent account, add one website and one YouTube creator, assign them to a test student, and confirm counts and preview update.
- Full live verification requires the updated Firestore rules and Phase 3 Cloud Functions to be deployed to the Firebase project used by the parent test account.

## Project Manager Questions

- Answered 2026-05-27: use trusted callables for resource-library writes, backed by parent-owned Firestore records, owner-only parent reads, no public student reads, and server-side trusted policy derivation reads.
- Answered 2026-05-27: YouTube watch URLs stay creator hints only; video-level approval is not Phase 3 scope.

## Human Assistance Triggers

- Provide a test parent account or authorize use of the existing Lockdown test account for browser smoke.
- Authorize or perform Firebase deployment when live validation depends on updated Firestore rules or callable functions.

## Master Developer Review Focus

Confirm that Household Resource Library is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Build the resource editor as a parent workflow, not a policy debug editor. Keep advanced fields hidden unless needed.
- `tester`: Exercise resource assignment behavior with at least two students when a fixture is available.

## Next Phase Inputs

- Saved household resource library
- Assignment-aware resource summaries
