# Phase 5 Handoff

## Phase Goal

Close out the PoC with one concise QA artifact, confirm the still-supported end-to-end paths, and capture the intentional gaps that must be addressed before any production work starts.

## Files Changed

- `docs/specs/poc-lockdown-runs/phase-05.md`
- `docs/specs/poc-lockdown-state.yaml`

## Manual QA Checklist

- [x] Extension popup local toggle behavior
  - Cleared pairing from `options.html`.
  - Confirmed the popup switched to `Not paired`, re-enabled the toggle, and allowed `Blocking on -> Blocking off -> Blocking on`.
- [x] Paired remote sync state
  - Re-saved the known Phase 4 pairing for `lockdownPolicies/hwgBHyfp7qRmv8eKp09UifD18VV2`.
  - Confirmed the popup returned to `Remote policy synced`, `Blocking on`, `2` allowed websites, and `2` approved creators.
- [x] Dashboard remote toggle propagation
  - Carried forward from the passed Phase 4 retest on the same paired policy path.
  - Verified there that `is_enabled: false` propagated to the popup and allowed `https://example.com` without reinstalling or re-pairing.
- [x] Website allowlist remote propagation
  - Carried forward from the passed Phase 4 retest on the same paired policy path.
  - Verified there that removing `https://www.desmos.com` propagated to the popup count and blocked Desmos without reinstalling or re-pairing.
- [x] Approved watch-page YouTube creator playback
  - Revalidated `https://www.youtube.com/watch?v=IupFWJS0g5A`.
  - Confirmed the page resolved to `Khan Academy` and the player exposed `Pause (k)`.
- [x] Approved shorts YouTube creator playback
  - Revalidated `https://www.youtube.com/shorts/0OtbV8-Mdr4`.
  - Confirmed desktop YouTube canonicalized to `watch?v=0OtbV8-Mdr4`, the page resolved to `Crash Course Kids`, and the tab reported `Audio playing`.
- [x] Blocked creator YouTube overlay behavior
  - Revalidated `https://www.youtube.com/watch?v=dQw4w9WgXcQ`.
  - Confirmed the in-page overlay headline `This creator is blocked right now` and the creator details `Rick Astley`, `@RickAstleyYT`, `UCuAXFkgsw1L7xaCfnd5JJOw`.
- [x] Restart persistence of the last synced policy
  - Carried forward from the passed Phase 4 retest on the same paired policy path.
  - Verified there that a full Chrome restart preserved the last synced paired policy before the next poll completed.
- [x] Localhost/dashboard access caveat while blocking is active
  - Reconfirmed that the paired test profile blocks both `http://127.0.0.1:3000/login` and `http://localhost:3000/` while blocking is on.
  - Confirmed that after clearing pairing and turning local blocking off, the same profile can reach `http://localhost:3000/dashboard`.
  - Confirmed this Chrome profile currently retains an authenticated parent session for `phase4tester+1777932000@example.com`, so the reachable destination after local unblock is the dashboard rather than the login page.

## Validation Notes

### Fresh Phase 5 Validation

- Environment:
  - Local app served from `http://localhost:3000/` via `npm run dev`
  - Chrome profile: `Lockdown Phase 2 Test`
  - Paired policy: `lockdownPolicies/hwgBHyfp7qRmv8eKp09UifD18VV2`
- Popup behavior is still consistent with the intended split:
  - unpaired mode keeps the local toggle editable
  - paired mode disables the toggle and surfaces sync state only
- The currently paired policy still resolves the expected YouTube creator allowlist:
  - `Khan Academy`
  - `Crash Course Kids`
- The blocked-creator overlay still fails closed and identifies the blocked creator clearly.

### Paired Round-Trip Coverage

- The authoritative paired remote propagation results remain the Phase 4 tester retest against the same live policy path:
  - dashboard toggle propagation: pass
  - dashboard allowlist propagation: pass
  - restart persistence after a successful sync: pass
- Phase 5 revalidated the same paired extension state before and after local unpair/re-pair, then revalidated creator-level enforcement on top of that paired state.
- The localhost caveat is now explicitly verified as a host-level block while active, not just a `127.0.0.1` quirk:
  - blocking active redirects both `localhost:3000` and `127.0.0.1:3000`
  - clearing pairing and disabling local blocking restores dashboard access on the same profile

## Production Gaps

- Firestore rules are still intentionally weakened for the PoC.
  - `lockdownPolicies/{policyId}` allows public unauthenticated `get`, which is not production-safe.
- Pairing is not hardened.
  - The current pairing code contains the policy id plus public Firebase web config and does not establish device identity, signed enrollment, revocation, or tamper resistance.
- Enforcement scope is intentionally narrow.
  - YouTube enforcement only supports direct `watch` and `shorts` pages.
  - Other YouTube surfaces are blocked or unsupported rather than policy-aware.
- The parent dashboard and localhost development host are not exempt from active blocking.
  - In practice, the same locked profile cannot manage the policy from either `localhost:3000` or `127.0.0.1:3000` while blocking is on unless the profile is first unpaired or locally turned off.
- Browser-session state still affects the manual workflow.
  - In this validation, the `Lockdown Phase 2 Test` profile retained an authenticated parent dashboard session after local unblock, but a fresh or signed-out profile may still land on `/login`.
- Popup sync timestamps are functional but rough.
  - `Last remote sync` and `Cached policy updated` can diverge in a way that is technically correct but easy to misread during manual QA.

## Must Change Before Productionization

- Replace public Firestore reads with authenticated device enrollment and scoped policy reads.
- Add a real device trust and pairing model with revocation and per-device visibility.
- Decide how the parent-management surface should bypass or coexist with blocking.
- Define whether unsupported YouTube surfaces stay intentionally blocked or gain broader policy-aware handling.
- Add automated validation for policy sync and creator enforcement instead of relying on manual profile-driven retests.

## Blockers

- None for Phase 5 closeout.

## Next Role

None

## Next Action

Workflow complete.
