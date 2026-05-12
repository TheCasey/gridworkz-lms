# Phase 1 Handoff

## Phase Goal

Create the first Chrome MV3 extension shell with a local-only mock policy, popup toggle, allowlist viewer, and blocked interstitial.

## Files Changed

- `extensions/chrome-lockdown-poc/manifest.json`
- `extensions/chrome-lockdown-poc/background.js`
- `extensions/chrome-lockdown-poc/policy.js`
- `extensions/chrome-lockdown-poc/popup.html`
- `extensions/chrome-lockdown-poc/popup.js`
- `extensions/chrome-lockdown-poc/allowlist.html`
- `extensions/chrome-lockdown-poc/allowlist.js`
- `extensions/chrome-lockdown-poc/blocked.html`
- `extensions/chrome-lockdown-poc/blocked.js`
- `extensions/chrome-lockdown-poc/styles.css`
- `.codex/agents/implementer/openai.yaml`
- `.codex/agents/tester/openai.yaml`
- `.codex/agents/researcher/openai.yaml`
- `docs/specs/poc-lockdown-state.yaml`
- `docs/specs/poc-lockdown-plan.md`

## Decisions Made

- Live run state now belongs in `docs/specs/poc-lockdown-state.yaml`; the PoC plan stays focused on phase definitions and handoff rules.
- Phase 1 uses MV3 `declarativeNetRequest` dynamic rules with one catch-all top-level redirect rule plus per-origin allow rules.
- The local mock policy uses origin-level website allowlisting and stores YouTube creator metadata now, but creator-level playback enforcement is intentionally deferred to Phase 2.
- Phase 1 only blocks `main_frame` navigation so allowlisted sites can load normally without turning the PoC into a full subresource-filter problem.

## Tests Run

- `npm run build`
- `node --check extensions/chrome-lockdown-poc/background.js`
- `node --check extensions/chrome-lockdown-poc/policy.js`
- `node --check extensions/chrome-lockdown-poc/popup.js`
- `node --check extensions/chrome-lockdown-poc/allowlist.js`
- `node --check extensions/chrome-lockdown-poc/blocked.js`
- `node -e "JSON.parse(require('node:fs').readFileSync('extensions/chrome-lockdown-poc/manifest.json', 'utf8'))"`

## Tester Validation

- Pass: Phase 1 acceptance criteria validated in an isolated Chrome profile using the unpacked extension at `extensions/chrome-lockdown-poc/`.
- Verified the unpacked MV3 extension loads in Chrome and appears in `chrome://extensions/` as `GridWorkz Lockdown PoC` version `0.1.0`.
- Verified the popup opens from the Chrome extensions menu and the on/off toggle changes the live state between `Blocking off` and `Blocking on`.
- Verified the allowlist view opens from the popup and shows both website entries (`https://www.khanacademy.org`, `https://www.desmos.com`) and YouTube creator entries (`Crash Course Kids`, `Khan Academy`).
- Verified with blocking on that an allowlisted site (`https://www.khanacademy.org`) loads normally.
- Verified with blocking on that a non-allowlisted site (`https://example.com`) redirects to the blocked interstitial and records the blocked URL.
- Verified with blocking off that normal browsing resumes and `https://example.com` loads normally.

## Blockers

- None after tester validation.

## Next Role

Developer
