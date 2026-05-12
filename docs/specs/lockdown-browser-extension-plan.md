# Lockdown Browser Extension Plan

Status: Browser extension current-state live; kiosk-mode and broader hardening follow-on open

Launch-state note as of 2026-05-11:

- The MV3 browser-extension runtime is now migrated to the trusted enrollment and trusted device-policy contract.
- `/dashboard/lockdown` now issues student-bound trusted enrollment material for Lockdown-entitled parents and preserves downgrade-safe read-only behavior when the entitlement is inactive.
- Paired browsers exchange enrollment material through `lockdownExchangeEnrollment`, then sync policy through `readLockdownDevicePolicy` with an opaque device credential.
- `lockdownPolicies/{parentId}` remains only as a compatibility and migration boundary. It is not the active runtime trust boundary for paired browsers.
- Real runtime validation now exists for trusted pairing, secure sync, weekly-plan-derived and off-hours state propagation, restart fallback, sync-failure fallback, approved-origin allow behavior, blocked-navigation redirects, and approved YouTube creators.

## Overview

This document now tracks two things:

- the completed current-state browser-extension contract
- the remaining follow-on planning for kiosk mode and broader Lockdown hardening

The goal remains the same: limit website browsing and YouTube access based on the current weekly block or project work, with separate states for active school time, inactive blocks, and off-hours. What changed is that the browser-extension path is no longer only a future plan.

The launched browser-extension path now includes:

- student-bound trusted pairing from `/dashboard/lockdown`
- one-time enrollment exchange into an opaque device credential
- credential-authenticated device-policy reads through Cloud Functions
- published-weekly-plan-derived policy state plus school-time, timer, and off-hours inputs
- cached fallback across restart and temporary sync failure
- approved-origin, blocked-navigation, and approved-creator enforcement inside the MV3 runtime

For the narrower prototype sequence, see the [archived Lockdown PoC workflow](../archive/lockdown-browser-extension-poc/poc-lockdown-plan.md).

Current-state behavior now lives in [../architecture.md](../architecture.md), [../features/parent-dashboard.md](../features/parent-dashboard.md), and [../features/student-portal.md](../features/student-portal.md). This spec stays in `docs/specs/` because kiosk mode and broader post-launch hardening are still future work.

## Relevant Repository Files

Existing repo files that are likely to be involved in this work:

- `src/App.jsx`
- `src/pages/ParentDashboard.jsx`
- `src/components/LockdownPolicyPanel.jsx`
- `src/pages/Lockdown.jsx`
- `src/firebase/trustedOperations.js`
- `src/pages/Curriculum.jsx`
- `src/pages/Settings.jsx`
- `src/pages/StudentPortal.jsx`
- `src/constants/schema.js`
- `src/utils/weekUtils.js`
- `src/utils/timerUtils.js`
- `src/utils/schoolSettingsUtils.js`
- `src/utils/lockdownPolicyUtils.js`
- `firestore.rules`
- `functions/src/index.js`
- `extensions/chrome-lockdown-poc/background.js`
- `extensions/chrome-lockdown-poc/policy.js`
- `extensions/chrome-lockdown-poc/options.js`
- `extensions/chrome-lockdown-poc/popup.js`
- `docs/architecture.md`
- `docs/features/parent-dashboard.md`
- `docs/features/student-portal.md`
- `docs/upgrades/subscriptions-and-entitlements.md`

Likely responsibilities by file:

