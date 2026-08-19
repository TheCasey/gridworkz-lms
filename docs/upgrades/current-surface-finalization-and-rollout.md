# Current Surface Finalization And Rollout

Last updated: 2026-06-23

Status: Active planning guide

## Goal

Create a practical finalization checklist for the current product surface so work can move one module at a time from:

- feature exists
- feature behavior is fully defined
- implementation phases are scaffolded
- validation is run
- production rollout happens before the next major surface starts

This doc is intentionally focused on the current app, not the longer-term product redesign. Use it to prepare future implementation chats and plan scaffolds.

## Near-Term Release Stance

Current product-direction decision:

- stand up the first paid Core plan at `$5/month`
- treat the Lockdown `$10/month` plan as `coming soon` in public-facing messaging until extension and kiosk follow-on work are ready
- focus immediate product definition and rollout energy on the existing parent dashboard, student portal, reports, settings, and chores/rewards surfaces
- avoid reopening Lockdown implementation as the primary release blocker for the first paid launch

Implications:

- keep stable internal plan ids as `free`, `core`, and `lockdown`
- use `Core` as the public plan name for now
- keep the entitlement rail and locked-state UI support for Lockdown in code
- do not market Lockdown as ready for broad paid reliance yet
- keep Lockdown visibly present in pricing and dashboard locked states as a `coming soon` attractor, not a hidden tier
- treat kiosk mode, extension hardening, and Chrome Web Store work as a later dedicated stream

## How To Use This Doc

Use this doc before opening an implementation chat.

1. Pick one shipping unit from the sequence below.
2. Finalize the open product and UX decisions for that unit.
3. Turn those decisions into a focused spec or upgrade doc if they do not already exist.
4. Open a new implementation chat against that focused doc.
5. After the implementation chat, scaffold plan phases only for that narrowed scope.
6. Push that unit through validation and production before starting the next mostly independent unit.

When a unit touches more than one route, define the whole linked surface first and ship it together.

## Recommended Shipping Units

| Unit | Routes and surfaces | Ship alone? | Notes |
| --- | --- | --- | --- |
| Core pricing and plan messaging | `/`, `/login`, `/dashboard/settings`, dashboard nav locked states, plan copy in chores and Lockdown surfaces | No | This should move together so public copy, account copy, and locked-state behavior match. Focused spec: `docs/specs/core-pricing-and-launch-positioning.md`. |
| Students and dashboard shell | `/dashboard/students`, shared shell header, add-student flow, plan-usage notice | No | Dashboard information architecture may change enough that shell, section grouping, and students landing behavior should be defined together first. Focused spec: `docs/specs/dashboard-shell-and-navigation.md`. |
| Curriculum and weekly planning | `/dashboard/curriculum`, weekly-plan review/publish, related dashboard shell copy | Usually | Keep this linked to any student school-work changes that rely on the same weekly-plan contract. |
| Student school workspace | `/student/:slug` school area, timers, resources, submission flow | Usually with curriculum | Ship together when the parent planning model changes the student experience. |
| Reports and rollover | `/dashboard/reports`, rollover behavior, report-facing settings dependencies | No | Reporting, report labels, and rollover timing should be finalized as one unit. |
| Chores and rewards parent surface | `/dashboard/chores` parent setup and review surfaces | Sometimes | Can ship first if student-facing changes are small or unchanged. |
| Chores and rewards student surface | `/student/:slug` chores and rewards areas | Usually with parent chores changes | Ship with the parent changes whenever parent setup affects the student flow or reward semantics. |
| Settings and account surface | `/dashboard/settings`, billing summary, support copy, school-year rules | No | Do not finalize this in isolation until the shell, section grouping, and ownership of school vs chores settings are decided. |
| Operator and support readiness | `/ops/entitlements`, runbooks, seeded smoke, support flows | No | Ship only when the linked customer-facing unit is already defined. |
| Lockdown follow-on | `/dashboard/lockdown`, extension, kiosk-mode planning | Later | Not part of the first paid-launch focus. Treat as a separate future stream. |

## Page And Option Finalization Checklist

Use the sections below as the master inventory of what should be explicitly decided before implementation starts.

### Marketing Home `/`

Source files:

- `src/pages/MarketingHome.jsx`
- `docs/specs/public-marketing-site-and-landing-page.md`

Finalize:

