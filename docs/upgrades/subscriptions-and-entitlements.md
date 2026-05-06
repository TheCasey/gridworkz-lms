# Subscriptions And Entitlements

Last updated: 2026-05-05

Status: Implemented

## Goal

Add a stable subscription and entitlement layer before more premium work lands so GridWorkz does not have to rethread limits, nav access, and lockdown availability later.

## Planning Decisions Locked In

Use stable internal plan ids even if marketing names change later.

| Internal plan id | Pricing target | Student limit | Curriculum limit | Projects | Lockdown modes |
| --- | --- | --- | --- | --- | --- |
| `free` | $0 | 2 | 3 | No | No |
| `core` | $5/month | 10 | Unlimited | Yes | No |
| `lockdown` | $10/month | 10 | Unlimited | Yes | Yes |

For this planning pass:

- Treat the current `subjects` collection as the closest existing implementation of "curriculums."
- Treat "projects" as a future paid feature that should be designed behind entitlements from day one.
- Treat the `lockdown` plan as including the current browser extension work, kiosk mode, and future lockdown-specific variants.

## Current-Code Reality

The current app now has a live entitlement foundation and trusted enforcement baseline.

Implemented surfaces now include:

- `src/constants/entitlements.js`
  - locked internal plan ids, limits, feature flags, and shared upgrade copy
- `src/hooks/useEntitlements.js`
  - shared `accountEntitlements/{parentId}` read path with free-plan fallback and reusable entitlement metadata
- `src/pages/ParentDashboard.jsx`
  - trusted student create path plus current shell-level premium visibility handling
- `src/pages/Curriculum.jsx`
  - trusted active-subject create path plus free-tier active-subject limit gating
- `src/pages/Settings.jsx`
  - current plan, usage, and locked-state account summary surface
- `src/components/LockdownPolicyPanel.jsx`
  - entitlement-aware read-only downgrade behavior for non-Lockdown plans
- `functions/src/index.js`
  - trusted `billingWebhook`, `createStudent`, and `createSubject` endpoints
- `firestore.rules`
  - trusted backstops for `accountEntitlements`, direct student/subject creates, and `lockdownPolicies` writes

Important constraint:

- `parents/{uid}` is owner-writable today, so it must not become the trusted source of paid plan access on its own.

Operational note:

- Stripe integration is live in sandbox mode only. Firebase Secret Manager now stores the Stripe test-mode secrets and price ids used by the deployed webhook path. Switching to real payments is an operational follow-up, not a missing Phase 5 implementation step.

## Recommended Product Rules

### Free plan

- Allow registration with no payment.
- Allow up to 2 students.
- Allow up to 3 curriculum entries.
- Do not expose projects.
- Do not expose lockdown controls, pairing, extension management, or kiosk configuration.

### Core plan

- Allow up to 10 students.
- Allow unlimited curriculum entries.
- Expose projects once that feature exists.
- Keep lockdown features unavailable.

### Lockdown plan

- Inherit the Core plan limits and project access.
- Unlock browser-extension mode, kiosk mode, and future lockdown setup flows.
- Keep all lockdown-related UI and policy writes behind this plan from the first production rollout.

### Downgrade behavior

Design for read-mostly downgrade handling instead of destructive cleanup:

- If an account drops below the required plan, keep existing data.
- Block new creates above the active plan limit.
- Keep edits and deletes available so the parent can get back under the limit.
- For lockdown downgrades, disable new pairing and policy edits until re-upgrade rather than silently deleting saved policy data.

## Recommended Technical Shape

### 1. Plan catalog in code

Add a single source of truth for plan features and limits, for example:

- `src/constants/entitlements.js`

That module should define:

- stable plan ids
- numeric limits such as `maxStudents` and `maxCurriculumItems`
- feature flags such as `canUseProjects`, `canUseLockdownExtension`, and `canUseLockdownKiosk`
- helper functions for limit checks and upsell copy

This lets every UI surface read from one catalog instead of hardcoding tier logic inline.

