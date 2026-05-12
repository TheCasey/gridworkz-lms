# Phase 4: Responsive Polish And Launch QA

## Goal

Refine the homepage for desktop and mobile, tighten navigation and scroll behavior, and produce launch-ready validation evidence for the new public root experience.

## Depends On

- Phase 3: Pricing FAQ And Conversion Paths

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Polish the sticky header, mobile navigation behavior, spacing rhythm, typography, motion, and section transitions.
- Add any subtle side-rail or anchored quick-link behavior that improves long-scroll orientation without turning the page into a docs layout.
- Make the final pass on screenshot framing or product mock presentation used on the page.
- Preserve the established Phase 1 through Phase 3 route, pricing, FAQ, and CTA contract while refining the feel and responsiveness.
- Keep this phase focused on polish and validation, not on reopening product copy or feature scope.

## Deliverables

- Responsive homepage behavior across desktop and mobile widths
- Final navigation and anchor-scroll polish
- Launch QA evidence for the root homepage and login handoff

## Files Or Areas To Touch

- src/pages/MarketingHome.jsx
- src/index.css
- src/App.jsx

## Read First

- docs/specs/public-marketing-site-and-landing-page.md
- src/pages/MarketingHome.jsx
- src/App.jsx
- src/pages/LoginPage.jsx
- src/index.css

## Exit Criteria

- The homepage feels intentional and stable on desktop and mobile widths.
- Sticky navigation, anchor behavior, and CTA visibility remain usable throughout the long scroll.
- The root-to-login experience is clean and no obvious layout or interaction regressions remain.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `interaction-smoke`: preferred tools `browser-use`, `playwright`, `computer-use`; default evidence test output, screenshot. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.
- `manual-qa`: preferred tools `human`; default evidence manual verification note. Document the manual follow-up that a human must complete before final merge or release confidence.

## Runtime Targets

- http://localhost:3000/
- Homepage at desktop and mobile widths
- Homepage anchored sections at `#pricing` and `#faq`
- Homepage to /login CTA handoff

## Evidence Required

- command output
- screenshot
- brief responsive-polish note

## Allowed Discovery

Follow homepage styles, navigation hooks, and direct CTA targets only as needed from the listed read-first files.

## Test Commands

- npm run build

## Manual Verification Follow-Up

- Confirm common mobile widths keep the sticky navigation usable and do not hide CTA buttons or anchored section headings behind fixed chrome.
- Confirm the `/login` and `/login?mode=signup` handoff still feels coherent for both signed-out visitors and already-authenticated parents under the existing `PublicRoute`.

## Master Developer Review Focus

Treat this as final polish plus QA. Do not reopen earlier product decisions unless a real defect forces it.
Protect the existing route, plan, and FAQ contract while smoothing responsive and navigation behavior.

## Runtime Handoff Notes

- `developer`: Polish responsiveness and navigation behavior only. Avoid slipping into unrelated dashboard or auth redesign work.
- `tester`: Run the final browser-based smoke at desktop and mobile widths and return concrete evidence about scroll, anchors, CTA visibility, and route handoff behavior.

## Next Phase Inputs

- Launch-ready public homepage
- QA notes and remaining manual follow-up, if any