- headline, subheadline, and product promise
- screenshot or illustration plan for each major section
- pricing presentation for Free, Core `$5/month`, and Lockdown `coming soon`
- Lockdown should appear as a visible `coming soon` tier or card, not a hidden future mention
- CTA destinations for start free trial, create account, and learn more
- feature comparison table and exact row labels
- FAQ topics and support contact path
- claims that must stay out of copy until validated, especially around Lockdown

### Login `/login`

Source file:

- `src/pages/LoginPage.jsx`

Finalize:

- account creation vs sign-in emphasis
- plan and pricing references on the auth screen
- password reset, verification, and error-state copy
- post-login redirect expectations for new vs returning parents
- whether Lockdown or chores are mentioned before account creation

### Dashboard Shell `/dashboard/*`

Source files:

- `src/pages/ParentDashboard.jsx`
- `src/constants/dashboardFeatures.js`

Finalize:

- nav order and labels
- whether the left nav should stay flat or shift to grouped top-level sections such as `School` and `Chores`
- if grouped nav is adopted, whether clicking the top-level item lands on a section dashboard while expand/collapse reveals child pages
- proposed school child pages such as curriculum, reports, and related school-facing tools
- proposed chores child pages such as daily routines, weekly chores, monthly chores, allowance, and rewards
- which locked modules remain visible with upgrade or coming-soon states; Lockdown should remain visible as `coming soon`
- shell header actions by route
- right-rail usage and whether Live Pulse stays only on Students
- empty-state language shared across dashboard routes
- usage and plan notices shown in the shell vs inside each page

Structural note from review:

- the current flat dashboard navigation may not be the right long-term shape
- a stronger candidate is a grouped left-nav model where `School` and `Chores` are top-level sections
- clicking `School` or `Chores` would open a section dashboard
- expanding those items would expose more focused child pages for direct navigation

### Students `/dashboard/students`

Source files:

- `src/pages/dashboard/StudentsRoute.jsx`
- `src/components/StudentCard.jsx`
- `src/components/AddStudentModal.jsx`

Finalize:

- student card fields and priority order
- what “progress this week” means and how it is shown
- add-student modal fields, defaults, helper text, and limits messaging
- student PIN creation and edit behavior
- slug visibility and parent-facing explanation
- archive/delete/disable expectations if you want them exposed later
- manual completion controls and whether they stay here
- weekly-report download or quick-link behavior from this page

### Curriculum `/dashboard/curriculum`

Source files:

- `src/pages/Curriculum.jsx`
- `src/components/curriculum/BlockObjectivesEditor.jsx`
- `src/components/curriculum/WeeklyPlanReviewPanel.jsx`

Finalize:

- page layout and section hierarchy
- subject creation fields and required defaults
- multi-student assignment behavior
- block editor terminology, steps, and save behavior
- archive, duplicate, delete, and destructive confirmation behavior
- weekly-plan generation, review, publish, republish, and reset behavior
- empty states for no subjects, no students, and no published week
- what remains compatibility-only vs what should feel first-class in the UI

### Reports `/dashboard/reports`

Source files:

- `src/pages/Reports.jsx`
- `src/utils/reportUtils.js`

Finalize:

- list view vs detail view information density
- filters, default week selection, and school-year labels
- exact difference between save, print, export, and archival states
- incomplete-week record behavior and parent-facing explanation
- assigned-block snapshot visibility and wording
- locking, editing, or overwrite rules for saved reports
- empty states for no report, no submissions, and no published week

### Chores Parent `/dashboard/chores`

Source files:

- `src/pages/dashboard/ChoresRoute.jsx`
- `src/hooks/useChoreSetup.js`

Finalize:

- parent information architecture for routines, chores, quotas, allowance, points, rewards, and review
- whether setup is one long page, tabbed sections, or compact summary cards
- routine template structure and per-student customization rules
- weekly and monthly chore creation fields
- quota configuration model and parent warnings
- allowance policy wording, cadence, and ledger visibility
- points settings and whether school points stay configurable now
- reward creation fields, stock behavior, approval behavior, and fulfillment language
- downgrade locked-state copy for Free vs Core

### Settings `/dashboard/settings`

Source files:

- `src/pages/dashboard/SettingsRoute.jsx`
- `src/pages/Settings.jsx`

Finalize:

- account summary layout
- plan, usage, and upgrade messaging
- where billing status and future checkout entry should live
- whether this route should narrow into account settings only
- whether school-year setup should move into the school or curriculum area instead of staying under Settings
- whether chores-specific settings should live inside the chores area instead of staying under Settings
- if Settings stays broader, which configuration areas still belong here
- if Settings narrows, what exact information architecture replaces the current mixed account plus school setup model
- support, feedback, and account-management actions

