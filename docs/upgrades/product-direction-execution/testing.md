# Repeatable Runtime Validation

Use Node 20 (`nvm use` with `.nvmrc`, or `npx --yes --package=node@20 -c '<command>'`) and Java 21+.

```bash
npm ci
npm ci --prefix functions
npx playwright install chromium
npm run check:direction-contracts
npm run check:direction-emulators
```

The last command starts Auth, Firestore, and Functions on the configured local ports with the isolated project `demo-gridworkz-direction`, runs actual rules tests, seeds eight deterministic households, runs callable tests, then starts a separate emulator-configured Vite server on port 3107 for Chromium browser tests. It shuts down its own emulators afterward. The port differs from the normal development server so it cannot silently reuse another app session.

The seeder intentionally has no production/staging mode or project override; `--write` requires both Auth and Firestore emulator hosts on numeric loopback ports. Scenario identities and email/password are fixed test-only values. It resets records belonging to the chosen fixture household, never other household records. `--scenario=all` includes empty, single, Free quota boundary, Core with 11 students, Lockdown, legacy/shared-data, activated Free routines, and points-opt-out households. Paid creates above ten students now succeed through the trusted callable; Free quota checks remain enforced.

Browser coverage currently verifies authenticated parent/student loading and routine completion through the callable, persisted state, reload/re-PIN, and rendered completed state. The browser test cannot run by itself on an unseeded/stopped backend. New helper schemas are additive preparation; no new production UI is enabled yet.

Evidence goes under ignored `tmp/product-direction/`: emulator fixtures, browser failure traces/screenshots, and a persisted-routine screenshot. Never commit generated credentials or real household data. CI runs the same emulator/browser path and uploads failure evidence.

The routine-authority suite verifies concurrent day awards/debits, snapshot freezing, settings opt-out and capability overrides, ownership/revision persistence, owner-only obligation settlement after downgrade, and migration dry-run/replay/deactivation with billing/support preservation. Run `npm run check:routine-reward-helpers` and `npm run check:routine-entitlements` for pure policy/parity checks. Future phases extend browser coverage to the finished routine/cosmetic interface, real draft/publish/default UI, timers, parent correction races, saved report amendments/print, and billing. The current counts of passing tests are a foundation acceptance result, not proof those future flows have shipped.

Migration tooling is separate from the emulator-only seeder: `node scripts/migrate-routine-first-entitlements.mjs --project=demo-gridworkz-direction --target=emulator --parents=<fixture-parent>`. It defaults to a redacted dry-run; `--write` refreshes packaging without activation, `--write --activate` enables the routine-first contract, and `--write --deactivate` suspends it without deleting any ledger/history. Cloud targets require an explicit staging/production project and cannot run with an emulator host. Production activation remains a release gate.


SourcePhase3 adds browser-backed setup, wallet/unlock/equip persistence across reload/second session, mobile keyboard completion, failed-read retry, owner settlement after downgrade, missing-entitlement Free bootstrap, empty states and unsaved routine edit preservation. Every browser scenario resets only its deterministic household. Singleton parent/settings records are deleted by exact household id as well as owner query, including legacy records missing parent_id.

Future Free accounts use owner-only `initializeRoutineFirstAccount`, which accepts no client configuration and never overwrites an existing entitlement. Its private rollout gate is `productDirectionConfig/routineFirst` (`version:1`, `new_accounts_enabled:true`); client read/write is denied. Migration opt-in `--activate --enable-new-accounts` enables it only with an explicit write; `--deactivate --disable-new-accounts` turns it off for rollback. Dry-run leaves the gate untouched. These are coordinated release switches, not production QA commands.
