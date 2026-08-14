# Phase 2: Parent Summary Shell

## Goal

Replace the long inline Lockdown management page with a summary-first shell and modal frame while preserving existing capabilities.

## Depends On

- Phase 1: Resource And Policy Contract

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Refactor `/dashboard/lockdown` content into summary cards and modal entry points.
- Keep student selection prominent and make the selected student drive all summaries.
- Move raw derived policy, legacy PoC material, and long tables behind Advanced or modal surfaces.
- Do not build the final resource-library editor yet.

## Deliverables

- Summary-first LockdownPolicyPanel layout.
- Reusable modal frame or local modal components matching current dashboard styling.
- Summary cards for schedule, off-block resources, devices, pairing, allowed-right-now, and advanced diagnostics.
- Focused view-model helpers if needed to keep the component readable.

## Files Or Areas To Touch

- src/components/LockdownPolicyPanel.jsx
- src/pages/Lockdown.jsx
- src/utils/lockdownPolicyUtils.js
- scripts/check-lockdown-parent-view-model.mjs

## Read First

- docs/specs/lockdown-simplification-and-extension-launcher.md
- src/pages/Lockdown.jsx
- src/components/LockdownPolicyPanel.jsx
- src/constants/dashboardFeatures.js
- tailwind.config.js
- scripts/check-lockdown-parent-view-model.mjs

## Exit Criteria

- The default Lockdown page is no longer a long scroll of open configuration panels.
- The page starts with student selection and summary cards.
- Existing pairing, schedule, derived preview, and device data remain reachable.
- Advanced diagnostic details are collapsed or moved behind a deliberate action.

## Automated Test Expectation

Add `scripts/check-lockdown-parent-view-model.mjs` if summary counts, labels, modal availability, or read-only action flags are extracted into pure helpers. If no pure helper is extracted, record a no-new-script rationale and rely on build plus browser smoke.

## Test Files

- scripts/check-lockdown-parent-view-model.mjs

## Test Cases To Cover

- Summary counts derive consistently from selected student data.
- Read-only entitlement state still disables management actions.
- No-student and multi-student states render explicit selection guidance.
- Existing pairing, schedule, derived preview, resource tester, device, and legacy compatibility functions remain reachable through modals or advanced surfaces.

## No-Test Rationale

Not set at dispatch. Downstream must add a view-model script when testable helpers are extracted, or record why Phase 2 remains validated by build plus browser smoke.

## Validation Modes

- `code-review`: preferred tools `shell`; default evidence code references. Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks.
- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence screenshot, route or interaction notes. Load the live UI in a runtime and verify the main happy path for the active slice.

## Runtime Targets

- http://localhost:3000/dashboard/lockdown

## Evidence Required

- npm run build output
- browser screenshot or detailed browser-smoke notes for the summary-first page
- code references for summary shell, modal frame, and moved advanced sections
- view-model script output or no-new-script rationale

## Allowed Discovery

Start from the Lockdown route and component, then inspect adjacent dashboard shell components only if needed for styling or modal patterns.

## Test Commands

- node scripts/check-lockdown-parent-view-model.mjs (if added)
- npm run build
- npm run dev

## Manual Verification Follow-Up

- Use a logged-in parent account to confirm the default page is scannable and modals open without losing selected student context.

## Project Manager Questions

- None for phase start. Use the source-plan card concepts and existing product wording; ask before changing product promises or final card titles beyond those concepts.

## Human Assistance Triggers

- Provide a logged-in parent browser session if automated auth fixtures are unavailable.

## Master Developer Review Focus

Confirm that Parent Summary Shell is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Focus on layout and information architecture. Do not change resource persistence or trusted endpoint behavior in this phase.
- `tester`: Validate the parent page visually and confirm existing management functions are still reachable.

## Next Phase Inputs

- Stable summary shell
- Modal frame ready for resource and schedule editors
