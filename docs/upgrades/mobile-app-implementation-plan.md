# GridWorkz Mobile App Implementation Plan

## Goal

Build native-feeling iOS and Android apps for GridWorkz that replace the need to manage the parent dashboard through the website and improve the student experience on phones and tablets.

This plan assumes two mobile products:

1. `GridWorkz Parent` for authenticated parents
2. `GridWorkz Student` for student use with simplified access

The current web app already separates those concerns at the route and data-access level:

- Parent experience: `/dashboard` with Firebase Auth
- Student experience: `/student/:slug` with public slug access and optional PIN

Because the user types, navigation models, and security expectations differ, splitting into two apps is cleaner than forcing both into one shell.

## Recommended Technical Direction

Use `React Native + Expo` for both apps.

Why this is the best fit for this repo:

- Current product is already React-based, so team familiarity transfers
- Firebase has strong React Native support for Auth and Firestore
- One shared mobile codebase can target iOS and Android
- Expo reduces native setup friction for notifications, builds, and store packaging
- Shared domain logic can be extracted from the existing web app instead of rewriting from scratch

Do not start with a WebView wrapper.

Reasons:

- The parent dashboard is desktop-shaped today and would remain cramped in a wrapper
- Student timer, offline behavior, notifications, and deep links are better handled natively
- App-store quality will be materially better with native navigation and layouts

## Product Scope Recommendation

### Phase 1 apps

Build both apps, but ship the parent app first.

Order:

1. Parent mobile app MVP
2. Student mobile app MVP
3. Shared backend hardening
4. Native-only enhancements

This order works because:

- Parent dashboard is the explicit business pain today
- Parent workflows are more operational and easier to convert into list/detail mobile patterns
- Student portal has more timer, notification, and session-state complexity

## Current Web Features To Map

### Parent app should cover

- Login / logout / password reset
- Student list and student details
- Add / archive / delete student
- Curriculum management
- Subject creation and editing
- Weekly progress overview
- Live activity feed
- Submission detail review
- Manual block completion
- Weekly report browsing
- Settings for school year, timezone, and weekly reset

### Student app should cover

- Student access by slug or invite code
- Optional PIN gate
- Subject list
- Block completion workflow
- Required summary input
- Resource attribution
- Custom field responses
- Timer start / pause / resume / complete
- Alarm sound / notification behavior
- Weekly progress view

## Architecture Plan

## 1. Create a monorepo-style structure

Recommended target structure:

```text
/src                     # existing web app
/mobile
  /apps
    /parent
    /student
  /packages
    /core
    /firebase
    /ui
```

Purpose of each shared package:

- `core`: schema types, week utilities, report utilities, timer utilities, validation helpers
- `firebase`: Firestore/Auth wrappers, query helpers, document mapping
- `ui`: shared design tokens, colors, spacing, icon mapping, reusable cards and badges where appropriate

## 2. Extract reusable business logic from the web app

Move logic out of page files and into shared modules before or during the mobile build.

Best extraction candidates from current codebase:

- `src/constants/schema.js`
- `src/utils/weekUtils.js`
- `src/utils/timerUtils.js`
- `src/utils/reportUtils.js`
- `src/utils/schoolSettingsUtils.js`

Additional extraction needed:

- Parent dashboard query logic
- Student subject/progress derivation logic
- Weekly rollover/report creation logic
- Submission creation/update/reset helpers

Goal:

- UI files should stop owning data rules directly
- mobile and web should both call the same domain-layer functions

## 3. Normalize data access behind service functions

Create service modules for:

- `parents`
- `students`
- `subjects`
- `submissions`
- `weeklyReports`
- `timerSessions`

Example responsibilities:

- subscribe to parent students
- subscribe to weekly submissions
- create/update subject
- create manual completion submission
- save timer session
- generate weekly report payload

This prevents mobile screens from duplicating Firestore query details from web page components.

## 4. Introduce explicit mobile navigation models

Parent app:

- Bottom tabs: Home, Students, Curriculum, Reports, Settings
- Stack navigation inside each tab

Student app:

- Home
- Subject detail
- Active timer / block flow
- History / progress
- Settings

## 5. Add mobile-safe state management

Current app uses page-local state plus contexts. That is acceptable for web, but mobile navigation needs more durable screen-to-screen state.

Recommended:

- Keep auth/theme in context
- Use React Query or Zustand for mobile server/cache state

Preferred choice: `@tanstack/react-query`

Reasons:

- better async cache behavior for Firestore-backed screens
- easier loading/error/refetch states
- safer background refocus behavior

Realtime listeners can still be used where needed, but they should feed structured hooks instead of being embedded in screen components.

## Backend and Security Changes Required

The mobile apps should not launch on top of the current permissive Firestore rule posture.

Current risk from repo notes:

- `students`, `subjects`, and `submissions` are currently open read/write

Required backend work before public release:

1. Lock all parent-owned collections to authenticated parent ownership
2. Replace public student slug access with one of these patterns:
   - custom auth tokens for students
   - one-time invite codes exchanged for device sessions
   - parent-approved device pairing flow
