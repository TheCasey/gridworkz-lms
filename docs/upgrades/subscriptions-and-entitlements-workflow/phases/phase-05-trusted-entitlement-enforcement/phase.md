# Phase 5: Trusted Entitlement Enforcement

## Goal

Move entitlement authority off client-owned records and add trusted write or rule backstops before launch, using a bounded research step to resolve the missing backend authority path.

## Depends On

- Phase 4: Lockdown Entitlement Integration

## Role Sequence

`master-developer -> researcher -> developer -> tester`

## Scope

- Resolve where trusted entitlement writes and billing sync should live in this Cloudflare Pages plus Firebase stack.
- Implement a server-owned or otherwise trusted path for accountEntitlements updates.
- Add rule-level or server-level backstops for plan-gated student creates, active-subject creates, and lockdown policy writes.
- Keep this phase aligned with the separate security-hardening track instead of swallowing that whole roadmap item.

## Deliverables

- Bounded recommendation for the trusted entitlement authority path
- Trusted entitlement write flow or backend sync entry point
- Backstop enforcement for gated create paths and lockdown writes
- Migration or rollout notes that preserve existing data and free-plan fallback behavior

## Files Or Areas To Touch

- firestore.rules
- src/constants/schema.js
- docs/upgrades/security-hardening.md
- new trusted entitlement sync surface selected in this phase

## Exit Criteria

- Normal clients can no longer mint or upgrade their own paid entitlement state through client-owned docs.
- The chosen trusted path is documented and implemented tightly enough that developer work is not guessing about billing authority.
- Plan-gated creates and lockdown writes have a rule or server backstop beyond client UI checks.
- The phase does not turn into a full security-hardening rewrite outside subscription enforcement.

## Test Commands

- npm run build

## Next Phase Inputs

- Trusted entitlement authority model
- Server-backed or rules-backed enforcement path for launch hardening
