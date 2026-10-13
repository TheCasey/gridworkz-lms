# Phase 4 Run Log

## Status Snapshot

- Phase: `phase-04-ship-daily-routines-avatars-and-the-narrow-household-surface`
- Current status: `locally_verified`
- Current owner: `master-developer`
- Next downstream role: `none`
- Validation modes: `unit-regression`, `api-smoke`, `browser-smoke`
- Last updated: `2026-10-13`

## Master Developer Reviews

- Pending
## Developer Results

- 2026-10-13 — Frontend developer (`Sol`, high) implemented the activated surface. No commits, pushes, deployment, production access, fixture mutations, server starts/resets, or emulator writes were performed by this developer. Root owns persisted browser/callable validation and rollout.
- Parent activation uses the server-owned `entitlementDoc.product_direction_version >= 1`. The registry keeps existing URLs and labels Weekly Plan; activated navigation shows Daily Routines and private Household History. Weekly/monthly chores, allowance, and broad rewards direct URLs redirect to `/dashboard/chores/household-history`. The wrapper never mounts `LegacyChoresRoute` or its automatic allowance-sync effect when active; the parent shell disables its legacy chore snapshot hook while access is loading or active. Inactive households retain the legacy branch.
- New `DailyRoutinesRoute` uses `useRoutineParentData` for strictly owner-scoped Firestore reads. Free parents independently edit Morning/Afternoon/Evening checklists per student and narrow daily-award settings (default 10, including opt-out/zero). Canonical per-student records replace known shared period defaults without changing siblings. Unknown legacy routines remain visibly separate. Saved-day checklists/settings remain frozen until the next server day. Empty household, empty history, disabled capability, loading/error/retry states are explicit. History includes saved routine/chore templates/completions/claims, allowance, reward catalog/redemptions, wallets/point entries, and settlement events. It exposes only accepted existing-obligation actions; idempotency keys are retained per action across retries. There are no direct Firestore writes or legacy background synchronization.
- `useStudentChores` preserves the existing verified PIN contract and adds request generation/session identity guards. Old async reads/actions cannot render another student's routine/reward state. Activated reads render `StudentDailyRoutines` from frozen server `routine_day` and response templates/completions, requiring exact unique checklist IDs and a completion timestamp before disabling a completed card. Completion submits the frozen date. Narrow reward denial keeps the checklist available with `routine_rewards:null`. Same-student read errors retain last known saved data and show retry; a failed post-mutation refresh is no longer cleared accidentally.
- Student `RoutineCosmetics` uses only trusted catalog, wallet, ownership, and revision data. Unlock/debit and equip/clear-slot actions use callables and then reload server state. Seedling, Stargazer, Comet, and Twilight have finished bundled code-native SVG artwork, with saved avatar/badge reflected in the top bar and Twilight in the portal/routine/profile space. Known historical aliases receive matching art; unknown owned identifiers remain visible in Historic cosmetics with a documented Seedling compatibility preview. Unknown artwork never becomes an arbitrary URL, and historic ownership is never deleted. Earlier identifiers without canonical ownership cannot silently incur a new charge or send an invalid equip; their matching historic ownership remains visible.
- Trusted client adapters added in `src/firebase/trustedOperations.js`: `readTrustedStudentRoutineRewards`, `unlockTrustedRoutineCosmetic`, `selectTrustedRoutineCosmetics`, `upsertTrustedRoutineRewardSettings`, `settleTrustedHouseholdHistory`, and root-added owner bootstrap `initializeTrustedRoutineFirstAccount`. `useEntitlements` attempts missing-record bootstrap once per parent, with an in-flight guard; only the server `productDirectionConfig/routineFirst` rollout gate authorizes initialization, and existing entitlement records remain unchanged.
- Frontend files: `src/App.jsx`, `src/constants/dashboardFeatures.js`, `src/firebase/trustedOperations.js`, `src/hooks/useEntitlements.js`, `src/hooks/useStudentChores.js`, new `src/hooks/useRoutineParentData.js`, `src/pages/ParentDashboard.jsx`, `src/pages/StudentPortal.jsx`, `src/pages/Curriculum.jsx`, `src/pages/dashboard/ChoresRoute.jsx`, new `src/pages/dashboard/DailyRoutinesRoute.jsx`, `src/pages/dashboard/HomeschoolRoute.jsx`, `src/pages/dashboard/StudentsRoute.jsx`, `src/components/curriculum/WeeklyPlanReviewPanel.jsx`, new `src/components/student/StudentDailyRoutines.jsx`, new `src/components/student/RoutineCosmetics.jsx`, and new `src/utils/routineViewModel.js`. Artwork: `src/assets/routine-cosmetics/{baseSeedling,stargazerAvatar,cometBadge,twilightTheme}.svg`. Pure checks: `scripts/check-routine-view-model.mjs`.
- Browser integration selectors: parent `parent-daily-routines`, `household-history`; student `student-portal-chores-tab`, `student-portal-avatar-tab`, `student-daily-routines`, `student-routine-cosmetics`, `routine-<template-id>`, `routine-day-award`, `equipped-cosmetics`, and `cosmetic-<catalog-id>`. Setup labels: Student, Morning/Afternoon/Evening, Save Morning/Afternoon/Evening, Daily points, Enable routine points, Save routine settings. Student uses native labeled checkboxes, Complete routine/Completed, Unlock Stargazer, Equip Stargazer/Stargazer equipped, Remove badge, Use classic theme. Retry is Retry loading. History actions: Acknowledge payment, Mark fulfilled, Cancel and refund.
- Local verification passed under Node 20: full ESLint (`npx --yes --package=node@20 node node_modules/eslint/bin/eslint.js . --ext js,jsx --report-unused-disable-directives --max-warnings 0`), Vite production build (`npx --yes --package=node@20 node node_modules/vite/bin/vite.js build`), `scripts/check-routine-view-model.mjs` (19 assertions), student timer sessions, student chores view, chores parent view-model, chores entitlements, points ledger, and reward redemptions. Pure presentation checks cover mismatched frozen dates, partial/extra/duplicate IDs, missing completion timestamps, empty shared overrides, unknown legacy routines, and artwork alias preservation. Browser/persisted state evidence remains root/tester responsibility; these local commands do not establish those runtime passes.
- Visual QA follow-up: root screenshots exposed light-text inheritance on warm/light cards. Checklist/catalog/profile panels now explicitly pair charcoal text with warm cream; their normal/disabled/hover buttons retain readable paired colors, 44px targets and focus outlines. Equipped Twilight overrides all existing student palette variables together, rather than only the background, so shell headings/navigation/rails retain contrast. Canonical routine periods render Morning/Afternoon/Evening in order with unknown legacy routines retained. Root owns fresh screenshots and browser contrast assertions; frontend lint/build and 19 presentation checks pass.
- Independent QA follow-up: entitlement/owner-bootstrap failures now block both household branches and parent legacy reads, expose `Retry access`, and resubscribe/retry without remounting the portal. Entitlement document, has-document state, errors, feature/action access and usage input are scoped to the current parent; disposed/old-parent listener callbacks are ignored. Active bootstrap results are explicitly read before compatibility can render. Independent QA also found unsaved sibling-period drafts lost after refresh: draft caches now preserve dirty values per parent/student/period across period/settings saves and student switching; dirty daily-award edits survive period saves. Saved allowance earned/remaining totals both use the same existing-snapshot calculation. Full Node 20 lint/build pass after these fixes; persisted regression cases are root-owned.
- Integrated browser follow-up: direct Household History loads initially resolved its inactive hidden state before entitlements arrived, redirecting to Students. Hidden-feature redirects now wait for entitlement resolution (including missing-record bootstrap). Root owns the runtime regression/retest.
- Root coordinated backend additions identified during integration: harmless top-level frozen `routine_day` for narrow-denied reads/completions; canonical empty period overrides shared defaults; and gated owner bootstrap for missing new Free entitlement documents. No remaining frontend blocker is known; independent integrated browser/reviewer acceptance remains pending.
## Tester Results

