# Phase 3: Resource Normalization And Parent Testing

## Goal

Make approved-resource behavior predictable for parents with origin normalization, YouTube parsing or resolution, unsupported-resource blocking, and a dashboard test tool.

## Depends On

- Phase 2: Policy Derivation And System Allowlist

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Implement a parent-facing URL and YouTube resource tester in the Lockdown module.
- Support normal parent entry by pasted URL, channel URL, handle URL, or video URL where feasible.
- Keep YouTube first production scope at channel-level approval unless a later product decision expands it.

## Deliverables

- Resource normalization helper for website origins and YouTube inputs
- Parent dashboard tester for URL or creator access against the selected student's current policy
- Clear unsupported-resource validation in planning/publish or Lockdown preview surfaces

## Files Or Areas To Touch

- src/utils/lockdownPolicyUtils.js
- src/components/LockdownPolicyPanel.jsx
- src/pages/Curriculum.jsx
- src/components/curriculum/WeeklyPlanReviewPanel.jsx
- scripts/check-lockdown-resource-normalization.mjs

## Read First

- src/utils/lockdownPolicyUtils.js
- src/components/LockdownPolicyPanel.jsx
- src/components/curriculum/WeeklyPlanReviewPanel.jsx
- src/pages/Curriculum.jsx
- docs/specs/lockdown-production-behavior-contract.md
- extensions/chrome-lockdown-poc/youtube-content.js

## Exit Criteria

- Parents can test a URL or YouTube resource and see allow, deny, unsupported, or metadata-needed results.
- Origin/domain behavior matches the production contract exactly.
- Manual YouTube channel ID entry remains an advanced fallback, not the only normal workflow.
- Unsupported resources do not silently appear as allowed resources in policy previews.

## Automated Test Expectation

Add focused resource-normalization checks for ordinary origins, unsupported schemes, YouTube channels, handles, videos, playlists, and invalid entries.

## Test Files

- scripts/check-lockdown-resource-normalization.mjs

## Test Cases To Cover

- Lesson URL normalizes to exact origin.
- Subdomain remains separate from root domain.
- YouTube video URL resolves to channel metadata or metadata-needed state.
- Playlist and unsupported YouTube surfaces fail closed until product support exists.
- Non-http schemes are rejected.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence focused check script output. Run the existing focused automated tests that cover the active slice before widening scope.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot or DOM summary. Load the live UI in a runtime and verify the main happy path for the active slice.
- `build-health`: preferred tools `shell`; default evidence npm run lint output, npm run build output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- http://127.0.0.1:3000/dashboard/lockdown with authenticated disposable or existing test account

## Evidence Required

- normalization check output
- browser-smoke evidence for parent tester UI
- lint/build output

## Allowed Discovery

Start with the listed read-first files, then follow imports, routes, existing check scripts, extension files, functions, and nearby docs only as needed for the active phase.

## Test Commands

- node scripts/check-lockdown-resource-normalization.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- If no authenticated account is available, record the browser tester as manual follow-up with the exact setup needed.

## Master Developer Review Focus

Confirm that Resource Normalization And Parent Testing is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Resource Normalization And Parent Testing. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Resource Normalization And Parent Testing using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Normalized resource model and parent test workflow for device management and student blocked UI.
