# Baseline Product Foundation

Last updated: 2026-05-10

Status: Active

## Goal

Define the production-baseline product contract for GridWorkz before more feature breadth lands, with special focus on weekly autonomy, curriculum layering, student workspace behavior, reporting and compliance expectations, projects, and narrow AI assistance.

This is the live cross-cutting planning surface for the product direction that should shape future specs and implementation work.

## Why This Exists

The current app proves the core direction:

- parent dashboard
- student portal
- timers, reflections, and weekly reporting
- premium gating
- a validated Lockdown proof of concept

What it does not yet define clearly enough is the baseline contract for:

- how reusable curriculum structure differs from student-specific assignment state
- how a week is defined and published without turning the product into an hourly scheduler
- how projects differ from recurring curriculum work
- how reporting should reflect weekly accountability rather than bell-schedule compliance
- where AI should assist and where parent review must remain authoritative

Without that contract, new features will pile onto an ambiguous model instead of strengthening it.

## Product Stance

GridWorkz is a **student-directed weekly execution system**, not an hourly homeschool scheduler.

The intended workflow is:

- parents define the week
- students run the day
- the system tracks what happened
- reports and evidence prove the work

That means GridWorkz should optimize for:

- weekly workload definition instead of time-of-day scheduling
- student choice of order and pacing inside the week
- clear block-level expectations and resources
- visibility, accountability, and proof of work
- focus and Lockdown tooling that follows the current weekly work state

GridWorkz should not try to win by matching every mature homeschool planner feature-for-feature. The stronger position is:

- student-led weekly execution instead of calendar-first micromanagement
- parent-controlled source material, approvals, and compliance evidence
- structured reporting and proof of work instead of only checkboxes
- a student portal that is a first-class product surface rather than an afterthought
- narrow AI assistance that turns parent-provided material into workable plans

## Core Contracts

### 1. Future Hierarchy

Planning docs should use this future model:

1. `CurriculumTemplate`
   - reusable instructional structure
   - no student-specific progress
2. `Unit` or `Module`
   - chunk inside a curriculum template
   - tied to source material or approved objectives
3. `Assignment`
   - student-specific pacing/configuration instance of a template
   - owns progress and student-specific overrides
4. `WeeklyPlan`
   - what is live for one student in one week
   - generated from assignments plus weekly exceptions
5. `WeeklyBlock`
   - one planned piece of work for that week
   - the main unit the student completes

Current-state docs may still refer to `subjects` where they describe the codebase as it exists today. Future planning docs should prefer the hierarchy above.

### 2. Curriculum Modes

The system should cover a small set of curriculum modes instead of trying to infer every homeschool style from one flat subject form.

Recommended modes:

1. `manual_recurring`
   - Examples: PE, journaling, reading time, chores
   - Parent defines cadence and duration
2. `sequenced_resource`
   - Examples: Khan Academy, paid websites, online courses, videos
   - Parent provides the resource path and the system sequences it into blocks
3. `uploaded_curriculum`
   - Examples: Beast Academy workbooks, PDFs, photographed tables of contents, printable programs
   - Parent uploads source material and the system drafts chunked blocks for approval
4. `standards_aligned_custom`
   - Examples: district standards, electives, parent-designed subjects
   - Parent provides goals plus preferred resources and the system proposes a plan
5. `practice_mastery_hybrid`
   - Examples: chess, piano, handwriting, drill practice, fluency work
   - Completion is driven by practice time, task completion, or both

### 3. Weekly Planning Model

Weekly planning is a first-class layer. It should not require a family to re-enter curriculum structure every week.

Default weekly-planning model:

- `one-click carry-forward`
  - keep the same assignments and pacing when nothing changed
- `optional guided weekly review`
  - a short review/setup flow for families who tweak a week often
- `direct edit`
  - inline weekly plan edits for power users

The weekly flow should be optimized for:

- very fast review when nothing changed
- clear weekly exceptions when something did change
- publishing a concrete week to the student portal

It should not be a mandatory wizard for every family every week.

### 4. Weekly Block Model

`WeeklyBlock` should have two independent dimensions.

`WeeklyBlock.category`:

- `lesson`
- `review`
- `practice`
- `assessment`
- `project_work`

`WeeklyBlock.completion_mode`:

- `time_boxed`
- `task_complete`
- `hybrid`

Color coding may be used in the UI, but color is a presentation aid. Category and completion mode are the actual model.

### 5. Projects And Assessments

Projects and quizzes should not be treated the same way.

- `Project`
  - a first-class tracked work object
  - may span multiple weeks
  - has its own progress and completion state
  - may consume weekly `project_work` blocks
- `Quiz` or `Assessment`
  - a category of weekly block
  - does not become a standalone top-level object by default

Projects sit beside curriculum assignments. Assessments live inside weekly plans.

### 6. Student Portal As Core Surface

The student portal is not a secondary companion view. It is one of the clearest differentiators of the product.

The future student workspace should center on:

- what work is live this week
- what block should be tackled next
- what projects are in progress
- what resources and instructions are available
- how far through the week the student is

It should continue to support independence rather than forcing a parent-built hourly schedule.

### 7. Ownership Split

