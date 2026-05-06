# Shell And Data Layer

Last updated: 2026-05-06

Status: Complete

## Implementation Status

This upgrade is now implemented.

Delivered outcomes:

- the parent experience now uses a route-backed `/dashboard/*` shell with a shared feature registry
- shell header slots and right-rail behavior are metadata-driven instead of hardcoded
- student, settings, subject, report, activity, and rollover orchestration now compose hook boundaries instead of living inline in the largest page files
- premium shell gating is structural, and Lockdown now lives as its own route-backed module
- the student portal now evaluates subject visibility, timer start, and submission access through one reusable access-policy layer

Follow-on work such as security hardening, reporting/evidence improvements, live-mode billing rollout, or future modules should continue in their dedicated docs rather than reopening this completed upgrade.

## Goal

Make GridWorkz modular enough that new parent-facing features can be added as registered sections instead of being threaded through `ParentDashboard.jsx`, and make feature logic portable enough that a future UI rewrite or mobile client can reuse domain modules instead of re-embedding Firestore and business rules inside each screen.

This upgrade is about structure, not a visual redesign.

## Why This Upgrade Exists

GridWorkz is already beyond the point where a single dashboard shell can safely keep absorbing new product areas.

Current pressure points:

- subscriptions and entitlements need consistent nav visibility, locked states, and action gating
- the Lockdown PoC should become a plan-gated module instead of staying embedded in the student overview page
- future modules such as chores, projects, billing, device management, or compliance workflows should be able to land as additional sections instead of expanding one switch statement
- the mobile plan already recommends structured hooks and cleaner navigation boundaries
- a future UI refresh should be able to swap shell chrome without rewriting feature logic

## Current Code Reality

As of 2026-05-06:

- `src/App.jsx` exposes a nested `/dashboard/*` shell, a dedicated `/dashboard/lockdown` module, and `/student/:slug`
- `src/constants/dashboardFeatures.js` is the shared shell contract for dashboard route metadata, shell slots, premium visibility state, and Lockdown registration
- `src/pages/ParentDashboard.jsx` is now a route-backed shell container instead of an internal-nav switchboard
- `Curriculum`, `Reports`, `Settings`, `Lockdown`, and `StudentPortal` now compose hook or policy boundaries instead of carrying the largest Firestore orchestration inline
- `useEntitlements` and the shared plan catalog are live, and the dashboard shell now treats premium modules structurally through one visible or locked or hidden contract
- trusted backend enforcement for student creates, active-subject creates, and entitlement-owned Lockdown writes remains the live dependency path and was reused rather than recreated
- the student portal now has a reusable prerequisite/access-policy layer for subject visibility, timer start, and submission flow

This means the app already has useful screen boundaries, but it does not yet have a stable shell contract or a reusable domain-data contract.

## Problems To Solve

### 1. The parent shell is hardcoded

Today, adding a new parent-facing module means touching:

- nav item definitions
- header title logic
- header description logic
- section-specific action buttons
- main-content conditional rendering
- sometimes the right-side rail

That is workable for four sections. It becomes expensive and brittle once subscriptions, projects, chores, billing, device management, or other add-ons are live.

### 2. The shell is not slot-based

The current shell assumes:

- dashboard-only header actions live in the shared header
- the `Live Pulse` rail is always part of the shell
- the Lockdown panel lives inside the student overview page

That makes future features feel like exceptions instead of modules.

### 3. Data loading is screen-owned, not domain-owned

The repo intentionally uses page-owned Firestore queries today. That has kept the app moving, but it also means:

- each large screen mixes listeners, writes, selectors, and UI
- a UI rewrite would still require lifting Firestore logic out of each page
- mobile clients would have to duplicate too much behavior unless structured hooks are introduced

### 4. Feature gating does not have a single integration point

Entitlement state and trusted enforcement now exist, but they are not yet threaded through:

- parent-shell navigation
- locked-state page shells
- future student prerequisites

### 5. Student prerequisites are not modeled as policy

A future rule like "complete chores before lessons unlock" should not require hardcoding chore checks into every student action. The app needs one access-policy layer that can answer:

- what the student can access right now
- what is blocked
- why it is blocked
- what resolves the block

## Architecture Decisions

### 1. No big-bang rewrite

Do not pause feature work for a complete app rebuild.

This should be an incremental refactor:

- keep the current visual language
- keep the current data model unless a phase explicitly changes it
- move one responsibility at a time behind clearer boundaries

### 2. Move to route-backed parent sections

