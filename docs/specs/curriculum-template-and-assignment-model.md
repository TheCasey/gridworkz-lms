# Curriculum Template And Assignment Model

Status: Draft

Last updated: 2026-05-10

## Goal

Define the future planning model that separates reusable instructional structure from student-specific pacing, weekly publication, and completion state.

This spec exists because the current `subjects` collection bundles too many responsibilities into one object:

- curriculum definition
- student assignment
- weekly work structure
- progress tracking
- resource references

That combined shape is workable for the current app, but it is too flat for the intended baseline product.

## Canonical Future Hierarchy

Planning docs should use this future hierarchy:

1. `CurriculumTemplate`
2. `Unit` or `Module`
3. `Assignment`
4. `WeeklyPlan`
5. `WeeklyBlock`

`Project` is a separate first-class object that may consume `WeeklyBlock` effort, but it does not replace the hierarchy above.

## Object Responsibilities

### `CurriculumTemplate`

Reusable instructional structure.

Responsibilities:

- title
- subject area
- curriculum mode
- source material references
- default pacing hints
- default block/completion recommendations
- reusable units or modules

Non-responsibilities:

- no student-specific progress
- no live weekly state
- no temporary weekly exceptions

Examples:

- `Beast Academy 5`
- `Khan Academy Pre-Algebra`
- `Chess Foundations`

### `Unit` or `Module`

Reusable chunk inside a template.

Responsibilities:

- label or title
- source-linked chunk boundaries
- objective summary
- estimated effort
- suggested `WeeklyBlock.category`
- suggested `WeeklyBlock.completion_mode`

Examples:

- `Chapter 1: Place Value`
- `Pages 12-18`
- `Lesson 4: Tactical Patterns`

### `Assignment`

Student-specific instance of a template.

Responsibilities:

- student identity
- linked template
- pacing configuration
- current position
- student-specific overrides
- assignment status

Examples of assignment-specific state:

- how many blocks per week
- target completion date
- whether this student uses `time_boxed` or `hybrid` completion for practice work
- notes or accommodations for one student only

### `WeeklyPlan`

Published weekly workload for one student in one week.

Responsibilities:

- one student + one week identity
- generated weekly blocks
- weekly add-ons and exceptions
- publication state
- final live view for the student portal

Recommended states:

- `draft`
- `published`
- `archived`

### `WeeklyBlock`

One planned piece of work in a published week.

Responsibilities:

- instructions
- resources
- source references
- `category`
- `completion_mode`
- completion/progress state
- optional project linkage
- optional assessment linkage

Required planning vocabulary:

- `WeeklyBlock.category`
  - `lesson`
  - `review`
  - `practice`
  - `assessment`
  - `project_work`
- `WeeklyBlock.completion_mode`
  - `time_boxed`
  - `task_complete`
  - `hybrid`

## Curriculum Modes

The future template model should support a small number of curriculum modes rather than trying to cover every homeschool workflow with one generic form.

Recommended modes:

1. `manual_recurring`
2. `sequenced_resource`
3. `uploaded_curriculum`
4. `standards_aligned_custom`
5. `practice_mastery_hybrid`

These modes are defined in the baseline foundation doc and should stay aligned with it.

## Shared Template Vs Student Assignment State

The system should treat template data and assignment data separately.

### Shared template data

Belongs on `CurriculumTemplate` or `Unit`:

- title and description
- units/modules
- source material
- approved resource links
- default objective phrasing
- default suggested chunking

### Student-specific assignment data

Belongs on `Assignment`:

- student id
- current unit/module position
- pace or weekly target
- duration or effort expectation
- special notes or overrides
- active/paused/completed state

This split is the main fix for the current pain where editing a subject often means reopening a multi-step wizard to change weekly reality.

## Assignment Modes

Assignments should support at least two planning modes.

### `sequential`

The assignment advances through a defined sequence automatically.

Best fit:

- textbooks
- workbooks
- online courses
- ordered lesson libraries

Expected behavior:

- the assignment tracks current position
- weekly plans pull the next relevant chunks
- parents only intervene when pacing or source structure needs adjustment

### `weekly_custom`

The parent defines or edits this week’s work manually.

Best fit:

- families who re-plan often
- flexible subjects with changing resources
- custom electives or enrichment

Expected behavior:

- the assignment still exists
- the weekly plan is more manually shaped
- parents should not need to rewrite the template just to change one week

## Source Material Linkage

The future model should treat source linkage as first-class data, especially for AI-assisted chunking.

Each template or module should be able to point back to:

- uploaded PDF or image source
- pasted text or table of contents
- approved resource URLs
- parent-authored objective text
- standards overlays where relevant

Every generated block should be traceable back to at least one of:

- a source section
- an approved objective
- an approved resource

If the system cannot ground a block to one of those sources, it should fail closed and request parent review instead of inventing structure.

## Current Position Tracking

Progress should live at the assignment layer, not the template layer.

That implies:

- two students can share the same `CurriculumTemplate`
- each student can sit at a different point in the sequence
- each student can have different pacing or accommodations
- a weekly plan should derive from assignment state, not mutate the shared template

This is especially important for cases where one parent teaches the same subject to multiple children but wants different pace, reminders, or block types.

## Relationship To Current Code

Current-state docs may still refer to `subjects` because that is the present repository shape.

For planning purposes, treat the current `subjects` record as an overloaded current-state object that roughly combines parts of:

- `CurriculumTemplate`
- `Assignment`
- some weekly-block defaults

Implementation work should not assume the current `subjects` object is the final long-term contract.

## Open Decisions

- Whether `Unit` and `Module` should remain synonyms or one term should win in implementation-facing naming.
- Whether assignment overrides should support full block-template replacement or only pacing/resource overrides in the first pass.
- Whether standards tags belong primarily on templates, modules, weekly blocks, or reports.

## Related Docs

- [../upgrades/baseline-product-foundation.md](../upgrades/baseline-product-foundation.md)
- [weekly-planning-and-review-flow.md](weekly-planning-and-review-flow.md)
- [projects-and-assessment-model.md](projects-and-assessment-model.md)
- [ai-assisted-planning-and-student-help.md](ai-assisted-planning-and-student-help.md)
