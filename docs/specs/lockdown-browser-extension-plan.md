# Lockdown Browser Extension Plan

Status: PoC validated, production plan open

## Overview

This document outlines the post-PoC plan for a lockdown-mode browser extension and Chrome OS kiosk-mode extension, with integration to the GridWorkz student flow. The goal is to limit website browsing and YouTube access based on the current curriculum block, with separate states that manage website access during active school time, inactive blocks, and off-hours.

The Chrome MV3 proof of concept is now validated end-to-end:

- the parent dashboard can save a derived policy document
- the extension can pair to that document
- saved policy changes can sync back to the extension

This document now covers what has to happen after that proof of concept so the feature can be productized safely.

For the narrower prototype sequence, see [poc-lockdown-plan.md](poc-lockdown-plan.md).

This is still a future feature track. It should stay in `docs/specs/` until the production-safe behavior exists and can be rewritten as a current-state feature doc.

## Relevant Repository Files

Existing repo files that are likely to be involved in this work:

- `src/App.jsx`
- `src/pages/ParentDashboard.jsx`
- `src/components/LockdownPolicyPanel.jsx`
- `src/pages/Curriculum.jsx`
- `src/pages/Settings.jsx`
- `src/pages/StudentPortal.jsx`
- `src/constants/schema.js`
- `src/utils/weekUtils.js`
- `src/utils/timerUtils.js`
- `src/utils/schoolSettingsUtils.js`
- `src/utils/lockdownPolicyUtils.js`
- `firestore.rules`
- `docs/architecture.md`
- `docs/features/parent-dashboard.md`
- `docs/features/student-portal.md`
- `docs/upgrades/subscriptions-and-entitlements.md`

Likely responsibilities by file:

- `src/pages/ParentDashboard.jsx`: parent-facing remote control entry point and testing UI.
- `src/components/LockdownPolicyPanel.jsx`: current PoC policy editor, saved policy display, and extension pairing output.
- `src/pages/Curriculum.jsx`: curriculum-block resource selection and whitelist source data.
- `src/pages/Settings.jsx`: off-time schedule controls for additional approved resources.
- `src/pages/StudentPortal.jsx`: current student/block context and a future extension-side embedded dashboard.
- `src/constants/schema.js`: schema source of truth for any new lockdown, whitelist, schedule, or device-policy fields.
- `src/utils/weekUtils.js` and `src/utils/schoolSettingsUtils.js`: school-time calculations that can help define outside-school-time behavior.
- `src/utils/timerUtils.js`: block timing coordination if extension state mirrors active timer sessions.
- `src/utils/lockdownPolicyUtils.js`: policy normalization, defaults, and pairing-code helpers used by the current PoC.
- `firestore.rules`: remote-control, policy-read, and device-session trust boundaries.

If extension code is added to this repository later, a reasonable starting structure would be:

- `extensions/chrome-os-lockdown/manifest.json`
- `extensions/chrome-os-lockdown/service-worker.js`
- `extensions/chrome-os-lockdown/policy-sync.js`
- `extensions/chrome-os-kiosk/manifest.json`
- `extensions/chrome-os-kiosk/service-worker.js`

## Subscription Packaging

Lockdown is not a universal feature in the production roadmap.

Current planning decision:

- Free plan: no lockdown access
- Core plan: no lockdown access
- Lockdown plan: browser extension mode, kiosk mode, and future lockdown-specific setup flows

That means all future lockdown work should be built against the shared entitlement layer described in [upgrades/subscriptions-and-entitlements.md](../upgrades/subscriptions-and-entitlements.md), not as a standalone toggle hidden only in UI copy.

## Key States

1. `Block Active`: active blocking based on the current curriculum block.
2. `No Block Active`: no active curriculum block, so block-level whitelisting is not applied.
3. `Outside School Time`: blocking during off-hours, with access limited to explicitly approved additional resources.

## Features And Functionality

### Parent Dashboard

1. Select resources for a curriculum block:
   - Parents can select resources for each curriculum block.
   - Those resources should be automatically whitelisted during the active block.
2. Additional resources:
   - Parents can select additional resources for off-times.
   - Parents can set specific times when those additional resources are allowed.
3. Remote control:
   - Parents can use a web portal to control and test blocking features.

### Student Dashboard

1. Automatic blocking:
   - Block all non-approved websites during active curriculum blocks.
   - Limit access during off-times to approved additional resources during designated windows.
2. Future development:
   - A future iteration can integrate the student dashboard directly into the extension for more seamless operation.

## Extension Functionality

### Chrome OS Extension

1. Initial proof of concept:
   - Implement basic blocking functionality with simple buttons.
   - Test two different types of blocking behavior.
2. Integration with the student dashboard:
   - A future iteration can add a side panel that shows the student dashboard inside the extension.

### Chrome OS Kiosk Mode

1. Initial proof of concept:
   - Implement basic blocking functionality with simple buttons.
   - Test two different types of blocking behavior.
2. Integration with the student dashboard:
   - A future iteration can add a side panel that shows the student dashboard inside the kiosk-mode experience.

### Web Portal

1. Basic controls:
   - Provide basic buttons to control and test blocking features remotely.
2. Integration:
   - Ensure remote control works with both the Chrome OS extension and the kiosk-mode extension.

## Development Steps

1. Entitlement foundation:
   - Add shared subscription and feature-gating support before exposing lockdown as a launch-facing feature.
   - Ensure the parent dashboard can tell whether the signed-in account is allowed to manage lockdown features at all.
2. Production-safe policy model:
   - Replace the current PoC public-read path with a real device trust and pairing flow.
   - Decide whether devices consume a derived student policy, a per-device policy, or another server-owned representation.
3. Curriculum-aware policy generation:
   - Connect policy state to the active curriculum block, off-hours windows, and approved resources.
   - Keep those derived policies decoupled from raw public portal reads when possible.
4. Integration testing:
   - Test the integration between the extension, kiosk mode, and the student dashboard.
   - Verify that blocking changes follow the current curriculum block correctly.
5. Feedback and iteration:
   - Collect parent and student feedback.
   - Improve blocking behavior, policy clarity, and usability based on that feedback.
6. Future development:
   - Integrate the student dashboard directly into the extension where it helps the workflow.
   - Add more advanced controls and customization options.

## Product And Technical Questions

- Should approved resources be stored as exact URLs, domain-level origins, or a mixed allowlist model?
- How granular should YouTube support be: full domain, channel-level, playlist-level, or video-level?
- Should off-time access windows live on `students`, `subjects`, or a separate device-policy collection?
- How should the extension authenticate or pair with a student device without relying only on the current public `/student/:slug` model?
- Should the extension read the currently active block from Firestore directly, or should the parent dashboard publish a derived policy document for devices to consume?
- Should a downgraded parent keep read-only access to prior lockdown configurations, or should the UI hide them entirely until re-upgrade?
- How should the parent-management surface bypass or coexist with active blocking on the same machine or profile?

## Documentation Notes

- Keep implementation planning in `docs/specs/lockdown-browser-extension-plan.md` until the feature exists.
- When the extension and web controls are live, add or update current-state docs under `docs/features/`.
- If the work expands into security or architecture changes, add companion docs under `docs/upgrades/` rather than overloading this plan.
