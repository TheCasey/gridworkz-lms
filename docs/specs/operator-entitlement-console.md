# Operator Entitlement Console

Status: Implemented MVP

Last updated: 2026-05-22

## Goal

Add a trusted operator-only console so support can inspect and adjust entitlement state for parent accounts without direct Firestore edits.

This should solve two immediate operational needs:

- resolve parent issues when billing sync, missing records, or downgrade state leaves the account in the wrong entitlement mode
- let an operator test their own account against `free`, `core`, and `lockdown` behavior without editing raw documents by hand

## Current MVP

The MVP is implemented as an internal operator surface at `/ops/entitlements`.

Implemented surfaces include:

- `src/pages/OpsEntitlements.jsx`
  - operator session check, search, account detail, state cards, usage and Lockdown summary, manual override form, clear override, and audit timeline
- `src/firebase/trustedOperations.js`
  - trusted callable wrappers for operator session, parent search, entitlement detail, missing-record initialization, override apply, and override clear
- `functions/src/index.js`
  - `supportOperators/{uid}` allowlist enforcement, operator callables, shared entitlement resolver, audit writes, and Stripe webhook behavior that preserves active manual overrides
- `firestore.rules`
  - server-owned `accountEntitlements`, `entitlementAuditLogs`, and `supportOperators` collections

The support runbook is [operator-entitlement-console-runbook.md](../support/operator-entitlement-console-runbook.md).

## Problem Solved By MVP

Before this console, the live entitlement stack only had two practical control paths:

- Stripe sandbox webhook writes
- direct backend/admin intervention outside the product UI

The MVP keeps the important security constraints:

- `accountEntitlements/{uid}` is owner-readable but server-writable only
- the parent-facing `Settings` surface shows plan state, but does not let parents repair or override it
- missing entitlement docs still fall back to `free`, and operators can now initialize a server-owned Free fallback record
- temporary testing, missing-record repair, override clearing, and audit review now go through trusted support workflows

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

The implemented MVP supports:

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

Implemented route:

- `/ops/entitlements`

Implemented first-pass layout:

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
- expired override state when recorded by trusted entitlement resolution or later billing sync

## Implemented Trust Model

Use trusted Cloud Functions as the only mutation path.

Do not let the operator UI write `accountEntitlements` directly from the client, even if the operator is internal.

### Operator authorization

Use a server-owned operator allowlist collection:

- `supportOperators/{uid}`

Current shape:

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

Implemented rule:

- trusted backend checks this document on every operator action
- optional custom claims can improve route gating later, but trusted backend checks should not rely on claims alone

This is preferable to a claims-only design because support access can be revoked immediately without waiting for token refresh.

## Implemented Data Model

Keep `accountEntitlements/{uid}` as the effective entitlement record the app already reads, but extend it so billing truth and operator overrides can coexist safely.

Implemented evolved shape:

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

## Implemented Audit Log

The MVP writes a server-owned audit collection:

- `entitlementAuditLogs/{logId}`

Current shape:

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

The first pass keeps `before` and `after` as shallow entitlement snapshots and renders them in the operator audit timeline.

## Implemented Trusted Backend Surface

Implemented functions:

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

There is no standalone usage-recompute callable in the MVP. Operator detail and mutation paths derive live student and active-subject usage while building the response.

Implementation note:

- keep the entitlement resolver shared between `billingWebhook`, `createStudent`, `createSubject`, Lockdown trusted functions, and the new operator functions so plan semantics do not drift

## Webhook And Override Interaction

This is the most important design constraint.

If operator overrides simply rewrite top-level fields, the next Stripe webhook can silently undo a support or testing action.

Implemented behavior:

1. Webhook always updates `billing_state`.
2. If no manual override is active, webhook also updates the effective top-level fields.
3. If a manual override is active, webhook leaves the effective top-level fields alone and records that billing state changed under an override.
4. Clearing or expiring the override recomputes effective top-level fields from `billing_state`.

This gives support a safe testing path without severing the billing trail.

## MVP Safety Rules

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

## MVP Scope

The implemented support tool includes:

1. operator auth check
2. account search
3. entitlement detail view
4. plan preset override
5. clear override
6. audit trail

Still deferred:

- Stripe customer editing
- refunds or invoice actions
- impersonation
- multi-account bulk edits
- support ticketing workflow

## Rollout Plan

### Phase 1. Operator trust boundary - Done

- add `supportOperators` collection
- add operator auth helper in Functions
- add operator route guard in the app

### Phase 2. Data contract and audit trail - Done

- extend `accountEntitlements` with `billing_state`, `manual_override`, and resolution metadata
- add `entitlementAuditLogs`
- update webhook logic to preserve billing truth under overrides

### Phase 3. Operator functions - Done

- add search, detail, initialize, apply override, and clear override functions
- add shared entitlement recompute helper

### Phase 4. Operator UI - Done

- build `/ops/entitlements`
- add search, detail, override form, and audit timeline
- add quick presets for `free`, `core`, and `lockdown`

### Phase 5. Verification and support playbooks - Runbook delivered

- documented missing-doc repair, downgrade warnings, self-testing, override clearing, and webhook-under-override checks
- documented how to use temporary overrides versus billing-backed repairs
- live operator validation still requires seeded `supportOperators/{uid}` records and representative parent data

## Implemented Files

- `functions/src/index.js`
- `firestore.rules`
- `src/App.jsx`
- `src/constants/schema.js`
- `src/constants/entitlements.js`
- `src/firebase/trustedOperations.js`
- `src/pages/OpsEntitlements.jsx`
- `src/components/ops/operatorEntitlementUi.js`
- `docs/support/operator-entitlement-console-runbook.md`

## Remaining Follow-Ups

- Move Stripe from sandbox mode to live-mode products, price ids, webhook secret, and webhook smoke validation when real payments are ready.
- Decide later whether operator access should stay in the main app at `/ops/*` or move to a separate internal deployment.
- Add provider/customer repair tooling only if support volume justifies it; the MVP intentionally does not edit Stripe customers, invoices, refunds, or subscriptions.
- Complete live operator validation in staging or emulator data before release acceptance.
- Decide whether expired overrides need scheduled cleanup. The MVP resolves expired overrides through trusted entitlement reads or later billing sync, and operators can clear completed overrides explicitly.
- Keep future premium modules such as projects on this entitlement rail.

## Related Docs

- [../upgrades/subscriptions-and-entitlements.md](../upgrades/subscriptions-and-entitlements.md)
- [../upgrades/security-hardening.md](../upgrades/security-hardening.md)
- [lockdown-browser-extension-plan.md](lockdown-browser-extension-plan.md)
- [projects-and-assessment-model.md](projects-and-assessment-model.md)
