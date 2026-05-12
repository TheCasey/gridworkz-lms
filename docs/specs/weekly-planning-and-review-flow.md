# Weekly Planning And Review Flow

Status: Draft

Last updated: 2026-05-10

## Goal

Define how a parent prepares and publishes a student’s week without turning GridWorkz into an hourly scheduler or forcing every change through the curriculum creation wizard.

## Product Stance

Weekly planning is the operational center of the product.

GridWorkz should optimize for:

- parents defining the week
- students choosing order and pacing inside the week
- clear publication of what is live right now
- fast review when nothing changed

GridWorkz should not require a parent to build a detailed hour-by-hour calendar to make the product usable.

## Core Weekly Planning Paths

The system should support three weekly planning paths.

### 1. `one-click carry-forward`

Purpose:

- fastest path when the family’s assignments and pace stayed the same

Expected behavior:

- reuse the current assignment set
- advance sequential assignments to the next chunk automatically
- keep stable block counts or effort targets unless the parent changes them
- let the parent publish quickly

### 2. `guided_weekly_review`

Purpose:

- support families who want a structured weekly check-in

Expected behavior:

- mostly prefilled review flow
- only ask about changes that matter this week
- skip quickly when nothing changed

This is the correct shape for a weekly wizard if one exists. It should be optional, not mandatory.

### 3. `direct_edit`

Purpose:

- support fast edits without opening a full wizard

Expected behavior:

- inline edits to weekly blocks
- quick add/remove/pause actions
- targeted changes to one student or one subject area

## Recommended Guided Weekly Review Steps

The guided review should be short and prefilled.

### Step 1. Review active assignments

Questions:

- keep current assignments?
- pause any assignment?
- add any temporary assignment?
- swap any assignment for this week?

### Step 2. Review weekly targets

Questions:

- keep the same weekly effort or block count?
- change pacing for any assignment?
- mark anything lighter or heavier this week?

### Step 3. Add weekly exceptions

Examples:

- project work
- quizzes or assessments
- catch-up blocks
- field trips
- break days
- one-off resources

### Step 4. Review generated weekly blocks

Purpose:

- verify instructions, source references, block categories, and completion modes
- adjust only the blocks that actually changed

### Step 5. Publish the week

Result:

- the student portal now reflects the approved weekly plan
- Lockdown and reporting layers can derive from the same published state later

## Weekly Plan Contract

`WeeklyPlan` should be the live operational object for one student in one week.

Responsibilities:

- reference the student
- reference the relevant assignments
- store weekly exceptions
- hold the final `WeeklyBlock` list
- store publication state

Recommended states:

- `draft`
- `published`
- `archived`

## Weekly Blocks

Each `WeeklyPlan` is made of `WeeklyBlock` entries.

Required vocabulary:

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

The weekly plan is where temporary changes belong. It should not require rewriting the underlying `CurriculumTemplate` just to account for one unusual week.

## Examples

### Stable household

Typical behavior:

- keep the same assignments
- auto-generate the next weekly chunks
- publish in one or two clicks

### Flexible household

Typical behavior:

- review assignments weekly
- change pacing or block targets often
- add projects, quizzes, or special tasks regularly

### Mixed household

Typical behavior:

- some assignments advance automatically
- some are manually reshaped each week
- the parent uses guided review only for students who need it

## Weekly Add-Ons And Exceptions

The weekly layer should support exceptions without forcing those exceptions to become permanent curriculum structure.

Examples:

- one-time quiz
- project allocation this week only
- catch-up week
- reduced workload
- special event or field trip
- parent override of standard pacing

These belong on `WeeklyPlan`, not on the shared template by default.

## Relationship To Projects And Assessments

- `Project` is a separate tracked object.
- weekly plans allocate `project_work` blocks against that project.
- quizzes and assessments remain `assessment` category blocks inside the weekly plan.

This split keeps weekly work flexible without pretending every temporary item is a curriculum template or that every assessment needs its own top-level object.

## Relationship To Lockdown

Lockdown should eventually derive from the published weekly plan, not from ad hoc subject records.

That means a published week can tell Lockdown:

- which resources are active
- which domains are approved
- whether a block is currently in `project_work`
- whether the student is inside or outside active school time

## Relationship To Reporting

Reporting should archive what the week actually contained and what happened during it.

That implies:

- `WeeklyPlan` is the live operational layer
- `WeeklyReport` is the archived record and compliance-facing summary

## Open Decisions

- Whether weekly planning should default to per-student review or provide a whole-family weekly review surface first.
- Whether unpublished draft weeks should exist more than one week ahead in the first implementation pass.
- Whether weekly exceptions should support reusable presets or start as one-off edits only.

## Related Docs

- [../upgrades/baseline-product-foundation.md](../upgrades/baseline-product-foundation.md)
- [curriculum-template-and-assignment-model.md](curriculum-template-and-assignment-model.md)
- [projects-and-assessment-model.md](projects-and-assessment-model.md)
- [reporting-and-compliance-contract.md](reporting-and-compliance-contract.md)
- [lockdown-browser-extension-plan.md](lockdown-browser-extension-plan.md)
