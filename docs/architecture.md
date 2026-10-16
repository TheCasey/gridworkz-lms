# GridWorkz Architecture

Last updated: 2026-10-15

## Stack

- Frontend: React 18 + Vite
- Styling: Tailwind CSS with custom visual styling inside components
- Backend: Firebase Auth + Firestore + Firebase Cloud Functions for trusted entitlement, Lockdown device trust, and billing flows
- Hosting target: Cloudflare Pages

## Application Shape

- Public marketing lands on the root Own Path domain.
- Parent access is authenticated and lands in `/dashboard`, with production traffic routed through `dashboard.own-path.com`.
- Student access is unauthenticated and lands in `/student/:slug`, with magic links generated against the public Own Path domain.
- The parent experience now uses a nested route-backed `/dashboard/*` shell with a shared feature registry and shell metadata contract.
- Lockdown now lives as its own dedicated dashboard module at `/dashboard/lockdown` instead of staying embedded inside the students surface.
- Internal operator support access is available at `/ops/entitlements` for allowlisted support users.

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
- `src/components/curriculum/WeeklyPlanReviewPanel.jsx`: current parent weekly-plan generation, review, and publish surface
- `src/components/curriculum/BlockObjectivesEditor.jsx`: compact subject modal block-objective editor
- `src/pages/Reports.jsx`: weekly reports and print/export behavior
- `src/pages/OpsEntitlements.jsx`: operator-only entitlement inspection and support override console
- `src/pages/Settings.jsx`: school year and weekly reset settings
- `src/pages/StudentPortal.jsx`: student experience, timer flow, and block completion
- `src/pages/dashboard/ChoresRoute.jsx`: parent chores/rewards setup, paid/free UI gating, allowance/points/reward review
- `src/hooks/useStudentChores.js`: PIN-verified trusted student chore/reward state and mutations

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
- `supportOperators`
- `entitlementAuditLogs`

The schema source of truth is `src/constants/schema.js`.

Core hierarchy:

- Parent
- Student
- Subject compatibility input
- Weekly plan
- Submission stream
- Weekly report snapshot

Important modeling details:

- Subjects support multi-student assignment through `student_ids`.
- Student access is keyed by a generated slug and can be guarded by an optional `access_pin`.
- `weeklyPlans` remain the published/archived student-week authority. The routine-first implementation keeps private drafts in `weeklyPlanDrafts` and per-student defaults in `studentDefaultWeeks`; trusted callables save current editor contents with revision checks and atomically publish an allowlisted snapshot. Private retry receipts remain owner-readable/server-writable. Production promotion is pending.
- Weekly reports cache school-year and quarter labels for filtering and reporting, and weekly-plan-backed records can preserve assigned block snapshots in `assigned_blocks_snapshot`.
- The routine-first implementation uses a trusted singleton school timer in `timerSessions/{studentId}`. Server-issued context and elapsed time govern completion; the student device renders the countdown against the returned server clock. Old local-storage/per-subject timer records remain compatibility inputs only before adoption. Production promotion is pending.
- `accountEntitlements/{uid}` is the server-owned plan and feature source for premium surfaces such as Lockdown.
- `supportOperators/{uid}` is the server-owned allowlist for operator callables.
- `entitlementAuditLogs` stores billing and operator entitlement events.
- `lockdownPolicies/{parentId}` now survives only as a compatibility snapshot and migration boundary; it is not the active runtime trust boundary for paired browsers.
- `lockdownEnrollmentSessions` stores short-lived server-owned trusted pairing tickets issued from `/dashboard/lockdown`.
- `lockdownDevices` stores server-owned device bindings plus opaque credentials consumed by credential-authenticated policy reads.
- `routineTemplates`, `routineCompletions`, `choreDefinitions`, `choreClaims`, `choreCompletions`, `choreSettings`, `allowancePeriods`, `rewardSettings`, `pointLedgerEntries`, `studentPointWallets`, `rewardCatalogItems`, and `rewardRedemptions` back the implemented chores/rewards module.

## Core Behaviors

### Weekly reset and reporting