- 2026-10-13 — Independent tester (`Sol`, medium) applied the React best-practices review skill within the existing React 18/Vite stack. Bounded source review covered student request identity/generation guards, frozen completion and equipped cosmetics, owner-scoped history reads/settlement retries, registry/direct-link routing, legacy background-hook suppression, new-account bootstrap, and its private rollout gate. The server initializer derives its owner from Auth, rejects client configuration, requires an existing parent, reads the private gate in the creation transaction, and preserves existing entitlement documents. No new server authorization defect found in this slice.
- Reported three UI findings and independently re-reviewed their fixes: failed bootstrap now exposes a retryable access-unavailable state through the parent shell/route and suppresses legacy hook mounting; entitlement records/errors are scoped to the current parent with guarded subscription/bootstrap callbacks and actions disabled while access resolves; period drafts are cached by parent/student with dirty-period tracking, and unsaved settings survive unrelated refreshes. All three findings are resolved in the bounded source review. Dirty flags clear only after the corresponding successful save. No additional defect found in this re-review.
- Node 20 validation passed: routine presentation **18 assertions**, backend routine helpers **166 assertions**, entitlement parity/migration checks, and full ESLint. These checks are pure/source checks. Persisted callable/browser validation remains **pending root confirmation**. This tester performed no emulator/browser runs, seeds/resets, production access, commits, or deployments.

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

