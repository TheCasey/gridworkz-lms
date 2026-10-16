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
- Cloudflare CLI access was restored and verified on2026-10-16. Paid launch remains deferred; the owner authorized a nonpayment family-testing rollout.

## Changes

2026-10-12: adopted the execution plan defaults and bounded pending-obligation settlement as above. No production mutations or billing changes made.

2026-10-14: Weekly Plan publish establishes server-owned per-student published authority, including missing/empty current weeks after a future publish. Publication copies canonical household reset/timezone to the public student record. Older households without a persisted timezone must save their school timezone in Settings before planning; the application surfaces this requirement rather than choosing different device/server defaults. Private drafts/defaults and v1 publication writes now require trusted revision adapters. Historical legacy publication archival uses the same trusted adapter after adoption. Current portal refreshes at weekly reset; removed or changed work invalidates open completion forms. Full trusted completion/correction authority follows in source Phase5.

2026-10-15: School completion adopts PIN-verified submission/timer commands and owner-authenticated correction/report-filing commands, with server clock/week authority and immutable evidence. Official report creation is transactional with effective school state; client report creation and original updates are denied. Each new filing intent uses a fresh nonce, retaining exact retries only while outcome is uncertain. First school-authority publication snapshots applicable raw legacy execution or an older canonical publication; exact identity/content may link automatically, otherwise parents explicitly reconcile source links/new work. Original source IDs/events/evidence remain unchanged. Historical operations must not release another week’s timer. Production coordination must include Functions, rules, indexes and compatible UI before adoption.

2026-10-16: The owner confirmed Cloudflare login and explicitly deferred Stripe to prioritize testing with their children. Proceed with the compatible nonpayment backend, indexes/rules and production frontend; activate only the owner-selected existing household. Preserve its current plan/support overrides and all family work/history. Keep checkout/portal creation unavailable and leave the existing billing webhook unchanged. Full provider lifecycle, real payment and broad paid-launch/observation acceptance remain separate later gates. New-account activation stays off; ordinary household work is never QA fixture data. Use a separate disposable cloud QA household for mutation-based release checks. The selected sign-in identifier stays in ignored local release metadata, not public docs.

2026-10-16: The authorized internal-testing milestone is live: compatible backend/rules/indexes/frontend deployed, one selected household activated, and all nine disposable cloud smoke stages pass with cleanup verified. Original family records and protected entitlement fields are preserved; four additional allowance periods observed during rollout were retained, with all originals independently hash-verified. Parent routine/history contrast receives a small compatible follow-up. This milestone does not close the original paid-billing phase or claim physical printing/48-hour/weekly-reset acceptance. Resume those gates when the owner returns to Stripe or requests broader launch work.
