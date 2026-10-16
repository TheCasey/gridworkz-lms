# Phase 3 Run Log

## Status Snapshot

- Phase: `phase-03-implement-routine-reward-and-entitlement-authority`
- Current status: `locally_verified`
- Current owner: `master-developer`
- Next downstream role: `none`
- Validation modes: `unit-regression`, `api-smoke`, `browser-smoke`
- Last updated: `2026-10-13`

## Master Developer Reviews

- Pending
## Developer Results

- 2026-10-13 — Backend developer (`Sol`, high) delivered the dormant routine authority in `functions/src/index.js`, `functions/src/routineRewardCatalog.js`, `functions/src/routineRewardContracts.js`, and `functions/src/routineRewardAuthority.js`; focused assertions are in `scripts/check-routine-reward-helpers.mjs`. No commit, deployment, production access, or fixture reset performed by this developer.
- Added raw `can_use_routine_rewards: true` on all plans, Core/Lockdown unlimited student scale, and compatibility `pro -> core`. Activation requires server-owned integer `accountEntitlements.product_direction_version >= 1`. Activated household access masks broad chore/reward mutation capabilities even when stored features or support overrides remain true. Activated daily-routine permission uses its own flag strictly, and narrow rewards also require daily permission; only unactivated access retains the legacy chore-flag fallback. Unactivated completion/read paths preserve legacy behavior. New endpoints deny inactive households.
- Resolver, manual-override apply/clear, billing synchronization, and effective entitlement response preserve/return the activation marker. `buildRoutineFirstEntitlementPatch({parentId, entitlementDoc, activate, nowMillis})` returns effective plan/features/limits and migration markers only; merge leaves nested billing, overrides, usage, and provider ids intact. For legacy records without nested billing_state, root plan_id remains the original billing source (pro is canonicalized), so a temporary override cannot become a permanent upgrade after expiry. Timestamp is stamped once and retained on replay. Activation is explicit; dormant migration preserves an existing active version.
- Browser-safe catalog/constants export one free `builtin_avatar_seedling` plus legacy-id unlocks `builtin_avatar_stargazer` (20), `builtin_badge_comet` (10), and `builtin_theme_twilight` (30). Root owns matching finished client artwork and presentation. `PRODUCT_DIRECTION_VERSION` and `ROUTINE_REWARD_MIGRATION_VERSION` are both 1.
- Calendar boundaries use a bounded search for the first instant of the local date, including skipped-midnight DST and skipped following calendar dates. First activated day use freezes per-student populated templates, checklist ids/labels, household timezone/day boundaries, reward amount, and enabled setting in `routineDaySnapshots`. Server-owned `routineDayPointers` pins the frozen local day until its original day boundary despite timezone edits. Canonical single-student periods supersede recognized shared/grouped equivalents; remaining legacy/grouped/unknown templates use explicit unique `legacy:<template-id>` periods with an optional inferred legacy period. Unknown templates are retained, never arbitrarily assigned to morning or silently dropped. Ambiguous canonical duplicates fail for repair.
- Activated `completeRoutine` requires the full exact frozen checklist and current frozen date (optional client date must match). One transaction reads all frozen completion ids and the existing `routine_day:<date_key>` ledger id, then saves completion and any award/wallet credit together. Concurrent final periods retry on common read dependencies. Partial/fake/empty-day inputs cannot award. Existing valid reward amounts, zero amounts, and opt-outs are preserved; absent settings default to 10/day enabled. Activated reads reconcile valid pre-activation/full-day completions lacking an award ledger, using the same identity, and return the updated wallet. Existing ledger entries never award twice.
- Student read APIs use existing verified `{student_id | slug, access_pin | pin}` context and expose only that student's frozen routines, wallet, built-in catalog, ownership/selection, day eligibility, and access. No custom catalogs, sibling records, broad chores/allowance pools, or old custom redemption details appear. Unchanged cosmetic reads do not rewrite the state; initialization/import preserves historic unlock ids and grants the free base. Positive-cost unlock/debit and ownership commit atomically; repeated unlocks do not debit again. Selection validates the owned server-catalog id, slot, and expected state revision.
- API payload/response: `readStudentRoutineRewards(context)` and activated `readStudentChoreState(context)` return `{contract:'routine_rewards_v1', student_id, routines, access, routine_rewards:{wallet,catalog,cosmetics,day,awarded,award_entry_id}}`. `unlockRoutineCosmetic(context + {cosmetic_id})` returns `{contract,cosmetic_id,already_owned,cosmetics,wallet}`. `selectRoutineCosmetics(context + {selected_cosmetic_ids,expected_revision})` returns `{contract,cosmetics}`. Cosmetics contain `{id,revision,owned_cosmetic_ids,selected_cosmetic_ids}`. Parent-authenticated `upsertRoutineRewardSettings({routine_day_points,routine_points_enabled})` rejects extra broad setting keys and returns `{contract,id,routine_day_points,routine_points_enabled}`. Completion retains `{contract,routine_completion_id,date_key,already_completed}` and adds `routine_rewards:{wallet,day,awarded,award_entry_id}` when narrow capability is allowed. Narrow support denial leaves routine completion available but performs no wallet/award-ledger reads and returns routine_rewards:null; daily denial rejects completion. Day contains `{snapshot_id,date_key,timezone,routine_day_points,routine_points_enabled,complete}`.
- Parent-authenticated `settleHouseholdHistory({obligation_type:'allowance'|'redemption',obligation_id,action:'acknowledge_payment'|'cancel_refund'|'fulfill',idempotency_key})` returns `{contract,event_id,status,replayed}`. It bypasses paid/narrow capability checks after activation so owners can settle after downgrade, but cannot create obligations or perform broad review/adjustments. Allowance acknowledgment pays only the existing earned remainder, including legacy records that require deriving the saved calculated amount plus saved parent adjustment without recomputing current policy. Redemption settlement requires a real matching reservation ledger for a positive snapshotted cost; cancel/refund reuses the original refund source identity and restores existing custom catalog stock, while fulfillment retains the reservation. Both append an immutable `householdHistoryEvents` record with actor/server time and original obligation, atomically with affected records. Settlement replay cannot issue a second refund or restore stock twice.
- Validation: `npx --yes --package=node@20 node scripts/check-routine-reward-helpers.mjs` passed **164 assertions** (pure helpers/resolver/write builders only; no backend reads/writes). Covered frozen requirements/defaults/opt-outs, canonical/legacy/grouped/unknown compatibility, exact item validation, empty/full/partial/fake days, missing-ledger reconciliation decisions, DST/local-day boundaries, scoped identities, catalog cost/ownership/selection, legacy unlock preservation, activation masking, all plan defaults/limits, support override and webhook marker preservation, and migration replay stability. `npx --yes --package=node@20 node node_modules/eslint/bin/eslint.js . --ext js,jsx --report-unused-disable-directives --max-warnings 0` passed. Persisted emulator/callable concurrency, privacy, denial, and migration verification are root/independent QA work; pure assertions do not establish those runtime passes.
- Remaining integration boundaries: root must add schema/rules/reset handling for `routineDayPointers` and `householdHistoryEvents`, finished client art, migration/activation orchestration, and persisted QA. This developer introduced no further product decisions. Structured weekly-plan exceptions remain the previously documented source Phase 4 contract expansion, unrelated to routine authority.
## Tester Results

