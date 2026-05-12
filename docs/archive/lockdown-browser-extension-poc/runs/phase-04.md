# Phase 4 Handoff

## Phase Goal

Add a narrow extension pairing flow and Firestore polling path so the MV3 extension can read the saved Phase 3 policy, cache it locally, and keep enforcing the last synced policy across restart or temporary network loss.

## Files Changed

- `extensions/chrome-lockdown-poc/manifest.json`
- `extensions/chrome-lockdown-poc/background.js`
- `extensions/chrome-lockdown-poc/policy.js`
- `extensions/chrome-lockdown-poc/popup.html`
- `extensions/chrome-lockdown-poc/popup.js`
- `extensions/chrome-lockdown-poc/options.html`
- `extensions/chrome-lockdown-poc/options.js`
- `extensions/chrome-lockdown-poc/styles.css`
- `src/components/LockdownPolicyPanel.jsx`
- `src/utils/lockdownPolicyUtils.js`
- `firestore.rules`
- `docs/specs/poc-lockdown-runs/phase-04.md`
- `docs/specs/poc-lockdown-state.yaml`

## Decisions Made

- Kept `lockdownPolicies/{parent_uid}` as the single remote policy document instead of introducing a second sync collection.
- Added an extension options page for pairing. The recommended path is a dashboard-generated pairing code that bundles:
  - `policy_id`
  - `project_id`
  - `api_key`
- Kept a manual fallback in the extension options page for direct `policy_id` entry with explicit `project_id` and `api_key` fields.
- Used Firestore REST reads from the extension service worker instead of adding a heavier Firebase SDK packaging step inside the PoC extension.
- Reused the existing `chrome.storage.local` policy record as the cached enforcement source. Remote sync writes the latest fetched policy into the same local cache that Phase 1 and Phase 2 already enforce from.
- Preserved local-only behavior when the extension is unpaired. In that state, the popup toggle still edits the local cached policy directly.
- Switched the popup to read-only remote-management mode when paired. In paired mode, the popup shows sync state and leaves on/off changes to the parent portal.
- Used a Chrome alarm with a 1 minute interval plus startup sync for the polling loop. This is more reliable in MV3 than trying to depend on a plain `setInterval` in the service worker.

## Pairing Flow

1. The parent signs in to the dashboard and opens the `Lockdown PoC` panel.
2. The panel now shows:
   - the Firestore policy id (`lockdownPolicies/{parent_uid}`)
   - a generated pairing code
3. In the extension options page, the parent can either:
   - paste the pairing code, which auto-fills the saved policy id plus Firebase public config, or
   - manually enter the policy id, Firebase project id, and Firebase web API key
4. Saving pairing settings stores them in `chrome.storage.local` and immediately triggers a remote sync.

## Remote Sync Behavior

- On extension install/startup, the service worker:
  - reapplies the cached local policy first
  - schedules the 1 minute sync alarm
  - attempts a Firestore fetch immediately
- Each sync fetches:
  - `https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/lockdownPolicies/{policy_id}?key={api_key}`
- The fetched document is normalized and written back into `chrome.storage.local` under the same `lockdownPolicy` key already used by enforcement.
- Because the existing background rule application already listens to policy storage changes, remote updates flow straight into:
  - top-level website allowlist enforcement
  - the existing creator-level YouTube checks

## Cached Fallback Behavior

- The extension continues to store the last known good policy in `chrome.storage.local`.
- On browser restart, the background worker reapplies that cached policy before any remote fetch completes.
- If a remote sync attempt fails, the popup marks the extension as using cached fallback and the last cached policy remains active.
- This means temporary network loss does not disable the current enforcement state.

## Popup And Setup UI

- Popup now shows:
  - paired vs unpaired state
  - sync status
  - last sync attempt / last sync success text
  - cached policy update time
- Popup still exposes the allowlist viewer.
- Popup local toggle remains available only when unpaired.
- Options page now handles pairing save/clear actions.

## Firestore Rules Change

- `firestore.rules` now allows public `get` on `lockdownPolicies/{policyId}` so the extension can poll the derived policy without Firebase Auth.
- Create/update/delete remain parent-owned.

## Tests Run

- `npm run build`
- `node --input-type=module <<'EOF' ... EOF`
  - verified extension pairing-code encode/decode
  - verified Firestore REST document parsing into the cached policy shape
  - verified Firestore REST URL generation

## Remaining Security And Rules Limitations

