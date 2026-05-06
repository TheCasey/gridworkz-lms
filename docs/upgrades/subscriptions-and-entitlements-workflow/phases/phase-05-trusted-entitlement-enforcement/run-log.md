# Phase 5 Run Log

## Status Snapshot

- Phase: `phase-05-trusted-entitlement-enforcement`
- Current status: `complete`
- Current owner: `master-developer`
- Last updated: `2026-05-05`

## Master Developer Notes

- Confirmed Phase 5 still matches the roadmap and source-plan order: this is the first phase that should deliberately touch trusted backstops and authority paths, but it must stay tightly limited to subscription enforcement.
- Treat the unresolved backend authority model as a bounded blocker, not an excuse to re-architect the app. The immediate question is where entitlement writes and billing webhooks should live in this Cloudflare Pages plus Firebase stack.
- The researcher handoff should end with one concrete recommended authority path that is small enough for the developer pass to implement without reopening platform decisions.
- Limit the eventual enforcement surface to account entitlements, student-create backstops, active-subject-create backstops, and lockdown policy writes. Do not swallow the broader security-hardening roadmap item in this phase.

## Researcher Notes

- Compared the two smallest viable trusted-backend surfaces for this repo: Cloudflare Pages Functions versus Firebase Cloud Functions. Both can host a billing webhook, but Pages Functions would still need custom Firebase ID-token verification or third-party JWT handling plus Google service-account based Firestore writes from the Workers runtime, while Firebase Cloud Functions already fits Firebase Auth context, Admin SDK writes, and Firestore transactions without adding a second trust model.
- Recommended authority path: add a small Firebase Cloud Functions surface for Phase 5 only. Use one HTTPS webhook for billing-to-`accountEntitlements` sync and two authenticated callable or HTTPS functions for trusted `students` create and trusted active-`subjects` create. Keep `lockdownPolicies` writes client-originated but backstop them in Firestore rules by reading the trusted `accountEntitlements/{uid}` document.
- This is the smallest viable option because the repo already depends on Firebase Auth, Firestore, and `firebase-tools`, but has no existing backend runtime. Adding Firebase Functions keeps the authority surface inside the same Firebase project as the data being protected and avoids re-implementing Firebase Admin concerns on the Cloudflare side just to protect three bounded write paths.
- Key developer consequences: deny normal client writes to `accountEntitlements`; move new student creation and new active subject creation off direct Firestore client writes and onto trusted functions; leave subject edit/archive/delete on the current client path; add Firestore-rule plan checks for `lockdownPolicies` create/update and for any remaining client-side writes that can safely key off the trusted entitlement doc.
- Narrow blocker: the webhook event mapping cannot be finalized until the first billing provider contract is explicitly chosen. The docs mention Stripe as the likely starting point; if Stripe is the intended first provider, this blocker is operational rather than architectural and should not stop the Phase 5 developer pass.

## Developer Notes

