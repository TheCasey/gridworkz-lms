# Own Path Lockdown Release Support Runbook

Last updated: 2026-05-27

Status: Release-readiness support guide for the Chrome Web Store package

Related: [Own Path Lockdown Chrome Web Store Upload Plan](lockdown-chrome-web-store-upload-plan.md)

## Scope

This runbook covers the production extension package for Own Path Lockdown. The package directory still uses the historical `chrome-lockdown-poc` path internally, but the packaged user-facing copy must read as Own Path.

Do not use this document to define new runtime features. It only covers release packaging, privacy disclosures, manual QA, and support recovery for the current browser-extension surface.

The checks below are package-level readiness checks. They do not claim a live Chrome Web Store installed-build smoke pass; that remains a manual paid-readiness gate.

## Chrome Web Store Privacy And Permission Checklist

Use this checklist before publishing or updating the listing:

- The listing name, popup copy, options copy, blocked-page copy, allowlist copy, and YouTube overlay copy all use Own Path branding.
- Any remaining legacy pairing handling is internal compatibility only and is documented here, not shown as primary user-facing copy.
- The privacy policy states that the extension uses broad host access to enforce a parent-configured learning allowlist.
- The privacy policy states that the extension stores policy state locally, including pairing details, sync state, allowlisted resources, and the last blocked URL.
- The privacy policy states that Own Path only contacts its own pairing and policy endpoints for enrollment exchange and policy sync.
- The privacy policy states that the extension reads YouTube page metadata locally to verify approved creators.
- The privacy policy states that the extension does not collect browsing history, search terms, page content, or full navigation logs in the first production scope.
- The Chrome Web Store data-use disclosure matches the actual permission set in `manifest.json`.
- The `storage` permission is justified for local policy cache, pairing, sync state, and blocked-state persistence.
- The `alarms` permission is justified for periodic secure policy sync.
- The `scripting` permission is justified for the local YouTube enforcement content script.
- The `declarativeNetRequest` permission is justified for top-level website blocking and origin allowlisting.
- The `declarativeNetRequestFeedback` permission is justified for blocked-navigation feedback and local status display.
- The host permissions for `http://*/*` and `https://*/*` are disclosed as broad host access required to enforce the learning allowlist across arbitrary student browsing.
- The package does not load remotely hosted executable code or script bundles.

## Manual QA Matrix

| Scenario | Setup | Expected result |
| --- | --- | --- |
| Pairing succeeds | Use a fresh trusted enrollment code from `/dashboard/lockdown` and pair a clean Chrome profile. | The popup shows a paired state, the options page shows the saved device, and secure sync completes. |
| Pairing fails | Use an expired, consumed, or revoked enrollment code. | The options page shows a clear error and the browser stays on the last cached policy. |
| Active block allowed site | Start a published work block with an allowed origin. | The site loads normally and the popup/allowlist show the expected approved resources. |
| Active block blocked site | Open an unrelated HTTP/S site during an active block. | The browser redirects to the blocked page and shows the allowed-resource context. |
| No active work | Open the extension during school time with no active work session. | The browser shows the no-active-work state and does not unlock unrelated sites. |
| No published plan | Test a student without a published weekly plan. | The browser stays closed to school-work resources and asks the parent to publish the week. |
| Off-hours open | Test inside an approved off-hours window. | The approved off-hours resources stay available and unrelated browsing stays blocked. |
| Off-hours closed | Test outside scheduled school time and outside any approved off-hours window. | Lockdown blocking turns off and the popup explains that enforcement resumes during school time or an approved off-hours window. |
| Network loss with cache | Disconnect a paired browser after a successful sync. | The extension keeps enforcing the last trusted cached policy and labels the state as cached fallback. |
| Network loss without cache | Use a browser that has never completed a trusted sync, then disconnect it. | The extension does not claim trusted enforcement and prompts for pairing or recovery. |
| Revoked device | Revoke the device from the parent dashboard and let the browser sync. | The extension reports the revoked state and stays closed until the browser is paired again. |
| Downgraded entitlement | Remove Lockdown entitlement from the parent account after pairing. | The dashboard becomes read-only and the extension stops receiving fresh trusted policy. |
| Local unpair | Clear pairing from the options page while the parent is present. | The browser becomes unpaired, but cached policy remains until it is replaced or cleared through the approved recovery path. |
| Stuck cached enforcement | Leave a browser enforcing a stale cached policy after revoke, downgrade, or network recovery. | A manual sync or approved parent recovery step clears the stale state; if it does not, clear extension storage and re-pair. |
| YouTube allowed creator | Open a supported YouTube watch or shorts page for an approved creator. | Playback stays in page and the creator is allowed. |
| YouTube blocked creator | Open a YouTube watch or shorts page for an unapproved creator. | The extension overlays a blocked state with approved-resource guidance. |
| Launcher behavior | Review the current browser-extension package. | There is no separate embedded work launcher in this package; launcher QA stays in the kiosk-mode follow-on track. |