- 2026-10-13 — Independent tester (`Sol`, medium) reviewed routine authority/contracts, trusted student context and entitlement guards, migration CLI/write builder, and persisted callable test coverage. Reported three reproducible issues: reward-disabled completion responses exposed wallet details; skipped-midnight DST in `America/Santiago` prevented day-window creation; migration of a legacy entitlement without nested billing state persisted a temporary paid override as its billing fallback. Developer fixes were re-reviewed: reward-disabled completion now avoids wallet/ledger reads and returns `routine_rewards: null`; day windows find the first instant of the local calendar date; legacy migration retains the underlying plan source while resolving effective features/limits separately. All three findings are resolved in source, with focused regression coverage. No additional concrete defect found in the bounded review.
- Independent Node 20 validation passed: routine helpers **164 assertions**, routine entitlement parity/migration checks, entitlement resolution checks, trusted chores contracts, chores entitlement checks, and points ledger assertions. These are pure/source checks and do not establish persisted runtime behavior. Final clean emulator chain is **pending root confirmation**; root owns all fixture resets and runtime mutations. This tester performed no emulator writes/resets, production access, commits, pushes, or deployments.

## Validation Evidence

- Pending

## Automated Test Evidence

- Pending

## Manual Verification

- None yet

## Project Manager Questions And Answers

- None yet

## Human Assistance

- None yet

## Git Checkpoint

- Pending

## Next Handoff

- Pending

## Open Questions Or Blockers

- None yet

## Completion Summary

- Pending


## Master Acceptance — 2026-10-13

Accepted locally after developer and independent tester review. Three review findings were fixed before acceptance: reward-denied completion wallet exposure, skipped-midnight DST, and temporary legacy override becoming a fallback billing plan. Migration equality now uses structural comparison because Firestore map key ordering is not stable.

Node20 clean `npm run check:routine-reward-helpers && npm run check:routine-entitlements && npm run check:direction-emulators` exited0:164 pure backend assertions, entitlement parity/migration checks,6 persisted rules tests,4 compatibility callables,12 routine-authority/migration runtime cases,2 Chromium baseline browser tests. Final runtime includes narrow capability denial, empty/evening-only days and actual legacy migration with temporary support override. Evidence: ignored `tmp/product-direction/phase2-final-validation.log`. Node20 lint/build/timer,106 shared contract assertions,3 fixture safety tests, and existing entitlement/chores/points/redemption checks also pass.

Root integrated schema/rules/reset fixtures, safe migration CLI, runtime API helper, persisted tests, npm/CI gates and documentation. The migration supports dry-run, dormant prepare, activation, replay and deactivation with audit receipts; it never changes wallets/ledgers/billing/override data. Original legacy top-level billing plan remains intact when no nested billing state exists.

Production/backend deployment and activation remain pending the complete routine interface and external release gates. Local acceptance enables frontend work; it is not production acceptance. Continue source Phase3/operational Phase4. No real households or payment systems were mutated in QA.