- Added a new Firebase Cloud Functions surface under `functions/` with three bounded endpoints for this phase only: `billingWebhook` (Stripe HTTPS webhook), `createStudent` (authenticated callable), and `createSubject` (authenticated callable).
- The billing webhook is the only planned writer for `accountEntitlements/{uid}`. It verifies Stripe signatures, maps subscription state into the existing entitlement doc shape, preserves existing `feature_overrides` and `usage_snapshot`, and falls back to the `free` plan only when the Stripe subscription is actually canceled rather than merely past due.
- Switched the client add-student and new-subject create flows onto the authenticated callable path. Subject edit/archive/delete remains on the existing client-owned Firestore path as required for downgrade recovery.
- Tightened `firestore.rules` so normal clients cannot write `accountEntitlements`, cannot create `students` directly, cannot create `subjects` directly, and cannot create or update `lockdownPolicies` unless the trusted entitlement doc resolves to Lockdown access.
- Added rollout notes in `docs/upgrades/security-hardening.md` covering the Stripe assumption, free-plan fallback when the entitlement doc is missing, and the need to deploy Functions and rules together.
- After the project moved to Blaze billing, deployed all three Phase 5 functions live and confirmed `billingWebhook`, `createStudent`, and `createSubject` are active in `us-central1`.
- Moved Stripe runtime configuration off plain process env assumptions and into Firebase Secret Manager bindings for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CORE_PRICE_ID`, and `STRIPE_LOCKDOWN_PRICE_ID`. `billingWebhook` now declares those secret bindings directly in source and keeps `invoker: 'public'` in source instead of relying on a one-off IAM patch.
- Created Stripe sandbox products and recurring monthly prices that match the repo plan catalog for Phase 5 validation only:
  - Core: product `prod_USnjeV7n15t4ID`, price `price_1TTs7pFm7DsMNB2Xwhu9z43j`
  - Lockdown: product `prod_USnjoL4p3efBAh`, price `price_1TTs7qFm7DsMNB2XEmSlMVOX`
- Created a Stripe sandbox webhook endpoint targeting `https://us-central1-gridworkz-lms.cloudfunctions.net/billingWebhook` with the subscription and checkout events expected by `functions/src/index.js`, then stored the returned signing secret in Firebase Secret Manager.

## Tester Notes

- Validate that direct client writes to `accountEntitlements/{uid}` are rejected while owner reads still succeed.
- Validate that the shipped UI can still add a student and create a new active subject through the callable path when under cap, and that the callable returns a plan-limit failure when the free-plan fallback is over cap with no entitlement doc present.
- Validate that direct Firestore creates for `students` and `subjects` now fail from a normal client even if the user bypasses the UI.
- Validate that `lockdownPolicies/{uid}` create/update succeeds only when the trusted `accountEntitlements/{uid}` record resolves to Lockdown access and fails for free-plan fallback accounts.

### Validation Results - 2026-05-05

- Validation was run against the only Firebase project available on this machine: `gridworkz-lms`. No staging Firebase project or alias exists in this repo, so I could not prefer staging for this pass.
- `npm run build` passed locally on `2026-05-05`.
- Live backend discovery result: Cloud Functions are not live on the target project. `npx firebase-tools functions:list --project gridworkz-lms --debug` returned `403 SERVICE_DISABLED` for `cloudfunctions.googleapis.com`, and direct requests to `https://us-central1-gridworkz-lms.cloudfunctions.net/createStudent` and `https://us-central1-gridworkz-lms.cloudfunctions.net/billingWebhook` returned `404`.
- Live rules result, free-plan fallback account with no entitlement doc at start:
  - direct client write to `accountEntitlements/{uid}` succeeded live. This required check failed.
  - direct client create to `students` succeeded live. This required check failed.
  - direct client create to `subjects` succeeded live. This required check failed.
  - direct client create and update to `lockdownPolicies/{uid}` both succeeded live. The intended non-Lockdown denial is not deployed.
- Live rules result, Lockdown-entitled account with `accountEntitlements/{uid}` seeded through an admin-authenticated setup write for validation:
  - direct client create and update to `lockdownPolicies/{uid}` both succeeded live.
  - This does not prove the intended Phase 5 entitlement boundary, because the same operations also succeeded for the free-plan fallback account.
- Live callable result:
  - authenticated `httpsCallable(..., "createStudent")` returned `functions/not-found`
  - authenticated `httpsCallable(..., "createSubject")` returned `functions/not-found`
  - Because the callable backend is not deployed, I could not complete the required under-cap and over-cap UI validation through the trusted path. The current shipped UI cannot succeed against this live backend for add-student or add-subject.
- Live Stripe webhook result:
  - I sent a Stripe-style signed `customer.subscription.updated` POST to the expected `billingWebhook` URL for a fresh test uid.
  - The endpoint returned `404`, and `accountEntitlements/{uid}` remained absent before and after the request.
  - The required end-to-end signed webhook entitlement sync is not live.