Keep `/dashboard` as the authenticated entry point, but turn it into a nested shell instead of a one-route internal switch.

Recommended destination:

- `/dashboard/students`
- `/dashboard/curriculum`
- `/dashboard/reports`
- `/dashboard/settings`
- future `/dashboard/lockdown`
- future `/dashboard/projects`
- future `/dashboard/chores`
- future `/dashboard/billing`

This makes browser history, deep linking, reload behavior, and future mobile translation cleaner.

### 3. Use a feature registry for the parent shell

The parent shell should stop hardcoding feature sections inline.

Recommended feature descriptor shape:

```js
{
  id: 'curriculum',
  label: 'Curriculum',
  path: 'curriculum',
  icon: BookOpen,
  component: CurriculumPage,
  header: {
    title: 'Curriculum',
    description: 'Manage subjects and learning resources',
  },
  primaryAction: 'add-subject',
  railMode: 'none',
  entitlementGate: null,
  visibilityMode: 'visible'
}
```

Add fields over time as needed, but keep one registry as the source of truth for:

- nav labels and icons
- route paths
- page title and description
- shell action slots
- optional right-rail behavior
- entitlement or premium gates

### 4. Separate shell, domain hooks, and feature UI

Target boundary:

- shell decides layout, nav, page metadata, and slots
- domain hooks own Firestore queries, mutations, and selectors
- feature screens compose hooks and render UI
- presentational components stay mostly data-agnostic

The exact folder names can vary. The boundary matters more than the naming.

### 5. Prefer explicit locked states over silent omission

For premium or blocked features:

- default to showing a locked nav item, card, or page shell with upgrade copy
- use full omission only for unfinished internal-only features
- keep edit and delete actions available when downgrade behavior is meant to be read-mostly

This matches the entitlement plan and keeps the product understandable.

### 6. Keep gating layered

No single gate is enough.

The app needs four distinct layers:

1. Shell-level visibility
2. Screen-level locked-state UI
3. Action-level create or write restrictions
4. Trusted backend or Firestore-rule enforcement

### 7. Add a student access-policy layer before chore-based lockouts

If chores or other prerequisites should block lesson access, do not wire those checks straight into subject rendering or timer buttons.

Add one resolver that can answer:

- `canViewSubjects`
- `canStartTimer`
- `canSubmitBlock`
- `blockedReason`
- `resolutionPath`

That makes chores, lockdown exceptions, or future behavior gates additive instead of invasive.

## Recommended Target Shape

### Parent shell

Recommended responsibilities:

- authentication wrapper
- parent-shell layout
- left navigation
- page header
- notice area
- optional right rail
- route outlet

Recommended non-responsibilities:

- student creation details
- curriculum form state
- report snapshot building
- lockdown policy editing
- entitlement limit calculations

### Domain hooks

Recommended first hooks:

- `useParentSettings`
- `useStudents`
- `useStudentMutations`
- `useSubjects`
- `useSubjectMutations`
- `useWeeklyActivity`
- `useWeeklyReports`
- `useWeeklyRollover`
- `useLockdownPolicy`
- `useEntitlements`
- future `useChores`
- future `useStudentAccessPolicy`

These hooks can still use Firestore listeners internally. The goal is not to remove realtime behavior. The goal is to stop embedding it in giant page files.

### Feature modules

Each major module should eventually have:

- one route container or page
- one or more domain hooks
- feature-specific UI components
- small utility helpers if needed

That is enough to let a future shell remount the same module in a different layout.

## Suggested File Direction

This is one reasonable end state, not a mandatory immediate rename:

```text
src/
  app/
    routes/
      AppRoutes.jsx
  shell/
    dashboard/
      DashboardShell.jsx
      dashboardFeatureRegistry.js
      DashboardHeader.jsx
      DashboardRail.jsx
  domains/
    students/
      hooks/
      utils/
    subjects/
      hooks/
      utils/
    reports/
      hooks/
      utils/
    settings/
      hooks/
      utils/
    entitlements/
      hooks/
      utils/
    lockdown/
      hooks/
      utils/
    access/
      hooks/
      utils/
  features/
    students/
    curriculum/
    reports/
    settings/
    lockdown/
    chores/
```

Important note:

- do not perform a repo-wide folder move just to match this shape
- create the new boundaries gradually and let old files collapse naturally

## Recommended Phased Rollout

### Phase 1. Convert the parent shell into nested dashboard routes

Goal:

- replace `activeNav` switching with nested `/dashboard/*` routes
- keep current screens mostly intact at first

Tasks:

