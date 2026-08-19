# Weekly Blocking And Assignment Templates

Last updated: 2026-06-23

Status: Active planning spec

## Goal

Define the parent-facing model for `Weekly Blocking` so it is clear:

- what curriculum defines
- what a student assignment defines
- what a default weekly block template defines
- what a one-week override or publish action defines

The page should let parents build stable default weeks without turning multi-student planning into a confusing mess.

## Core Separation

This planning direction should be treated as the working model.

### Curriculum defines what the subject is

Curriculum is the reusable academic structure.

It should define things like:

- subject or curriculum title
- projects or resources that belong to that curriculum
- reusable content library
- suggested block structure or pacing hints

Curriculum should not be the place where a parent directly publishes this specific week for this specific student.

### Weekly Blocking defines how that curriculum turns into this student’s normal week

Weekly Blocking should answer:

- how many blocks per week does this student get for this assignment?
- how long are those blocks?
- what is the default content for those blocks?
- what template should be reused unless the week is overridden?

### The published weekly plan defines this exact week

The published week is where the parent can:

- accept the default
- swap in a project for this week only
- replace specific blocks
- adjust the week without rewriting the base curriculum structure

## Recommended Object Model

The cleanest version of your examples is:

1. `Curriculum`
2. `Assignment`
3. `Weekly Blocking Template`
4. `Weekly Plan`

### 1. Curriculum

Reusable shared instructional object.

Examples:

- `Math 5`
- `Chess Foundations`
- `US History`

Responsibilities:

- define what the curriculum is
- hold reusable projects/resources/content options
- optionally hold reusable block ideas

Non-responsibilities:

- not the actual student-specific weekly schedule
- not this week’s final publication state

### 2. Assignment

Student-specific connection to a curriculum.

This is the key layer that keeps multi-student planning clean.

Responsibilities:

- student identity
- linked curriculum
- student-specific pacing
- student-specific level or variation
- current position
- student-specific notes or accommodations

This is where your shared-subject problem gets solved.

Example:

- one `Chess` curriculum can exist
- student A has a `Chess` assignment at one level
- student B has a `Chess` assignment at a different level

The two students do not need to share identical weekly block data just because they share the same curriculum family.

### 3. Weekly Blocking Template

Reusable default weekly structure for one assignment.

Responsibilities:

- number of blocks per week
- default block length
- default content pattern
- which blocks are generic recurring blocks
- whether a template is the default for that student’s assignment

This is the layer that answers:

- “Math for this student usually has 5 blocks per week”
- “each block is usually 45 minutes”
- “these 5 blocks usually point to the same resource pattern unless I override the week”

### 4. Weekly Plan

The actual week that gets published.

Responsibilities:

- take the default weekly blocking template
- allow this week’s substitutions or overrides
- replace specific blocks with projects, special assignments, or custom content
- become the student’s actual published week

This is where a parent can say:

- “for this week only, 3 of the 5 math blocks are replaced by the math project”

## Recommended Parent Mental Model

The parent should be able to think about this in four simple layers:

1. `Curriculum`: what this subject is
2. `Assignment`: how this student is taking that subject
3. `Weekly Blocking Template`: what this student’s normal week looks like for that subject
4. `Published Week`: what is actually assigned this week

That keeps the product from collapsing into one giant “subject editor” that tries to do everything.

## Your Math Example In This Model

### Setup

- Parent creates or uses a `Math` curriculum.
- Parent creates a student-specific math assignment.
- Parent creates a default weekly blocking template for that assignment:
  - 5 blocks per week
  - 45 minutes each
  - same assigned resource pattern by default

### Later weekly override

Later, the parent wants a math project to take 3 of those 5 blocks for one week.

The clean flow should be:

1. the math project already exists inside the curriculum or linked content library
2. the parent opens Weekly Blocking or weekly review for that week
3. the default 5-block week is prefilled
4. the parent replaces 3 chosen blocks with project work
5. the published week now reflects the project override for that week only

The parent should not need to rewrite the whole curriculum just to do that.

## Your Chess Example

This is the most important modeling test.

### Recommended answer

Do **not** put all 5th-grade and 7th-grade block data for chess into one mixed weekly-block definition.

The cleaner model is:

- either one shared `Chess` curriculum with separate student assignments
- or separate level-specific curriculums if the instructional material itself is truly different

### Best default rule

Use one shared curriculum only when the core content family is genuinely shared.

Then use separate assignments for each student so they can differ in:

- level
- pace
- block count
- project usage
- current position
- default weekly blocking template

### When to split into separate curriculums

Split the curriculum itself when the source material is meaningfully different, not just the pacing.

Good example:

- `Chess Foundations`
- `Intermediate Chess`

Less good example:

- one giant `Chess` curriculum with block data, resources, and sequencing for every age and level mixed together

### Recommendation

Default to:

- shared curriculum family when the material is truly shared
- separate assignments and separate weekly-blocking templates per student

If the content diverges enough to feel like a different course, create a different curriculum.

## Page Responsibilities

### Curriculum page

Should be where the parent:

- creates curriculum
- adds projects/resources/content
- organizes reusable academic material

### Weekly Blocking page

Should be where the parent:

- chooses a student
- sees that student’s assignments
- defines default weekly block templates per assignment
- picks which template is the default
- previews the effect on a normal week
- overrides a week before publish when needed

### Reports page

Should be where the parent sees what actually happened after publish and completion.

## Required Weekly Blocking Behaviors

The page should support:

- one student at a time as the primary planning mode
- assignment-by-assignment weekly block setup
- reusable templates
- one default template per assignment
- specific-week overrides before publish
- block replacement rather than only full-week replacement

## UX Direction

The Weekly Blocking page should feel like:

- assignment planning
- default-week setup
- selective override

It should not feel like:

- editing the whole curriculum again
- manually rebuilding every subject every week from scratch
- one giant spreadsheet of every student and every subject at once

## Product Recommendation

The cleanest answer to your question is:

- keep curriculum relatively reusable and clean
- keep student differences at the assignment layer
- keep normal weekly structure in assignment-level weekly blocking templates
- keep special one-week changes in the published weekly plan

That is cleaner than:

- one curriculum carrying all students’ block variants
- or one giant per-week editor with no stable default template model

## Open Decisions For The Next Review Pass

These are the main decisions still worth locking later:

1. Should `Weekly Blocking` stay the final page name, or should it become something like `Weekly Plans`?
2. Should one assignment support multiple reusable templates beyond just one default and one override?
3. How visual should block replacement be: drag-and-drop, slot replacement, or list editing?
4. Should projects live inside curriculum only, or also be creatable from Weekly Blocking as a shortcut?
5. Should the first version plan one student at a time only, or also support a faster family-wide publishing flow after defaults are set?
