# Pre-Merge Readiness Checklist

Last updated: 2026-05-26

Status: Private beta checkpoint checklist for the current chores/rewards and Lockdown hardening branch.

## Purpose

Use this before pushing, opening a PR, or merging the current `feat/chores-and-rewards-module` branch. The automated checks below establish local/static confidence. They do not replace seeded browser, callable, Stripe, Chrome Web Store, or security-hardening gates.

Source references:

- [Chores Phase 9 run log](../specs/chores-and-rewards-module-workflow/phases/phase-09-integration-hardening-and-launch-qa/run-log.md)
- [Chores runbook](chores-and-rewards-runbook.md)
- [Lockdown Chrome Web Store upload plan](lockdown-chrome-web-store-upload-plan.md)
- [Lockdown support runbook](lockdown-support-runbook.md)
- [Reporting safety fixes](../upgrades/reporting-safety-fixes.md)
- [Curriculum modal cleanup](../upgrades/curriculum-modal-cleanup.md)
- [Operator entitlement console](../specs/operator-entitlement-console.md)
- [Subscriptions and entitlements](../upgrades/subscriptions-and-entitlements.md)
- [Architecture security posture](../architecture.md#security-posture)

## Release Decision

- [ ] Decide whether this checkpoint is a private beta/internal release or a paid production launch.
- [ ] Treat private beta as acceptable only after automated validation and seeded smoke pass.
- [ ] Treat paid production launch as blocked until Stripe live-mode and Chrome Web Store installed-build gates are complete.
- [ ] Do not direct-push the mixed dirty tree to `main` without a PR review.

## Repo Hygiene Before PR

- [ ] Review dirty and untracked files with `git status --short --branch`.
- [ ] Confirm the branch only contains intended chores/rewards, Lockdown hardening, and documentation changes.
- [ ] Reconcile docs drift before PR: marketing status, subscriptions/chores packaging, architecture/platform gaps, and launch caveats.
- [ ] Keep any unrelated work out of the commit or call it out explicitly in the PR description.

## Automated Validation

Run these locally before opening the PR:

```bash
npm run lint
npm run build
node scripts/check-lockdown-release-package.mjs
node scripts/check-lockdown-policy-states.mjs
node scripts/check-lockdown-derived-policy.mjs
node scripts/check-lockdown-resource-normalization.mjs
node scripts/check-lockdown-device-management.mjs
node scripts/check-lockdown-extension-states.mjs
node scripts/check-lockdown-work-launcher.mjs
node scripts/seed-reporting-validation.mjs --dry-run
node scripts/check-chores-rewards-e2e.mjs
node scripts/check-chores-availability.mjs
node scripts/check-chores-entitlements.mjs
node scripts/check-chores-parent-view-model.mjs
node scripts/check-chores-trusted-contracts.mjs
node scripts/check-student-chores-view.mjs
node scripts/check-allowance-ledger.mjs
node scripts/check-points-ledger.mjs
node scripts/check-reward-redemptions.mjs
```

Expected caveat:

- `scripts/check-chores-trusted-contracts.mjs` can pass while still reporting that callable emulator coverage is not configured in `firebase.json`. That means seeded staging/deployed callable smoke is still required.

## Seeded Smoke Before Private Beta

- [ ] Generate or write disposable smoke fixtures:

```bash
node scripts/seed-private-beta-smoke-fixtures.mjs --dry-run
# or, with local emulators running:
node scripts/seed-private-beta-smoke-fixtures.mjs --write --target emulator
# or, against an explicitly disposable staging project:
node scripts/seed-private-beta-smoke-fixtures.mjs --write --target staging --confirm-staging-write
```

- [ ] Run callable smoke against the written fixture when functions are available:

```bash
node scripts/smoke-private-beta-callables.mjs --dry-run
# with seeded local emulators:
node scripts/smoke-private-beta-callables.mjs --run --target emulator
# with explicitly disposable staging data:
node scripts/smoke-private-beta-callables.mjs --run --target staging --confirm-staging-run
```

- [ ] Reports: run the reporting fixture against emulator or staging, save an assigned-but-incomplete week, print/export it, confirm student portal assigned block context, and confirm rollover archival expectations.
- [ ] Chores/rewards: use a seeded parent with two PIN-protected students and switch Free, Core/Pro, and Lockdown entitlements. Verify routine-only Free behavior, paid setup, student privacy, monthly cooldown, allowance/point updates from accepted completions, reward reservation/refund, and downgrade locking with preserved history.
- [ ] Operator console: seed `supportOperators/{uid}` and representative parent data. Verify non-operator denial, missing-record initialization, Free/Core/Lockdown overrides, clear override, downgrade warnings, audit timeline, and webhook-under-override behavior.
- [ ] Curriculum modal: use a disposable parent account to create, save, reopen, archive, and delete subjects/blocks. Do not use real household data for destructive checks.
- [ ] Lockdown unpacked extension: in a clean Chrome profile, verify pairing success/failure, allowed and blocked resources, no active work, no published plan, off-hours behavior, cached fallback, revoked device, downgrade, local unpair recovery, stale-cache recovery, and YouTube allowed/blocked creator behavior.

## Paid Production Gates

These are not optional for a broad paid launch:

- [ ] Stripe live-mode products, price IDs, webhook secret, Secret Manager values, endpoint configuration, and webhook smoke validation.
- [ ] Chrome Web Store publisher account, listing fields, extension icons, screenshots, privacy URL, support URL or email, distribution choice, upload, review, and installed-build validation.
- [ ] Production-like Lockdown account validation for pairing, revoke, downgrade, stale cache, YouTube enforcement, and support recovery.
- [ ] Decision and implementation path for emergency parent unlock or temporary allow behavior.
- [ ] Support rehearsal for pairing failures, revoked devices, stale cache, downgrade, local unpair, and stuck cached enforcement.
- [ ] Broader student portal/session hardening plan for public `students`, `subjects`, `submissions`, and `timerSessions` trust boundaries.
- [ ] Reporting compliance follow-up for Evidence Drawer, Storage-backed attachments, backend archival, and report locking behavior.

## PR Closeout

- [ ] PR description states the release bar: private beta checkpoint or paid production launch.
- [ ] PR description includes command evidence and the seeded smoke result.
- [ ] PR description lists remaining manual gates instead of implying production readiness.
- [ ] CI passes on the branch.
- [ ] Merge to `main` only after the selected release bar is satisfied.
