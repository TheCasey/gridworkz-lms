# Parent Dashboard

Status: Active

## Scope

The parent dashboard is the authenticated control surface for the app. It owns:

- student overview
- live weekly activity
- student creation
- route-backed shell navigation to students, curriculum, reports, settings, and Lockdown
- manual completion and rollover-related state
- shared shell state for premium visibility and shell slots

## Key Files

- `src/pages/ParentDashboard.jsx`
- `src/components/StudentCard.jsx`
- `src/components/AddStudentModal.jsx`
- `src/constants/dashboardFeatures.js`
- `src/pages/Lockdown.jsx`

## Current Behavior

- Composes route-backed shell state, shared dashboard feature metadata, and extracted domain hooks.
- Loads students, subjects, weekly activity, reports, and rollover state through hook boundaries instead of inline listeners.
- Creates parent profiles if missing.
- Generates student slugs and optional PINs on creation.
- Syncs reset and timezone settings to student records.
- Shows live pulse activity and student progress.
- Supports parent-led manual completion for a block.
- Routes Lockdown into its own dedicated dashboard module instead of hosting the policy editor inside the students surface.
- The `/dashboard/lockdown` route is entitlement-aware and uses the same shell rail for active, locked, and downgraded read-only states.
- Multi-student households must choose a student explicitly before generating a trusted pairing code.
- Lockdown-entitled parents can generate short-lived trusted enrollment material, review the current derived policy state, and manage approved off-hours resources per student from the dashboard.
- Downgrades preserve saved Lockdown setup in read-only mode while disabling trusted pairing and edits until the Lockdown plan is restored.

## Open Gaps

- This page still coordinates a meaningful amount of shell orchestration even after hook extraction.
- Weekly rollover is run from the client.
- The future weekly planning layer, project views, and direct weekly review surfaces are not implemented yet.
- Projects, billing, chores, and other future modules still need to be added on top of the shared shell contract.
- Kiosk mode and broader Lockdown hardening remain follow-on scope outside the current parent dashboard launch surface.

## Related Planning

- [../upgrades/baseline-product-foundation.md](../upgrades/baseline-product-foundation.md)
- [../specs/weekly-planning-and-review-flow.md](../specs/weekly-planning-and-review-flow.md)
- [../specs/projects-and-assessment-model.md](../specs/projects-and-assessment-model.md)