Locally accepted after independent developer/tester review and actual persisted browser verification. Source review repaired failed initialization falling into legacy UI, cross-parent entitlement state, unsaved period/settings loss and direct History redirects before entitlement resolution. Visual inspection repaired inherited pale text on light cards; warm panels, readable buttons/focus and the complete Twilight palette now pass computed text contrast checks and desktop/mobile screenshot review. Morning/Afternoon/Evening order is explicit.

Root added safe new-account bootstrap and private rollout rules/CLI flags, top-level frozen day projection independent of wallet permission, intentional empty canonical override, singleton fixture reset for legacy records without parent_id, and browser/runtime regressions. Migration never activates existing records through owner bootstrap; a private configured release gate is required for a missing Free record. Activation remains dormant in production.

Final Node20 clean validation exited0: lint/build,166 backend policy assertions,19 presentation assertions, entitlement parity,3 fixture safety tests,106 shared contracts and timers; fresh emulator run passes7 persisted rules tests,4 compatibility callables,13 reward/migration/bootstrap cases and11 Chromium browser tests. Browser tests verify Free setup/settings/sibling isolation, missing-entitlement initialization and transient retry, zero-wallet first award/Comet unlock, Stargazer/Twilight equipment across reload/second device, frozen day state, empty setup, unsaved edits, mobile keyboard/overflow/contrast, load retry, stale URLs and owner history settlement after downgrade. History also passes mobile overflow. Evidence: ignored `tmp/product-direction/phase3-final-validation.log`, `phase3-browser-final.log`, `phase3-history-mobile.log`, and screenshots `browser-cosmetics-persisted.png`, `browser-routines-mobile.png`, `browser-household-history.png`. QA touched only the isolated demo project.

Frontend active branches never mount old allowance-sync/setup hooks while access resolves, fails or routine-first is active. Legacy paths remain for inactive records. Bundled SVGs use fixed server catalog IDs; unknown previous unlocks remain visible with a documented compatibility preview. Persisted selections change the student profile and theme.

Production promotion/activation remains pending backend/rules/UI deployment coordination and external release gates. Continue local sourcePhase4/operationalPhase5 Weekly Plan persistence and conditional timers. Do not represent this local acceptance as a live production rollout.
