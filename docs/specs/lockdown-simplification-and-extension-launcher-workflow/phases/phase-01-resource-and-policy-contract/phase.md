# Phase 1: Resource And Policy Contract

## Goal

Define the simplified Lockdown source model and policy merge behavior before changing the parent or extension UI.

## Depends On

- None

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Define the household off-block resource library contract with per-student assignments.
- Preserve the existing weekly schedule behavior and outside-schedule blocking-off behavior.
- Define how parent-approved off-block resources merge with active block resources during school-time enforcement.
- Keep current student off-hours window data readable as migration input.
- Keep this phase at schema/helper contract level. Do not choose the final Firestore persistence path, build parent CRUD UI, or change extension UI in Phase 1.

## Deliverables

- Updated schema or schema comments for the resource library and assignment shape.
- Policy helper updates that normalize resource-library inputs and merge them into derived policy previews.
- Assignment-aware helper behavior that can accept parent-owned resource-library input and filter it for the selected student.
- Compatibility handling for existing off-hours window resources.
- Focused script coverage for normalization, assignments, system allowlist, and derived policy states.

## Files Or Areas To Touch

- src/constants/schema.js
- src/utils/lockdownPolicyUtils.js
- functions/src/index.js
- scripts/check-lockdown-resource-normalization.mjs
- scripts/check-lockdown-policy-states.mjs
- scripts/check-lockdown-derived-policy.mjs

## Read First

- docs/specs/lockdown-simplification-and-extension-launcher.md
- docs/specs/lockdown-production-behavior-contract.md
- src/constants/schema.js
- src/utils/lockdownPolicyUtils.js
- functions/src/index.js
- scripts/check-lockdown-resource-normalization.mjs

## Exit Criteria

- The simplified resource-library model is represented in code or schema comments.
- Derived policy includes system resources, parent-approved resources for the selected student, and active block resources in the intended states.
- Outside schedule with no explicit enforcement window still leaves network blocking off.
- Existing saved off-hours resources remain readable during migration.

## Automated Test Expectation

Add or update focused Node validation scripts that cover resource normalization, helper-level student assignment filtering, policy-state merging, legacy off-hours compatibility, and Own Path system allowlist behavior.

## Test Files

- scripts/check-lockdown-resource-normalization.mjs
- scripts/check-lockdown-policy-states.mjs
- scripts/check-lockdown-derived-policy.mjs

## Test Cases To Cover

- Website URLs normalize to exact origins and reject unsupported schemes.
- YouTube creator inputs preserve stable channel IDs when present and do not allow all of youtube.com.
- Parent-approved resources apply only to assigned students.
- School time with no active block allows system resources and assigned off-block resources.
- Active block adds block resources without dropping parent-approved resources.
- Outside schedule without an approved enforcement window keeps Lockdown blocking off.
- Existing `lockdown_schedule.off_hours_resource_windows` resources remain readable as migration input.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `code-review`: preferred tools `shell`; default evidence code references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.
- `unit-regression`: preferred tools `shell`; default evidence command output. Run the existing focused automated tests that cover the active slice before widening scope.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- No explicit runtime targets listed. Add them before live validation if the phase needs them.

## Evidence Required

- command output for Lockdown scripts
- npm run build output
- code references for data contract and policy merge

## Allowed Discovery

Follow imports from schema, policy helpers, and existing Lockdown scripts only as needed.

## Test Commands

- node scripts/check-lockdown-resource-normalization.mjs
- node scripts/check-lockdown-policy-states.mjs
- node scripts/check-lockdown-derived-policy.mjs
- npm run build

## Manual Verification Follow-Up

- None currently required. Add a follow-up here if the phase cannot be fully verified in-agent.

## Project Manager Questions

- None for phase start. The source plan assumes parent-approved off-block resources are baseline allowed while school-time enforcement is active, and Phase 3 owns the saved resource-library persistence path and parent CRUD UI.

## Human Assistance Triggers

- None currently known. Add device, simulator, credential, account, fixture, or manual setup needs here before validation if they appear.

## Master Developer Review Focus

Keep this phase contract and policy focused. Do not dispatch UI work until the merge behavior is proven by scripts.

## Runtime Handoff Notes

- `developer`: Implement the smallest model and helper changes needed for the simplified resource contract, then update focused scripts. Keep persistence-path and UI decisions deferred to later phases.
- `tester`: Verify the scripts exercise behavior rather than only implementation details, and confirm outside-schedule behavior stayed unchanged.

## Next Phase Inputs

- Stable simplified resource contract
- Policy helper behavior that UI phases can consume
