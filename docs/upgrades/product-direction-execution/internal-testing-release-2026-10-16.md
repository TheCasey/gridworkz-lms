# Internal Family Testing Release — 2026-10-16

The nonpayment routine-first release is live for the owner-selected existing household. [Start testing](internal-family-testing.md). The owner explicitly deferred Stripe and broad launch acceptance; neither is a blocker for this internal testing milestone. Operational Phase 8 remains open for paid billing acceptance, and Phase 9's full observation/weekly-reset acceptance is still pending.

## Deployment evidence

| Component | Verified release |
| --- | --- |
| Public and parent hosts | `own-path.com` and `dashboard.own-path.com`; both hosts and nested dashboard URLs return the compatible app |
| Initial frontend promotion | PR 10 merged as `1fe41e1aff55e500b8dd3d0ba2797e1c57442ed5`; Cloudflare Pages production deployment `a4427c0f-9154-4eb7-b840-ee53ee532076`, successful at 17:47:40 UTC |
| Follow-up frontend | This release-record change also fixes parent routine/history text contrast and adds rendered contrast assertions; its PR and Cloudflare commit status identify the subsequent frontend promotion |
| Firebase project | `gridworkz-lms`, region `us-central1` |
| Functions | 49 selected nonpayment functions deployed and ACTIVE, including the closed billing-status adapter; 50 ACTIVE in inventory including the unchanged existing webhook |
| Rules | `projects/gridworkz-lms/rulesets/a4df5000-9992-4ec7-8260-80bd5f9875fd`, updated 17:46:19 UTC; downloaded source exactly matches reviewed `firestore.rules` |
| Rules SHA-256 | `8db74c78228f54b0dbb98b4862156ca2baee8adeb0312b841091e052507f79f0` |
| Indexes | All 26 READY; 11 additive indexes, all 15 previous indexes retained |
| Activation | Exactly one selected existing entitlement migrated to product-direction version 1; global new-account activation remains off |
| Payment scope | `createCoreCheckout` and `createBillingPortal` absent; existing `billingWebhook` source generation/hash unchanged |

The selected household retains its existing plan and protected billing, support-override and usage fields. Original students, subjects, plans, reports, routine templates, wallets, points, rewards and obligations were compared using private snapshots and hashes. Original records remain unchanged. Four additional allowance periods appeared during rollout; all 16 pre-existing periods match their original hash and the additional records were retained. The release did not invoke allowance synchronization on this household; no actor is inferred from timing alone. No owner schoolwork was published or completed by QA.

## Validation

- Initial promoted commit has green [CI 38942291325](https://github.com/TheCasey/gridworkz-lms/actions/runs/38942291325): lint/build, complete isolated emulator/API/rules checks, all 36 browser cases and generated report PDFs.
- Actual cloud smoke used one random disposable QA household, real authentication, deployed callables, both production browser hosts and persisted Firestore assertions. All nine stages passed: trusted creates/Free quotas/identity denials; parent draft/default/publish/reload; routine/settings saves; untimed student completion/evidence; timer start/pause/resume and early-completion rejection; owner correction/idempotency/immutable originals/amendment; single daily award/cosmetic unlock/equip/reload; saved-amendment print popup; and closed billing/narrow routes/mobile width.
- QA used no ordinary family records, Stripe calls, server-clock changes or provider mocks. Browser print-dialog invocation alone was instrumented. QA-owned Firestore records and Auth user were deleted, with cleanup verified.
- Parent routine/history readability was independently reviewed, fixed using the existing page palette, and checked through actual rendered contrast ratios of at least 4.5:1 for headings, labels, save notices and history text. Focused parent scenarios pass; full CI remains a merge requirement for this follow-up.
- Unauthenticated mutation/status endpoints reject requests with `UNAUTHENTICATED`; dashboard-origin CORS was verified.

Ignored local evidence is under `tmp/product-direction/internal-testing-*`: deployed inventory, cloud smoke receipt, release logs, record-preservation hashes and synthetic-only screenshots. Household identifiers, PINs, slugs, response text and credentials are excluded from versioned release docs.

## Operations and deferred checks

Refresh tabs opened before deployment. Use existing student links/PINs. Publish the intended current week from Weekly Plan; saving a draft/default or publishing only a future week does not assign current work. Review any legacy-work reconciliation prompt before publishing. Routine checklist/settings edits apply according to the saved daily snapshot; they do not rewrite a day already started.

Use compatible forward fixes after adoption. The old pre-release Pages deployment `5ad29e70-e897-4b71-a007-ddec24c7caa8` at `e3120e1` is an inventory reference, not a safe rollback after school-authority data is written. Keep additive backend support, original reports, evidence, ledgers and audit records. If an urgent stop is needed, suspend new user actions at the UI and repair the compatible release; do not restore old rules/backend or delete adopted family data.

Still deferred: isolated Stripe subscription lifecycle, any separately authorized live purchase and portal acceptance, physical printer feedback, actual full-duration timed completion on family devices, and the formal 48-hour/weekly-reset observation window. These are not represented as completed by the internal cloud smoke. New-account activation and general rollout remain off.
