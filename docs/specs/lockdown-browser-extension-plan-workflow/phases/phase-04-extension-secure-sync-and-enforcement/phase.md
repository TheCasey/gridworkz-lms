# Phase 4: Extension Secure Sync And Enforcement

## Goal

Update the MV3 browser extension to consume the trusted derived-policy contract and enforce active-block or off-hours behavior reliably.

## Depends On

- Phase 3: Parent Lockdown Management Surface

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Replace the PoC remote sync contract in the extension with the trusted pairing and policy-read flow.
- Preserve cached fallback and startup behavior so restart or temporary network loss does not disable enforcement.
- Validate policy propagation for approved origins and approved YouTube behavior under the new derived policy contract.

## Deliverables

- Extension pairing and sync path aligned to the trusted production contract
- Cached-policy fallback behavior preserved under the new sync path
- Updated extension status and setup UI that reflects secure pairing instead of the current PoC flow

## Files Or Areas To Touch

- extensions/chrome-lockdown-poc/manifest.json
- extensions/chrome-lockdown-poc/background.js
- extensions/chrome-lockdown-poc/policy.js
- extensions/chrome-lockdown-poc/options.js
- extensions/chrome-lockdown-poc/popup.js
- extensions/chrome-lockdown-poc/youtube-content.js

## Exit Criteria

- The extension can enroll and sync without depending on the PoC public Firestore REST read path.
- Cached fallback still preserves the last good policy across browser restart or temporary sync failure.
- Active-block and off-hours policy changes propagate to the extension without reinstalling.

## Test Commands

- npm run lint
- npm run build

## Master Developer Review Focus

Keep this phase centered on the browser extension runtime. Do not pull kiosk mode in as a second implementation stream.

## Runtime Handoff Notes

- `developer`: Preserve the existing enforcement strengths, especially cached fallback, while swapping out the PoC sync contract underneath.
- `tester`: Validate sync, restart persistence, and stale-network behavior explicitly; do not stop at static code review.

## Next Phase Inputs

- Browser extension ready for full authenticated manual validation
- Production-secure sync and enforcement path for approved resources and YouTube handling
