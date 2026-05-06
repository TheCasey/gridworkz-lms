# GridWorkz Architecture

Last updated: 2026-05-06

## Stack

- Frontend: React 18 + Vite
- Styling: Tailwind CSS with custom visual styling inside components
- Backend: Firebase Auth + Firestore + Firebase Cloud Functions for trusted entitlement and billing flows
- Hosting target: Cloudflare Pages

## Application Shape

- Parent access is authenticated and lands in `/dashboard`.
- Student access is unauthenticated and lands in `/student/:slug`.
- The parent experience now uses a nested route-backed `/dashboard/*` shell with a shared feature registry and shell metadata contract.
- Lockdown now lives as its own dedicated dashboard module at `/dashboard/lockdown` instead of staying embedded inside the students surface.

Key files:

- `src/App.jsx`: route wiring and auth wrappers
- `src/pages/ParentDashboard.jsx`: parent shell and dashboard route-container logic
- `src/constants/dashboardFeatures.js`: registry-driven dashboard routes, shell metadata, and premium visibility state
- `src/pages/Lockdown.jsx`: dedicated Lockdown module routed through the dashboard shell
- `src/components/LockdownPolicyPanel.jsx`: saved lockdown prototype policy controls and pairing output
- `src/pages/Curriculum.jsx`: subject builder and editor
- `src/pages/Reports.jsx`: weekly reports and print/export behavior
- `src/pages/Settings.jsx`: school year and weekly reset settings
- `src/pages/StudentPortal.jsx`: student experience, timer flow, and block completion

## Data Model

Primary collections:

- `parents`
- `students`
- `subjects`
- `submissions`
- `weeklyReports`
- `dailyLogs`
- `timerSessions`
- `lockdownPolicies`

The schema source of truth is `src/constants/schema.js`.

Core hierarchy:

- Parent
- Student
- Subject assignment
- Submission stream
- Weekly report snapshot

Important modeling details:

- Subjects support multi-student assignment through `student_ids`.
- Student access is keyed by a generated slug and can be guarded by an optional `access_pin`.
- Weekly reports cache school-year and quarter labels for filtering and reporting.
- Timer sessions are stored in Firestore and mirrored in local storage for resilience.
- `lockdownPolicies` currently holds a parent-owned derived policy document for the extension PoC.

## Core Behaviors

### Weekly reset and reporting

- Week calculations live in `src/utils/weekUtils.js`.
- Parent settings define reset day, hour, minute, and timezone.
- Rollover currently runs from the parent dashboard client and updates report state from there.

### Timers

- Timer logic lives in `src/utils/timerUtils.js`.
- Timers are based on target end time, not interval drift.
- Student portal timers persist both locally and in `timerSessions`.

### Student portal access policy

- The student portal now evaluates subject visibility, timer start, and block submission through `src/hooks/useStudentAccessPolicy.js`.
- The access-policy layer returns structured allow or deny decisions plus reason metadata so future prerequisite modules can extend one shared contract.

### Settings and school-year metadata

- School settings helpers live in `src/utils/schoolSettingsUtils.js`.
- Settings drive quarter generation, report labels, and rollover timing.

## Security Posture

- Parent profile access is owner-scoped.
- Student and subject reads are public to support slug-based student access.
- Submission creation is currently public.
- Timer session access is guarded by data-shape checks plus student/subject assignment checks, but remains unauthenticated.
- `accountEntitlements/{uid}` is owner-readable but server-writable only, with writes now owned by the trusted billing webhook path.
- New student creates and new active-subject creates now run through trusted callable functions instead of direct Firestore client creates.
- `lockdownPolicies` still allows public unauthenticated `get` for the browser-extension PoC sync path, but create and update are now backstopped by the trusted entitlement record.

This is sufficient for the current public-portal model, but it is not a hardened long-term posture.

## Platform Gaps

- Stripe-backed billing sync and the trusted entitlement document now exist in sandbox mode, but live-mode payment rollout is still pending.
- The route-backed dashboard shell and premium gating boundaries are now in place, but future premium modules such as projects, chores, or billing still need to be built onto that shared contract.
- The lockdown extension still uses a PoC-grade public policy read path and does not yet have production-safe device trust or scoped policy access.

## Tooling State

- No automated test suite is configured.
- `npm run build` currently passes.
- `npm run lint` currently passes with the root ESLint config.
- A lightweight GitHub Actions workflow runs lint and build on push and pull request.

## Documentation Entry Points

- Product priorities: [roadmap.md](roadmap.md)
- Current status audit: [audits/baseline-plan-audit-2026-05-04.md](audits/baseline-plan-audit-2026-05-04.md)
- Feature docs: [features/README.md](features/README.md)
- Upgrade docs: [upgrades/README.md](upgrades/README.md)
