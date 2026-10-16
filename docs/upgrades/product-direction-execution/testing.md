# Repeatable Runtime Validation

Use Node 20 (`nvm use` with `.nvmrc`, or `npx --yes --package=node@20 -c '<command>'`) and Java 21+.

```bash
npm ci
npm ci --prefix functions
npx playwright install chromium
npm run check:direction-contracts
npm run check:direction-emulators
```

The last command starts Auth, Firestore, and Functions on the configured local ports with the isolated project `demo-gridworkz-direction`, runs actual rules tests, seeds nine deterministic households, runs callable tests, then starts a separate emulator-configured Vite server on port 3107 for Chromium browser tests. It shuts down its own emulators afterward. The port differs from the normal development server so it cannot silently reuse another app session.

The seeder intentionally has no production/staging mode or project override; `--write` requires both Auth and Firestore emulator hosts on numeric loopback ports. Scenario identities and email/password are fixed test-only values. It resets records belonging to the chosen fixture household, never other household records. `--scenario=all` includes empty, single, Free quota boundary, Core with 11 students, Lockdown, legacy/shared-data, activated Free routines, points-opt-out, and isolated school-correction households. Paid creates above ten students now succeed through the trusted callable; Free quota checks remain enforced.

Browser coverage currently verifies authenticated parent/student loading and routine completion through the callable, persisted state, reload/re-PIN, and rendered completed state. The browser test cannot run by itself on an unseeded/stopped backend. Production deployment and adoption remain pending the coordinated release gates.

Evidence goes under ignored `tmp/product-direction/`: emulator fixtures, browser failure traces/screenshots, and a persisted-routine screenshot. Never commit generated credentials or real household data. CI runs the same emulator/browser path and uploads failure evidence.

The routine-authority suite verifies concurrent day awards/debits, snapshot freezing, settings opt-out and capability overrides, ownership/revision persistence, owner-only obligation settlement after downgrade, and migration dry-run/replay/deactivation with billing/support preservation. Run `npm run check:routine-reward-helpers` and `npm run check:routine-entitlements` for pure policy/parity checks. Routine/cosmetic and draft/publish/default interfaces and conditional timers now have persisted browser coverage. SourcePhase5 adds trusted parent correction races and saved report amendments; simplified print is under integrated validation and billing remains a subsequent phase. The current counts of passing tests are a foundation acceptance result, not proof those future flows have shipped.

Migration tooling is separate from the emulator-only seeder: `node scripts/migrate-routine-first-entitlements.mjs --project=demo-gridworkz-direction --target=emulator --parents=<fixture-parent>`. It defaults to a redacted dry-run; `--write` refreshes packaging without activation, `--write --activate` enables the routine-first contract, and `--write --deactivate` suspends it without deleting any ledger/history. Cloud targets require an explicit staging/production project and cannot run with an emulator host. Production activation remains a release gate.


SourcePhase3 adds browser-backed setup, wallet/unlock/equip persistence across reload/second session, mobile keyboard completion, failed-read retry, owner settlement after downgrade, missing-entitlement Free bootstrap, empty states and unsaved routine edit preservation. Every browser scenario resets only its deterministic household. Singleton parent/settings records are deleted by exact household id as well as owner query, including legacy records missing parent_id.

Future Free accounts use owner-only `initializeRoutineFirstAccount`, which accepts no client configuration and never overwrites an existing entitlement. Its private rollout gate is `productDirectionConfig/routineFirst` (`version:1`, `new_accounts_enabled:true`); client read/write is denied. Migration opt-in `--activate --enable-new-accounts` enables it only with an explicit write; `--deactivate --disable-new-accounts` turns it off for rollback. Dry-run leaves the gate untouched. These are coordinated release switches, not production QA commands.

SourcePhase4 adds `npm run check:weekly-planning-helpers` and `npm run check:weekly-planning-callables`; the latter is included in the full emulator chain. Browser checks cover private draft/published isolation, per-student future defaults, atomic current-candidate publish, retained copies, two-tab conflicts, exact lost-response retry, adopted empty/missing weeks, conditional timer controls/pause/resume/completion, active-timer preservation, stale modal invalidation, live custom reset and mobile navigation/keyboard reachability. Fixture block identities are deterministic and Admin app instances are unique so all test files collect and reset independently. Calendar checks compare browser/server DST/custom reset windows and report payload keys.

SourcePhase5 adds `npm run check:school-authority-helpers` (server foundation, student timer clock projection, report effective counts and parent view/retry helpers) and `npm run check:school-authority-callables` in the emulator chain. Runtime checks exercise owner/PIN/sibling/forged-field denials, immutable evidence, undo/resubmit, competing corrections, server-enforced elapsed time, non-timed completion preserving another timer, explicit saved-report amendments, first-publication reconciliation/continuity and missing/empty adopted weeks. Browser cases include parent correction retries across reload, live revision review, report version choice and second-device portal status. Timed browser QA backdates only an Admin-owned emulator fixture; changing the device clock cannot satisfy the server timer. Household calendar/clock-skew coverage supplements the pure DST/reset-boundary checks.

`firestore.indexes.json` now preserves the read-only production index inventory and adds authority query indexes. Emulators do not validate production composite-index availability. Release validation must deploy/build indexes before coordinated Functions/rules/UI activation, and must exercise the actual cloud queries on a disposable household. No index deployment is implied by local passing tests.

Official report filing now uses the trusted `fileSchoolWeeklyReport` adapter. API tests serialize it with a correction, exercise archived amendments while a current timer is active, and cover new filing intents after an empty result or owner deletion. Browser tests cover unamended deletion/refiling with a fresh nonce and server-relative week refresh under device date skew. Fixture publications default to the current school completion contract; legacy migration cases explicitly seed older metadata.

## Report screen and print validation

SourcePhase6 uses `npm run check:report-print` for the shared browser-safe presentation and escaping contract, plus `tests/product-direction/reports.spec.js` in the isolated browser suite. Live and saved screens and all print buttons use the same normalized models. Subject filters select entire student/week records; they do not silently change completion totals. Original versus amendment choice controls both details and printed output.

Run `npm run render:report-pdfs` after installing Playwright Chromium to produce eight synthetic Letter/A4 PDFs and their HTML/manifest under ignored `tmp/product-direction/report-pdfs/`. CI preserves those artifacts for visual review. The long-content cases cover 32 blocks/eight subjects, long names/responses/resources, escaped HTML, zero completions and legacy unknown duration. This generation check does not itself prove visual quality. Locally, `scripts/check-report-pdfs.py` runs with a Python runtime containing pdfplumber to verify paper size, text geometry, required content and page numbers; render every PDF with `pdftoppm` and inspect page images after print-layout changes. Physical print verification is a separate manual release item. Never commit real household responses or identifiers in validation artifacts.
