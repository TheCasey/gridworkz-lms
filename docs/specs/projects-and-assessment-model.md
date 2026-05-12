# Projects And Assessment Model

Status: Draft

Last updated: 2026-05-10

## Goal

Define the future split between first-class projects and assessment-style weekly blocks so the product can support multi-week work without overloading curriculum assignments or inventing unnecessary top-level objects.

## Core Decision

Projects and quizzes should not be modeled the same way.

- `Project` should be a first-class tracked work object.
- `Quiz` or `Assessment` should be a `WeeklyBlock.category`, not a separate top-level entity by default.

This keeps the system aligned to the actual lifecycle of each kind of work.

## Why Projects Are Separate

Projects differ from ordinary curriculum blocks because they often:

- span multiple weeks
- have their own progress and completion state
- involve their own instructions, resources, and deliverables
- need to appear in a dedicated student-facing area
- need active vs completed organization

That is meaningfully different from a single weekly lesson or quiz.

## Why Assessments Stay Inside Weekly Blocks

Assessments usually behave like one planned piece of work in a week.

Common examples:

- math quiz
- spelling test
- written narration
- oral check-in
- comprehension checkpoint

These fit naturally as `WeeklyBlock.category = assessment`.

They do not need their own tab, lifecycle, or standalone object in the first planning model.

## `Project` Contract

Projects should be first-class tracked objects that sit beside curriculum assignments.

Recommended project responsibilities:

- title
- related subject area or assignment
- description
- estimated total blocks or hours
- status
- due date if relevant
- optional milestones
- optional resources
- optional deliverable expectations

Recommended statuses:

- `draft`
- `active`
- `completed`
- `archived`

## Relationship To Weekly Plans

Projects do not replace weekly plans.

Instead:

- the project holds the long-lived work definition and progress state
- `WeeklyPlan` allocates `project_work` blocks against the project
- the student completes those blocks inside the normal weekly workflow

This gives the product both:

- a dedicated project surface
- a clean weekly execution model

## Relationship To Curriculum Assignments

Projects are related to a subject area or assignment, but they are not the same thing as curriculum.

Example:

- `ELA assignment` continues weekly
- `Book reflection project` is created separately
- the weekly plan allocates two `project_work` blocks to that project this week

This is cleaner than pretending the project is a temporary fake curriculum.

## First-Pass Scope Recommendation

For the baseline redesign, prefer a simpler project contract:

- single-student project ownership
- optional linkage to one assignment or subject area
- weekly allocation through `project_work` blocks
- active and completed views

Do not make the first implementation depend on:

- shared multi-student project progress
- nested task trees
- complex rubric systems
- cross-family collaboration

Those can come later if needed.

## Assessments And Quizzes

Assessments should live in weekly plans as block categories.

Required planning vocabulary:

- `WeeklyBlock.category = assessment`
- `WeeklyBlock.completion_mode` still applies

Examples:

- `task_complete` for a written quiz that must be finished
- `time_boxed` for an oral check-in slot
- `hybrid` for a longer assessment with both time and deliverable expectations

## Color Coding

Color coding is useful in the UI, but it should remain a presentation layer only.

Meaning should come from:

- `Project` state and type
- `WeeklyBlock.category`
- `WeeklyBlock.completion_mode`

Do not make color the actual data model.

## Student Experience

The future student portal should show:

- active projects in a dedicated project area
- weekly `project_work` blocks in the normal work queue
- assessment blocks inline with the rest of the week

This keeps the portal understandable:

- projects are visible as longer-running work
- weekly execution still happens one block at a time

## Parent Experience

Parents should be able to:

- create a project without reopening the curriculum wizard
- estimate total effort
- connect the project to a subject area or assignment
- allocate project effort week by week
- mark a project complete or archive it

Parents should also be able to add assessment blocks directly in weekly planning without creating a separate top-level object.

## Subscription And Entitlement Implications

Projects should be treated as a future premium object type behind the shared entitlement model.

Assessments and quizzes should not be defined as a separate premium object type in the current plan. They remain part of the weekly planning model.

## Open Decisions

- Whether a project should attach to one `Assignment`, one subject area label, or optionally multiple related areas.
- Whether milestone tracking should be first-pass or post-baseline work.
- Whether completed projects should remain visible in student history by default or move to an archived-only view.

## Related Docs

- [../upgrades/baseline-product-foundation.md](../upgrades/baseline-product-foundation.md)
- [curriculum-template-and-assignment-model.md](curriculum-template-and-assignment-model.md)
- [weekly-planning-and-review-flow.md](weekly-planning-and-review-flow.md)
- [reporting-and-compliance-contract.md](reporting-and-compliance-contract.md)
- [../upgrades/subscriptions-and-entitlements.md](../upgrades/subscriptions-and-entitlements.md)
