# Phase 1: Public Route And Shell Foundation

## Goal

Replace the root redirect with a real public homepage route and add the anchored marketing-page shell without regressing login, dashboard, or student access flows.

## Depends On

- None

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Add a dedicated public homepage route at `/` while keeping `/login`, `/dashboard/*`, and `/student/:slug` behavior intact.
- Keep `/` as a genuine marketing route instead of another auth redirect surface, while preserving `/login` as the existing authenticated parent fast path.
- Create the initial homepage shell with sticky navigation, section anchors, and primary CTA wiring.
- Route `Start free` and `Sign in` through the current auth entry point instead of inventing `/signup`, `/pricing`, checkout, or billing flows in this phase.
- Keep this phase structural; do not spend it on full copy polish, pricing detail, or FAQ depth.

## Deliverables

- Public homepage route on `/`
- Homepage shell component with anchor section scaffolding
- Safe CTA routing between homepage, login, and dashboard entry points

## Files Or Areas To Touch

- src/App.jsx
- src/pages/MarketingHome.jsx
- src/index.css

## Read First

- docs/specs/public-marketing-site-and-landing-page.md
- src/App.jsx
- src/pages/LoginPage.jsx
- src/index.css
- tailwind.config.js

## Exit Criteria

- Unauthenticated visitors land on a real public homepage at `/` instead of an auth redirect.
- The homepage has stable anchor sections and visible primary CTAs even if the section content is still provisional.
- Existing login and dashboard entry flows still behave correctly.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `browser-use`, `playwright`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.
- `interaction-smoke`: preferred tools `browser-use`, `playwright`, `computer-use`; default evidence test output, screenshot. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.

## Runtime Targets

- http://localhost:3000/
- http://localhost:3000/login
- Homepage anchor navigation on `/`

## Evidence Required

- command output
- screenshot
- brief route-and-anchor behavior note

## Allowed Discovery

Follow the router, the new homepage component, adjacent styles, and direct CTA targets only as needed from the listed read-first files.

## Test Commands

- npm run build

## Manual Verification Follow-Up

- Confirm the public-root, in-page anchor, and `/login` handoff still makes sense for both new visitors and returning parents without implying a separate signup or live billing flow.

## Master Developer Review Focus

Keep this phase about routing and shell structure first. Do not spend the first handoff budget on long-form copy or late-stage polish.

## Runtime Handoff Notes

- `developer`: Implement only the route and shell foundation. Preserve existing auth guards and student routes while wiring the public homepage.
- `tester`: Verify that `/`, `/login`, and the key CTA paths behave correctly, and that anchor navigation actually works in the live page.

## Next Phase Inputs

- Stable public route behavior
- Anchored homepage shell ready for real content sections