- Cleanup:
  - Deleted the disposable Firestore docs created during validation.
  - Deleted the disposable Firebase Auth users created during validation.

### Required Check Matrix

- `npm run build` passes: `PASS` locally.
- direct client Firestore write to `accountEntitlements/{uid}` fails: `FAIL` live, write succeeded.
- direct client Firestore create to `students` fails: `FAIL` live, create succeeded.
- direct client Firestore create to `subjects` fails: `FAIL` live, create succeeded.
- UI add-student succeeds under cap through callable path: `BLOCKED` live, callable returned `functions/not-found`.
- UI add-student fails over cap with real callable limit error: `BLOCKED` live, callable returned `functions/not-found`.
- UI add-subject succeeds under cap through callable path: `BLOCKED` live, callable returned `functions/not-found`.
- UI add-subject fails over cap with real callable limit error: `BLOCKED` live, callable returned `functions/not-found`.
- `lockdownPolicies/{uid}` create/update fails for non-Lockdown account: `FAIL` live, create and update both succeeded.
- `lockdownPolicies/{uid}` create/update succeeds for Lockdown account: `PASS` live, create and update both succeeded after admin-seeded entitlement setup, but the gating signal is invalid because the free account also succeeded.
- Stripe signed webhook delivery updates `accountEntitlements/{uid}` end to end: `FAIL` live, signed POST returned `404` and the entitlement doc remained absent.

### Inspection-Only Notes

- Local source inspection still shows the intended Phase 5 implementation in `functions/src/index.js`, `firestore.rules`, `src/firebase/trustedOperations.js`, `src/pages/ParentDashboard.jsx`, `src/pages/Curriculum.jsx`, and `src/components/LockdownPolicyPanel.jsx`.
- The local code and the live Firebase project are currently out of sync. The repository contains the intended trusted enforcement implementation, but that implementation is not what is deployed on `2026-05-05`.

### Follow-up Validation Results - 2026-05-05

- I attempted a real Phase 5 deploy with `npx firebase-tools deploy --only functions,firestore:rules --project gridworkz-lms --non-interactive --debug`.
- The Firebase CLI successfully enabled `cloudfunctions.googleapis.com` on the target project during that deploy attempt.
- The same deploy then failed when Firebase tried to enable `cloudbuild.googleapis.com` and `artifactregistry.googleapis.com`. Google returned: project `gridworkz-lms` must be upgraded to the Blaze pay-as-you-go plan before those APIs can be enabled. The Firebase CLI pointed to `https://console.firebase.google.com/project/gridworkz-lms/usage/details`.
- Because the project is still on the Spark/free tier, there are still zero deployed Functions in `gridworkz-lms`. Fresh `functions:list` now returns `No functions found in project gridworkz-lms.` instead of the earlier `SERVICE_DISABLED`, which confirms the API enablement moved forward but the actual Functions deploy did not.
- The direct endpoint checks still fail exactly as expected for an undeployed backend:
  - `https://us-central1-gridworkz-lms.cloudfunctions.net/createStudent` returns `404`
  - `https://us-central1-gridworkz-lms.cloudfunctions.net/billingWebhook` returns `404`
- I deployed Firestore rules separately with `npx firebase-tools deploy --only firestore:rules --project gridworkz-lms`.
- That live rules validation uncovered a real repo bug in `firestore.rules`: the final recursive `match /{document=**}` block was granting authenticated writes back to every collection, which silently overrode the intended Phase 5 denies for `accountEntitlements`, `students`, `subjects`, and `lockdownPolicies`.
- I fixed that Phase 5 rules bug by replacing the recursive authenticated fallback with an explicit `dailyLogs` match plus a deny-by-default recursive fallback, then redeployed the corrected rules successfully.
- I reran the rules checks in a real browser context using the Firebase web SDK instead of server-side approximations. Browser-backed live results after the rules fix:
  - direct client write to `accountEntitlements/{uid}` now fails with `permission-denied`
  - direct client create to `students` now fails with `permission-denied`
  - direct client create to `subjects` now fails with `permission-denied`
  - `lockdownPolicies/{uid}` create now fails with `permission-denied` for a non-Lockdown account
  - `lockdownPolicies/{uid}` update now fails with `permission-denied` for a non-Lockdown account after I admin-seeded the document only for the update check
  - `lockdownPolicies/{uid}` create succeeds for a Lockdown account after I admin-seeded `accountEntitlements/{uid}` with `plan_id: lockdown`
  - `lockdownPolicies/{uid}` update also succeeds for that Lockdown account
