# Dashboard Shell And Navigation

Last updated: 2026-06-23

Status: Active planning spec

## Goal

Define the next dashboard shell structure so the parent experience is organized around:

- a persistent student overview at the top
- a clearer separation between school and chores domains
- expandable left navigation with section dashboards
- a persistent live pulse surface across the dashboard
- account settings as a dedicated top-right account action instead of a mixed catch-all page

This spec is about information architecture, navigation, and section ownership. It is not yet a detailed spec for curriculum, reports, chores, or billing behavior inside each section.

## Why This Needs Its Own Spec

The current dashboard shell is route-backed and functional, but it is still mostly a flat list of modules:

- Students
- Curriculum
- Reports
- Chores
- Settings
- Lockdown

That flat model is likely no longer the right structure for the product.

The next shell should group the app by domain so future pages have an obvious home and the parent does not need to infer where school planning ends and household planning begins.

## Locked Direction From Review

These decisions were provided during dashboard-shell review and should be treated as the working direction unless changed explicitly later.

### Overall left-nav structure

The left navigation should become domain-grouped.

Recommended top-level order:

1. `Students`
2. `Homeschool`
3. `Chores`
4. `Lockdown`

Locked direction:

- keep `Students` as the label instead of `Kids`

### Students top-level behavior

- Students stays at the top of the nav.
- Students remains the main parent overview and family dashboard.
- It should stay similar to the current overview model rather than becoming a buried subsection.

Expected role:

- student cards
- family overview
- quick understanding of who is on track
- live pulse access
- quick navigation into school and chores progress per student

### Homeschool top-level behavior

Clicking `Homeschool` should open a school dashboard page.

Expanding `Homeschool` should expose child pages:

- `Curriculum`
- `Weekly Blocking`
- `Reports`

Locked direction:

- keep `Weekly Blocking` as the working label for now

### Chores top-level behavior

Clicking `Chores` should open a chores dashboard page.

Expanding `Chores` should expose child pages:

- `Daily Routines`
- `Weekly Chores`
- `Monthly Chores`
- `Allowance`
- `Rewards`

### Lockdown behavior

- `Lockdown` remains below `Chores`
- it should remain visible
- it should use `coming soon` positioning in the shell during this launch phase

### Account access

The top-right dashboard chrome should include:

- `Account Settings`
- `Log Out`

`Account Settings` should sit to the left of `Log Out`.

Locked direction:

- `Account Settings` should be a full page route, not a modal

## Section Requirements

### 1. Students section

The `Students` page should remain the parent overview dashboard.

Required behavior:

- preserve the current “overview first” spirit
- each student card should include a `View progress` action for school
- each student card should include a `View progress` action for chores
- the page should work as the fastest entry point into child-specific progress

Open implementation question:

- whether `View progress` opens a filtered dashboard route, a student detail view, or deep-links into the school or chores section with student context applied

### 2. Live Pulse

Live Pulse should no longer be limited to the Students page.

Required behavior:

- Live Pulse should be persistent across the entire dashboard experience
- it should be hideable and expandable on demand
- showing it should not compress the main page content awkwardly
- it should support filtering by student
- it should support filtering by domain:
  - school
  - chores

Design intent:

- treat Live Pulse more like a persistent utility panel than a page-specific sidebar
- it should feel available everywhere without constantly taking over the layout

Locked direction:

- Live Pulse should use a persistent right-side drawer or utility panel model
- it should be closed by default
- its open/closed and filter state should persist while navigating the dashboard

### 3. Homeschool dashboard

The top-level `Homeschool` page should act as a school section dashboard.

Expected role:

- summarize the active school setup
- show quick links into curriculum, weekly blocking, and reports
- give the parent a clear picture of the current school planning state

This page should not try to replace the deeper work pages. It should be a section dashboard.

Focused follow-on spec:

- `docs/specs/homeschool-dashboard.md`

### 4. Curriculum

`Curriculum` should become the place where parents:

- add subjects
- add projects to those subjects
- add and organize school content as they think of it

Conceptually:

- Curriculum is the library and setup area
- it is not the final weekly assignment surface

This means parents should be able to capture and organize school content without immediately deciding the exact weekly block assignment.

### 5. Weekly Blocking

`Weekly Blocking` should be the place where parents:

- define how many blocks from each subject are assigned to each student
- pick the actual contents of those blocks
- assign resources, projects, or related content into each block
- save block plans as reusable templates

Template behavior direction:

- each student can have a default weekly-blocking template
- unless a parent overrides it, the default template should be the one that gets published
- parents should still be able to override or customize a given week before publish

Conceptually:

- Curriculum stores the available school material
- Weekly Blocking turns that material into the actual assigned week

### 6. Reports

`Reports` should be where parents view and print weekly reports.

Expected report categories from review:

- attendance-style reports that use planned block time and completed work to show attendance-style output
- fuller reports that show assignments, responses, and related weekly work evidence

This page should stay clearly report-focused rather than becoming a second curriculum or planning surface.

### 7. Chores dashboard

The top-level `Chores` page should become a section dashboard rather than the entire chores experience by itself.

Expected role:

- summary of chores status
- quick view of pending review, allowance state, rewards state, and routine/chore health
- section entry point into the deeper chores pages

### 8. Chores child pages

The chores area should split into dedicated pages:

- `Daily Routines`
- `Weekly Chores`
- `Monthly Chores`
- `Allowance`
- `Rewards`

Expected ownership:

- `Daily Routines`: recurring grouped routine setup and review
- `Weekly Chores`: weekly pool definitions and review
- `Monthly Chores`: monthly pool definitions and review
- `Allowance`: allowance policy, earned amounts, payouts, and ledger-oriented review
- `Rewards`: point/reward catalog, redemptions, fulfillment, and related settings

## Account Settings Direction

This review strongly suggests that the current `Settings` route may be too broad.

Recommended direction:

- create a dedicated `Account Settings` area reachable from the top-right account action
- move personal details, billing, subscription changes, password, and account-management actions there
- consider moving school-specific settings into the school domain instead of leaving them under a mixed settings page
- consider moving chores-specific settings into the chores domain instead of leaving them under a mixed settings page

This spec does not yet finalize the detailed structure of Account Settings. It only establishes the direction that it should be separated from school and chores configuration concerns.

## Navigation Model Requirements

The shell needs to support:

- top-level parent sections
- expand or collapse behavior for sections with child pages
- a section dashboard when the top-level item itself is clicked
- active state clarity for both the section and the specific child page
- visible locked and `coming soon` states for premium or deferred areas

Locked direction:

- after login, the default dashboard landing route should stay `Students`
- `Homeschool` and `Chores` should be expandable sections
- only one major expandable section should be open at a time

## Non-Goals

- Do not finalize detailed curriculum field design here.
- Do not finalize weekly-block template schema here.
- Do not finalize exact reports layouts here.
- Do not finalize chores subpage field-by-field behavior here.
- Do not finalize Lockdown implementation here.
- Do not finalize billing workflows here.

Those should each get their own focused specs after the shell structure is accepted.

## Expected Follow-On Specs

After this shell spec, likely focused specs are:

- students overview and student progress entry points
- homeschool dashboard
- curriculum and weekly blocking separation
- reports and attendance-style outputs
- chores dashboard and chores subpage breakdown
- account settings and billing
- live pulse persistent panel behavior

## Open Decisions For The Next Review Pass

These are the main unresolved questions that follow naturally from the shell direction:

1. What exactly should appear on the top-level `Chores` dashboard page?
2. How should the student-specific `View progress` actions behave?