- The extension now depends on public Firestore `get` access for `lockdownPolicies/{policyId}`. That is a deliberate PoC compromise, not a production-safe device auth model.
- Anyone with the project id, API key, and a valid policy id can read that derived policy document while the Phase 4 rules change is deployed.
- The pairing code is therefore sensitive within the scope of this PoC even though it only contains public web config plus the policy id.
- The deployed Phase 4 rules now allow unauthenticated `get` for `lockdownPolicies/{policyId}` on the live `gridworkz-lms` project. This is intentionally limited to the single-document PoC polling path and does not open list access or parent writes.
- The extension still has no hardened device enrollment, no signed pairing token, and no tamper resistance. Those remain outside Phase 4 scope.

## Blockers

- None for the code handoff.
- Operational note: the tester needs the updated Firestore rules deployed before validating remote sync against the live project.

## Next Role

Tester

## Tester Checklist

1. Deploy the updated Firestore rules if the remote Firebase project is still running the older owner-only rule:
   - `firebase deploy --only firestore:rules`
2. Load or reload the unpacked extension from `extensions/chrome-lockdown-poc/`.
3. In the parent dashboard at `/dashboard`, open `Lockdown PoC` and copy the pairing code.
4. Open the extension options page, paste the pairing code, and save pairing.
5. Confirm the popup changes to paired mode and reports a successful remote sync within the polling window.
6. In the dashboard, toggle blocking on/off, save, and confirm the extension updates within 1 minute without reinstalling.
7. In the dashboard, add or remove an allowed website origin, save, and confirm live extension behavior updates within 1 minute without reinstalling.
8. Restart the browser, reopen the extension popup, and confirm the last synced policy is still enforced before or during the next remote sync.
9. Optionally simulate a temporary network loss after one successful sync and confirm the popup reports cached fallback while enforcement still matches the last synced policy.

## Tester Validation (Initial Failure)

- Status: `fail`
- Tested on `2026-05-04` against `http://localhost:3000/dashboard` and the unpacked extension loaded from `extensions/chrome-lockdown-poc/` in the `Lockdown Phase 2 Test` Chrome profile.
- Used a fresh Firebase parent account created during validation: `phase4tester+1777932000@example.com`.
- Rules deployment was required for live Phase 4 validation, but deployment was not possible in this environment because the `firebase` CLI is not installed (`firebase: command not found`).

## Tester Results (Initial Failure)

- Confirmed the dashboard exposes a saved Firestore policy id and a generated pairing code for the signed-in parent (`lockdownPolicies/hwgBHyfp7qRmv8eKp09UifD18VV2`).
- Confirmed the unpacked extension was loaded in Chrome and could be reloaded from `chrome://extensions`.
- Confirmed the extension options page accepted the dashboard pairing code and saved the derived `policy_id`, `project_id`, and `api_key`.
- Confirmed the popup reflects fallback sync state after pairing: it showed `Using cached fallback`, displayed the paired policy id, and surfaced the latest sync failure timestamp.

## Tester Failures (Initial Failure)

- Remote sync failed immediately after pairing because the live Firestore project still denies unauthenticated reads for `lockdownPolicies/{policyId}`. The popup reported `Firestore denied policy access. Check the PoC rules setup.`
- A direct unauthenticated REST read to `https://firestore.googleapis.com/v1/projects/gridworkz-lms/databases/(default)/documents/lockdownPolicies/hwgBHyfp7qRmv8eKp09UifD18VV2?key=...` returned `HTTP/2 403` with `PERMISSION_DENIED` and `Missing or insufficient permissions.`
- Because remote sync never succeeded, I could not validly verify the polling-window toggle propagation, live allowlist propagation without reinstalling, or restart persistence of the last synced remote policy for this Phase 4 target policy.

## Developer Retry Remediation

- Re-verified the local PoC rules change in `firestore.rules`: `match /lockdownPolicies/{policyId}` allows public `get`, keeps `list` denied to unauthenticated callers, and keeps create/update/delete parent-owned.
- Confirmed the local dashboard pairing values still target the tester's live project and policy path:
  - `project_id`: `gridworkz-lms`
  - `policy_id`: `hwgBHyfp7qRmv8eKp09UifD18VV2`
  - `api_key`: the same public web API key exposed through `.env.local` and `src/firebase/firebaseConfig.js`
- Confirmed Firebase project access in this environment with `npx firebase` and the authenticated account `thecaseyburesh@gmail.com`.
- Deployed the repo's `firestore.rules` to the live target project with:
  - `npx firebase deploy --only firestore:rules --project gridworkz-lms`