- `src/pages/ParentDashboard.jsx`: parent-facing remote control entry point and testing UI.
- `src/components/LockdownPolicyPanel.jsx`: live parent-facing Lockdown management surface for trusted pairing, derived-state visibility, off-hours setup, and compatibility history.
- `src/pages/Lockdown.jsx`: dedicated dashboard route for the Lockdown launch surface.
- `src/firebase/trustedOperations.js`: client bridge for parent-authenticated trusted enrollment issuance.
- `src/pages/Curriculum.jsx`: current curriculum resource selection and future template/assignment resource source data.
- `src/pages/Settings.jsx`: off-time schedule controls for additional approved resources.
- `src/pages/StudentPortal.jsx`: current student/block context and a future extension-side embedded dashboard.
- `src/constants/schema.js`: schema source of truth for any new lockdown, whitelist, schedule, or device-policy fields.
- `src/utils/weekUtils.js` and `src/utils/schoolSettingsUtils.js`: school-time calculations that can help define outside-school-time behavior.
- `src/utils/timerUtils.js`: block timing coordination if extension state mirrors active timer sessions.
- `src/utils/lockdownPolicyUtils.js`: policy normalization, defaults, derived preview helpers, and trusted pairing-code helpers.
- `functions/src/index.js`: trusted issuance, exchange, and device-policy read endpoints.
- `extensions/chrome-lockdown-poc/background.js`: active MV3 secure-sync and enforcement runtime despite the historical folder name.
- `extensions/chrome-lockdown-poc/policy.js`: extension-side pairing normalization, device sync state, and cached fallback behavior.
- `extensions/chrome-lockdown-poc/options.js` and `extensions/chrome-lockdown-poc/popup.js`: trusted pairing, secure-sync status, and migration messaging.
- `firestore.rules`: compatibility-only snapshot boundaries plus server-owned enrollment and device records.

The active browser-extension runtime already lives in this repository under `extensions/chrome-lockdown-poc/`. Future kiosk-mode work should use its own separate extension directory instead of widening that current runtime path.

## Subscription Packaging

Lockdown is not a universal feature in the production roadmap.

Current planning decision:

- Free plan: no lockdown access
- Core plan: no lockdown access
- Lockdown plan: browser extension mode, kiosk mode, and future lockdown-specific setup flows

That means all future lockdown work should be built against the shared entitlement layer described in [upgrades/subscriptions-and-entitlements.md](../upgrades/subscriptions-and-entitlements.md), not as a standalone toggle hidden only in UI copy. It should also align to the future weekly-plan and project model rather than depending permanently on the current flat subject shape.

## Current Browser-Extension Contract

The launched browser-extension contract is:

1. Parent-authenticated issuance:
   - `issueLockdownEnrollment` is a callable Cloud Function available only to signed-in parents with the Lockdown extension entitlement.
   - `/dashboard/lockdown` requires a selected student and issues short-lived student-bound enrollment material.
   - The one-time ticket is stored in the server-owned `lockdownEnrollmentSessions` collection.
2. Extension-facing enrollment exchange:
   - `lockdownExchangeEnrollment` is a public HTTP Cloud Function that accepts the short-lived enrollment token plus device metadata.
   - The function exchanges that ticket for an opaque device credential, stores the resulting server-owned device record in `lockdownDevices`, and consumes the ticket so it cannot be reused.
3. Credential-authenticated policy reads:
   - `readLockdownDevicePolicy` is a public HTTP Cloud Function that accepts the opaque device credential and returns the device policy payload.
   - The function returns derived device policy and never requires the extension to call Firestore directly.
4. Derived policy source:
   - The returned policy is derived from published weekly plans, timer context, school-time rules, and student off-hours windows.
   - The current contract names that source `published_weekly_plan_derived_policy_v1`.
5. Cached fallback:
   - The extension keeps the last good policy in local storage and reapplies it on startup before any network work.
   - Temporary sync failure keeps cached enforcement active until secure sync recovers.
6. Compatibility and downgrade boundaries:
   - `lockdownPolicies/{parentId}` still exists as compatibility history and migration-boundary input only.
   - The parent dashboard keeps saved Lockdown setup visible in read-only mode on downgrade, but pairing and edits stay disabled until the Lockdown plan is restored.

## Key States

1. `Block Active`: active blocking based on the current weekly block or project work block.
2. `No Block Active`: no active weekly block, so block-level whitelisting is not applied.
3. `Outside School Time`: blocking during off-hours, with access limited to explicitly approved additional resources.

