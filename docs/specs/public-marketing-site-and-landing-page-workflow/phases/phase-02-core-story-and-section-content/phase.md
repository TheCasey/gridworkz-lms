# Phase 2: Core Story And Section Content

## Goal

Turn the homepage shell into a clear product narrative that explains what GridWorkz is, how it works, and why the student workspace plus reporting model matters.

## Depends On

- Phase 1: Public Route And Shell Foundation

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Implement the hero, problem framing, how-it-works, parent experience, student experience, and reports/accountability sections.
- Use the weekly-autonomy product stance from the source docs instead of generic LMS or admin-template language.
- Add product-frame callouts, screenshot slots, or section compositions that feel intentional rather than placeholder marketing cards.
- Build on the Phase 1 shell by preserving the current root-route contract, section-anchor IDs, and CTA wiring unless a Phase 2 content need makes a small local adjustment necessary.
- Keep pricing cards, FAQ, and final conversion refinements for later phases.

## Deliverables

- Complete narrative content for the core homepage sections
- Visual section layouts that reflect the existing GridWorkz brand direction
- Homepage copy that emphasizes weekly planning, student independence, and proof of work

## Files Or Areas To Touch

- src/pages/MarketingHome.jsx
- src/index.css

## Read First

- docs/specs/public-marketing-site-and-landing-page.md
- docs/upgrades/baseline-product-foundation.md
- docs/roadmap.md
- docs/architecture.md
- src/pages/MarketingHome.jsx
- tailwind.config.js

## Exit Criteria

- A first-time visitor can understand what GridWorkz is and how it works before reaching pricing.
- The student portal and reporting surfaces are visible as differentiators instead of being buried behind parent-dashboard language.
- The page copy stays truthful to the live app and avoids promising future curriculum, project, or AI behavior as if it is already shipped.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.
- `manual-qa`: preferred tools `human`; default evidence manual verification note. Document the manual follow-up that a human must complete before final merge or release confidence.

## Runtime Targets

- http://localhost:3000/
- Homepage hero through `#reports` on `/`

## Evidence Required

- command output
- screenshot
- brief copy-truthfulness note

## Allowed Discovery

Follow adjacent styles, assets, and copy-support files only as needed from the homepage component and the listed planning docs.

## Test Commands

- npm run build

## Manual Verification Follow-Up

- Review the visible homepage copy for overclaims about future features or live billing that the repo does not support yet.
- Confirm a first-time visitor can understand what GridWorkz is, how it works, and why the student workspace plus reports matter before reaching pricing.

## Master Developer Review Focus

Protect the positioning discipline here: parents define the week, students run the day, and reports prove the work.
Keep the Phase 1 route, anchor, and CTA contract stable so later pricing and FAQ work can layer on without another structural pass.

## Runtime Handoff Notes

- `developer`: Build the core story sections only. Replace the Phase 1 placeholder language in hero through reports while keeping pricing and FAQ as later-phase shells.
- `tester`: Focus on whether the page actually communicates the product clearly and whether any section regressed visually while scrolling the core narrative.

## Next Phase Inputs

- Stable core homepage story and section structure
- Product framing ready for pricing and FAQ integration
