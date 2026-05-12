# Phase 1 Run Log

## Status Snapshot

- Phase: `phase-01-entitlement-foundation`
- Current status: `complete`
- Current owner: `tester`
- Last updated: `2026-05-05`

## Master Developer Notes

- Confirmed Phase 1 still matches the roadmap and source-plan order: shared entitlement scaffolding first, with no create gating, account UI, or lockdown UI work in this phase.
- Tightened the handoff to one entitlement-specific catalog plus one entitlement-specific helper or hook. Do not turn this into a generic Firestore loader or broader shared data-layer refactor.
- The active-subject counting rule must be explicit in implementation: `ParentDashboard.jsx` already reads active subjects, but `Curriculum.jsx` currently reads all subjects, so curriculum usage helpers must exclude inactive or archived records themselves.
- The worktree already has unrelated in-flight edits, including `src/constants/schema.js` and `src/pages/ParentDashboard.jsx`. Preserve those changes and layer the Phase 1 work onto the current file state.

## Developer Notes

- Added `src/constants/entitlements.js` as the shared plan catalog with stable `free`, `core`, and `lockdown` plan ids, limit keys, feature flags, and upgrade copy.
- Extended `src/constants/schema.js` with the server-owned `accountEntitlements` collection name plus `AccountEntitlementSchema`, `AccountEntitlementFeatureOverridesSchema`, and `AccountEntitlementUsageSnapshotSchema`.
- Added `src/hooks/useEntitlements.js` as a narrow entitlement-specific read path that listens only to `accountEntitlements/{parentId}`, derives live usage from page-owned `students` and `subjects` arrays, and falls back to the free plan when the entitlement doc is missing.
- Added `src/utils/entitlementUtils.js` with active-subject-only curriculum counting and shared limit/feature derivation helpers. Curriculum usage excludes inactive and archived subjects even if callers pass a broader subjects query.
- Validation: `npm run build` passed on `2026-05-05`.

## Tester Notes

- Validated the shared catalog in `src/constants/entitlements.js`: stable internal plan ids exist for `free`, `core`, and `lockdown`, with the expected student limits, curriculum limits, and feature flags.
- Validated the server-owned contract in `src/constants/schema.js`: paid-access authority is represented as `Collections.ACCOUNT_ENTITLEMENTS = "accountEntitlements"` plus `AccountEntitlementSchema`, not as a `parents/{uid}` plan flag.
- Validated `src/hooks/useEntitlements.js`: the hook listens only to `accountEntitlements/{parentId}`, derives usage from caller-owned `students` and `subjects` arrays, and remains entitlement-specific instead of becoming a generic shared Firestore abstraction.
- Validated the free-plan fallback and helper behavior in `src/utils/entitlementUtils.js`: missing entitlement docs normalize to the `free` plan, and curriculum usage counts only active subjects while excluding inactive or archived records from the cap.
- Confirmed Phase 1 stayed inside scope: repo-wide entitlement references are limited to the new contract files, `ParentDashboard.jsx` does not gate `handleAddStudent`, and `Curriculum.jsx` does not gate subject creation or add plan/premium UI.
- Validation command: `npm run build` passed on `2026-05-05`.

## Open Questions Or Blockers

- None yet

## Completion Summary

- Phase 1 passed tester validation.
- Shared entitlement scaffolding, the server-owned `accountEntitlements` contract, the narrow entitlement read hook, and active-subject curriculum counting are in place without create gating, nav changes, account-plan UI, or lockdown UI work.
- Workflow is ready to advance to `phase-02-create-limit-gates`.
