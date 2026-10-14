# Accepted Execution Decisions

Recorded: 2026-10-12. Authorization: the user instructed, “Okay go ahead and begin execution plan,” after receiving the proposed plan. Apply that plan's recommended defaults; record any later steering here.

## Release Contract

- Public product labels: Daily Routines and Weekly Plan. Preserve existing route URLs/aliases.
- Free: complete implemented schoolwork and complete routine/cosmetic loop; 2 students and 3 active curriculum records. Core remains $5/month with `null` student/curriculum quotas; Lockdown inherits scale but remains coming soon for new purchases.
- Routine award: once per household-local day after every populated period is complete. No empty-day award; no item/period awards, streak penalty, or school-work awards. Default new settings to 10 points/day; preserve existing valid amounts. Snapshot qualifying templates on first daily use.
- Narrow routine reward capability is independent of paid broad rewards. Preserve wallets, historical catalogs/redemptions, and unlock IDs. Built-in cosmetics are included on Free; a small usable catalog and persisted selection ship before activation.
- Drafts/defaults are parent-private separate records. Published/archived `weeklyPlans` stay the student/report/extension authority. Publishing saves the validated current draft and published snapshot atomically with revision checks.
- Default weeks are student-specific. Saving never mutates an existing published week or another student's defaults. Legacy subject defaults remain fallback input.
- Parent corrections change status plus reason/note only. Server records actor/time, prior/new status, stable block identity, and idempotency. Undo preserves original evidence and reopens current work; a later valid submission may complete it again.
- Saved reports retain original snapshots. Later corrections create explicit amendment versions; archived work never returns to the current portal.
- Weekly/monthly chores, allowance, bounties, and broad custom rewards disappear from ordinary navigation. Parent-only Household History retains records and access to obligations. Disable new suspended setup/claims/catalog/redemption requests, including stale-client paths.
- Pending obligations: permit owner-only settlement of existing allowance records (acknowledge payment) and existing redemption reservations (cancel/refund or fulfill). No new points adjustment, obligation creation, broad reward review, or new claim is implied. Settlement must work after downgrade and append its own audit/reconciliation event.
- Existing subscriptions, customer/price IDs, and valid support overrides are preserved. Compatibility `pro` maps to Core where already supported. No automatic cancellation, subscription repricing, or charging occurs from packaging migrations.
- All implementation tests that mutate data use the isolated `demo-gridworkz-direction` emulator project or an explicitly identified disposable staging/QA household. Production family records remain untouched during QA.

## Deferred / External Gates

- Later Lockdown price, kiosk commercialization, projects, AI, PWA/mobile, general evidence uploads, and broader public-read/session redesign remain outside this release.
- Live payment validation requires an owner-authorized disposable purchase once checkout is implemented and reviewable. No payment is authorized merely by starting the execution plan.
- Cloudflare CLI deployment access is currently missing; requested local authentication. Production rollout remains pending that setup. Independent local implementation continues.

## Changes

2026-10-12: adopted the execution plan defaults and bounded pending-obligation settlement as above. No production mutations or billing changes made.

2026-10-14: Weekly Plan publish establishes server-owned per-student published authority, including missing/empty current weeks after a future publish. Publication copies canonical household reset/timezone to the public student record. Older households without a persisted timezone must save their school timezone in Settings before planning; the application surfaces this requirement rather than choosing different device/server defaults. Private drafts/defaults and v1 publication writes now require trusted revision adapters. Historical legacy publication archival uses the same trusted adapter after adoption. Current portal refreshes at weekly reset; removed or changed work invalidates open completion forms. Full trusted completion/correction authority follows in source Phase5.