- turn `/dashboard` into a shell route with children
- register `students`, `curriculum`, `reports`, and `settings` as route-backed sections
- move nav, title, and description definitions into one registry
- make `students` the default child route

Exit criteria:

- adding a new top-level parent module no longer requires editing multiple conditional branches in `ParentDashboard.jsx`

### Phase 2. Add shell slots and remove page-specific assumptions

Goal:

- make the shell flexible enough for future modules with different controls

Tasks:

- add header slots for `primaryAction`, `secondaryActions`, and optional filters
- make the right rail optional by page
- move `Live Pulse` behind a `railMode` or similar registry setting
- stop treating the student overview page as the default host for unrelated modules

Exit criteria:

- features can choose whether they need a right rail, page actions, or neither

### Phase 3. Extract domain hooks from the largest screens

Goal:

- keep current behavior while removing Firestore orchestration from giant page files

Priority order:

1. students and parent settings
2. subjects
3. weekly activity and reports
4. lockdown policy
5. student portal access state

Tasks:

- move listeners and writes into domain hooks
- keep selectors and formatting helpers near the domain that uses them
- leave the current UI mostly intact until the hooks are stable

Exit criteria:

- route containers assemble data from hooks instead of creating listeners directly

### Phase 4. Integrate entitlements into the shell contract

Goal:

- make premium gating structural instead of ad hoc

Tasks:

- consume `useEntitlements` in the parent shell
- gate nav visibility and locked states from shared entitlement metadata
- reuse the existing `Settings` plan summary surface instead of introducing a second account-summary contract
- move Lockdown into its own gated module instead of leaving it embedded in the student page

Exit criteria:

- premium modules can be shown as visible, locked, or hidden based on one shared source

### Phase 5. Add a student access-policy layer

Goal:

- make prerequisites composable before chores or similar blockers land

Tasks:

- create a resolver or hook that combines student state, entitlement state, lockdown state, and future prerequisite modules
- return structured reasons instead of booleans only
- use that layer in the student portal for subject availability, timer start, and submission flow

Exit criteria:

- a future chores module can block lesson access by extending one policy layer instead of rewriting the portal

Trusted backend enforcement for entitlements, create limits, and Lockdown writes is already complete through the subscriptions-and-entitlements workflow. Treat that live backend path as a dependency for this upgrade, not as another phase inside it.

## How Future Features Should Plug In

### Example: chores

Target integration shape:

1. Add a `chores` feature module and route
2. Add `useChores` domain hooks
3. Add an entitlement gate if chores are plan-limited
4. Add a student-access policy rule such as `requiresCompletedChores`
5. Render locked or blocked states from shared shell and policy contracts

What should not happen:

- adding chores UI inside the students page just because it is already there
- hardcoding chore checks directly into each student subject row
- inventing a second gating system separate from entitlements and access policy

### Example: future UI redesign

If the boundaries above exist, a redesign should mostly touch:

- `DashboardShell`
- registry metadata
- presentational components

It should not require re-implementing:

- student queries
- subject queries
- report snapshot logic
- entitlement checks
- lockdown policy data access

## Constraints And Non-Goals

- Do not convert the app into a monorepo just for this.
- Do not adopt a global store first and then decide what the boundaries are.
- Do not redesign the entire UI before the shell contract is cleaner.
- Do not move every existing page into new folders in one pass.
- Do not combine this upgrade with a student-auth overhaul unless a phase explicitly depends on it.

## Recommended Order Relative To Other Docs

This upgrade should coordinate with:

- [subscriptions-and-entitlements.md](subscriptions-and-entitlements.md)
- [security-hardening.md](security-hardening.md)
- [mobile-app-implementation-plan.md](mobile-app-implementation-plan.md)
- [performance-and-bundle-splitting.md](performance-and-bundle-splitting.md)

Suggested sequencing:

1. build the route-backed shell and feature registry now that entitlement and trusted-backend work are already live
2. add shell slots before more dashboard-only assumptions land
3. extract domain hooks before any major visual rewrite
4. add the student access-policy layer before chores or other prerequisite blockers
5. keep future premium modules on the existing entitlement and trusted-backend rail

## Success Criteria

This upgrade is successful when:

- a new parent-facing module can be added primarily by registering a route and feature descriptor
- the parent shell no longer owns feature-specific business logic
- premium gating flows through a shared contract from nav to action to enforcement
- the student portal can evaluate prerequisites through one access-policy layer
- a future UI rewrite can remount existing feature modules without re-embedding Firestore logic
