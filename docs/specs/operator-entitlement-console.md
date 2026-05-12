# Operator Entitlement Console

Status: Draft

Last updated: 2026-05-11

## Goal

Add a trusted operator-only console so support can inspect and adjust entitlement state for parent accounts without direct Firestore edits.

This should solve two immediate operational needs:

- resolve parent issues when billing sync, missing records, or downgrade state leaves the account in the wrong entitlement mode
- let an operator test their own account against `free`, `core`, and `lockdown` behavior without editing raw documents by hand

## Problem

The current entitlement stack is live, but it only has two practical control paths:

- Stripe sandbox webhook writes
- direct backend/admin intervention outside the product UI

Current constraints:

- `accountEntitlements/{uid}` is owner-readable but server-writable only
- the parent-facing `Settings` surface shows plan state, but does not let anyone repair or override it
- missing entitlement docs still fall back to `free`, which is safe but not support-friendly
- there is no trusted support workflow for temporary testing, fixing a missing record, or undoing a bad plan state

## Non-Goals

- do not turn this into a customer self-service billing portal
- do not replace Stripe as the billing source of truth
- do not let parents manually upgrade themselves through normal dashboard UI
- do not build a general-purpose admin CMS
- do not add impersonation as part of the first pass

## Primary Users

### Support operator

- search for a parent account
- inspect current effective entitlement state
- repair missing or incorrect entitlement state
- explain why a parent sees `free`, `core`, or `lockdown`

### Founder or internal tester

- temporarily switch their own account between plans
- test locked, active, and downgrade-safe flows
- revert cleanly back to the billing-backed state

## Product Requirements

The operator console should support:

1. Search parent accounts by email, uid, or school name.
2. View the current effective entitlement state the app will honor.
3. View the last known billing-backed entitlement state separately from any operator override.
4. Initialize a missing `accountEntitlements/{uid}` document safely.
5. Apply a manual override for plan, subscription status, and feature overrides.
6. Set an optional expiration on a manual override for temporary testing.
7. Clear a manual override and return the account to billing-backed state.
8. Show an audit trail of who changed what, when, and why.
9. Warn when a change would downgrade an account below its current usage or remove Lockdown access from a configured household.

## Entry Point And UX Shape

This should not live inside the normal parent dashboard shell.

Recommended route:

- `/ops/entitlements`

Recommended first-pass layout:

### 1. Operator search view

- account search input
- recent accounts
- quick link to "Open my account"
- explicit environment badge such as `Stripe Sandbox`

### 2. Account detail view

Show:

- parent identity: uid, email, school name
- effective plan and subscription status
- whether the current view is coming from billing, manual override, or free-plan fallback
- current usage: students and active curriculum
- Lockdown access summary
- timestamps for last billing sync and last operator update

### 3. Manual override panel

Controls:

- quick presets: `Free`, `Core`, `Lockdown`
- subscription status selector
- feature override toggles
- optional expiration timestamp
- required support reason
- preview of the exact diff before apply

### 4. Audit timeline

Show:

- webhook writes
- operator-applied changes
- operator-cleared overrides
- automatic reversion after expiration

## Recommended Trust Model

Use trusted Cloud Functions as the only mutation path.

Do not let the operator UI write `accountEntitlements` directly from the client, even if the operator is internal.

### Operator authorization

Use a server-owned operator allowlist collection, for example:

- `supportOperators/{uid}`

Suggested shape:

```js
{
  uid: "operator_uid",
  email: "operator@example.com",
  role: "support" | "admin",
  is_active: true,
  created_at: "timestamp",
  updated_at: "timestamp"
}
```

Recommended rule:

- trusted backend checks this document on every operator action
- optional custom claims can improve route gating later, but trusted backend checks should not rely on claims alone

This is preferable to a claims-only design because support access can be revoked immediately without waiting for token refresh.

## Data Model Recommendation

Keep `accountEntitlements/{uid}` as the effective entitlement record the app already reads, but extend it so billing truth and operator overrides can coexist safely.

Suggested evolved shape:

```js
{
  parent_id: "uid",

  // Effective state currently consumed by the app and trusted create flows
  plan_id: "free" | "core" | "lockdown",
  subscription_status: "trialing" | "active" | "past_due" | "canceled" | null,
  billing_provider: "stripe" | null,
  feature_overrides: {
    can_use_projects: false,
    can_use_lockdown_extension: false,
    can_use_lockdown_kiosk: false
  },
  usage_snapshot: {
    students: 0,
    curriculum_items: 0
  },
  trial_ends_at: "timestamp|null",
  current_period_end: "timestamp|null",

  // Metadata describing why the effective state currently looks this way
  resolution_source: "billing" | "manual_override" | "fallback_initialized",
  updated_via: "billing_webhook" | "operator_console" | "operator_clear_override",
  updated_at: "timestamp",

  // Provider-backed truth retained even when a manual override is active
  billing_state: {
    plan_id: "free" | "core" | "lockdown",
    subscription_status: "trialing" | "active" | "past_due" | "canceled" | null,
    billing_provider: "stripe" | null,
    feature_overrides: {},
    trial_ends_at: "timestamp|null",
    current_period_end: "timestamp|null",
    updated_at: "timestamp|null"
  },

  // Optional support/test override
  manual_override: {
    is_active: true,
    plan_id: "free" | "core" | "lockdown",
    subscription_status: "trialing" | "active" | "past_due" | "canceled" | null,
    feature_overrides: {},
    reason: "Support fix or self-test note",
    expires_at: "timestamp|null",
    applied_by_uid: "operator_uid",
    applied_by_email: "operator@example.com",
    applied_at: "timestamp"
  }
}
```

