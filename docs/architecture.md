# GridWorkz Architecture

Last updated: 2026-05-11

## Stack

- Frontend: React 18 + Vite
- Styling: Tailwind CSS with custom visual styling inside components
- Backend: Firebase Auth + Firestore + Firebase Cloud Functions for trusted entitlement, Lockdown device trust, and billing flows
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
- `src/components/LockdownPolicyPanel.jsx`: student-bound Lockdown management surface, trusted pairing issuance, derived-policy visibility, and compatibility notes
- `src/firebase/trustedOperations.js`: parent-authenticated trusted enrollment issuance
- `extensions/chrome-lockdown-poc/background.js`: active MV3 trusted-device sync and cached enforcement runtime
- `extensions/chrome-lockdown-poc/policy.js`: pairing-state normalization, policy caching, and fallback helpers
- `src/pages/Curriculum.jsx`: subject builder and editor
- `src/pages/Reports.jsx`: weekly reports and print/export behavior
- `src/pages/Settings.jsx`: school year and weekly reset settings
- `src/pages/StudentPortal.jsx`: student experience, timer flow, and block completion

## Data Model

Primary collections:

- `accountEntitlements`
- `parents`
- `students`
- `subjects`
- `weeklyPlans`
- `submissions`
- `weeklyReports`
- `dailyLogs`
- `timerSessions`
- `lockdownPolicies`
- `lockdownEnrollmentSessions`
- `lockdownDevices`

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
- `accountEntitlements/{uid}` is the server-owned plan and feature source for premium surfaces such as Lockdown.
- `lockdownPolicies/{parentId}` now survives only as a compatibility snapshot and migration boundary; it is not the active runtime trust boundary for paired browsers.
- `lockdownEnrollmentSessions` stores short-lived server-owned trusted pairing tickets issued from `/dashboard/lockdown`.
- `lockdownDevices` stores server-owned device bindings plus opaque credentials consumed by credential-authenticated policy reads.

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

### Lockdown browser extension

- `/dashboard/lockdown` is the live parent-facing management surface for the Lockdown plan.
- Multi-student households must select a student explicitly before generating a trusted enrollment code.
- The browser extension exchanges a short-lived enrollment artifact through `lockdownExchangeEnrollment`, stores an opaque device credential, and reads policy through `readLockdownDevicePolicy`.
- Device policy is derived from published weekly-plan state, timer context, school-time rules, and student-bound off-hours windows.
- The extension keeps the last good policy cached locally so restart and temporary sync failure do not drop enforcement.

## Security Posture

- Parent profile access is owner-scoped.
- Student and subject reads are public to support slug-based student access.
- Submission creation is currently public.
- Timer session access is guarded by data-shape checks plus student/subject assignment checks, but remains unauthenticated.
- `accountEntitlements/{uid}` is owner-readable but server-writable only, with writes now owned by the trusted billing webhook path.
- New student creates and new active-subject creates now run through trusted callable functions instead of direct Firestore client creates.
- Active Lockdown pairing and sync no longer rely on public Firestore reads or raw Firebase web config. `lockdownEnrollmentSessions` and `lockdownDevices` are server-owned only, and paired browsers sync through trusted Cloud Function endpoints.
- `lockdownPolicies/{parentId}` still allows a public compatibility snapshot read, but that path is now migration-boundary history rather than the active device-policy trust boundary.

This is sufficient for the current browser-extension launch path, but the broader student portal and public compatibility surfaces are not a hardened long-term posture.

## Platform Gaps

- Stripe-backed billing sync and the trusted entitlement document now exist in sandbox mode, but live-mode payment rollout is still pending.
- The route-backed dashboard shell and premium gating boundaries are now in place, but future premium modules such as projects, chores, or billing still need to be built onto that shared contract.
- The browser-extension track is now live on the trusted device contract. Follow-on Lockdown scope is kiosk mode, broader rollout hardening, and eventual retirement of compatibility-only snapshot paths.
- Broader student-flow hardening still remains outside the Lockdown launch scope, especially around public reads and unauthenticated timer or submission behavior.

## Tooling State

- No automated test suite is configured.
- `npm run build` currently passes.
- `npm run lint` currently passes with the root ESLint config.
- A lightweight GitHub Actions workflow runs lint and build on push and pull request.

## Documentation Entry Points

- Product priorities: [roadmap.md](roadmap.md)
- Product baseline planning: [upgrades/baseline-product-foundation.md](upgrades/baseline-product-foundation.md)
- Current status audit: [audits/baseline-plan-audit-2026-05-04.md](audits/baseline-plan-audit-2026-05-04.md)
- Feature docs: [features/README.md](features/README.md)
- Upgrade docs: [upgrades/README.md](upgrades/README.md)
