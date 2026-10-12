# Repeatable Runtime Validation

Use Node 20 (`nvm use` with `.nvmrc`, or `npx --yes --package=node@20 -c '<command>'`) and Java 21+.

```bash
npm ci
npm ci --prefix functions
npx playwright install chromium
npm run check:direction-contracts
npm run check:direction-emulators
```

The last command starts Auth, Firestore, and Functions on the configured local ports with the isolated project `demo-gridworkz-direction`, runs actual rules tests, seeds six deterministic households, runs callable tests, then starts a separate emulator-configured Vite server on port 3107 for Chromium browser tests. It shuts down its own emulators afterward. The port differs from the normal development server so it cannot silently reuse another app session.

The seeder intentionally has no production/staging mode or project override; `--write` requires both Auth and Firestore emulator hosts on numeric loopback ports. Scenario identities and email/password are fixed test-only values. It resets records belonging to the chosen fixture household, never other household records. `--scenario=all` includes empty, single, Free quota boundary, Core with 11 students, Lockdown, and legacy/shared-data households. Above-limit paid creates are covered when the Phase 2 entitlement authority changes; current baseline still caps paid creates at 10.

Browser coverage currently verifies authenticated parent/student loading and routine completion through the callable, persisted state, reload/re-PIN, and rendered completed state. The browser test cannot run by itself on an unseeded/stopped backend. New helper schemas are additive preparation; no new production UI is enabled yet.

Evidence goes under ignored `tmp/product-direction/`: emulator fixtures, browser failure traces/screenshots, and a persisted-routine screenshot. Never commit generated credentials or real household data. CI runs the same emulator/browser path and uploads failure evidence.

Future phases extend these fixtures/checks to narrow Free rewards, cosmetics, real draft/publish/default UI, timers, parent correction races, saved report amendments/print, and billing. The current counts of passing tests are a foundation acceptance result, not proof those future flows have shipped.
