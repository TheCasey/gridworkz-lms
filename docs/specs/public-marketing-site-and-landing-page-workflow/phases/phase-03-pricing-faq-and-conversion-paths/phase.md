# Phase 3: Pricing FAQ And Conversion Paths

## Goal

Complete the public decision-making surface with plan-aware pricing, FAQ coverage, and repeated conversion paths that match the documented billing reality.

## Depends On

- Phase 2: Core Story And Section Content

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add the pricing section for Free, Core, and Lockdown using the current entitlement and pricing docs as the source of truth.
- Add the FAQ section and final CTA block.
- Make CTA behavior consistent across the page: start free, see pricing, and sign in.
- Preserve the current root-route contract, existing section anchors, and current `/login` plus `/login?mode=signup` entry paths while deepening the public decision surface.
- Do not implement live checkout or imply that paid self-serve billing is already available if it is not.

## Deliverables

- Pricing section aligned with the entitlement model
- FAQ and final CTA sections
- Homepage CTA behavior that routes visitors clearly into signup or login paths

## Files Or Areas To Touch

- src/pages/MarketingHome.jsx
- src/constants/entitlements.js
- src/index.css

## Read First

- docs/specs/public-marketing-site-and-landing-page.md
- docs/upgrades/subscriptions-and-entitlements.md
- src/constants/entitlements.js
- src/pages/MarketingHome.jsx
- src/pages/LoginPage.jsx

## Exit Criteria

- The pricing section matches the current entitlement model and does not contradict the source docs.
- Visitors can learn plan differences without hitting a dead-end or misleading checkout expectation.
- The FAQ answers the main friction questions called out in the source spec.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.
- `interaction-smoke`: preferred tools `browser-use`, `playwright`, `computer-use`; default evidence test output, screenshot. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.
- `manual-qa`: preferred tools `human`; default evidence manual verification note. Document the manual follow-up that a human must complete before final merge or release confidence.

## Runtime Targets

- http://localhost:3000/#pricing
- http://localhost:3000/#faq
- http://localhost:3000/login

## Evidence Required

- command output
- screenshot
- brief billing-readiness note

## Allowed Discovery

Follow pricing-related constants, CTA targets, and nearby homepage sections only as needed from the listed read-first files.

## Test Commands

- npm run build

## Manual Verification Follow-Up

- Confirm the public pricing and CTA copy does not imply that live paid checkout is already active if the operational billing path is still pending.
- Confirm the repeated CTA paths still make sense for both signed-out visitors and already-authenticated parents who hit the public marketing page.

## Master Developer Review Focus

Keep the pricing copy tied to the entitlement source of truth and force explicit caution around live billing readiness.
Keep pricing and FAQ additive to the Phase 2 story instead of turning the page into a billing-first surface.

## Runtime Handoff Notes

- `developer`: Add pricing, FAQ, and CTA repetition without inventing new plan rules or checkout flows.
- `tester`: Verify the pricing anchors, CTA links, and FAQ rendering in the live page, and flag any misleading plan or billing claims.

## Next Phase Inputs

- Complete public content stack including pricing and FAQ
- Consistent CTA paths ready for final responsive polish
