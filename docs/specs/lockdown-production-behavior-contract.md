# Lockdown Production Behavior Contract

Status: Draft product contract

Last updated: 2026-05-22

## Purpose

Lockdown is Own Path's premium learning-browser control. It keeps a paired student browser profile focused on parent-approved learning resources during school work and explicitly approved off-hours windows.

This contract defines the behavior Own Path should publish to parents before the Chrome extension is treated as production-ready.

## Parent Goals

Lockdown solves one narrow problem: a student should not be able to drift from the current learning task to unrelated websites or unapproved YouTube content inside the paired learning browser.

Lockdown should promise:

- student-bound browser pairing
- policy derived from the published weekly plan, active work session, timers, school-time schedule, and off-hours windows
- origin-level website enforcement for approved web resources
- approved YouTube creator enforcement on supported YouTube watch and shorts pages
- fail-closed behavior when a paired device has a last good active policy but temporarily loses network access
- clear parent visibility into what is allowed right now and why

Lockdown should not promise:

- whole-device parental control
- protection in other browsers, other Chrome profiles, guest profiles, or incognito unless a managed-device policy forces extension installation and disables bypasses
- uninstall, extension-disable, OS-level, VPN, DNS, or network tamper resistance in the consumer extension
- content filtering, mature-content classification, keyword scanning, or search-result safety
- exact path-level website restrictions for ordinary websites in the first production browser-extension mode
- YouTube playlist-level or video-level guarantees until those are explicitly implemented and tested

For homeschool families, the feature should feel firm but not punitive. The paired browser is a learning space. When Lockdown is active, the default should be "not available unless approved," but the student-facing copy should explain the next useful step: start a block, use an approved resource, or ask a parent.

## Lockdown States

| State | Parent-facing meaning | Student/browser behavior | Policy stance |
| --- | --- | --- | --- |
| School time plus active weekly block or timer | Student is inside scheduled school time and has an active work session tied to a published weekly block. | Allow Own Path system pages plus supported resources attached to the active block. Block unrelated HTTP/S top-level navigation. On YouTube, allow only approved creators from the active block on watch or shorts pages. | Strict allowlist, derived from active block resources. |
| School time plus no active block or timer | School time is active, but Own Path does not know what work the student is currently doing. | Allow Own Path system pages and extension pages only. Show "start a block timer/work session to unlock approved resources." | Fail closed until an active work session exists. |
| Outside school time plus approved off-hours window | The current local time matches a parent-approved off-hours resource window for this student. | Allow Own Path system pages plus resources in the active off-hours window. Block unrelated browsing. | Strict allowlist, derived from that off-hours window. |
| Outside school time plus no approved off-hours window | The paired learning browser is outside school time and no parent-approved off-hours window is active. | Lockdown network blocking is off. The popup should explain that enforcement resumes when school time or an approved off-hours window starts. | No active Lockdown enforcement outside configured windows. |
| No published weekly plan | The current week is not published for the student. | During school time, do not unlock subject or block resources from draft or legacy records. Show parent and student guidance to publish the week. | No school-work allowlist until a published plan exists. |
| Student has no active work | Published plan exists but all work is complete, paused, archived, or absent. | Allow Own Path system pages only. Show "no active work is available." | No discretionary web access from school-work policy. |
| Parent downgrades from Lockdown | Parent no longer has active Lockdown extension entitlement. | Dashboard remains read-only. New pairing, edits, and trusted policy management are disabled. After a successful device sync, paired browsers should stop enforcing paid Lockdown policy. If sync is unavailable, the last cached policy may continue until sync recovers or a parent clears the browser locally. | Entitlement inactive disables remote policy, preserves setup. |
| Device loses network | Browser cannot reach the trusted policy endpoint. | If a last good active policy exists, continue enforcing it and show cached-fallback status. If no trusted cached policy exists, show unpaired/setup status and do not claim enforcement. | Fail closed only when a trusted cached policy exists. |
| Device is unpaired or revoked | The device is no longer trusted for policy updates. | Remote revocation should stop future policy reads and move the extension into a parent-action-required state. It should not silently open browsing for a student. Local unpairing should require a parent action or managed-device control before disabling enforcement. | Revoked is a distinct state, not just sync failure. |

