# Phase 3 Handoff

## Phase Goal

Add a Lockdown PoC panel inside the authenticated parent dashboard flow so a parent can save a prototype Firestore policy with `is_enabled` and `allowed_origins`, then reload and see the persisted values.

## Files Changed

- `src/pages/ParentDashboard.jsx`
- `src/components/LockdownPolicyPanel.jsx`
- `src/utils/lockdownPolicyUtils.js`
- `src/constants/schema.js`
- `firestore.rules`
- `docs/specs/poc-lockdown-runs/phase-03.md`
- `docs/specs/poc-lockdown-state.yaml`

## Decisions Made

- Kept the implementation inside the existing authenticated dashboard flow by adding a single `LockdownPolicyPanel` beneath the current dashboard content.
- Stored the prototype derived policy at `lockdownPolicies/{parent_uid}` to keep the Phase 3 model narrow and parent-owned.
- Used this Firestore shape for the Phase 3 prototype document:
  - `parent_id: string`
  - `is_enabled: boolean`
  - `allowed_origins: string[]`
  - `allowed_youtube_channels: { channel_id, title, handle }[]`
  - `created_at: timestamp`
  - `updated_at: timestamp`
- Preserved the Phase 2 creator policy shape without adding editor UI for it. The panel shows current creator entries as read-only and writes them back unchanged.
- Reused the Phase 1/2 default website origins and YouTube creators when no saved policy exists yet, so the dashboard and extension policy shape stay aligned.
- Added a dedicated `lockdownPolicies` match in `firestore.rules` so the intended access pattern is owner-only by document id.

## Validation Behavior

- Website entries are validated in `src/utils/lockdownPolicyUtils.js` before they are added and again before save.
- Accepted entries must:
  - parse as a valid URL
  - use `http` or `https`
  - omit usernames and passwords
  - omit any path beyond `/`
  - omit query strings and hashes
- Valid entries are normalized to `URL.origin`.
- Duplicate origins are rejected in the UI.
- If the user types a pending website entry and clicks save before adding it, save is rejected until the field is added or cleared.

## Tests Run

- `npm run build`
- `node --input-type=module -e "import { validateOriginInput, normalizeLockdownPolicy, buildDefaultLockdownPolicy } from './src/utils/lockdownPolicyUtils.js'; const valid = validateOriginInput('https://www.khanacademy.org/'); const invalid = validateOriginInput('https://www.khanacademy.org/math?x=1'); const policy = normalizeLockdownPolicy({ ...buildDefaultLockdownPolicy('parent-1'), allowed_origins: ['https://www.desmos.com', 'https://www.desmos.com/', 'notaurl'] }, 'parent-1'); console.log(JSON.stringify({ valid, invalid, policy }, null, 2));"`

## Remaining Gaps

- I updated `firestore.rules` locally for the new `lockdownPolicies` collection, but I did not run `firebase deploy --only firestore:rules` in this phase. If the tester needs the stricter owner-only rule live in the remote project, rules still need deployment.
- The new rules scope ownership by document id and `parent_id`, but they do not yet enforce detailed field shape constraints. That is a hardening gap, not a Phase 3 blocker.
- No extension pairing, polling, or remote sync behavior was added. That remains Phase 4 scope.

## Blockers

- None for Phase 3 handoff.

## Next Role

Tester

## Tester Checklist

1. Sign in through the normal parent authentication flow and open the dashboard.
2. Confirm the `Lockdown PoC` panel is visible inside the dashboard view.
3. Toggle blocking on or off, click `Save Lockdown Policy`, refresh the page, and confirm the saved state remains.
4. Add a valid origin such as `https://www.example.com`, save, refresh, and confirm it remains in the allowlist.
5. Remove an existing origin, save, refresh, and confirm it stays removed.
6. Try invalid entries such as:
   - `notaurl`
   - `https://www.khanacademy.org/math`
   - `https://www.khanacademy.org?unit=algebra`
   - `ftp://example.com`
   Confirm the UI rejects them before save.

## Tester Validation

- Status: `pass`
- Tested on `2026-05-04` against the authenticated dashboard flow at `http://127.0.0.1:3000/dashboard`.
- Used a fresh Firebase parent account created during validation: `phase3tester+1777920278812@example.com`.
- Used a clean Safari profile for dashboard validation because the dedicated Chrome PoC profile already had the extension enabled and was correctly blocking the local dashboard, which would have mixed Phase 4 behavior into this Phase 3 test.

## Tester Results

- Confirmed the `Lockdown PoC` panel is reachable from the authenticated parent dashboard flow.
- Confirmed `allowed_youtube_channels` entries remain visible and read-only in Phase 3.
- Toggled blocking from off to on, saved the policy, refreshed the dashboard, and confirmed the saved `on` state persisted after reload.
- Added `https://www.example.com/`, confirmed the UI normalized it to `https://www.example.com`, saved, refreshed, and confirmed the normalized origin persisted after reload.
- Removed `https://www.desmos.com`, saved, refreshed, and confirmed the origin stayed removed after reload.
- Tried `notaurl`, `https://www.khanacademy.org/math`, and `ftp://example.com`; each was rejected inline before save and none were added to the persisted allowlist.

## Tester Failures

- None.

## Next Action

- Advance to Phase 4 developer work: extension pairing and remote sync.
