# Environment And Historical Inventory

Verified 2026-10-12 with authenticated read-only Firebase/Firestore/Secret Manager/Stripe requests. No production document, subscription, rule, secret, or deployment was changed. Tokens/keys and household-identifying fields were kept out of output and committed artifacts.

## Confirmed Targets

- Git: `https://github.com/TheCasey/gridworkz-lms`; `origin/main` and initial checkout both at `e3120e1`. Workflow branch: `codex/product-direction-routine-first`.
- Production Firebase: `gridworkz-lms`, project number `4562943877`; 33 deployed functions in `us-central1`, `nodejs20`. `billingWebhook` is deployed; checkout/customer-portal creation functions are absent.
- Deployed Stripe key: test mode; its subscription listing contains zero subscriptions. This does not assert that another live Stripe account has no customers. Existing Firestore billing/override records are preserved regardless.
- Public hosts: `https://own-path.com` and `https://dashboard.own-path.com`, both HTTP 200 behind Cloudflare. README identifies `gridworkz-lms.pages.dev` and GitHub-based Cloudflare deployment.
- Cloudflare project `gridworkz-lms` and account `953fd6e3720dd469d84ee6347d5f23ce` are confirmed by the GitHub Pages check. The foundation commit `3bacc90` produced successful preview deployment `05e924cc-2605-489a-bb7e-744b348f587c` at `https://05e924cc.gridworkz-lms.pages.dev`. Production build branch/environment settings and rollback deployment IDs remain pending authenticated Pages access. `wrangler pages project list` refused non-interactive access without a configured credential. Local login was requested; no replacement token is stored in the repo.
- Local test target: `demo-gridworkz-direction`, loopback Auth 9099 / Firestore 8080 / Functions 5001; no production fallback is allowed by the new seeder.
- Supported baseline: Node 20.20.2, Java 25 available for emulators. Existing lockfiles installed; baseline lint/build/timer/entitlement/report/chores/points checks passed after correcting a stale test expectation.

## Production Aggregates

| Collection | Records |
| --- | --- |
| parents | 12 |
| accountEntitlements | 10 |
| students | 15 |
| subjects | 30 |
| weeklyPlans | 13 |
| weeklyReports | 45 |
| routineTemplates | 11 |
| routineCompletions | 5 |
| studentPointWallets | 4 |
| pointLedgerEntries | 4 |
| rewardCatalogItems | 2 |
| rewardRedemptions | 2 |
| allowancePeriods | 18 |

Migration-relevant shapes:

- Entitlements: 2 Free and 8 Lockdown; 2 active manual overrides. Stored subscription statuses: 8 active, 1 canceled, 1 trialing. Do not infer actual live billing from these fixtures/state labels.
- Subjects: 13 legacy single-student records and 4 multi-student records. All 30 use active or unspecified active status. Preserve both assignment shapes.
- Routine templates: 2 morning, 2 afternoon, 2 evening, 5 missing canonical period labels; 2 shared multi-student templates. Compatibility reads remain necessary.
- Redemptions: 2 requested. Preserve reservations and provide accepted owner-only settlement.
- Allowance periods: 16 paid and 2 unpaid. Preserve balances/history and expose accepted settlement before hiding administration.

Local redacted aggregate artifact: `tmp/product-direction/production-inventory.json` (ignored). The inventory queried only counts and selected shape/status fields with a 2,000-record ceiling; each returned set was below the ceiling. Detailed amounts, names, PINs, slugs, and response text were not printed.

## Outstanding Release Dependencies

Baseline note, superseded by the 2026-10-16 release entry below: Cloudflare authentication/project inspection initially remained unresolved. Access and the nonpayment internal-testing rollout are now verified. Payment, physical printing and full observation acceptance remain later gates.

## SourcePhase6 reporting validation (2026-10-15)

Read-only Firestore REST inspection rendered three representative weeklyReports in memory. Raw family text, IDs and dates were neither logged nor persisted; only aggregate shape/outcomes and fully redacted screenshots were retained under ignored tmp/product-direction/. The records included zero completion and historical evidence (one 33-assignment record with 90 recorded minutes). All rendered within the viewport. Two Epson ET-2800 printer queues are available; no print job was sent. Physical spot-check results remain pending owner feedback.

