# Lockdown Simplification And Extension Launcher

Status: Source plan for phased workflow scaffold

Last updated: 2026-05-27

## Purpose

The trusted Lockdown extension path is live, but the parent setup page and extension UI still expose too much internal policy, diagnostic, and legacy setup detail. The next workflow should make Lockdown feel like a parent-manageable learning browser, not a policy console.

This plan defines the product and implementation direction for a simpler parent Lockdown module, a clearer resource model, tighter paired-device behavior, and a small extension-side student launcher that can start or resume active work and immediately drive the device policy.

## Goals

- Keep parent-controlled weekly schedule setup, but present it as a summary with a focused edit modal.
- Replace the long inline Lockdown settings surface with compact summary cards and task-specific modals.
- Make off-block approved resources a parent-owned household resource library with per-student assignments.
- Keep active block resources derived from the student's published weekly plan and current work session.
- Let the extension show the student what is allowed right now and, in a basic launcher, start or resume a block from the published plan.
- Remove paired-student self-service controls that let the student clear pairing or turn blocking off.
- Add parent-visible device risk signals for revoked, stale, or locally cleared pairings where the backend can detect them.
- Preserve the trusted device credential model, cached policy behavior, and Own Path system allowlist.
- Make the workflow finishable with automated scripts plus a Chrome profile QA pass before Chrome Web Store publication.

## Non-Goals

- Do not implement full whole-device parental controls, OS controls, VPN controls, or kiosk mode in this workflow.
- Do not promise uninstall or extension-disable prevention for unmanaged consumer Chrome profiles.
- Do not rebuild the whole curriculum, weekly planning, or student portal model.
- Do not make the extension a second curriculum source. It should read published weekly-plan and timer/session state.
- Do not add a YouTube Data API dependency unless the project manager explicitly approves the key, quota, and privacy posture.
- Do not complete the actual Chrome Web Store upload in this workflow. The goal is package and QA readiness, with upload remaining a manual release action.

## Product Model

### Schedule

The weekly schedule remains parent-controlled. It defines when the paired learning browser should enforce the school-time Lockdown policy.

The first simplified version should preserve current behavior:

- During scheduled school time, Lockdown is active.
- Outside scheduled school time, Lockdown network blocking is off unless a later product decision explicitly reintroduces approved off-hours enforcement windows.
- If school time is active and no work block is active, the browser allows Own Path system resources plus parent-approved off-block resources for that student.
- If school time is active and a work block is active, the browser allows Own Path system resources, parent-approved off-block resources for that student, and resources attached to the active block.

Any migration from the current `lockdown_schedule.off_hours_windows` shape should be backward-compatible and should not strand existing saved resources.

### Resource Library

The parent manages one household-level resource library for Lockdown. Each resource can be assigned to all students or a selected set of students.

Supported first-version resource types:

- Website origin: exact `http` or `https` origin, with no wildcard support.
- YouTube creator: stable channel ID when available, plus display title and handle metadata when known.

The resource editor should accept common parent inputs:

- Website URL or origin.
- YouTube channel URL, handle URL, creator URL, or channel ID.
- YouTube watch URL as an optional convenience that extracts obvious local channel metadata only when available; full remote resolution needs a separate approval.

The UI should hide raw policy IDs and contract names by default. Advanced metadata can stay behind an "Advanced" disclosure.

### Active Block Resources

Active block resources come from the student's published weekly plan and the currently active timer or work session.

When the student starts a block from the student portal or extension launcher:

- A timer or active work-session record is created or resumed.
- The trusted policy reads should immediately include that block's supported resources.
- The extension should update its local policy without waiting for a long polling interval.

When the block ends, those block resources stop being part of the active allowlist. Parent-approved off-block resources remain allowed while Lockdown enforcement is active.

### System Resources

Own Path system resources are always allowlisted when Lockdown enforcement is active. This includes:

- `https://own-path.com`
- `https://www.own-path.com`
- Student portal routes.
- Extension pages.
- Trusted Lockdown endpoints required for enrollment, policy sync, and launcher actions.

Parent dashboard access from a paired student profile remains a product decision. The default should avoid accidentally making parent admin pages part of the student allowlist.

### Devices

Pairing remains student-bound. A device credential belongs to one student and one parent account.

The parent page should summarize:

- Paired devices for the selected student.
- Last seen and last policy sync.
- Revoked or inactive devices.
- Stale devices based on a documented threshold.

Local paired-browser controls should not let a student clear pairing or turn blocking off. Any local unpair or emergency unlock should require a parent-controlled action or clearly documented managed-device setup.

## Parent UX Direction

The Lockdown route should become a summary-first management page.

Top-level structure:

- Student selector at the top.
- Current status strip for the selected student.
- Weekly schedule summary card with "Edit schedule" modal.
- Off-block resource library summary card with counts for websites, YouTube creators, and assigned students, plus "Manage resources" modal.
- Paired devices summary card with device count, stale/revoked count, and "Manage devices" modal.
- "Pair a browser" card or button that opens a guided pairing wizard.
- "Allowed right now" preview card that shows the current effective allowlist and reason.
- Advanced diagnostics collapsed by default.

The long inline panels for derived policy, raw contract names, legacy PoC pairing, resource internals, and device tables should move behind modals or an advanced area.

### Pairing Wizard

The pairing wizard should walk the parent through:

