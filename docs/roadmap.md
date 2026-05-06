# GridWorkz Roadmap

Last updated: 2026-05-06

## Current Snapshot

- `npm run build` and `npm run lint` both pass as of 2026-05-06.
- A lightweight GitHub Actions workflow now runs build and lint on push and pull request.
- The core web app is real and usable: parent auth, student magic-link portal with optional PIN, curriculum builder, timers, reports, settings, and client-side weekly rollover are all present.
- The parent experience now uses a route-backed `/dashboard/*` shell with a shared feature registry, shell slots, extracted domain hooks, structural premium gating, and a dedicated Lockdown module.
- The student portal now evaluates subject visibility, timer start, and submission access through one reusable access-policy layer instead of scattered inline checks.
- The lockdown browser extension proof of concept now exists end-to-end: the parent dashboard can save a derived policy document and the MV3 extension can pair, poll, cache, and enforce it.
- Subscription enforcement is now live end to end in sandbox mode: shared entitlements, plan-aware UI, trusted callable creates, Firestore-rule backstops, and Stripe webhook billing sync are all deployed.
- The original concept plan is not fully complete. Reporting/compliance hardening, backend automation, and security tightening are still open.

## Baseline Status

| Area | Status | Notes |
| --- | --- | --- |
| Parent auth + dashboard shell | Done | Firebase Auth, protected route-backed dashboard shell, shared feature registry, dedicated Lockdown module |
| Student access model | Done | Public `/student/:slug` access with optional PIN |
| Curriculum builder | Done | Multi-student subjects, resources, custom fields, timers, block objectives, student overrides |
| Weekly progress + live activity | Done | Dashboard cards, pulse feed, manual parent completion |
| Weekly reports | Partial | Reports exist and can be browsed/printed, but evidence attachments are not implemented |
| Week rollover | Partial | Client-driven rollover exists; server automation does not |
| Firestore security posture | Partial | Subscription enforcement paths are now trusted, but public student portal flows and timer/submission exposure still need broader hardening |
| Subscription + entitlement model | Partial | Billing sandbox, trusted entitlement authority, live UI gating, and Stripe webhook sync are now live; projects UI and live-mode billing rollout are still open |
| Lockdown browser controls | Partial | Chrome extension PoC, entitlement gating, and read-only downgrade behavior are live, but device trust, kiosk mode, and production-safe policy access are not |
| Tooling baseline | Done | Build and lint both pass, and GitHub Actions runs them as a lightweight CI gate |
| Mobile apps | Future | Planning docs exist, no mobile workspace yet |
| Donation/support workflow | Future | Not implemented |

## Active Priorities

### 1. Stabilize the current web app

- Reduce the initial JS bundle size and split the dashboard-heavy code paths.
- Keep new parent-facing work on the route-backed shell, feature registry, and extracted hook boundaries instead of re-embedding Firestore logic into page components.

Related docs:

- [audits/baseline-plan-audit-2026-05-04.md](audits/baseline-plan-audit-2026-05-04.md)
- [upgrades/tooling-and-linting.md](upgrades/tooling-and-linting.md)
- [upgrades/performance-and-bundle-splitting.md](upgrades/performance-and-bundle-splitting.md)
- [upgrades/shell-and-data-layer.md](upgrades/shell-and-data-layer.md)

### 2. Build on the live subscription foundation without letting premium work sprawl the shell

- Keep future premium modules on the same shell-level entitlement rail instead of reintroducing one-off gates.
- Treat Stripe sandbox mode as the current integration baseline and switch to live-mode products, prices, and webhook secrets only when real payments are ready.
- Keep Lockdown as a top-tier module on its dedicated route and reuse the same shell-level gating contract for future premium surfaces.

Related docs:

- [upgrades/shell-and-data-layer.md](upgrades/shell-and-data-layer.md)
- [upgrades/subscriptions-and-entitlements.md](upgrades/subscriptions-and-entitlements.md)
- [specs/lockdown-browser-extension-plan.md](specs/lockdown-browser-extension-plan.md)

### 3. Finish reporting and compliance workflows

- Build the Evidence Drawer flow described in the original plan.
- Add Firebase Storage-backed evidence attachments.
- Decide how report locking, archival, and parent edits should behave after rollover.

Related docs:

- [features/reporting-and-rollover.md](features/reporting-and-rollover.md)
- [specs/report-evidence-drawer.md](specs/report-evidence-drawer.md)

### 4. Harden security and move trusted workflows off the client

- Revisit public read/write rules for `students`, `subjects`, `submissions`, and `timerSessions`.
- Move weekly rollover/report archival into trusted backend automation.
- Build on the live trusted entitlement path instead of duplicating it in new premium workflows.
- Define a safer future path for student sessions if the public slug model remains.

Related docs:

- [upgrades/security-hardening.md](upgrades/security-hardening.md)
- [upgrades/subscriptions-and-entitlements.md](upgrades/subscriptions-and-entitlements.md)
- [features/student-portal.md](features/student-portal.md)

### 5. Productize the lockdown track instead of leaving it as a one-off PoC

- Treat the working extension sync path as a validated prototype, not as launch-ready architecture.
- Build the production version behind the top paid tier only.
- Replace public PoC reads and loose pairing with a real device trust model before launch.
- Keep kiosk mode and future lockdown variants on the same entitlement rail as the browser extension.

Related docs:

- [specs/lockdown-browser-extension-plan.md](specs/lockdown-browser-extension-plan.md)
- [upgrades/subscriptions-and-entitlements.md](upgrades/subscriptions-and-entitlements.md)

### 6. Pursue mobile as a major upgrade stream

- Keep mobile work separate from core web stabilization.
- Treat mobile as a dedicated upgrade track with its own architecture and UX docs.

Related docs:

- [upgrades/mobile-app-implementation-plan.md](upgrades/mobile-app-implementation-plan.md)
- [specs/mobile-ui-requirements.md](specs/mobile-ui-requirements.md)

## Documentation Map

- Master map: [roadmap.md](roadmap.md)
- System reference: [architecture.md](architecture.md)
- Current audit: [audits/baseline-plan-audit-2026-05-04.md](audits/baseline-plan-audit-2026-05-04.md)
- Legacy concept plan: [archive/initial-product-plan.md](archive/initial-product-plan.md)
