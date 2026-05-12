# AI-Assisted Planning And Student Help

Status: Draft

Last updated: 2026-05-10

## Goal

Define a narrow, source-grounded, review-first AI strategy that improves planning and student support without turning GridWorkz into a broad conversational tutoring product.

## Product Stance

AI should help parents structure work and help students get unstuck.

AI should not:

- act as the authoritative curriculum source
- invent structure when source material is weak
- replace parent review
- become an always-on conversational tutor in the first rollout

## Rollout Order

The first three AI features should land in this order:

1. `Curriculum planner from source material`
2. `Worksheet generator from approved objectives`
3. `Student one-shot Ask for help hints`

This ordering keeps AI closest to parent review first and student-facing behavior last.

## 1. Curriculum Planner From Source Material

### Purpose

Take parent-provided material and draft a chunked instructional sequence that can later become assignments and weekly blocks.

### Accepted first-pass inputs

- uploaded PDFs
- photographed pages or table-of-contents images
- pasted text
- approved resource URLs or lesson lists
- parent-entered pacing goals
- optional standards overlays

### Expected outputs

- draft units or modules
- draft objective summaries
- draft suggested weekly chunks
- suggested `WeeklyBlock.category`
- suggested `WeeklyBlock.completion_mode`
- source references for each generated chunk
- confidence or review flags where grounding is weak

### Required guardrails

- no generated chunk becomes live automatically
- parent review is required before publication
- every generated chunk should point back to the source material or approved objective
- if source extraction is weak, the system should ask for a better upload or manual correction instead of guessing

## 2. Worksheet Generator From Approved Objectives

### Purpose

Generate printable or on-screen worksheet drafts from already approved curriculum objectives or weekly blocks.

### Allowed inputs

- approved objective text
- approved weekly block details
- approved template/module metadata
- age/grade hints
- requested practice format

### Expected outputs

- worksheet draft
- answer key draft
- optional suggested difficulty notes
- optional suggested follow-up or review notes

### Required guardrails

- worksheet generation starts from approved planning data, not raw unreviewed AI guesses
- parent reviews the worksheet before assigning it live
- the system should keep the generated worksheet tied to the approved objective or block it came from

## 3. Student One-Shot `Ask for help`

### Purpose

Give the student a bounded way to request help on a specific problem without turning the student experience into open-ended chat.

### Expected inputs

- the specific problem
- the student’s typed work so far or selected answer
- optional image of written work
- optional context from the active worksheet block

### Expected outputs

- a hint
- a suggested next step
- a prompt to re-check one part of the work
- a small correction signal

### Non-goals

- do not provide full final answers by default
- do not allow free-form multi-turn tutoring in the first implementation
- do not preserve broad conversational memory between requests

Each help request should be treated as its own one-shot evaluation.

## Grounding And Fail-Closed Rules

The planning AI should fail closed when grounding is weak.

Examples:

- a blurry table of contents image
- a PDF parse that did not extract real chapter titles
- a resource list that is incomplete
- a student help request that lacks the actual problem context

In those cases, the system should:

- ask for a clearer upload
- ask the parent to confirm the structure
- ask the student to provide the actual problem or work shown so far

It should not silently hallucinate a confident answer.

## Standards As Overlays

District or state standards should act as overlays and validation aids.

They may help with:

- tagging objectives
- checking coverage gaps
- guiding worksheet focus
- summarizing progress

They should not be treated as the only curriculum source unless the parent explicitly wants a standards-built plan.

## Parent Review Requirements

Parent review is mandatory for:

- curriculum chunking before it becomes an assignment
- worksheet drafts before they become live work

Parent visibility should exist for:

- student help request logs
- recurring failure or confusion patterns
- weak-source confidence flags

## Relationship To Lockdown And Student Workspace

AI is not separate from the rest of the product model.

Relevant integrations:

- approved AI-generated chunks can become part of `CurriculumTemplate` or `Assignment` flows
- approved worksheet drafts can become `WeeklyBlock` resources
- one-shot student help belongs inside the future student workspace
- Lockdown can eventually respect the currently active worksheet or approved resource context

## Out Of Scope For First Pass

- fully autonomous year-long curriculum generation without parent-provided grounding
- open-ended conversational student tutoring
- auto-grading of every worksheet type
- unrestricted web research by the model during planning

## Open Decisions

- Whether the first curriculum-planner pass should support only uploaded material or also curated web resource lists.
- Whether worksheet generation should prefer downloadable files first, browser-native worksheets first, or both.
- Whether student help responses should be visible to the parent immediately or summarized later in weekly reporting.

## Related Docs

- [../upgrades/baseline-product-foundation.md](../upgrades/baseline-product-foundation.md)
- [curriculum-template-and-assignment-model.md](curriculum-template-and-assignment-model.md)
- [weekly-planning-and-review-flow.md](weekly-planning-and-review-flow.md)
- [projects-and-assessment-model.md](projects-and-assessment-model.md)
- [../features/student-portal.md](../features/student-portal.md)
