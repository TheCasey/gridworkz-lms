# GridWorkz Roadmap

Last updated: 2026-05-11

## Current Snapshot

- `npm run build` and `npm run lint` both pass as of 2026-05-11.
- A lightweight GitHub Actions workflow now runs build and lint on push and pull request.
- The core web app is real and usable: parent auth, student magic-link portal with optional PIN, curriculum builder, timers, reports, settings, and client-side weekly rollover are all present.
- The parent experience now uses a route-backed `/dashboard/*` shell with a shared feature registry, shell slots, extracted domain hooks, structural premium gating, and a dedicated Lockdown module.
- The student portal now evaluates subject visibility, timer start, and submission access through one reusable access-policy layer instead of scattered inline checks.
- The Lockdown browser extension is now live on the trusted device contract: `/dashboard/lockdown` issues student-bound trusted enrollment material, the MV3 runtime exchanges it for an opaque device credential, `readLockdownDevicePolicy` drives secure sync, and cached fallback keeps enforcement active across restart or temporary sync failure.
- Subscription enforcement is now live end to end in sandbox mode: shared entitlements, plan-aware UI, trusted callable creates, Firestore-rule backstops, and Stripe webhook billing sync are all deployed.
- The baseline product redesign is now the top planning priority: weekly autonomy, layered planning, projects, student workspace, and narrow AI need to be locked in before wider rollout.

## Baseline Status

| Area | Status | Notes |
| --- | --- | --- |
| Parent auth + dashboard shell | Done | Firebase Auth, protected route-backed dashboard shell, shared feature registry, dedicated Lockdown module |
| Student access model | Done | Public `/student/:slug` access with optional PIN |
| Curriculum and weekly planning model | Partial | Current recurring subject builder exists, but the future template/assignment/weekly-plan model is not yet designed or implemented |
| Student portal workspace | Partial | Student portal exists, but the future weekly workspace, project view, worksheet runtime, and help flows are not yet in place |
| Weekly progress + live activity | Done | Dashboard cards, pulse feed, manual parent completion |
| Weekly reports | Partial | Reports exist and can be browsed/printed, but evidence attachments and the richer reporting contract are not implemented |
| Week rollover | Partial | Client-driven rollover exists; server automation does not |
| Firestore security posture | Partial | Subscription enforcement paths are now trusted, but public student portal flows and timer/submission exposure still need broader hardening |
| Subscription + entitlement model | Partial | Billing sandbox, trusted entitlement authority, live UI gating, and Stripe webhook sync are now live; projects UI and live-mode billing rollout are still open |
| Lockdown browser controls | Partial | The browser-extension launch path is live: entitlement-gated parent management, trusted device pairing, secure policy reads, cached fallback, approved-origin and approved-creator enforcement, and downgrade-safe read-only behavior are current state. Kiosk mode and broader rollout hardening remain follow-on scope. |
| AI assistance | Future | AI planning is now defined narrowly around curriculum chunking, worksheet drafting, and bounded student help |
| Tooling baseline | Done | Build and lint both pass, and GitHub Actions runs them as a lightweight CI gate |
| Mobile apps | Future | Planning docs exist, no mobile workspace yet |
| Donation/support workflow | Future | Not implemented |

## Active Priorities

### 1. Re-baseline the product around weekly autonomy

- Lock the product stance that parents define the week, students run the day, and order or time-of-day is not the core contract.
- Replace the flat subject-first planning model with a clearer future hierarchy: curriculum templates, assignments, weekly plans, weekly blocks, and projects.
- Treat the student portal as a first-class differentiator, not a sidecar to the parent dashboard.
- Define how Lockdown should eventually depend on the stronger weekly-plan and project model instead of only the current flat curriculum shape.
- Keep AI narrow: parent-provided material in, review-first drafts out, and one-shot hinting instead of broad conversational tutoring.

Related docs:

- [upgrades/baseline-product-foundation.md](upgrades/baseline-product-foundation.md)
- [upgrades/curriculum-and-weekly-plan-rollout.md](upgrades/curriculum-and-weekly-plan-rollout.md)
- [specs/curriculum-template-and-assignment-model.md](specs/curriculum-template-and-assignment-model.md)
- [specs/weekly-planning-and-review-flow.md](specs/weekly-planning-and-review-flow.md)
- [specs/projects-and-assessment-model.md](specs/projects-and-assessment-model.md)
- [specs/ai-assisted-planning-and-student-help.md](specs/ai-assisted-planning-and-student-help.md)

### 2. Finish reporting and compliance workflows