### 2. Server-owned entitlement document

Do not trust the current `parents` document for paid access.

Preferred production direction:

- add a new server-owned document such as `accountEntitlements/{parentId}`

Suggested shape:

```js
{
  parent_id: "uid",
  plan_id: "free" | "core" | "lockdown",
  subscription_status: "trialing" | "active" | "past_due" | "canceled",
  billing_provider: "stripe",
  feature_overrides: {
    can_use_projects: false,
    can_use_lockdown_extension: false,
    can_use_lockdown_kiosk: false
  },
  usage_snapshot: {
    students: 2,
    curriculum_items: 3
  },
  trial_ends_at: "timestamp|null",
  current_period_end: "timestamp|null",
  updated_at: "timestamp"
}
```

The UI can read this document directly, but normal clients should not be allowed to mint or upgrade it themselves.

### 3. Billing records stay out of client-owned docs

If Stripe or another provider is added, provider identifiers and webhook-driven state should live in server-managed records or backend storage, not as client-authoritative flags on `parents/{uid}`.

### 4. Usage checks should start simple

For the current app shape:

- derive student usage from the existing `students` query in `ParentDashboard.jsx`
- derive curriculum usage from the existing `subjects` query in `Curriculum.jsx`

That is enough for early UI gating.

Later, once trusted backend flows exist, add server-side backstops so limits are enforced even if a client bypasses the UI.

## Required UI And Code Workstreams

### Workstream A. Shared entitlement scaffolding

- Add the plan catalog constant.
- Add a shared entitlement loader or hook.
- Expose current plan, usage, limits, and upgrade-needed messaging in one place.

### Workstream B. Existing create limits

Apply limit checks to the surfaces that already create billable objects:

- `src/pages/ParentDashboard.jsx`
  - gate `handleAddStudent`
  - show current student usage vs plan limit
- `src/pages/Curriculum.jsx`
  - gate subject creation for the free-tier curriculum cap
  - show plan-based create limits in the editor or header

These two surfaces should be updated before more premium work lands.

### Workstream C. Navigation and premium feature visibility

- Add an account or plan summary surface in `Settings` or a new billing page.
- Hide or disable projects unless the plan allows them.
- Hide or disable lockdown controls unless the plan allows them.
- Prefer explicit locked-state UI with upgrade messaging over simply omitting features without explanation.

### Workstream D. Lockdown integration

Before the lockdown feature is treated as productized:

- gate `src/components/LockdownPolicyPanel.jsx` behind the `lockdown` plan
- make future kiosk mode and device management read the same entitlement source
- keep all future lockdown variants on the same premium rail instead of inventing separate checks later

### Workstream E. Trusted enforcement

After the UI scaffolding exists:

- move entitlement writes to trusted backend flows
- add rule-level or server-level enforcement for plan-gated creates
- avoid relying on client-only checks for paid access

This work depends on the broader security-hardening track already called out in the roadmap.

## Implementation Status

Completed:

1. Internal plan ids and entitlement keys are frozen in code.
2. The shared entitlement catalog and read path are live.
3. Student and curriculum create limits are enforced in the UI and by trusted backend paths.
4. The account summary and upgrade messaging surface are live in `Settings`.
5. Lockdown is entitlement-aware and downgrade-safe.
6. Backend billing sync and trusted enforcement are live in sandbox mode.

Still open:

1. Land future project features behind the same entitlement layer.
2. Move Stripe from sandbox mode to live-mode products, prices, webhook secret, and webhook smoke validation when real payments are ready.

## Open Product Questions

- Should the `lockdown` plan keep the same 10-student limit permanently, or should it grow later?
- What exact object will "projects" map to in the data model?
- Will there be trials, annual billing, or promo overrides that need to coexist with the three base plans?

## Related Docs

- [roadmap.md](../roadmap.md)
- [architecture.md](../architecture.md)
- [security-hardening.md](security-hardening.md)
- [lockdown-browser-extension-plan.md](../specs/lockdown-browser-extension-plan.md)