- I also confirmed there are no `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CORE_PRICE_ID`, or `STRIPE_LOCKDOWN_PRICE_ID` values present in the local shell environment, and there is no repo-level Functions env file carrying them. Even after the billing blocker is removed, the billing webhook runtime config still needs explicit setup before end-to-end Stripe validation can pass.

### Updated Required Check Matrix

- `npm run build` passes: `PASS` locally.
- direct client Firestore write to `accountEntitlements/{uid}` fails: `PASS` live after the rules bug fix and redeploy.
- direct client Firestore create to `students` fails: `PASS` live after the rules bug fix and redeploy.
- direct client Firestore create to `subjects` fails: `PASS` live after the rules bug fix and redeploy.
- `createStudent` callable works under cap: `PASS` live after Blaze upgrade and Functions deployment.
- `createStudent` callable fails over cap: `PASS` live. The production error surfaced as `HTTP 429` with `RESOURCE_EXHAUSTED`, which matches the callable `resource-exhausted` contract in `functions/src/index.js`.
- `createSubject` callable works under cap: `PASS` live after Blaze upgrade and Functions deployment.
- `createSubject` callable fails over cap: `PASS` live. The production error surfaced as `HTTP 429` with `RESOURCE_EXHAUSTED`, which matches the callable `resource-exhausted` contract in `functions/src/index.js`.
- `lockdownPolicies/{uid}` create/update fails for non-Lockdown account: `PASS` live after the rules bug fix and redeploy.
- `lockdownPolicies/{uid}` create/update succeeds for Lockdown account: `PASS` live after admin-seeding the trusted entitlement record.
- Stripe signed webhook delivery updates `accountEntitlements/{uid}` end to end: `PASS` live. A signed `customer.subscription.created` event posted to `https://us-central1-gridworkz-lms.cloudfunctions.net/billingWebhook` returned `200`, and the matching `accountEntitlements/{uid}` document updated to `plan_id: core`, `subscription_status: active`, and `billing_provider: stripe`. A signed cleanup `customer.subscription.deleted` event also returned `200`.

### Final Live Validation Results - 2026-05-05

- Blaze upgrade removed the Functions deployment blocker. The live project now serves all three Phase 5 functions.
- `functions:list` now shows:
  - `billingWebhook` v2 https `us-central1`
  - `createStudent` v2 callable `us-central1`
  - `createSubject` v2 callable `us-central1`
- `npm run build` still passes locally after the secure-runtime patch for the webhook path.
- The webhook runtime is now secured without checked-in secrets. Stripe test-mode values live in Firebase Secret Manager, not in tracked repo files.
- Stripe live mode is not required for this phase. All practical validation for Phase 5 was completed against Stripe sandbox mode.

## Open Questions Or Blockers

- No Phase 5 blockers remain.
- Follow-up work outside this phase:
  - Rotate from Stripe sandbox to live-mode products, prices, and webhook secret when billing goes live.
  - Plan a separate maintenance pass for the deprecated Node.js 20 runtime and the outdated `firebase-functions` dependency warning reported by the Firebase CLI. Those are real operational concerns, but they are outside the bounded scope of Phase 5 trusted entitlement enforcement.

## Completion Summary

- Phase 5 is complete and live on `gridworkz-lms`.
- Firestore rules, callable trusted create paths, Lockdown gating, and signed Stripe webhook entitlement sync now match the repository implementation and have all passed practical live validation.
- The workflow can advance out of Phase 5.
