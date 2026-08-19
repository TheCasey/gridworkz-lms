# Disposable Validation Accounts

Last updated: 2026-06-23

Status: Active internal support note for disposable browser-smoke and plan-level QA accounts.

## Purpose

Use this note when a workflow needs a disposable authenticated parent session instead of guessing at stale shared credentials.

## Current Local Credential Index

The current live credentials are stored locally in:

- `tmp/validation-accounts/dashboard-shell-accounts-20260623.md`

Related generated fixture artifacts:

- `tmp/validation-accounts/dashboard-shell-free-20260623.json`
- `tmp/validation-accounts/dashboard-shell-lockdown-20260623.json`

These files are intended for local internal use on this machine and can be rotated without changing product docs.

## Current Account Set

- One disposable parent account seeded on the `free` plan
- One disposable parent account seeded on the `lockdown` plan
- One shared disposable operator account seeded in `supportOperators`

Each parent fixture also includes:

- two students
- student portal slugs and PINs
- seeded curriculum, reports, weekly plans, chores/rewards, and points/reward records
- a disposable curriculum subject reserved for destructive QA

## Regeneration

Use the existing fixture writer instead of manually creating accounts:

```bash
node scripts/seed-private-beta-smoke-fixtures.mjs --write --target staging --confirm-staging-write --plan free --parent-email <email> --parent-password <password> --operator-email <email> --operator-password <password> --output tmp/validation-accounts/<artifact>.json

node scripts/seed-private-beta-smoke-fixtures.mjs --write --target staging --confirm-staging-write --plan lockdown --parent-email <email> --parent-password <password> --operator-email <email> --operator-password <password> --output tmp/validation-accounts/<artifact>.json
```

After rotation:

- update the local credential index under `tmp/validation-accounts/`
- update this doc if the local index path changes
- do not restore stale shared credentials to `README.md`

## Usage Notes

- Prefer the `free` parent for locked-state and baseline shell checks.
- Prefer the `lockdown` parent for paid-shell and Lockdown-surface checks.
- Use the shared operator account to switch parent entitlements in `/ops/entitlements` when a workflow needs to move between Free, Core, and Lockdown without creating another parent.
