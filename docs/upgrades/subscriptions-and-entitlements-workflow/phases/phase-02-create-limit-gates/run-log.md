# Phase 2 Run Log

## Status Snapshot

- Phase: `phase-02-create-limit-gates`
- Current status: `complete`
- Current owner: `tester`
- Last updated: `2026-05-05`

## Master Developer Notes

- Confirmed Phase 2 still matches the roadmap and source-plan order: gate only the two existing billable create paths before any account-plan surfaces, navigation work, or lockdown gating.
- `ParentDashboard.jsx` has one add-student path in `handleAddStudent`; keep the student gate limited to that existing flow and its nearby messaging.
- `Curriculum.jsx` uses one shared submit path for both create and edit. Gate only the create branch for new active subjects; do not block subject edits, archive, or delete actions for accounts already at or over limit.
- Keep curriculum checks tied to active-subject counting from Phase 1. Historical inactive or archived subjects must remain manageable and must not consume the create cap.
- The worktree is still dirty, including `src/pages/ParentDashboard.jsx` and the new Phase 1 entitlement files. Preserve in-flight changes and layer the Phase 2 work onto the current file state.

## Developer Notes

- Added plan-aware student create gating in `src/pages/ParentDashboard.jsx` using `useEntitlements`, with disabled create buttons at limit, inline usage-versus-limit messaging, and a submit-time guard so the flow does not rely on Firestore errors.
- Added plan-aware curriculum create gating in `src/pages/Curriculum.jsx` using active-subject counting only, with disabled create buttons at limit, inline upgrade messaging, and a create-only guard inside the shared submit handler so edits, archives, and deletes remain available.
- Extended `src/hooks/useEntitlements.js` and `src/utils/entitlementUtils.js` with named limit checks plus reusable usage-summary copy so both gated surfaces read the same plan state.
- Validation: `npm run build` passed on 2026-05-05. Vite emitted the existing large-chunk warning, but the production build completed successfully.

## Tester Notes

- Validated the student-create gate in `src/pages/ParentDashboard.jsx`: the only student create path remains `handleAddStudent`, both dashboard add-student entry points disable at cap, the dashboard usage panel shows usage-versus-limit plus upgrade copy near the create surface, and `handleAddStudent` still blocks direct submit attempts when `canAddStudent` is false.
- Validated the curriculum-create gate in `src/pages/Curriculum.jsx`: the header and empty-state create buttons disable at cap, the usage panel and create modal both show curriculum usage-versus-limit messaging, the shared submit handler blocks only the create branch for new active subjects, and editing an existing subject still keeps update, archive, and delete paths available.
- Validated the shared helpers: `src/hooks/useEntitlements.js` now exposes named limit checks and create booleans consumed by both surfaces, and `src/utils/entitlementUtils.js` counts only active, non-archived subjects toward the curriculum cap so inactive or archived records do not consume limit.
- Validation command: `npm run build` passed on `2026-05-05`. The existing Vite large-chunk warning still appears, but the production build completes successfully.
- Corrected scope judgment: `LockdownPolicyPanel` remains later lockdown-tier work, but its presence in `src/pages/ParentDashboard.jsx` is pre-existing unrelated dirty-worktree work rather than a change attributable to the Phase 2 create-limit implementation. It should be tracked in the later lockdown phase, but it does not block Phase 2 completion because the Phase 2 exit criteria themselves validate cleanly.

## Open Questions Or Blockers

- None.

## Completion Summary

- Phase 2 passed tester validation for the intended create-limit scope.
- Student creation and active-subject creation are both plan-aware, downgrade-safe, and backed by visible usage-plus-upgrade messaging.
- Workflow is ready to advance to `phase-03-account-visibility-and-locked-states`.