1. Select the student.
2. Confirm the Chrome profile should be the student's learning profile.
3. Generate the trusted enrollment code.
4. Paste the code into the extension setup page.
5. Confirm the extension reports secure sync.
6. Read hardening guidance for managed Chrome, extension force-install, guest profile limitations, and why consumer Chrome cannot fully prevent uninstall.

The wizard should be honest about limits. It can explain that a managed Chrome environment is required to reliably prevent extension removal or disabling.

### Resource Modal

The resource modal should let the parent:

- Add a website or YouTube creator.
- Assign the resource to all students or selected students.
- See validation feedback before saving.
- Edit or archive a resource.
- Filter by student.
- See which resources are available during school time when no active block is running.

## Extension UX Direction

The popup should become a student-facing launcher and status surface, not a policy dashboard.

Required states:

- Unpaired: show pairing setup guidance.
- Paired and outside schedule: show that Lockdown is currently off and when it resumes.
- Paired, school time, no active block: show the allowed off-block resources and available blocks to start.
- Paired, active block: show current block, time state, allowed resources, and quick links.
- Paired but stale sync: show cached-policy status and a parent-action message.
- Revoked or inactive: keep a distinct parent-action-required state.

The extension should not show a paired student a local "turn blocking off" control or a self-service clear-pairing button.

The blocked page should match the same model:

- Explain why the page is unavailable.
- Show allowed resources when safe.
- Offer "Open Own Path" and "Start or resume a block" where supported.
- Avoid raw policy jargon.

## Trusted Backend And API Direction

The existing trusted device credential model remains the trust boundary. New launcher actions should be credential-authenticated and scoped to the bound student.

Likely endpoint additions or extensions:

- Read launcher state for the paired student.
- Start a published weekly block for the paired student.
- Resume an existing active block session for the paired student.
- Return the updated policy or a policy refresh hint after start/resume.
- Record device heartbeat and last launcher action for parent visibility.
- Support parent-authorized unpair or emergency recovery if chosen for this workflow.

The extension must not call Firestore directly for trusted launcher state. It should keep using Cloud Functions or trusted HTTP endpoints.

## Security And Hardening Direction

Consumer Chrome cannot reliably prevent a student from removing an unpacked or normally installed extension. The product should not claim otherwise.

This workflow should still reduce easy bypasses:

- Hide or remove local paired "turn blocking off" behavior.
- Hide or remove local paired "clear pairing" behavior unless a parent unlock is present.
- Treat revoked, invalid, or stale credentials as distinct states.
- Keep cached enforcement active after sync failure when a trusted cached policy exists.
- Add parent-visible stale-device and revoked-device indicators.
- Add support docs and wizard guidance for managed Chrome policies such as force-installed extensions and profile restrictions.

## Testing And Release Readiness

Automated checks should cover:

- Policy derivation for school time, no active block, active block, outside schedule, and system allowlist.
- Resource normalization and per-student assignment behavior.
- Parent view-model summaries for schedule, resources, devices, and allowed-right-now.
- Device management and stale/revoked status.
- Extension states for paired, unpaired, active, outside schedule, stale, revoked, and no active block.
- Launcher state reads and start/resume actions.
- Chrome Web Store package checks.

Runtime QA should cover:

- Parent can set weekly schedule from the compact modal.
- Parent can add a website and YouTube creator and assign them to one or more students.
- Parent can pair a clean Chrome profile.
- Student extension can start or resume a block.
- Active block resources become allowed immediately.
- Own Path remains allowed while Lockdown is enforcing.
- Student cannot use the paired extension UI to turn blocking off or clear pairing.
- Parent can see device last-seen and stale/revoked state.
- Screenshots can be captured for Chrome Web Store listing.

## Open Product Decisions

- Should parent-approved off-block resources also be available during active blocks, or only when no block is active? This plan assumes they are baseline allowed while school-time enforcement is active.
- Should outside-schedule enforcement stay off unless a separate approved window is configured? This plan assumes the current outside-schedule-off behavior remains.
- What stale-device threshold should create a parent warning: 24 hours, 48 hours, 7 days, or another value?
- Should parent dashboard routes be allowlisted from the paired student Chrome profile?
- Should YouTube video URLs be accepted only as hints for creator/channel extraction, or should video-level approval become real scope?
- Should emergency unlock ship in this workflow, or stay as a follow-on paid-reliance gate after the simplified UI and launcher are stable?

## Recommended Workflow Shape

Operational scaffold: [lockdown-simplification-and-extension-launcher-workflow/workflow-plan.md](lockdown-simplification-and-extension-launcher-workflow/workflow-plan.md)

The implementation should be phased because it touches the parent dashboard, policy derivation, Cloud Functions, extension UI, data contracts, support docs, and Chrome QA.

Recommended phase order:

1. Resource and policy contract foundation.
2. Parent Lockdown summary shell and modal frame.
3. Household resource library management.
4. Weekly schedule modal and allowed-right-now preview.
5. Pairing wizard and device summaries.
6. Extension anti-tamper and paired-state cleanup.
7. Trusted launcher endpoints and active block actions.
8. Extension student launcher and blocked-page integration.
9. Integration QA and Chrome Web Store readiness.

Each phase should add or update focused validation scripts where behavior changes. Browser or Chrome manual QA should be tied to the phases where UI and extension behavior become live-testable, then repeated in the final readiness phase.