3. Restrict timer session access by parent or student identity
4. Add server-side validation for report creation and rollover writes
5. Move sensitive workflow logic into Firebase Functions where trust boundaries matter

Recommended new backend additions:

- Firebase Functions for:
  - generating secure student session tokens
  - weekly rollover/report archival
  - push notification triggers
  - optional invite creation / revoke flows

## Authentication Strategy

### Parent app

- Continue using Firebase email/password
- Add biometric unlock after first login
- Persist session on device

### Student app

Do not keep the current open `/student/:slug` model unchanged for native apps.

Recommended student auth flow:

1. Parent creates student invite from parent app
2. Invite is represented by QR code or short code
3. Student app enters/scans code
4. Backend exchanges invite for device-bound student session
5. Optional PIN remains as a quick local unlock

This is materially safer than relying on a shareable public slug inside an installable app.

## Mobile-Specific Features

### Phase 1

- Native bottom tab navigation
- Push notifications for timer completion
- Deep links for parent invites and student pairing
- Offline caching for last-loaded student/subject/report data
- Pull-to-refresh

### Phase 2

- Local notifications for timer milestones
- Background resume of in-progress timers
- Share/export report PDFs
- Parent approval flows for resets or exceptions
- Tablet-specific split view layouts

### Phase 3

- Widgets / live activities for active timers
- Parent digest notifications
- Teacher or co-parent account roles

## Delivery Phases

## Phase 0: Discovery and hardening

Estimated outcome:

- final app information architecture
- mobile data contract
- Firestore rules redesign
- shared package extraction plan

Tasks:

- inventory every parent and student workflow
- identify which utilities can be shared unchanged
- define mobile auth/session strategy
- define push notification requirements
- redesign Firestore security rules

## Phase 1: Shared foundation

Estimated outcome:

- mobile workspace scaffolding
- shared packages in place
- reusable query/service layer

Tasks:

- create Expo app workspace
- extract core utilities from web
- create typed models for all collections
- add query/service modules
- implement auth bootstrap and theme tokens

## Phase 2: Parent app MVP

Estimated outcome:

- app-store testable parent experience

MVP screens:

- login
- dashboard home
- student list
- student detail
- curriculum list
- subject create/edit
- reports list/detail
- settings

Parent MVP exclusions:

- advanced print layouts inside app
- full parity with every web modal on day one

## Phase 3: Student app MVP

Estimated outcome:

- installable student workflow with timer and submission support

MVP screens:

- invite/pairing
- PIN unlock
- subject list
- block detail
- active timer
- summary/custom response submission
- weekly progress

## Phase 4: Backend completion

Tasks:

- Firebase Functions for privileged flows
- push notification plumbing
- analytics and crash reporting
- app-store configuration

## Phase 5: Beta and store launch

Tasks:

- TestFlight + Android internal testing
- parent beta cohort
- performance tuning
- store listing assets
- privacy policy and support links

## Suggested Build Sequence By Feature

1. Shared models and utilities
2. Parent auth and session bootstrap
3. Parent student list/detail
4. Subject CRUD
5. Reports read experience
6. Student pairing/auth model
7. Student subject list and progress
8. Timer engine and local notifications
9. Submission flow
10. Security rule lockdown and beta rollout

## Key Risks

### 1. Security model mismatch

The current student web access model is convenient, but it is too loose for a polished mobile app release.

### 2. Page-owned Firestore queries

The current architecture embeds query logic directly in page files. That will slow mobile development unless it is extracted first.

### 3. Timer portability

The timer is already more advanced than a simple interval, but mobile background behavior, app suspension, and notification timing still need device-native handling.

### 4. Reports and printing

Current report generation is browser-based. Mobile should initially focus on readable report views and export later, not duplicate browser print behavior immediately.

## UX/Product Recommendations

- Keep the parent app focused on monitoring, editing, and approvals
- Keep the student app focused on one next action at a time
- Avoid copying the desktop dashboard layout directly
- Prefer list/detail flows, large touch targets, and persistent progress summaries
- Treat tablets as a first-class second layout, not the default layout

## Team Recommendation

If only one app can be funded first, build `GridWorkz Parent` first.

If both are being built together, staff workstreams as:

1. Shared architecture + backend/security
2. Parent app UI + flows
3. Student timer/submission flows

## Definition of Done For MVP

Parent app MVP is done when a parent can:

- sign in
- manage students
- manage subjects
- monitor weekly progress
- review submission details
- read reports
- update school settings

Student app MVP is done when a student can:

- securely access their account on-device
- see assigned subjects
- run a timer
- submit completed blocks with required details
- review weekly progress

## Final Recommendation

Build two Expo apps backed by a shared mobile core, not a single WebView wrapper.

Start by extracting business logic from the current React SPA and tightening Firestore security. Then ship the parent app MVP first, followed by the student app once secure mobile student access and timer notifications are in place.
