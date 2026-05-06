# Phase 2 Handoff

## Phase Goal

Add creator-level YouTube enforcement for `watch` and `shorts` pages while preserving the Phase 1 website allowlist redirect behavior.

## Files Changed

- `extensions/chrome-lockdown-poc/manifest.json`
- `extensions/chrome-lockdown-poc/background.js`
- `extensions/chrome-lockdown-poc/policy.js`
- `extensions/chrome-lockdown-poc/popup.js`
- `extensions/chrome-lockdown-poc/blocked.html`
- `extensions/chrome-lockdown-poc/youtube-content.js`
- `docs/specs/poc-lockdown-state.yaml`
- `docs/specs/poc-lockdown-runs/phase-02.md`

## Decisions Made

- Kept the Phase 1 MV3 architecture intact and extended it with the smallest new surface:
  - `declarativeNetRequest` still handles top-level website allowlist blocking.
  - A new YouTube content script handles creator enforcement only on `watch` and `shorts` pages.
- Added explicit top-level allow rules for direct YouTube `watch` and `shorts` routes so those pages can load far enough for in-page creator checks.
- Kept `channel_id` as the enforcement key and updated the local mock policy to use real channel IDs for:
  - `Crash Course Kids`: `UCONtPx56PSebXJOxbFv-2jQ`
  - `Khan Academy`: `UC4a-Gbdw7vOaccHmFo40b9g`
- Resolved creator identity from live YouTube page data in the service worker with `chrome.scripting.executeScript(...)` in the page's main world, using:
  - `window.ytInitialPlayerResponse.videoDetails.channelId`
  - `window.ytInitialPlayerResponse.videoDetails.author`
  - `window.ytInitialPlayerResponse.microformat.playerMicroformatRenderer.ownerProfileUrl`
- Kept the content script fail-closed:
  - it pauses visible media while checking,
  - removes the overlay for approved creators,
  - keeps a blocked overlay for non-approved creators,
  - keeps an unresolved overlay if creator data never stabilizes after retries.
- Did not add pairing, remote sync, dashboard writes, or curriculum logic.

## Tests Run

- `npm run build`
- `node --check extensions/chrome-lockdown-poc/background.js`
- `node --check extensions/chrome-lockdown-poc/policy.js`
- `node --check extensions/chrome-lockdown-poc/popup.js`
- `node --check extensions/chrome-lockdown-poc/youtube-content.js`
- `node --input-type=module` policy matcher check:
  - approved Khan Academy ID matches
  - approved Crash Course Kids ID matches
  - sample blocked Rick Astley ID does not match
- Live YouTube HTML checks against current public pages:
  - `https://www.youtube.com/watch?v=IupFWJS0g5A` resolves `UC4a-Gbdw7vOaccHmFo40b9g`
  - `https://www.youtube.com/shorts/0OtbV8-Mdr4` resolves `UCONtPx56PSebXJOxbFv-2jQ`
  - `https://www.youtube.com/watch?v=dQw4w9WgXcQ` resolves `UCuAXFkgsw1L7xaCfnd5JJOw`

## Tester Validation

- Pass: Phase 2 acceptance criteria validated in a fresh local Chrome profile named `Lockdown Phase 2 Test`.
- Chrome 147 in this environment did not honor unpacked-extension command-line loading, so the tester loaded `extensions/chrome-lockdown-poc/` manually through `chrome://extensions` with `Developer mode` and `Load unpacked` in that fresh profile.
- Verified blocking was turned on from `chrome-extension://fnklbkmnjlknenbgglcggcdjpaepflag/popup.html` before any YouTube checks. The popup changed from `Blocking off` to `Blocking on`.
- Verified the approved watch URL `https://www.youtube.com/watch?v=IupFWJS0g5A` remained usable while blocking was on:
  - the page resolved to Khan Academy,
  - the YouTube player exposed `Pause (k)`,
  - the tab state switched to `Audio playing`.
- Verified the approved shorts URL `https://www.youtube.com/shorts/0OtbV8-Mdr4` remained usable while blocking was on:
  - desktop YouTube canonicalized the URL to `youtube.com/watch?v=0OtbV8-Mdr4`,
  - the video resolved to Crash Course Kids,
  - the YouTube player exposed `Pause (k)`,
  - the tab state switched to `Audio playing`.
- Verified the blocked creator URL `https://www.youtube.com/watch?v=dQw4w9WgXcQ` showed the intended blocked state while blocking was on:
  - the in-page overlay headline was `This creator is blocked right now`,
  - the overlay identified `Rick Astley`, `@RickAstleyYT`, and `UCuAXFkgsw1L7xaCfnd5JJOw`,
  - the tab no longer reported `Audio playing` once the blocked state settled.
- Verified the non-YouTube blocked-site check `https://example.com` still redirected to the blocked interstitial:
  - the top-level URL became `chrome-extension://fnklbkmnjlknenbgglcggcdjpaepflag/blocked.html`,
  - the page headline was `This site is blocked right now`,
  - the interstitial recorded `https://example.com/` as the blocked URL.

## Known Edge Cases

- The Phase 2 YouTube check depends on `window.ytInitialPlayerResponse`. If YouTube delays or withholds that object on a route transition, the page stays blocked with the unresolved creator overlay instead of failing open.
- Only direct `watch` and `shorts` routes are supported in this phase. Other YouTube surfaces should remain blocked by the Phase 1 top-level rule, and if a user SPA-navigates away from an allowed video page the content script keeps the page blocked in-place instead of opening new product surface.
- Full unpacked-extension browser validation is still the tester's job for this phase. The developer pass here covers code changes, syntax, build health, policy matching, and current public page channel-ID verification.

## Blockers

- None for handoff.

## Next Role

Developer

## Original Tester Checklist

1. Load the unpacked extension from `extensions/chrome-lockdown-poc/` in an isolated Chrome profile.
2. Turn blocking on.
3. Confirm `https://www.youtube.com/watch?v=IupFWJS0g5A` is usable and the video can play.
4. Confirm `https://www.youtube.com/shorts/0OtbV8-Mdr4` is usable and the short can play.
5. Confirm `https://www.youtube.com/watch?v=dQw4w9WgXcQ` shows the in-page blocked creator state and does not stay playable.
6. Confirm a non-allowlisted non-YouTube site such as `https://example.com` still redirects to the blocked interstitial exactly as in Phase 1.