Parent-owned responsibilities:

- selecting or uploading source material
- approving curriculum chunking and worksheet drafts
- setting cadence, duration, and standards overlays
- reviewing progress, reports, and evidence
- overriding or editing blocks when needed
- creating projects and allocating project effort

Student-owned responsibilities:

- choosing the order of work inside the week
- completing live blocks
- using timers or logging time when required
- entering reflections, summaries, or custom-field responses
- working through assigned worksheets
- using a bounded `Ask for help` flow without gaining full answers

### 8. AI Operating Rules

AI should start as a draft-and-review assistant, not as an autonomous curriculum authority.

Guardrails:

- parent-provided or parent-approved material goes in
- structured draft output comes back
- parent review happens before anything becomes live
- every generated plan element should point back to a source, objective, or approved resource
- standards act as overlays and validation aids, not as the only curriculum input
- student-facing AI remains hint-oriented and non-conversational
- no AI-generated content becomes authoritative without explicit parent approval

## Top AI Features And Order

1. `Curriculum planner from source material`
   - first AI surface
   - drafts units, assignments, and weekly-block scaffolding from uploaded or linked parent-provided material
2. `Worksheet generator`
   - second AI surface
   - drafts worksheets only from approved objectives or blocks
3. `Student Ask for help hints`
   - third AI surface
   - one-shot hinting on a specific worksheet problem and work shown so far

This ordering is intentional:

- planning first
- printable or on-screen work generation second
- student-facing hinting third

## Foundational Workstreams Before Or Beside AI

### A. Curriculum And Assignment Layer

The current subject model is too weekly and too flat for the intended ingestion and assignment flows.

Needed work:

- separate reusable template structure from student-specific assignment state
- support current-position tracking at the assignment layer
- support source-material linkage at the template and unit level
- remove ambiguity between multi-student subject assignment and student-specific progress

### B. Weekly Planning And Publishing

The product needs a real weekly layer rather than forcing weekly edits through the curriculum creation flow.

Needed work:

- define how weeks are drafted, reviewed, published, and archived
- support carry-forward, guided review, and direct edit
- support weekly add-ons such as assessments, catch-up work, and project allocations

### C. Projects

Projects need to be designed as first-class tracked work rather than disguised as fake curriculum.

Needed work:

- project creation and progress contract
- relation to an assignment or subject area
- weekly allocation through `project_work` blocks
- active vs completed project views

### D. Reporting And Compliance

The current reporting surface is useful but incomplete.

Needed work:

- define reporting primitives:
  - assigned weekly work snapshot
  - completed weekly work
  - time spent
  - student reflections
  - parent overrides
  - project progress
  - evidence attachments
- define what is required vs optional
- define how reports stay weekly-accountability-focused rather than hourly-schedule-focused

### E. Student Worksheet Runtime

Before the hint system exists, the worksheet surface must be defined.

Needed work:

- printable worksheet delivery
- on-screen worksheet completion options
- answer-entry patterns by problem type
- file or image upload for worked problems
- teacher or parent review expectations

### F. Lockdown Integration

Lockdown should eventually follow the same weekly work model instead of remaining a sidecar feature.

Needed work:

- derive allowed resources and domains from weekly blocks and project work
- decide how focus rules differ by completion mode
- integrate Lockdown with student workspace state without exposing raw internal data directly

### G. Trusted Workflows And Security

The broader product baseline should not expand on top of the current permissive student-side trust posture.

Needed work:

- safer student session model
- trusted report archival and rollover
- trusted AI job orchestration where approvals matter
- auditability for parent approvals and student help requests

## Recommended Execution Order

1. Lock the baseline terminology and model in docs.
2. Redesign the curriculum, assignment, and weekly-plan model.
3. Define the reporting and compliance contract.
4. Define projects and assessment handling.
5. Build the curriculum planner MVP with parent approval.
6. Build worksheet generation tied to approved objectives.
7. Build the student worksheet runtime and bounded hint flow.
8. Reconnect Lockdown to the richer weekly-plan model.

## Defaults Chosen In This Planning Pass

- GridWorkz is weekly-autonomy-first, not hourly-schedule-first.
- The student portal is a core product differentiator.
- Weekly planning is optional guided review plus carry-forward plus direct edit.
- Projects are separate first-class tracked work objects.
- Quizzes and assessments are weekly block categories, not standalone top-level objects.
- `WeeklyBlock.category` and `WeeklyBlock.completion_mode` are separate concepts.
- AI remains review-first and source-grounded, with curriculum chunking before worksheet generation, and worksheet generation before student help hints.

## Related Docs

- [roadmap.md](../roadmap.md)
- [architecture.md](../architecture.md)
- [specs/curriculum-template-and-assignment-model.md](../specs/curriculum-template-and-assignment-model.md)
- [specs/weekly-planning-and-review-flow.md](../specs/weekly-planning-and-review-flow.md)
- [specs/projects-and-assessment-model.md](../specs/projects-and-assessment-model.md)
- [specs/reporting-and-compliance-contract.md](../specs/reporting-and-compliance-contract.md)
- [specs/ai-assisted-planning-and-student-help.md](../specs/ai-assisted-planning-and-student-help.md)
