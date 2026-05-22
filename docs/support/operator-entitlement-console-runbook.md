# Operator Entitlement Console Runbook

Last updated: 2026-05-22

Status: Implemented MVP support playbook

## Scope

Use `/ops/entitlements` to inspect and repair parent entitlement state without direct Firestore edits. The console is operator-only: the signed-in Firebase user must have an active server-owned `supportOperators/{uid}` record, and all reads or writes go through trusted Cloud Functions.

The current environment is Stripe sandbox. Do not use this console as a live billing customer portal.

## State Model

- Effective state is the top-level `accountEntitlements/{parentId}` plan, status, feature overrides, and usage snapshot that the app and trusted create flows honor.
- Billing-backed state is stored in `billing_state` and is updated by Stripe webhooks or by safe fallback initialization.
- Manual override state is stored in `manual_override`. When active and unexpired, it controls the effective state while preserving billing-backed truth.
- Audit history is written to `entitlementAuditLogs` for billing syncs, record initialization, override apply, and override clear events.

## Temporary Override Versus Billing-Backed Repair

Use a temporary manual override for support testing, founder self-testing, or a short-lived exception while billing state is being investigated. Prefer an expiration, always enter a support reason, review the diff and warnings, and clear the override when the test or exception is finished.

Use billing-backed repair when the parent should be entitled because of Stripe or account state. Fix or replay the billing source so the webhook updates `billing_state`; then clear any manual override so the effective state returns to the billing-backed state. Do not leave a manual override as the permanent paid-plan source of truth.

Missing `accountEntitlements/{parentId}` records are repaired by initializing a safe Free fallback record first. If the parent is actually paid, initialization is only the baseline repair; the paid state should still come from Stripe webhook sync.

## Operator Workflow

1. Seed operator access with `supportOperators/{operatorUid}`:

```js
{
  uid: "operator_uid",
  email: "operator@example.com",
  role: "support", // or "admin"
  is_active: true
}
```

2. Sign in as that Firebase user and open `/ops/entitlements`.
3. Search by parent email, parent uid, or school name, or use `Open my account`.
4. Review `Effective State`, `Billing State`, `Manual Override`, usage, Lockdown summary, downgrade warnings, and the audit timeline before changing anything.

## Initialize Missing Records

When an account has no `accountEntitlements/{parentId}` document, the detail view shows a missing-record panel and resolves the parent to a safe Free fallback.

To initialize:

1. Confirm the parent identity.
2. Enter a support reason in `Initialize safe fallback`.
3. Click `Initialize Record`.
4. Verify the account now has a server-owned Free fallback entitlement, `resolution_source: fallback_initialized`, and a `record_initialized` audit entry.

After initialization, apply a temporary override only when needed. For true paid-plan repair, repair the Stripe-backed state and let the webhook update `billing_state`.

## Apply Manual Overrides

1. Choose the `Free`, `Core`, or `Lockdown` preset.
2. Confirm subscription status, feature overrides, and optional expiration.
3. Enter a support reason.
4. Review the diff preview and downgrade warnings.
5. Click `Apply Manual Override`.

Expected preset behavior:

- `Free`: disables Projects and Lockdown features and enforces Free limits.
- `Core`: enables Projects, keeps Lockdown unavailable, and uses Core limits.
- `Lockdown`: enables Projects plus Lockdown extension and kiosk feature flags.

## Clear Manual Overrides

Use `Clear Override And Return To Billing State` when testing is complete or when Stripe has been repaired.

1. Confirm an active manual override exists.
2. Enter the support reason.
3. Click `Clear Override`.
4. Verify `manual_override.is_active` is false, the effective state follows `billing_state` or fallback Free state, and an `override_cleared` audit entry appears.

## Webhook Under Override

Stripe webhooks always update `billing_state`. If a manual override is active, the webhook should not replace the effective top-level plan or features. Clearing or expiring the override resolves the effective state from the latest billing-backed state.

## Validation Checklist

- Non-operator denial: a signed-in user without an active `supportOperators/{uid}` record sees operator access denied, and trusted mutation calls return permission denied.
- Missing-doc repair: a parent without `accountEntitlements/{uid}` shows missing-record fallback, initializes to Free with a support reason, and records `record_initialized`.
- Free override: applying the Free preset disables premium features, shows usage warnings when the account exceeds Free limits, and creates `override_applied`.
- Core override: applying the Core preset enables Projects, leaves Lockdown disabled, and reflects Core limits in effective state.
- Lockdown override: applying the Lockdown preset enables Lockdown feature flags and allows Lockdown management paths for that parent.
- Clear override: clearing returns effective state to `billing_state` or fallback Free, marks the override inactive, and records `override_cleared`.
- Downgrade warnings: changing to a lower plan warns for over-limit student/curriculum usage and for saved Lockdown setup.
- Audit timeline: webhook, initialize, apply, and clear events show actor, timestamp, reason, and before/after plan state.
- Webhook-under-override behavior: while an override is active, a sandbox Stripe webhook updates `billing_state` and audit history while the effective state stays on the manual override until clear or expiration.

## Known Limitations

- Stripe is sandbox-only for this MVP.
- The UI intentionally does not expose raw provider config, Stripe secret values, webhook secrets, or price ids.
- Live operator validation requires seeded `supportOperators/{uid}` records and representative parent data.
- Live-mode Stripe rollout remains an operational follow-up: live products, prices, secrets, webhook endpoint, and webhook smoke validation are still open.
- The console does not edit Stripe customers, invoices, refunds, subscriptions, or support tickets.
- Manual override expiration is resolved by trusted entitlement reads or later billing sync; operators should still clear completed test overrides explicitly.