Own Path system pages should include the student portal, extension block/allowlist/setup pages, and required trusted-policy endpoints. Parent dashboard access from the same student browser should be an explicit product decision, not an accidental allow.

## Allowed Resources

Resource support for the first production browser-extension mode:

- Ordinary websites are allowed by exact origin: scheme plus host plus optional port, for example `https://www.khanacademy.org`. A saved lesson URL on that origin grants the origin, not one exact path.
- No wildcard domains in the first production mode. `https://example.com` and `https://sub.example.com` are separate origins.
- HTTP and HTTPS are the only supported website schemes.
- Block resources attached to the active published weekly block are automatically allowed only while that block is the active work session.
- Off-hours resources are separate from school-time block resources. Parents must explicitly add off-hours resources and windows per student.
- Unsupported resources fail closed. They can remain visible in the student portal, but Lockdown should not allow them until the parent adds supported metadata.
- YouTube is allowed by stable channel ID for supported watch and shorts pages. The extension should not allow all of `youtube.com`.
- Parents should enter YouTube resources by pasting a channel, handle, or video URL; Own Path should resolve and store `youtube_channel_id`, title, and handle. Manual channel-ID entry can remain an advanced fallback, not the normal parent workflow.
- YouTube playlists and individual video IDs are future scope unless the product explicitly decides to support them. A video URL in the first production mode should resolve to its creator channel, not create a one-video permission.

## Parent Controls

Required parent controls:

- Device pairing: Parent selects a student, creates a short-lived one-time enrollment code, enters it in the extension, and the extension exchanges it for an opaque device credential.
- Device list: Parent can see paired devices per student, including device name, platform, extension version, paired time, last seen time, last policy sync, and status.
- Device revocation: Parent can revoke a device. Revocation invalidates the credential and clearly explains whether the local profile remains locked until re-paired or locally cleared by a parent.
- Per-student setup: School days, school hours, off-hours windows, and off-hours resources are configured per student.
- Preview/testing mode: Parent can preview the current derived state and test a URL or YouTube resource against the policy before relying on it.
- Override/emergency unlock: Student should not receive a self-serve bypass. A parent should have a time-limited unlock or "allow this resource for this block/window" path that is explicit, auditable, and reversible.

First publish may ship without a full emergency-unlock workflow if the listing and UI are clear that parents manage access through the dashboard. Paid reliance should not begin until device revocation and emergency recovery are implemented and tested.

## Student Experience

When blocked, the student should see:

- a short reason: not approved for this block, no block is active, outside approved hours, YouTube creator not approved, creator could not be verified, or cached policy is being used
- the current allowed resources when safe to show
- a next step: start a timer/work session, return to Own Path, ask a parent, or wait until an approved window
- no developer jargon, no raw policy IDs, and no frightening security language

Students may request help or access, but a request must not unlock anything by itself. The parent should decide whether to add a resource, start an override, or keep it blocked.

If the timer/work session is not started, Lockdown should not infer the active block from the visible page alone. The student portal should make the required start action obvious before external resources are opened.

Future kiosk mode and richer extension modes should include an embedded student work launcher. When school time activates automatically, the launcher can show the student's published subjects or weekly blocks, let the student choose the block they are starting, start or resume the work session, and show the resources that will become available for that block. This launcher should be a thin runtime view over the same published weekly-plan and device-policy contract, not a separate curriculum or assignment source.

## Security And Trust

The extension is trusted to enforce:

- top-level HTTP/S navigation through Manifest V3 declarative network rules
- local cached policy application after successful trusted sync
- YouTube watch and shorts playback gating by locally observed creator channel ID
- local user feedback through extension block, popup, options, and allowlist pages

The extension remains best-effort for:

