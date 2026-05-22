# Phase 2: Stable Modal Shell

## Goal

Restructure the subject modal into a sticky header, scrollable body, and sticky footer so long forms remain navigable.

## Depends On

- extract-block-objectives-editor

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Rework the modal shell in `Curriculum.jsx` without changing form state or submission logic.
- Keep the stepper, close action, previous/next/cancel/primary actions, and entitlement messaging intact.
- Ensure the footer remains visible or reachable with long block lists on desktop and mobile.
- Avoid cards-inside-cards visual churn; keep styling aligned to existing parent dashboard tokens.

## Deliverables

- Sticky modal header
- Scrollable modal body
- Sticky modal footer
- Responsive modal sizing

## Files Or Areas To Touch

- src/pages/Curriculum.jsx
- src/components/curriculum/BlockObjectivesEditor.jsx

## Read First

- docs/upgrades/curriculum-modal-cleanup.md
- src/pages/Curriculum.jsx
- src/components/curriculum/BlockObjectivesEditor.jsx
- tailwind.config.js
- src/index.css

## Exit Criteria

- Modal header context stays visible while editing long steps.
- Footer actions are not lost below long Step 4 content.
- All four existing steps remain accessible.
- No text overlaps or clipped buttons at common mobile widths.

## Automated Test Expectation

No component test runner exists; validate with lint/build and browser screenshots at desktop and mobile widths.

## Test Files

- None for this phase.

## Test Cases To Cover

- Browser validation should cover long Step 4 content on desktop and mobile, with header/footer controls visible or reachable.

## No-Test Rationale

This is layout behavior best verified through browser smoke in the current repo because no UI test runner is configured.

## Validation Modes

- `build-health`: preferred tools `shell`; default evidence command output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.
- `browser-smoke`: preferred tools `playwright`, `browser-use`; default evidence test output, screenshot. Load the live UI in a runtime and verify the main happy path for the active slice.
- `interaction-smoke`: preferred tools `playwright`, `computer-use`; default evidence test output, screenshot. Drive a real interaction flow end to end and note visible regressions, console issues, or broken state.

## Runtime Targets

- http://localhost:3000/dashboard/curriculum
- desktop width
- mobile widths 375 and 430

## Evidence Required

- lint/build output
- screenshots showing modal Step 1 and Step 4 at desktop/mobile
- notes confirming footer actions remain reachable

## Allowed Discovery

Stay inside curriculum page/component styles and shared CSS/tokens.

## Test Commands

- npm run lint
- npm run build

## Manual Verification Follow-Up

- Create or edit a 10-plus block subject and verify Previous/Next/Save remain reachable without excessive scroll recovery.

## Master Developer Review Focus

Confirm that Stable Modal Shell is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Stable Modal Shell. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Stable Modal Shell using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Completed deliverables and the run-log summary from this phase.
