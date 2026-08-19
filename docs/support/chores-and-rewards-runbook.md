# Chores And Rewards Runbook

Last updated: 2026-05-26

## Launch State

- Module status: implemented after Phase 9 validation.
- Free: daily routine setup and daily routine completion only.
- Core/Pro and Lockdown: daily routines plus chore pools, weekly/monthly chores, allowance tracking, points, reward store, redemptions, achievements boundary, and placeholder avatar/badge/theme cosmetics.
- Downgrade: saved paid records remain visible to the parent, but new paid creates, allowance sync, point changes, chore reviews, reward catalog edits, and redemption state changes are locked until the account returns to Core/Pro or Lockdown.

## Security Boundary

- Firestore rules deny direct writes to chores/rewards collections.
- Parent reads are owner-scoped.
- Student portal chores/rewards state is loaded through PIN-verified trusted callables.
- Student-safe state must not expose sibling allowance records, point wallets, reward catalog eligibility, claims, or redemptions.
- School-block point awards remain deferred until school completion is server-owned.

## Validation Commands

Run these before launch handoff:

```bash
node scripts/check-chores-rewards-e2e.mjs
node scripts/check-chores-availability.mjs
node scripts/check-chores-entitlements.mjs
node scripts/check-chores-parent-view-model.mjs
node scripts/check-chores-trusted-contracts.mjs
node scripts/check-student-chores-view.mjs
node scripts/check-allowance-ledger.mjs
node scripts/check-points-ledger.mjs
node scripts/check-reward-redemptions.mjs
npm run lint
npm run build
```

## Manual QA

Use a seeded two-student household with PINs:

Fixture helper:

```bash
node scripts/seed-private-beta-smoke-fixtures.mjs --dry-run
# with local Auth and Firestore emulators running:
node scripts/seed-private-beta-smoke-fixtures.mjs --write --target emulator
# with local Auth and Functions emulators running after fixture write:
node scripts/smoke-private-beta-callables.mjs --run --target emulator
```

1. Free plan: create/edit a daily routine, complete it from the student portal, and confirm chore pools/rewards are not usable.
2. Core/Pro or Lockdown: create weekly and monthly chores, claim/complete as one student, and confirm the sibling does not see private claim/redemption state.
3. Complete a late-month monthly chore and confirm cooldown prevents immediate next-month repetition.
4. Approve a chore completion and confirm allowance and points update from accepted completions only.
5. Request a parent-created reward and confirm points reserve immediately; reject/cancel and confirm points refund.
6. Downgrade to Free and confirm history is visible while new paid creates/reviews/redemptions are blocked.

## Seeded Runtime Status

On 2026-08-19, the student portal path completed a disposable local emulator pass covering PIN unlock, student isolation, school timers/submissions, daily routines, chore completion and parent review, allowance/point effects, reward cancellation/refund, reward approval/fulfillment, and Free/Lockdown gating. See `student-portal-seeded-e2e-2026-08-19.md`.

Staging/browser confirmation is still required before production launch confidence:

- Parent target: `http://localhost:3000/dashboard/chores`
- Student target: `http://localhost:3000/student/:slug`
- Required staging seed: disposable parent auth, two students with PINs, entitlement switch between Free/Core/Lockdown, and deployed callable runtime.