- Week calculations live in `src/utils/weekUtils.js`.
- Parent settings define reset day, hour, minute, and timezone.
- Rollover currently runs from the parent dashboard client and updates report state from there.
- Reports use published/archived `weeklyPlans`; private drafts never become report input. Adopted current weeks without a publication have no assigned work. Pre-adoption subject history remains reportable. Rollover archives both legacy and v1 publications through the trusted adapter.
- Report print builders escape report strings before writing print HTML.
- `scripts/seed-reporting-validation.mjs --dry-run` generates the current manual QA fixture for incomplete-week records, assigned block snapshots, student portal checks, and rollover archival expectations.

### Weekly planning bridge

- Weekly-plan contracts and helpers live in `src/constants/schema.js` and `src/utils/weeklyPlanUtils.js`.
- `src/hooks/useWeeklyPlanRecord.js` owns the parent review/publish record path.
- `src/hooks/useStudentPortalWeeklyPlan.js` refreshes its listener at the household weekly boundary. Server-owned per-student planning adoption prevents raw-subject fallback for empty/missing current publications; unadopted students retain legacy compatibility.
- The current subject editor remains the compatibility input; persisted first-class curriculum templates and assignment management are not built out yet.

### Timers

- Timer logic lives in `src/utils/timerUtils.js`.
- Timers are based on target end time, not interval drift.
- Student portal timers persist both locally and in `timerSessions`.
- Timer sessions are scoped to their student week, published weekly plan, block identity and planned duration. The portal removes unavailable/completed sessions and sessions whose timer requirement or duration changed. Non-timed blocks show direct completion and may finish while a different block’s timer continues.

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

### Chores and rewards

- `/dashboard/chores` is route-backed through the shared dashboard feature registry.
- Free accounts can manage and complete daily routines only. Morning, Afternoon, and Evening are canonical per-student periods backed by `routineTemplates`; legacy shared/grouped templates remain compatibility-readable until a per-student period record supersedes them. Parents edit one checklist item at a time, and multi-student adds create independent copies.
- Routine allowance progress and routine point awards use a full-day contract: all populated routine periods for the student must be complete for the date. The single point award is idempotent on `routine_day:<date_key>`; individual items and periods do not carry separate eligibility decisions in the parent flow.
- Core/Pro and Lockdown include the full paid module: chore pools, weekly/monthly chores, allowance tracking, points, reward-store behavior, redemptions, achievements, and related placeholder cosmetics.
- Downgrade behavior is non-destructive: saved paid records remain parent-readable, but new paid setup, allowance sync, point changes, chore review, and reward/redemption mutations are blocked by UI state and trusted callable entitlement checks.
- Student chores/rewards access uses PIN-verified trusted callables. The student-safe response is scoped to the active student; Free responses omit chore pools, allowance, wallets, rewards, and redemptions.
- School-block point awards remain deferred until school completion moves to a trusted server-owned flow.

## Security Posture

- Parent profile access is owner-scoped.
- Student and subject reads are public to support slug-based student access.
- Submission creation is currently public.
- Timer session access is guarded by data-shape checks plus student/subject assignment checks, but remains unauthenticated.
- `accountEntitlements/{uid}` is owner-readable but server-writable only, with writes now owned by the trusted billing webhook path.
- `supportOperators` and `entitlementAuditLogs` are server-owned; operator reads and writes go through trusted Cloud Functions, not direct client Firestore writes.
- New student creates and new active-subject creates now run through trusted callable functions instead of direct Firestore client creates.
- Active Lockdown pairing and sync no longer rely on public Firestore reads or raw Firebase web config. `lockdownEnrollmentSessions` and `lockdownDevices` are server-owned only, and paired browsers sync through trusted Cloud Function endpoints.
- `lockdownPolicies/{parentId}` still allows a public compatibility snapshot read, but that path is now migration-boundary history rather than the active device-policy trust boundary.
- Chores/rewards collection writes are denied in Firestore rules and served through trusted callables. Parent reads are owner-scoped; public student portal reads cannot enumerate household chore/reward state.

This is sufficient for the current browser-extension launch path, but the broader student portal and public compatibility surfaces are not a hardened long-term posture.

## Platform Gaps

