# Curriculum Modal Cleanup

Last updated: 2026-05-22

Status: Workflow implementation complete; seeded destructive-flow QA pending

## Goal

Make the current curriculum subject editor easier to use, especially the block-objective editing step, without changing the Firestore data shape or reopening the weekly-plan architecture.

This is a targeted UI and component-structure cleanup for the existing compatibility input path in `src/pages/Curriculum.jsx`.

## Why This Exists

The parent curriculum page now carries two different responsibilities:

- the legacy subject editor, which remains the compatibility source for subjects, resources, custom fields, timers, and block objectives
- the newer weekly-plan review panel, which can generate and publish a student-week from current active subjects

The immediate parent pain is not the thin weekly-plan panel. It is the legacy subject modal, especially the `Block Objectives` step.

Current issues:

- the modal uses one long scrollable surface, so navigation buttons and context can disappear while editing many blocks
- Step 4 mixes block instructions, block-specific custom fields, student-specific overrides, and nested custom-field editors in one vertical list
- editing a 10 to 20 block subject requires too much scrolling and visual parsing
- the implementation lives inside one large page component, making focused UI changes harder than necessary

## Current-Code Reality

Key files:

- `src/pages/Curriculum.jsx`
- `src/components/curriculum/WeeklyPlanReviewPanel.jsx`
- `src/hooks/useSubjectMutations.js`
- `src/hooks/useWeeklyPlanRecord.js`
- `src/utils/planningCompatibilityUtils.js`
- `src/utils/weeklyPlanUtils.js`

Current data model to preserve:

- subjects remain the active compatibility input
- `block_objectives` stays a map keyed by block index
- each block objective may include `instruction`, `custom_fields`, and `student_overrides`
- each student override may include `instruction` and `custom_fields`
- subject-level `custom_fields`, `resources`, `require_timer`, and `require_input` continue to work

## MVP Scope

In scope:

1. Extract the block-objective editor out of `Curriculum.jsx` into a dedicated component.
2. Preserve the existing save payload and handler behavior during extraction.
3. Restructure the subject modal into a stable shell with sticky header, scrollable body, and sticky footer.
4. Replace the all-expanded block-objective list with a compact block selector plus one active block detail editor.
5. Keep advanced block-specific fields and per-student overrides behind explicit collapsed sections.
6. Preserve keyboard and mobile usability for the modal.
7. Validate that create, edit, archive, delete, publish-week preview, and subject list behavior still work.

Out of scope:

- creating real persisted `curriculumTemplates` or `assignments`
- changing weekly-plan generation semantics
- changing Firestore rules or subject document shape
- redesigning the entire Curriculum page
- changing student portal rendering
- implementing AI curriculum planning

## Product And UX Decisions

### Modal structure

Use a fixed modal shell:

- sticky header with title, step indicator, and close action
- `min-h-0 overflow-y-auto` body
- sticky footer with previous, next, cancel, and primary action buttons

The footer should remain reachable when a subject has many blocks.

### Block objective editing

Default Step 4 to a compact block list and one detail editor.

Recommended behavior:

- show all block numbers/titles as compact selectable rows
- indicate whether each block has an instruction, custom fields, or student overrides
- edit only the selected block in the detail panel
- keep instruction visible by default
- hide block custom fields and per-student overrides behind collapsed controls

### Data safety

This cleanup must be behavior-preserving unless a small bug fix is explicitly called out in a phase.

No phase should change:

- subject write shape
- weekly-plan compatibility references
- student portal completion behavior
- report snapshot behavior

## Implementation Phases

### Phase 1. Extract block objective component

- move Step 4 rendering and helper UI into `src/components/curriculum/BlockObjectivesEditor.jsx`
- pass existing state and handlers through props
- do not change visible behavior yet except for tiny markup cleanup needed by extraction

### Phase 2. Stabilize modal shell

- restructure the modal into sticky header, scrollable body, and sticky footer
- keep all four existing steps and actions intact
- ensure long block lists do not hide the footer controls

### Phase 3. Compact block objective workflow

- replace all-expanded block cards with a block list plus active detail editor
- add concise state indicators for configured blocks
- keep advanced nested editors collapsed until opened

### Phase 4. Responsive and regression pass

- validate desktop and mobile modal behavior
- verify subject create and edit flows still write the same shape
- verify weekly-plan preview still derives from edited subjects

Completion notes, 2026-05-22:

- modal Step 2 and Step 3 rows now stack below the small breakpoint so schedule inputs, resource URL fields, remove controls, and custom-field controls do not compress on 375px/430px widths
- lint and production build pass after the final polish
- authenticated Chrome smoke confirmed the edit modal opens, Step 4 is reachable, footer actions remain visible on desktop, compact block switching still works, and block-specific feedback field controls still open in an unsaved draft
- weekly-plan review still derives from current active subjects; the smoke account showed 33 weekly blocks from 7 active subjects and `Refresh From Subjects` regenerated the local preview message
- final tester smoke also verified an authenticated unsaved add-modal flow through Step 4 and weekly-plan preview refresh without application console errors
- live create/save/reopen/archive/delete were not executed in the available authenticated accounts because writes/destructive actions were not explicitly authorized against those fixtures; those remain manual QA in a seeded or explicitly disposable account

## Exit Criteria

- `Curriculum.jsx` is smaller and delegates block-objective editing to a focused component
- modal controls remain visible or reachable while editing long subjects
- parents can edit per-block instructions without scanning every block at once
- advanced fields remain available but no longer dominate the default path
- lint and build pass
- browser smoke confirms create/edit flow and weekly-plan preview still work

## Remaining Follow-Up

- Complete tester/manual QA in a seeded or disposable parent account for create, save, reopen, archive, and delete. Do not use the current live parent data for destructive checks unless the fixture is explicitly safe.
- Recheck 375px and 430px screenshots in an authenticated viewport harness if available. The developer pass includes code/layout review for those widths and desktop authenticated smoke; authenticated mobile screenshot tooling was not available in this pass.
- Keep persisted curriculum templates, assignment architecture, Firestore rules, student portal behavior, and report behavior out of this cleanup unless a separate plan owns that work.

## Related Docs

- [curriculum-and-weekly-plan-rollout.md](curriculum-and-weekly-plan-rollout.md)
- [../specs/weekly-planning-and-review-flow.md](../specs/weekly-planning-and-review-flow.md)
- [../specs/curriculum-template-and-assignment-model.md](../specs/curriculum-template-and-assignment-model.md)
- [../features/parent-dashboard.md](../features/parent-dashboard.md)