- Chrome extension removal or disabling
- alternate browsers, profiles, guest mode, incognito, and unmanaged devices
- already-open pages and non-top-level embedded traffic beyond the implemented rules
- YouTube page structure changes that hide or delay stable channel metadata
- offline policy freshness
- student portal and Firestore security outside the trusted Lockdown device-policy path

Local extension storage may include:

- student ID, parent ID, device ID, device name, platform, extension version
- opaque device credential
- latest normalized policy, allowed origins, approved YouTube channels
- sync state, last sync/error metadata, and cached-fallback status
- last blocked URL and timestamp for local explanation

Backend storage may include:

- server-owned enrollment session records
- server-owned device records and credential hashes
- device metadata, status, paired time, last seen time, and last policy-read time
- derived policy context returned during sync

Backend storage should not include full browsing history, page content, search terms, or every blocked URL in first production scope.

Privacy disclosures must state that the extension uses broad host access to enforce a parent-configured learning allowlist, stores policy data locally, contacts Own Path only for pairing and policy sync, and reads YouTube page metadata locally to verify approved creators. The Chrome Web Store listing and privacy policy must align with the extension permissions and the Chrome Web Store data-use disclosures.

## Launch Scope

### Required For First Chrome Web Store Publish

- Rename user-facing extension surfaces from GridWorkz to Own Path or intentionally document the transitional brand.
- Remove or hide legacy PoC pairing from the production extension and parent flow.
- Keep one narrow extension purpose: enforce Own Path Lockdown for a paired student learning browser.
- Provide a privacy policy, permission justifications, and Chrome Web Store privacy disclosures for storage, broad host access, scripting, and network-rule behavior.
- Confirm no remotely hosted executable code is used by the extension package.
- Include parent setup, pairing, popup status, blocked page, allowlist page, and cached-sync status.
- Add a basic manual QA script for pairing, active block, no active block, off-hours allowed, off-hours closed, network loss, downgrade, YouTube allowed creator, and YouTube blocked creator.

### Required Before Paid Customers Rely On It

- Device list and revoke flow in the parent dashboard backed by trusted Cloud Functions.
- State-specific blocked UI and parent preview that distinguish all states in this contract.
- URL and YouTube resource tester in the parent dashboard.
- YouTube URL parser/resolver so parents do not manually find channel IDs.
- Explicit Own Path system allowlist behavior for the student portal and extension pages.
- Emergency parent unlock or temporary allow workflow with audit trail.
- Clear stale-cache behavior, including parent-visible last sync and student-visible cached status.
- End-to-end extension validation on a production-like account after Chrome Web Store installation, not only unpacked extension testing.
- Support runbook for pairing failures, revoked devices, stale policies, downgrades, and stuck cached enforcement.

### Future Kiosk Mode

Kiosk mode is a separate product mode. It may reuse the trusted policy contract and entitlement rail, but it should make stronger claims only when Chrome OS managed deployment can enforce install, prevent removal, constrain profiles, and control app escape paths.

Kiosk mode should also be the natural home for the embedded student work launcher: a small subject or weekly-block viewer that appears when school time starts, lets the student pick the block they are doing, starts the active work context, and shows allowed resources. The launcher should work from published weekly plans first, with legacy subject compatibility only as a migration bridge.

### Future Project And Worksheet Integration

Projects and worksheets should become first-class Lockdown policy sources. A project-work or worksheet session should define its own active resource context instead of depending only on legacy subject IDs, block indexes, and timers.

## Open Product Decisions

- Should local unpairing disable enforcement, keep the last cached lock, or require a parent credential?
- Should remote revocation lock the profile until re-paired, disable enforcement after sync, or offer both actions as separate "revoke" and "retire device" controls?
- Should the parent dashboard be allowed from a paired student profile during Lockdown, or should parent access happen from a separate browser/profile?
- What is the exact stale-cache threshold that should trigger parent alerts?
- Should task-complete weekly blocks without timers get a separate "start work" session primitive?
- Should the embedded work launcher ship only in kiosk mode first, or should the browser extension also expose a smaller popup/sidebar version?
- When school time starts automatically, should the launcher open proactively, show a notification, or only appear when the student clicks the extension/kiosk shell?
- Should YouTube video-level or playlist-level approval be supported before paid launch, or stay future scope?
- Should off-hours windows remain on student records long term, or move to a dedicated device-policy/source collection when device management matures?
- Should blocked access requests send email, in-app parent notifications, dashboard queue entries, or only local instructions in the first paid version?