- Re-ran the exact unauthenticated Firestore REST read used by the extension service worker:
  - `GET https://firestore.googleapis.com/v1/projects/gridworkz-lms/databases/(default)/documents/lockdownPolicies/hwgBHyfp7qRmv8eKp09UifD18VV2?key=...`
  - Result after deployment: `HTTP/2 200`
- Verified the live response contains the expected Phase 4 policy fields:
  - `parent_id: hwgBHyfp7qRmv8eKp09UifD18VV2`
  - `is_enabled: true`
  - `allowed_origins`: `https://www.khanacademy.org`, `https://www.desmos.com`
  - `allowed_youtube_channels`: the saved Crash Course Kids and Khan Academy channel entries

## Current Handoff Status

- Phase 4 remote sync is unblocked at the Firestore policy layer.
- No extension code change was required for this retry because the live failure came from undeployed rules, not a mismatch in the pairing or fetch path.
- Phase 4 is ready for tester re-validation of propagation and restart persistence.

## Tester Retest Validation

- Status: `pass`
- Retested on `2026-05-04` against the unpacked extension loaded from `extensions/chrome-lockdown-poc/` in the `Lockdown Phase 2 Test` Chrome profile.
- Used the saved Firebase parent session for `phase4tester+1777932000@example.com`, targeting `lockdownPolicies/hwgBHyfp7qRmv8eKp09UifD18VV2` in project `gridworkz-lms`.
- Confirmed the Phase 4 retry prerequisites before retesting:
  - Firestore REST `get` for `lockdownPolicies/hwgBHyfp7qRmv8eKp09UifD18VV2` returned `HTTP 200`
  - the dashboard pairing code still matched the same policy id and project id

## Tester Retest Results

- Re-read the authenticated parent dashboard and confirmed the saved policy id and pairing code still target `hwgBHyfp7qRmv8eKp09UifD18VV2`.
- Reloaded the unpacked extension from `extensions/chrome-lockdown-poc/`.
- Opened the extension options page and re-saved the existing pairing.
- Confirmed the popup reached a successful sync state:
  - `Remote policy synced`
  - paired policy id `hwgBHyfp7qRmv8eKp09UifD18VV2`
  - last remote sync initially showed `5/4/2026, 4:01:15 PM`
- Confirmed the paired policy baseline before propagation tests:
  - `https://example.com` redirected to the blocked interstitial while blocking was on
  - `https://www.khanacademy.org` remained accessible from the saved allowlist
- Validated polling-window propagation for the blocking toggle:
  - updated the same saved policy document to `is_enabled: false`
  - after the next poll, the popup switched to `Blocking off` and showed `Last remote sync 5/4/2026, 4:07:52 PM`
  - `https://example.com` then loaded normally without reinstalling or re-pairing the extension
- Validated polling-window propagation for the website allowlist:
  - restored `is_enabled: true`, then confirmed the popup returned to `Blocking on` with `Last remote sync 5/4/2026, 4:10:54 PM`
  - removed `https://www.desmos.com` from `allowed_origins`
  - after the next poll, the popup count dropped from `2` to `1` allowed website and showed `Last remote sync 5/4/2026, 4:13:29 PM`
  - `https://www.desmos.com` then redirected to the blocked interstitial without reinstalling the extension
  - `https://www.khanacademy.org` remained accessible after the allowlist edit
- Validated restart persistence:
  - fully quit Chrome and relaunched the `Lockdown Phase 2 Test` profile
  - immediately reopened the popup and confirmed it still reflected the last synced policy state: `Blocking on`, `1` allowed website, and the paired policy id
  - immediately navigated to `https://www.desmos.com` after relaunch and confirmed it was still blocked
- Restored the saved policy document to its original Phase 4 state after testing:
  - `is_enabled: true`
  - `allowed_origins`: `https://www.khanacademy.org`, `https://www.desmos.com`

## Tester Retest Notes

- No Phase 4 extension or dashboard code changes were required for the retry.
- Fresh `localhost` navigation from the paired test profile is blocked once blocking is active, so the propagation retest mutated the same authenticated `lockdownPolicies/{policyId}` document directly for the toggle and allowlist steps. This still exercised the Phase 4 pairing, polling, cached enforcement, and restart-persistence behavior against the exact live policy targeted by the dashboard-generated pairing code.
- The popup reflected a correct successful sync state throughout the retest and preserved the cached policy update timestamp across restart.

## Final Phase Status

- Phase 4 is complete and ready to hand off to Phase 5 developer work.

## Next Action

Developer should start Phase 5: `End-to-end validation and gap capture`, using the now-verified Phase 4 pairing and remote sync path as the baseline.
