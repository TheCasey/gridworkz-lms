# Core Pricing And Launch Positioning

Last updated: 2026-10-15

Status: routine-first implementation in progress; live payment acceptance pending

This replaces the earlier June packaging proposal. The accepted contract is recorded in [execution decisions](../upgrades/product-direction-execution/decisions.md).

| Plan | Current promise | Purchase availability |
| --- | --- | --- |
| Free | 2 students, 3 active curriculum records; complete schoolwork, Weekly Plans, reports, Daily Routines, daily points and built-in avatars | No payment required |
| Core | Same complete experience; unlimited students and active curriculum records | $5 USD/month; server-approved checkout only when configured and activated |
| Lockdown | Existing access and provider mappings preserved; future focus controls | Coming soon for new purchases |

Core adds household scale. School completion, timers, reflections, reports and the complete implemented routine/cosmetic loop are included on Free. New broad chores, allowance and custom rewards are paused; Household History preserves records and permits the approved existing-obligation settlements. New projects and later Lockdown pricing remain outside this release.

## User-facing surfaces

- Marketing pricing/FAQ and signup use the same Free/Core/Lockdown promise. The homepage starts Free; account Settings shows the server-reported billing options. No homepage CTA starts a Lockdown purchase.
- Settings shows current access, actual usage and billing options independently. Test billing is visibly labeled. Missing configuration or a failed read never implies purchase availability.
- Quota notices link to Settings and preserve existing students/curriculum/work. Free accounts cannot create or reactivate above the cap through another path.
- Checkout loading prevents repeated clicks. An uncertain outcome retains its exact account-scoped intent across reload. Redirects are provider navigation only; entitlement changes require trusted billing reconciliation.
- A verified customer can manage subscriptions after downgrade. The portal cannot switch plans into a new Lockdown purchase.

## Technical release contract

`createCoreCheckout`, `createBillingPortal` and `getCoreBillingStatus` derive identity from Firebase authentication and require an existing parent. Prices, provider IDs and return origins are server-owned. `billingAccounts` and private immutable intent/attempt/event records support fenced coordination, exact retry and current-provider reconciliation. See the active [billing phase](../upgrades/product-direction-execution/phases/phase-08-ship-live-core-billing-and-consistent-product-copy/phase.md).

Existing subscriptions retain their customer/subscription/price IDs. Historic prices and pro-to-Core compatibility are recognized through explicit server mappings. Support overrides, usage and routine-first markers survive billing changes. Legacy bindings require provider-verified transition; writable parent profiles never establish customer ownership.

Live rollout still requires approved products/prices/secrets/origin and portal configuration, coordinated backend/UI deployment, an owner-authorized disposable real purchase/manage/cancel check, and the production observation window. Local or sandbox checks do not satisfy those gates.