- Stripe-backed billing sync, the trusted entitlement document, and the operator entitlement console now exist in sandbox mode, but live-mode payment rollout and seeded operator validation are still pending.
- The route-backed dashboard shell and premium gating boundaries are now in place. Projects and any later paid surfaces should continue building on that shared contract; chores/rewards already do.
- Chores/rewards trusted callables are deployed in production. Local seeded E2E covers privacy, entitlements, cooldowns, allowance, points, redemptions, and parent/student behavior; a non-mutating production smoke confirms live callable routing and authentication/PIN validation. Any destructive production validation should use a disposable household.
- Longer-term student-session hardening remains open because the module still relies on PIN-verified public student slug context.
- The weekly-plan compatibility bridge is live, but persisted curriculum template management, assignment management, richer projects, worksheet runtime, and full compliance reporting are still future work.
- The browser-extension track is now live on the trusted device contract. Follow-on Lockdown scope is kiosk mode, broader rollout hardening, and eventual retirement of compatibility-only snapshot paths.
- Broader student-flow hardening still remains outside the Lockdown launch scope, especially around public reads and unauthenticated timer or submission behavior.

## Tooling State

- Focused helper checks and an isolated Auth/Firestore/Functions + Chromium harness now support the routine-first execution. See [testing instructions](upgrades/product-direction-execution/testing.md).
- Routine/cosmetic and private draft/default authority and interfaces are locally implemented and verified. Correction/amendment contracts remain preparatory; production consumers have not been switched. See [contract boundaries](upgrades/product-direction-execution/contracts.md).
- `npm run build` currently passes.
- `npm run lint` currently passes with the root ESLint config.
- A lightweight GitHub Actions workflow runs lint and build on push and pull request.

## Documentation Entry Points

- Product priorities: [roadmap.md](roadmap.md)
- Product baseline planning: [upgrades/baseline-product-foundation.md](upgrades/baseline-product-foundation.md)
- Current status audit: [audits/baseline-plan-audit-2026-05-04.md](audits/baseline-plan-audit-2026-05-04.md)
- Feature docs: [features/README.md](features/README.md)
- Implemented chores and rewards module: [specs/chores-and-rewards-module.md](specs/chores-and-rewards-module.md)
- Upgrade docs: [upgrades/README.md](upgrades/README.md)

## Trusted School Completion (routine-first implementation; release pending)

`functions/src/schoolCompletionAuthority.js` owns PIN-verified school reads, student submissions/timers and authenticated parent corrections. Immutable evidence remains in `submissions`; `blockCompletionStates` stores effective status, and `parentCorrectionEvents` plus `schoolStateHistory` retain audit history. Commands use revision checks and private idempotency receipts. Public student markers invalidate reads across devices. The server returns the canonical household school week, so device clock skew cannot advance the assignment week or grant elapsed timer time.

A missing legacy execution freezes separately in private `schoolExecutionSnapshots`. First publication uses a private immutable `schoolPublicationBridges` record and exact one-to-one `legacy_source_links` to preserve executed work. Ambiguous pre-existing draft identities require parent reconciliation. Canonical states take precedence over inherited baselines; publication-era blocks cannot inherit unrelated subject/index evidence. Missing/empty adopted weeks stay empty.

`useParentSchoolState`, the student adapter, report snapshot builders and trusted Lockdown policy share effective state semantics. Parent corrections never fabricate student submissions or time. Saved original reports cannot update; explicit `weeklyReportAmendments` and private amendment heads provide versioned changes. Historical reports without reliable assignment attribution require review and retain their original numerical evidence. General public-read/session redesign remains separate scope.

## Shared report presentation (routine-first implementation; release pending)

`src/utils/reportPresentation.js` normalizes live school snapshots and saved original/amendment records for both `ReportSnapshotDetails` and every Reports print button. Effective counts remain separate from immutable evidence/time. New trusted filings freeze exact minutes, original evidence/custom responses/resources, publication revision, correction event snapshots/watermark and household timezone. Historical display uses recorded assignment boundaries; exact legacy duplicate projections are paired for presentation while unmatched history remains visible. Student/subject filters select whole weekly records. PDF generation and visual QA are separate from cloud release and physical printer acceptance.
