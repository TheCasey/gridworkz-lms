# Own Path Lockdown Chrome Web Store Upload Plan

Last updated: 2026-05-27

Status: Remaining work from the current repo state to first Chrome Web Store upload.

## Source References

- [Chrome Web Store overview](https://developer.chrome.com/docs/webstore)
- [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare)
- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Set up distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Review process](https://developer.chrome.com/docs/webstore/review-process)

## Current Starting Point

The local package is release-hardened at the repo level:

- `extensions/chrome-lockdown-poc/manifest.json` uses Own Path Lockdown production naming.
- `scripts/check-lockdown-release-package.mjs` validates manifest metadata, visible branding, legacy compatibility visibility, runbook coverage, and remote-code absence.
- `docs/support/lockdown-support-runbook.md` contains the privacy checklist, permission justifications, manual QA matrix, and recovery runbook.
- Focused package checks, lint, and build have passed locally.

The remaining work is not just "upload the zip." The live extension package still needs production-like extension smoke, listing assets, public policy/support URLs, dashboard field entry, and Chrome Web Store review.

Phase 5 parent guidance now assumes:

- the dashboard pairing flow is a student-bound wizard, not a raw contract console
- parent device summaries separate paired, stale, revoked, and inactive states
- a paired browser is marked stale after 7 days without a successful heartbeat or policy sync
- managed Chrome references are the approved path for force-install and stronger profile controls

## 1. Make The Publish Decision

Before packaging, decide the first Chrome Web Store visibility:

- `Private`: best for trusted tester validation before launch. Requires trusted tester accounts or groups in the developer dashboard.
- `Unlisted`: installable by anyone with the store URL, but not searchable.
- `Public`: searchable and installable by the public after review.

Chrome documents that all visibility settings go through the same policy review. For first validation, prefer `Private` unless there is a specific reason to expose an unlisted or public listing immediately.

Also decide:

- target regions, or all regions
- whether the listing mentions Lockdown as a paid plan feature
- who owns the Chrome Web Store developer account and who is added as backup owner/admin
- support email and escalation owner during review

## 2. Finish Account And Public URL Prerequisites

In the Chrome Web Store Developer Dashboard:

1. Register or confirm the publisher account.
2. Complete account setup and publisher profile fields.
3. Add backup owner/admin access for continuity.
4. Confirm the public support contact.

Public URLs needed before submission:

- privacy policy URL that matches the disclosures in `docs/support/lockdown-support-runbook.md`
- support/help URL, or a support email if a URL is not ready
- marketing/product page if the listing will link to one

The privacy policy must cover broad host access, local storage of policy and pairing data, Own Path pairing/policy sync endpoints, local YouTube metadata checks, and the current non-collection stance for browsing history, search terms, page content, and full navigation logs.

## 3. Finish Package Assets

Chrome's preparation docs call out manifest metadata, including `name`, `version`, `icons`, and `description`, before upload. Current remaining package-asset work:

- Add production extension icons under `extensions/chrome-lockdown-poc/`.
- Add the `icons` manifest field with the required production icon sizes.
- Prepare Chrome Web Store listing assets:
  - store icon
  - at least one screenshot, preferably the full set for popup, options, blocked page, allowlist, and parent setup context
  - optional small promo tile and marquee image if launch marketing needs them
- Keep screenshots current with Own Path branding.

Do not include source maps, local notes, `.DS_Store`, unpublished secrets, or unrelated repo files in the submitted zip.

## 4. Run Pre-Upload Validation

Run local checks:

```bash
node scripts/check-lockdown-release-package.mjs
npm run lint
npm run build
```

Then run live extension QA from `docs/support/lockdown-support-runbook.md` against a staging or disposable production-like account:

- fresh pairing succeeds
- expired/consumed/revoked pairing fails clearly
- the parent wizard makes the student binding and managed-Chrome limits clear
- active block allowed site loads
- active block blocked site redirects
- no active work stays closed
- no published plan stays closed
- off-hours open allows only configured resources
- off-hours closed leaves Lockdown blocking off
- network loss with a trusted cache keeps cached enforcement
- network loss without a trusted cache does not claim fresh trusted enforcement
- a stale device warning appears after 7 days without heartbeat/policy-sync activity
- revoked device reports the revoked state
- downgraded entitlement behavior matches product copy
- local unpair requires parent-managed recovery
- stale cached enforcement has a recovery path
- YouTube allowed creator plays
- YouTube blocked creator overlays correctly

Record the browser profile, parent account, student slug, extension version, and test date.

## 5. Create The Upload Zip

Package only the extension directory contents, with `manifest.json` at the zip root.

Example:

```bash
mkdir -p dist/chrome-web-store
cd extensions/chrome-lockdown-poc
zip -r ../../dist/chrome-web-store/own-path-lockdown-1.0.0.zip . -x "*.DS_Store"
```

Before upload, inspect the zip:

```bash
unzip -l dist/chrome-web-store/own-path-lockdown-1.0.0.zip
```

Confirm:

- `manifest.json` is at the zip root.
- required HTML, JS, CSS, icons, and assets are present.
- no repo-level docs, local caches, credentials, or unrelated files are present.

## 6. Upload In Chrome Developer Dashboard

In the Chrome Developer Dashboard:

1. Sign in to the publisher account.
2. Choose `Add new item`.
3. Choose the zip file.
4. Upload it.
5. Confirm the manifest and zip validate.

Important upload notes:

- Chrome's docs state that the package zip must be valid and the maximum supported package size is 2 GB.
- After upload, manifest metadata is not edited in the dashboard. If `name`, `version`, `description`, or icons need changes, update `manifest.json`, increment `version`, rebuild the zip, and upload again.
- Future updates must use a larger manifest version than the previous uploaded version.

## 7. Complete Store Listing

Fill out the Store Listing tab:

- title: `Own Path Lockdown`
- summary: concise, accurate, no superlatives or unsupported claims
- detailed description: parent-managed learning-browser enforcement for paired student profiles
- category and language
- screenshots and listing images
- website URL if available
- support URL or support email

Listing text should say:

- parents configure approved learning resources from Own Path
- the extension enforces a paired student browser profile
- the parent dashboard shows paired, stale, revoked, and inactive device states for the selected student
- broad host access is used to enforce the allowlist
- YouTube checks are limited to approved creators on supported watch/shorts pages
- it is not a kiosk-mode guarantee and does not prevent extension removal, alternate browsers, unmanaged profiles, or device escape paths

When reviewers or support staff ask how households should harden the browser setup, point them to the managed Chrome references already listed in the support runbook instead of implying that the consumer Chrome install flow prevents removal on its own.

## 8. Complete Privacy Fields

Fill out the Privacy tab:

- single purpose: enforce Own Path Lockdown for a paired student learning browser
- permission justifications:
  - `storage`: local policy cache, pairing data, sync state, last blocked request
  - `alarms`: periodic secure policy sync
  - `scripting`: local YouTube page metadata enforcement
  - `declarativeNetRequest`: top-level website blocking and allowlisting
  - `declarativeNetRequestFeedback`: blocked-navigation feedback/status
  - broad `http://*/*` and `https://*/*` host permissions: enforce parent-configured allowlist across arbitrary student browsing
- remote code: declare no remotely hosted executable code
- data use: match the public privacy policy and runbook
- privacy policy URL: public and reachable

Do not overclaim data minimization. The extension stores policy state locally and sends pairing/policy sync requests to Own Path endpoints.

## 9. Set Distribution

In the Distribution tab:

- choose `Private`, `Unlisted`, or `Public`
- choose trusted testers or groups if private
- choose regions
- disclose any paid/in-app purchase context if required by the dashboard flow

For a first upload, the safest path is:

1. submit as `Private` to trusted testers
2. run installed-build validation after approval
3. then decide whether to move to `Unlisted` or `Public`

## 10. Submit For Review

Click `Submit for Review` only after:

- package upload is valid
- Store Listing is complete
- Privacy tab is complete
- Distribution is set
- local package checks pass
- live unpacked-extension QA is recorded

As of the official review-process page checked on 2026-05-24, Chrome noted extended submission review times due to a surge in submissions. Plan for review delay rather than same-day approval.

## 11. During Review

Monitor:

- Developer Dashboard item status
- publisher email inbox
- support tickets or appeals if requested

If rejected:

1. Record the exact policy reason.
2. Patch the package or listing.
3. Increment manifest version if the package changes.
4. Rebuild and re-upload.
5. Update this plan and the support runbook if the rejection reveals a repeatable checklist item.

## 12. After Approval

Before relying on it with paid customers:

1. Install the approved Chrome Web Store build in a clean Chrome profile.
2. Run the full manual QA matrix again.
3. Confirm listing copy, privacy disclosures, screenshots, support links, and install flow.
4. Confirm policy sync against a staging or disposable production-like account.
5. Record the approved extension ID, version, release date, reviewer outcome, and validation evidence.
6. Decide whether to keep visibility private, move to unlisted, or launch public.

## Remaining Gates Before Paid Reliance

Do not treat marketplace upload as equivalent to paid readiness. These gates remain:

- live Chrome Web Store installed-build validation
- production-like account validation for pairing, revoke, downgrade, stale cache, and YouTube enforcement
- emergency parent unlock or temporary allow workflow decision and implementation
- automated extension regression coverage beyond package-level scripts
- support team rehearsal for pairing, revoked device, stale cache, downgrade, local unpair, and stuck cached enforcement
- customer/payment go-live decision