## Phase 7 Release Hardening Status

Phase 7 release hardening resolved the production-facing package drift that started this workflow. The package and docs now distinguish what is already hardened from what still needs paid-readiness validation.

### Resolved In This Workflow

- Trusted enrollment, opaque device credentials, secure policy reads, published-weekly-plan derivation, off-hours inputs, cached fallback, origin allow rules, and approved YouTube creator enforcement remain the active runtime foundation.
- The production package now uses Own Path branding on the manifest and user-facing extension surfaces, with legacy PoC / GridWorkz naming confined to historical or internal compatibility paths.
- The blocked-page, popup, options, allowlist, and YouTube overlay copy are documented as Own Path-facing release copy.
- The release support runbook now covers the Chrome Web Store privacy and permission checklist, manual QA, recovery flows, and internal compatibility notes.
- The release package checker now validates manifest metadata, branding, no remote executable code, and release-doc coverage.

### Remaining Paid-Readiness And Manual Gates

- Live Chrome Web Store installed-build smoke remains to be performed; this workflow only has package-level validation, lint, and local build evidence.
- An automated extension regression suite is still not present.
- Parent device list and revocation still need live, staging, or production-like validation before paid customers rely on the feature.
- The state-specific blocked UI, URL and creator tester, explicit system allowlist, and their parent-facing flows still need live, staging, or production-like validation where applicable before paid customers rely on the feature.
- The embedded work launcher is still future kiosk-mode scope and is not yet a production browser-extension requirement.
- Emergency parent unlock or temporary allow, kiosk mode, project and worksheet integration, paid-readiness end-to-end validation, and real customer/payment reliance decisions remain the true follow-on gaps.

## Recommended Implementation Workflow

Operational scaffold: [lockdown-production-behavior-contract-workflow/workflow-plan.md](lockdown-production-behavior-contract-workflow/workflow-plan.md)

1. Contract acceptance and state vocabulary
   - Accept this behavior contract, rename the product states, and update schema comments/docs.
   - Define exact student/parent copy for each state.

2. Policy derivation hardening
   - Add distinct backend policy states and context fields.
   - Add system resource allowlist behavior.
   - Add tests or fixtures for all state transitions.

3. Resource normalization
   - Implement parent URL tester.
   - Add YouTube URL parsing and channel resolution.
   - Prevent or clearly block unsupported resources before publish/reliance.

4. Device management
   - Add trusted device list and revoke functions.
   - Add parent dashboard device table and revoke/retire actions.
   - Align extension behavior for revoked, unpaired, and locally cleared states.

5. Student blocked/help experience
   - Replace generic block pages with state-specific guidance.
   - Add allowed-resource visibility.
   - Add request-help/request-access queue if chosen for paid launch.

6. Embedded work launcher foundation
   - Define a shared active-work-session contract that can be started from the student portal, extension popup/sidebar, or kiosk shell.
   - Build a read-only subject/weekly-block viewer over published plans.
   - Show block resources and allowed-resource status from the same derived policy preview.

7. Parent override and recovery
   - Implement time-limited emergency unlock or temporary allow.
   - Add audit trail and support runbook coverage.

8. Chrome Web Store publish hardening
   - Rename/package production extension.
   - Complete privacy disclosures and permission justifications.
   - Validate MV3 packaging, no remote code, and production-like installed extension behavior.

9. Paid-readiness validation
   - Run end-to-end pairing, policy, downgrade, revoke, network-loss, YouTube, and support scenarios against staging or a disposable production account.
   - Freeze the support runbook and paid-customer limitation language before charging for Lockdown.