Why this shape:

- current clients can keep reading the top-level effective fields
- webhook sync can keep updating `billing_state` without stomping an active test override
- operator UI can show both effective state and billing truth at the same time

## Audit Log Recommendation

Add a server-owned audit collection, for example:

- `entitlementAuditLogs/{logId}`

Suggested shape:

```js
{
  parent_id: "uid",
  operator_uid: "operator_uid|null",
  operator_email: "operator@example.com|null",
  event_type: "billing_webhook_sync" | "override_applied" | "override_cleared" | "record_initialized" | "override_expired",
  reason: "Human-entered reason or webhook event type",
  before: { ... },
  after: { ... },
  created_at: "timestamp"
}
```

The first pass can keep `before` and `after` shallow if full snapshots feel too heavy, but an operator-facing audit view is not optional.

## Trusted Backend Surface

Recommended new functions:

- `getOperatorSession`
  - confirms whether the current authenticated user is an active operator
- `searchParentAccounts`
  - search by email, uid, school name
- `getOperatorEntitlementRecord`
  - returns effective entitlement, billing state, manual override, usage summary, and recent audit entries
- `initializeEntitlementRecord`
  - creates a safe baseline record when the doc is missing
- `applyEntitlementOverride`
  - applies or updates a manual override and recomputes effective fields
- `clearEntitlementOverride`
  - removes the manual override and resolves effective fields back to `billing_state`
- `recomputeEntitlementUsageSnapshot`
  - optional first-pass helper to refresh usage counts from live `students` and `subjects`

Recommended implementation note:

- keep the entitlement resolver shared between `billingWebhook`, `createStudent`, `createSubject`, Lockdown trusted functions, and the new operator functions so plan semantics do not drift

## Webhook And Override Interaction

This is the most important design constraint.

If operator overrides simply rewrite top-level fields, the next Stripe webhook can silently undo a support or testing action.

Recommended behavior:

1. Webhook always updates `billing_state`.
2. If no manual override is active, webhook also updates the effective top-level fields.
3. If a manual override is active, webhook leaves the effective top-level fields alone and records that billing state changed under an override.
4. Clearing or expiring the override recomputes effective top-level fields from `billing_state`.

This gives support a safe testing path without severing the billing trail.

## Safety Rules

- Require a reason for every manual operator mutation.
- Show a diff preview before apply.
- Show a warning if the change would remove Lockdown from an account that has saved Lockdown setup.
- Show a warning if the change would place the account above plan limits.
- Prefer temporary overrides with expiration for self-testing over permanent manual rewrites.
- Never expose raw Stripe secret values, webhook secrets, or other sensitive provider config in the operator UI.

## UI Copy And Behavior Rules

- Always distinguish `billing-backed state` from `manual override state`.
- Always show whether the parent app is currently honoring an override.
- Keep explicit labels such as `Effective State`, `Billing State`, and `Manual Override`.
- Make the revert path obvious: `Clear Override And Return To Billing State`.

## First-Pass Scope Recommendation

Build the smallest useful support tool first:

1. operator auth check
2. account search
3. entitlement detail view
4. plan preset override
5. clear override
6. audit trail

Defer these unless needed immediately:

- Stripe customer editing
- refunds or invoice actions
- impersonation
- multi-account bulk edits
- support ticketing workflow

## Rollout Plan

### Phase 1. Operator trust boundary

- add `supportOperators` collection
- add operator auth helper in Functions
- add operator route guard in the app

### Phase 2. Data contract and audit trail

- extend `accountEntitlements` with `billing_state`, `manual_override`, and resolution metadata
- add `entitlementAuditLogs`
- update webhook logic to preserve billing truth under overrides

### Phase 3. Operator functions

- add search, detail, initialize, apply override, and clear override functions
- add shared entitlement recompute helper

### Phase 4. Operator UI

- build `/ops/entitlements`
- add search, detail, override form, and audit timeline
- add quick presets for `free`, `core`, and `lockdown`

### Phase 5. Verification and support playbooks

- validate missing-doc repair
- validate downgrade and re-upgrade behavior
- validate self-testing on an internal account
- document how to use temporary overrides versus permanent fixes

## Likely Files

- `functions/src/index.js`
- `firestore.rules`
- `src/App.jsx`
- `src/constants/schema.js`
- `src/constants/entitlements.js`
- `src/firebase/trustedOperations.js`
- `src/pages/Settings.jsx`
- `src/pages/Lockdown.jsx`
- new operator-facing files under `src/pages/` and `src/components/`

## Open Questions

- Should operator access stay in the main app at `/ops/*`, or move to a separate internal deployment later?
- Should manual overrides be able to change only top-level plan state, or also override individual feature flags in the first pass?
- Should override expiration clear lazily on the next trusted read or write, or via scheduled backend cleanup?
- Should usage snapshots be refreshed automatically on every operator read, or stay explicit as a repair action to control cost?

## Related Docs

- [../upgrades/subscriptions-and-entitlements.md](../upgrades/subscriptions-and-entitlements.md)
- [../upgrades/security-hardening.md](../upgrades/security-hardening.md)
- [lockdown-browser-extension-plan.md](lockdown-browser-extension-plan.md)
- [projects-and-assessment-model.md](projects-and-assessment-model.md)
