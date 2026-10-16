# Core Billing Operations And Acceptance

Status: implementation/integration in progress. No live payment or production activation is verified.

## Targets and configuration

Firebase production is `gridworkz-lms`, Functions region `us-central1`. Public hosts are `https://own-path.com` and `https://dashboard.own-path.com`; the canonical billing return origin must be selected explicitly after checking the deployed app routes. Both hosts need smoke validation. Never put Stripe secrets in `VITE_*`, browser storage, logs, PR bodies or committed environment files.

| Server setting | Contract |
| --- | --- |
| `STRIPE_SECRET_KEY` | Existing Secret Manager binding; explicitly selected test/live account |
| `STRIPE_WEBHOOK_SECRET` | Matching account/mode webhook signing secret |
| `STRIPE_CORE_PRICE_ID` | Active USD500 recurring licensed monthly price, one unit |
| `STRIPE_LOCKDOWN_PRICE_ID` | Historical recognition only; no new Lockdown checkout |
| `CORE_BILLING_MODE` | `test` or `live`; invalid/missing fails closed |
| `CORE_BILLING_APP_ORIGIN` | Exact HTTPS origin, with fixed `/dashboard/settings` return path; loopback permitted only in emulator |
| `CORE_BILLING_CHECKOUT_ENABLED` | Explicit `true` to enable a validated purchase path; default off |
| `CORE_BILLING_LIVE_APPROVED` | Additional explicit gate for live checkout; keep off before live acceptance authorization |
| `CORE_BILLING_PORTAL_CONFIGURATION_ID` | Active matching-mode configuration, subscription switching disabled, period-end cancellation enabled |
| `CORE_BILLING_HISTORICAL_CORE_PRICE_IDS` / `CORE_BILLING_HISTORICAL_LOCKDOWN_PRICE_IDS` | Comma-separated server-owned recognition mappings; do not reprice existing subscriptions |

The portal remains a separate management capability after downgrade or checkout suspension. A return redirect cannot grant access. Verified billing reconciliation owns entitlement changes and must preserve current support overrides, usage, rollout markers and historical financial IDs.

## Safe validation order

1. Run Node20 policy/view checks, isolated Firestore coordinator concurrency checks, actual callable auth/config-denial checks, rules tests and browser tests. Browser provider-navigation simulations are explicitly separate from real Stripe acceptance.
2. Read provider mode, actual subscriptions, prices, endpoint events and portal configuration without exposing credentials. Compare with the historical inventory, including all existing customer/subscription associations before enabling checkout.
3. Verify safe test-mode Checkout/portal creation, exact intent reuse, abandonment/expiration and cleanup using a disposable emulator household. Do not complete a payment through a test account whose existing webhook targets an unprepared production backend.
4. Use an isolated Stripe sandbox/webhook target for the complete payment lifecycle: successful purchase, abandonment, delayed/duplicate/out-of-order events, incomplete/payment failure, recovery, renewal, period-end cancellation and final cancellation. Verify actual provider state and persisted entitlements, not just redirect text. Exercise support override apply/clear/expiry during billing changes.
5. Configure/build cloud indexes and deploy compatible backend/rules with purchase gate off. Verify customer transition/reconciliation and signed webhook behavior on a disposable cloud household. Deploy compatible UI to the approved Cloudflare target, then validate both public hosts.
6. Make the live purchase flow concrete and request the owner's separately authorized disposable purchase, management/cancellation and refund/cleanup policy. Record provider/entitlement evidence without credentials or ordinary household data. A real payment is not authorized merely by starting this execution plan.
7. After final activation, observe at least 48 hours and through one real household weekly reset, whichever is later. Record live failures, denied operations, webhook delay, report filing errors, routine award reconciliation and listener/read volume against a measured baseline.

## Reconciliation and rollback

Never guess customer ownership from an email address or owner-writable parent profile. Missing/contradictory historical associations require provider-verified transition. Retain signed events for safe reconciliation; never overwrite an established customer binding with another customer merely because an old event arrived.

Unknown checkout results retain their exact intent/parameters and provider idempotency keys. After the 23-hour replay guard, reconcile the provider before allowing a new purchase. Do not clear private records to bypass that guard. Definitively expired known sessions can start a fresh intent.

First response to checkout trouble is to turn off purchase availability while keeping trusted webhook reconciliation and subscription management available. Retain additive Functions/rules and financial/audit/ledger records. UI rollback must understand all data already written; never restore a backend that permits public writes into adopted school/routine authority. Account/new-household routine rollback switches are documented in testing.md; both existing-account and new-account gates must be handled.

Before production promotion, record the actual Cloudflare production deployment and rollback IDs, Firebase deployed versions, active indexes, private schema/catalog versions, migration counts and exact verified commit. Cloudflare authentication is currently expired; no production rollback ID has been guessed.

## Acceptance ledger

| Boundary | Evidence/status |
| --- | --- |
| Existing provider inventory | Read-only test account: $5/month Core, zero actual subscriptions, one lifecycle webhook, no initial portal configuration |
| Backend policy and persisted coordination | 70 policy assertions and22 persisted emulator scenarios passed; final independent review found no new actionable issues |
| Actual callable auth/config routing | 4 actual callable cases passed; unauthenticated/non-parent/forged requests denied and missing config closed. Production HTTP adapter passes real Stripe signature/raw-body/mode and duplicate receipt checks using synthetic signing keys |
| UI/browser provider simulations | 4 browser cases passed, including uncertain outcome/reload retry, duplicate click prevention, unsafe URL denial and mobile keyboard management |
| Actual Stripe Checkout/portal sessions and abandonment | Passed actual test-mode Checkout/portal creation, exact open-session reuse and expiration; no payment/subscription created. Disposable customer deleted; default QA portal retained with invoice history only because Stripe rejects deactivation of its default configuration |
| Isolated real-provider payment lifecycle | Pending isolated sandbox/webhook setup |
| Live purchase, production deployment and observation | Pending external release gates |
| Physical report print spot check | Owner feedback pending; eight Letter/A4 PDFs already inspected |

Primary references: [Stripe webhooks](https://docs.stripe.com/webhooks), [idempotent requests](https://docs.stripe.com/api/idempotent_requests), [portal integration](https://docs.stripe.com/customer-management/integrate-customer-portal), [testing](https://docs.stripe.com/testing), [automated testing limits](https://docs.stripe.com/automated-testing).

## Quota acceptance repair

Integration review found that simultaneous trusted creates counted outside their writes, and direct subject reactivation could bypass Free limits. A private per-parent transaction coordinator and trusted reactivation adapter are being added. Existing over-limit records retain normal editing/archive/delete access. Quota validation passed9 persisted cases,6 rules cases and4 actual HTTP callable cases, including competing create/reactivate and Core beyond ten students.

Local integrated validation:13 main rules,4 compatibility,13 routine,8 planning,14 school API,9 quota persistence,6 quota rules,4 quota HTTP,22 billing persistence and4 billing HTTP cases pass, plus signature/raw-body checks. Browser run passed35/36 with one login-navigation timeout before assertions; its unchanged focused rerun passed in6.5 seconds. Follow-up clean CI [38846955531](https://github.com/TheCasey/gridworkz-lms/actions/runs/38846955531) passes all36 browsers in one run, all emulator checks, lint/build and PDF generation for implementation checkpoint`e1b5ed2`. Cloudflare preview deployment`df61e06e-5538-4715-bd23-e6f0bac05250` built successfully.