## SourcePhase7 billing validation (2026-10-15)

Read-only recheck confirmed the existing deployed secret remains test-mode, Core is USD500/month and there were no provider subscriptions. Its lifecycle webhook still points to the deployed production backend. Full subscription testing requires an isolated sandbox/webhook target and is pending owner setup; no production entitlement was written by QA.

Safe actual-provider session QA used only a disposable emulator parent and test customer: two Checkout sessions were opened/expired, open-session retries reused the exact hosted session and customer, and a portal session was created. No payment or subscription was created. QA customer was deleted and sessions closed. Stripe made the first test portal configuration the default and refused deactivation. It remains clearly labeled QA with invoice history only; subscription switching/cancellation and payment changes are disabled, and no app configuration references it. Own IDs remain only in the ignored cleanup receipt.

Cloudflare authentication recheck reports an expired token that cannot refresh noninteractively. Local `npx wrangler login` was requested again. Production settings, rollback IDs and actual deployment acceptance remain pending access.

## Checkpoint acceptance update (2026-10-16)

Implementation checkpoint`e1b5ed2` has green lint/build and complete emulator/browser CI run`38846955531`, including all36 browser cases in one clean run and generated report PDF artifacts. Successful Cloudflare preview: deployment`df61e06e-5538-4715-bd23-e6f0bac05250`, [preview](https://df61e06e.gridworkz-lms.pages.dev). This verifies the preview build only; it is not coordinated production acceptance.

Cloudflare local authentication recheck still fails because the token is expired and cannot refresh noninteractively. No local environment/secret file has appeared in the checkout. Isolated provider lifecycle setup and physical print feedback remain unconfirmed; no payment or production release has occurred.

## Owner-authorized family-testing rollout (2026-10-16)

Cloudflare OAuth access is restored. Project`gridworkz-lms` production branch is`main`; production and preview both point to Firebase`gridworkz-lms`, with emulator mode absent. Production rollback reference before this rollout is Pages deployment`5ad29e70-e897-4b71-a007-ddec24c7caa8` at commit`e3120e1`. The selected household exists with a saved school timezone and current paid-tier access; preserve the plan and protected financial/support fields. Private identifiers remain in ignored local metadata.

Fresh inventory found15 READY cloud indexes, all preserved in the local manifest. Eleven additive authority indexes were submitted. The backend release selects49 functions, including a closed billing-status adapter using existing secrets; purchase/portal creation and the existing webhook are omitted. Do not activate the selected household until required indexes, backend, rules and compatible UI are verified.

The cloud migration dry run initially exposed unsupported Admin Firestore custom credentials. `scripts/firebase-cli-cloud.mjs` now supplies the existing CLI OAuth client to the Google Firestore SDK in memory; actual selected-household cloud dry run succeeds without mutation. Credentials are never persisted by this helper.

## Internal testing live — 2026-10-16

The coordinated nonpayment rollout is complete. All 49 selected Functions are ACTIVE; the existing webhook is unchanged and checkout/portal creation exports are absent. All 26 indexes are READY. Deployed rules exactly match the reviewed local source: ruleset `a4df5000-9992-4ec7-8260-80bd5f9875fd`. Initial compatible Pages production deployment is `a4427c0f-9154-4eb7-b840-ee53ee532076` at merged commit `1fe41e1`; both production hosts and dashboard deep links return the app.

Exactly one selected existing household is activated; global new-account activation stays off. Original household records and protected plan/billing/support/usage fields are preserved. Four additional allowance periods appeared during rollout and remain retained; all 16 original allowance records hash identically to baseline. No ordinary family data was used for QA.

Nine actual cloud smoke stages passed using one disposable household, including browser-to-callable-to-data assertions and the saved amendment print popup. All QA data and its Auth account were cleaned up. A follow-up fixes parent routine/history text contrast with measured browser regression checks. See the [release record](internal-testing-release-2026-10-16.md) for boundaries and the [testing guide](internal-family-testing.md) for owner steps.