- Build the richer reporting and compliance contract on top of the future weekly-plan model.
- Build the Evidence Drawer flow described in the original plan.
- Add Firebase Storage-backed evidence attachments.
- Decide how report locking, archival, evidence, and parent edits should behave after rollover.

Related docs:

- [features/reporting-and-rollover.md](features/reporting-and-rollover.md)
- [specs/reporting-and-compliance-contract.md](specs/reporting-and-compliance-contract.md)
- [specs/report-evidence-drawer.md](specs/report-evidence-drawer.md)

### 3. Harden security and move trusted workflows off the client

- Revisit public read/write rules for `students`, `subjects`, `submissions`, and `timerSessions`.
- Move weekly rollover/report archival into trusted backend automation.
- Build on the live trusted entitlement path instead of duplicating it in new premium workflows.
- Define a safer future path for student sessions if the public slug model remains.

Related docs:

- [upgrades/security-hardening.md](upgrades/security-hardening.md)
- [upgrades/subscriptions-and-entitlements.md](upgrades/subscriptions-and-entitlements.md)
- [features/student-portal.md](features/student-portal.md)

### 4. Build on the live subscription foundation without letting premium work sprawl the shell

- Keep future premium modules on the same shell-level entitlement rail instead of reintroducing one-off gates.
- Treat Stripe sandbox mode as the current integration baseline and switch to live-mode products, prices, and webhook secrets only when real payments are ready.
- Keep Lockdown as a top-tier module on its dedicated route and reuse the same shell-level gating contract for future premium surfaces.
- Treat projects as the next major premium object type behind the same entitlement layer.

Related docs:

- [upgrades/subscriptions-and-entitlements.md](upgrades/subscriptions-and-entitlements.md)
- [specs/projects-and-assessment-model.md](specs/projects-and-assessment-model.md)
- [specs/lockdown-browser-extension-plan.md](specs/lockdown-browser-extension-plan.md)

### 5. Extend the lockdown track without reopening the shipped browser-extension contract

- Treat the trusted browser-extension path as current state, not as still-open launch architecture.
- Keep kiosk mode as a separate follow-on track instead of widening browser-extension maintenance into a broader device-management redesign.
- Continue deriving Lockdown behavior from weekly blocks and project work as the baseline planning model evolves.
- Retire the remaining compatibility-only `lockdownPolicies/{parentId}` boundary only when legacy support can be removed safely.
- Keep future Lockdown variants on the same entitlement rail and trusted device-policy model where that reuse still makes sense.

Related docs:

- [architecture.md](architecture.md)
- [features/parent-dashboard.md](features/parent-dashboard.md)
- [features/student-portal.md](features/student-portal.md)
- [specs/lockdown-browser-extension-plan.md](specs/lockdown-browser-extension-plan.md)
- [specs/weekly-planning-and-review-flow.md](specs/weekly-planning-and-review-flow.md)
- [specs/projects-and-assessment-model.md](specs/projects-and-assessment-model.md)

### 6. Stabilize the current web app while the model is being redesigned

- Keep new parent-facing work on the route-backed shell, feature registry, and extracted hook boundaries instead of re-embedding Firestore logic into page components.
- Avoid large UI churn that fights the future curriculum and weekly-planning redesign.
- Only do structural performance work when it still helps the current shipping app without pre-implementing the future model.

Related docs:

- [audits/baseline-plan-audit-2026-05-04.md](audits/baseline-plan-audit-2026-05-04.md)
- [upgrades/performance-and-bundle-splitting.md](upgrades/performance-and-bundle-splitting.md)
- [upgrades/shell-and-data-layer.md](upgrades/shell-and-data-layer.md)

### 7. Pursue mobile as a major upgrade stream after the baseline model is settled

- Keep mobile work separate from core web stabilization.
- Treat mobile as a dedicated upgrade track with its own architecture and UX docs.
- Base future mobile contracts on the template/assignment/weekly-plan model rather than the current flat subject model.

Related docs:

- [upgrades/mobile-app-implementation-plan.md](upgrades/mobile-app-implementation-plan.md)
- [specs/mobile-ui-requirements.md](specs/mobile-ui-requirements.md)

## Documentation Map

- Master map: [roadmap.md](roadmap.md)
- Product-baseline planning: [upgrades/baseline-product-foundation.md](upgrades/baseline-product-foundation.md)
- System reference: [architecture.md](architecture.md)
- Current audit: [audits/baseline-plan-audit-2026-05-04.md](audits/baseline-plan-audit-2026-05-04.md)
- Legacy concept plan: [archive/initial-product-plan.md](archive/initial-product-plan.md)
