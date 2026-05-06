# Phase 1: Entitlement Foundation

## Goal

Freeze the shared plan contract in code, represent the server-owned entitlement document shape, and add a reusable read path that later UI phases can consume without duplicating tier logic.

## Depends On

- None

## Role Sequence

`master-developer -> developer -> tester`

## Scope

- Add one source of truth for stable internal plan ids, numeric limits, and feature flags.
- Represent the planned account-entitlement document shape in code without trusting the owner-writable parents document as the paid-access authority.
- Introduce a shared entitlement hook or helper that can return current plan, derived usage, limit checks, and upgrade-needed copy.
- Treat curriculum usage as active subjects only, excluding inactive or archived subjects from the free-tier cap.

## Deliverables

- Shared entitlement catalog with free, core, and lockdown plan definitions
- Code-level contract for the planned accountEntitlements document
- Reusable entitlement read path with a safe free-plan fallback
- Helper logic that counts only active subjects toward curriculum limits

## Files Or Areas To Touch

- src/constants/entitlements.js
- src/constants/schema.js
- src/hooks/useEntitlements.js
- src/utils/entitlementUtils.js

## Exit Criteria

- Stable plan ids, limits, and flags are defined in one shared module.
- The app has one reusable entitlement read path instead of phase-specific inline tier logic.
- Curriculum-limit helpers count only active subjects.
- The phase stops short of changing create flows or dashboard UI behavior.

## Test Commands

- npm run build

## Next Phase Inputs

- Shared plan and feature-flag contract
- Entitlement helper or hook API
- Active-subject counting rule for curriculum usage
