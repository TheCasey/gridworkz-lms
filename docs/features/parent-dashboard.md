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

## Open Gaps

- This page still coordinates a meaningful amount of shell orchestration even after hook extraction.
- Weekly rollover is run from the client.
- Projects, billing, chores, and other future modules still need to be added on top of the shared shell contract.