## Parent Pairing Wizard Expectations

The parent dashboard pairing flow is now a five-step wizard:

1. Choose the student who owns the browser profile.
2. Confirm the Chrome profile is the student learning profile and open `chrome://extensions`.
3. Generate a one-time trusted enrollment code.
4. Paste the code into the extension setup screen and confirm secure sync.
5. Review managed Chrome hardening guidance before relying on uninstall resistance.

The wizard must stay honest about consumer Chrome limits. It can guide pairing and policy sync on an unmanaged profile, but it must not imply that an ordinary Chrome profile can reliably prevent extension removal, profile switching, guest browsing, or alternate-browser bypass.

## Managed Chrome Hardening References

Use these official Chrome resources when a parent, school admin, or support operator needs stronger controls:

- [Chrome Browser Cloud Management overview](https://chromeenterprise.google/products/cloud-management/) for managed browser enrollment and policy rollout.
- [Automatically install apps and extensions](https://support.google.com/chrome/a/answer/6306504?hl=en-EN) for Admin console force-install flow.
- [ExtensionInstallForcelist policy reference](https://chromeenterprise.google/policies/extension-install-forcelist/) for policy-level force-install details and platform caveats.
- [Incognito mode availability policy](https://chromeenterprise.google/intl/en_au/policies/incognito-mode-availability/) when a managed environment needs to limit incognito browsing.

## Support Runbook

### Pairing Failures

Symptoms:

- The options page rejects the enrollment code.
- The popup says the browser is not paired or that secure sync is paused.
- Sync stops after a fresh enrollment attempt.

Likely causes:

- The enrollment code expired, was consumed, or was revoked.
- The parent account no longer has active Lockdown entitlement.
- The browser still has an older pairing format saved locally.

Recovery:

1. Confirm the parent still has Lockdown entitlement.
2. Generate a fresh trusted enrollment code from `/dashboard/lockdown`.
3. If the browser still has an older saved pairing, clear it from the options page before pairing again.
4. Pair the browser again and confirm secure sync completes.

### Stale Policy

Symptoms:

- The popup shows cached fallback or stale cached policy.
- The allowlist and blocked page do not reflect a recent parent change.
- The browser is online, but the policy does not advance.
- The parent dashboard marks the paired browser stale after 7 days without a successful check-in or policy sync.

Likely causes:

- The last trusted sync is still cached locally.
- The device has not successfully reached the policy endpoint.
- The parent changed the policy but the browser has not completed the next sync cycle.

Recovery:

1. Trigger a manual sync from the popup.
2. Confirm the browser can reach the policy endpoint and the parent account still has entitlement.
3. Review the parent dashboard device summary. A device is considered stale when neither `last_seen_at` nor `last_policy_read_at` has advanced for 7 days.
4. If the stale state persists, re-pair the browser after confirming the parent record is current.

### Revoked Device

Symptoms:

- The popup reports a revoked device state.
- The options page says the saved device credential is revoked.
- Secure sync stops after a parent-side revoke.

Recovery:

1. Confirm the revoke was intentional.
2. Keep the local browser closed to new policy updates until the parent is ready to re-pair.
3. If the device should be trusted again, issue a fresh enrollment code and pair the browser again.
4. Do not use local unpair as a student bypass.

### Downgrade

Symptoms:

- The parent account loses Lockdown entitlement.
- The dashboard turns read-only for Lockdown setup.
- The browser keeps the last cached policy but no longer receives fresh trusted updates.

Recovery:

1. Confirm whether the downgrade was intentional.
2. Explain that saved setup is preserved read-only and that new pairing/editing is disabled until Lockdown is restored.
3. If the household should remain on Lockdown, restore entitlement first, then re-sync.

### Local Unpair

Symptoms:

- The parent wants to clear the local browser record.
- The device needs to be repurposed or reassigned.

Recovery:

1. Use the options page clear action only with parent approval or on a managed device.
2. Verify that the browser returns to an unpaired state.
3. If cached policy still appears to enforce after the clear, follow the stuck cached enforcement steps below.
4. If the household depends on uninstall resistance or profile restrictions, move the browser into managed Chrome before re-pairing.

### Stuck Cached Enforcement

Symptoms:

- The browser still enforces the old policy after revoke, downgrade, or a long offline period.
- The local block page keeps showing an outdated allowed-resource set.

Recovery:

1. Trigger a manual sync.
2. Confirm whether the device is revoked, inactive, or simply offline.
3. Clear the local pairing and policy state if the browser is meant to be retired.
4. If needed, remove and reinstall the extension after the parent-side record is corrected.

### Internal Compatibility Note

- The extension source still contains legacy pairing-format handling so the package can recognize and retire older data safely.
- That compatibility path must remain hidden from primary user-facing copy.
- Any reviewer-facing note about historical pairing should point back to this runbook instead of reintroducing PoC language in the UI.