Structural note from review:

- Settings may need to become primarily account settings
- school settings may belong under the school or curriculum area
- chore settings may belong inside the chores area
- do not finalize `/dashboard/settings` in isolation until the dashboard navigation and section model are chosen

### Lockdown `/dashboard/lockdown`

Source files:

- `src/pages/Lockdown.jsx`
- `src/components/LockdownPolicyPanel.jsx`

Finalize:

- the route should stay visible as `coming soon`, not hidden, for non-Lockdown accounts
- coming-soon copy and CTA
- what current parents see if they already have saved Lockdown state
- what support or internal users should be able to inspect before general rollout
- which docs and public pages are allowed to mention Lockdown while it is not an active paid launch path

### Operator Support `/ops/entitlements`

Source files:

- `src/pages/OpsEntitlements.jsx`
- `src/components/ops/operatorEntitlementUi.js`

Finalize:

- whether the current operator console is “internal ready” or still needs UX cleanup before routine use
- required support runbook steps for overrides and downgrade recovery
- seeded validation expectations before relying on it for live customer support

### Student Portal `/student/:slug` School Area

Source files:

- `src/pages/StudentPortal.jsx`
- `src/hooks/useStudentAccessPolicy.js`
- `src/utils/timerUtils.js`

Finalize:

- PIN gate copy and retry behavior
- page structure for School, Chores, and Rewards sections
- “what should I do next?” guidance
- timer start, pause, resume, and completion behavior
- required summary, resource-used, and custom-field submission expectations
- no-published-plan and no-active-work states
- how much weekly-plan language should surface to the student
- mobile layout expectations

### Student Portal Chores And Rewards

Source files:

- `src/pages/StudentPortal.jsx`
- `src/components/student/StudentChoresWorkspace.jsx`
- `src/components/StudentRewardStore.jsx`
- `src/hooks/useStudentChores.js`

Finalize:

- tab labels and order
- daily routine completion flow
- claim vs complete flow for chores
- approval-pending and returned chore states
- allowance-earned visibility
- points wallet terminology
- reward-store browsing, request, approval, and fulfillment states
- privacy boundaries for sibling data and household totals

## Cross-Cutting Decisions To Lock Before Implementation

These questions affect multiple pages and should be settled before route-level execution starts.

### Packaging And Messaging

- exact Free plan value proposition
- exact Core `$5/month` feature set shown publicly
- `Core` is the public name for now, while leaving room for a later split such as school-only, chores-only, or combined variants
- exact Lockdown `coming soon` phrasing and CTA behavior

### Shared UX Rules

- empty-state style direction
- destructive action pattern
- locked-state pattern
- success and saved-state feedback pattern
- form density and mobile expectations

### Dashboard Information Architecture

- whether the dashboard stays a flat route list or becomes grouped by domain
- whether `School` and `Chores` become top-level parent sections
- whether section dashboards should exist for top-level clicks
- how far to split chores into dedicated subpages vs one large parent page
- whether Settings becomes account-only after those section pages absorb their own configuration controls

### Rollout And Validation

- what counts as sufficient local validation for each unit
- which units require seeded emulator or staging data
- which units require manual browser QA before production
- whether a unit needs support-runbook updates before rollout

## Recommended Near-Term Sequence

Use this order unless a later decision changes the dependencies.

1. Core pricing, plan messaging, and Lockdown coming-soon positioning.
2. Dashboard information architecture, nav grouping, and section-level page model.
3. Students dashboard and add-student flow polish.
4. Curriculum and weekly-planning finalization.
5. Student school workspace aligned to the chosen planning model.
6. Reports and rollover finalization.
7. Chores and rewards parent surface.
8. Chores and rewards student surface.
9. Settings account surface once the surrounding nav and settings ownership model are settled.
10. Operator, seeded-smoke, and support readiness for the customer-facing units already shipped.
11. Lockdown return pass after the core paid launch is stable.

## Suggested Handoff Packet For Future Chats

Before opening a new chat, prepare these items:

- shipping unit name
- exact routes and files in scope
- decisions already locked
- decisions still open
- explicit non-goals
- data model or rules changes allowed or not allowed
- validation bar for local, staging, and production
- whether the unit should ship alone or with linked surfaces

If the packet is still broad after writing it down, the scope is probably too large for one implementation workflow.
