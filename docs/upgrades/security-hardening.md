# Security Hardening

Status: Ready

## Problem

The current student portal model depends on permissive Firestore rules for public access and writes.

## Current State

- Student records are publicly readable by design because slug lookup requires it.
- Subjects are publicly readable for the same reason.
- Submission creation is public.
- Timer session writes are unauthenticated but shape-checked.

## Upgrade Goals

- Reduce public write exposure.
- Move trusted state transitions out of the client where possible.
- Preserve a low-friction student experience while improving abuse resistance.

## Suggested Workstreams

- Redesign student session/auth strategy.
- Tighten Firestore rules around submissions and timer sessions.
- Move rollover/report archival into backend-owned logic.
- Revisit whether slug lookup needs to stay as broad as it is today.

## Phase 5 Trusted Enforcement Notes

- Phase 5 uses Firebase Cloud Functions as the narrow trusted surface for subscription enforcement in this repo.
- `accountEntitlements/{uid}` is now intended to be written only by one HTTPS billing webhook. This implementation assumes Stripe as the first billing contract and expects the webhook to receive a Stripe subscription object that includes `parent_id` metadata or a customer-level fallback plus either `plan_id` metadata or a configured Stripe price-id mapping.
- Missing `accountEntitlements/{uid}` documents continue to mean free-plan fallback. The client entitlement hook still renders the free plan when the document is absent, and the trusted `createStudent` / `createSubject` functions enforce free-tier caps the same way instead of mutating entitlement documents during creates.
- Deploy Functions and Firestore rules together. Once the rules deny direct client creates for `students`, `subjects`, and `accountEntitlements`, older clients that still write Firestore directly will fail until the callable-backed create flow is live.
- Existing students, existing subjects, and saved lockdown policy documents are preserved. Downgraded accounts can still edit, archive, or delete current subjects to get back under cap, while new student creates, new active-subject creates, and lockdown policy edits are backstopped by the trusted entitlement record.
- As of `2026-05-05`, the Phase 5 surface is live on `gridworkz-lms` in Stripe sandbox mode. Stripe runtime values are stored in Firebase Secret Manager rather than tracked repo files.