## Features And Functionality

### Parent Dashboard

1. Select resources for a curriculum block:
   - Parents can select resources for each weekly block or project work block.
   - Those resources should be automatically whitelisted during the active block.
2. Additional resources:
   - Parents can select additional resources for off-times.
   - Parents can set specific times when those additional resources are allowed.
3. Remote control:
   - Parents can use a web portal to control and test blocking features.

### Student Dashboard

1. Automatic blocking:
   - Block all non-approved websites during active weekly blocks.
   - Limit access during off-times to approved additional resources during designated windows.
2. Future development:
   - A future iteration can integrate the student dashboard directly into the extension for more seamless operation.

## Extension Functionality

### Browser Extension Current State

1. Current launch behavior:
   - Pair a student-bound device from `/dashboard/lockdown`.
   - Securely sync the derived policy with an opaque device credential.
   - Allow approved origins and approved YouTube creators while redirecting blocked top-level navigation to the extension block page.
2. Current parent management model:
   - Parents manage pairing, derived policy visibility, and off-hours inputs from the dashboard.
   - Downgraded accounts keep saved setup visible in read-only mode.

### Chrome OS Kiosk Mode

1. Follow-on scope only:
   - Kiosk mode is not part of the launched browser-extension runtime.
   - Reuse the same entitlement rail and trusted policy contract where it makes sense, but keep implementation and rollout planning separate from the browser-extension closeout.

### Web Portal

1. Basic controls:
   - Provide basic buttons to control and test blocking features remotely.
2. Integration:
   - Ensure remote control works with both the Chrome OS extension and the kiosk-mode extension.

## Completed Browser-Extension Scope

1. Entitlement-gated Lockdown management now lives on the shared dashboard shell.
2. Student-bound trusted pairing now starts from `/dashboard/lockdown`.
3. The MV3 runtime now exchanges enrollment material for an opaque device credential and reads policy through the trusted device-policy endpoint.
4. Device policy now reflects published weekly-plan-derived state, timer context, school-time rules, and off-hours resources.
5. Cached fallback, approved-origin allow behavior, blocked redirects, and approved YouTube creator enforcement have recorded real runtime evidence.
6. Downgraded parents keep their saved Lockdown setup visible in read-only mode instead of losing it.

## Follow-On Scope

1. Implement and validate Chrome OS kiosk mode on a separate workstream.
2. Retire compatibility-only `lockdownPolicies/{parentId}` usage when legacy support is no longer needed.
3. Continue broader security hardening for the public student portal, submissions, timer sessions, and related Firestore rules.
4. Adapt Lockdown inputs as the weekly-plan and project model evolves.
5. Decide whether future student-dashboard embedding or richer remote-control flows add enough value to justify added complexity.

## Product And Technical Questions

- Should approved resources be stored as exact URLs, domain-level origins, or a mixed allowlist model?
- How granular should YouTube support be: full domain, channel-level, playlist-level, or video-level?
- Should off-time access windows live on `students`, `assignments`, weekly plans, or a separate device-policy collection?
- The browser-extension launch resolved the trust-boundary question by using Cloud Functions plus server-owned enrollment and device records instead of relying on public Firestore reads or raw Firebase web config as the effective secret.
- The browser-extension launch also settled the parent downgrade question in favor of downgrade-safe read-only visibility.
- How should the parent-management surface bypass or coexist with active blocking on the same machine or profile?

## Documentation Notes

- The browser-extension current state now belongs in [../architecture.md](../architecture.md), [../features/parent-dashboard.md](../features/parent-dashboard.md), and [../features/student-portal.md](../features/student-portal.md).
- Keep kiosk-mode and broader Lockdown hardening planning here until those follow-on tracks become current state.
- If the work expands into wider security or architecture changes, add companion docs under `docs/upgrades/` rather than overloading this plan.
