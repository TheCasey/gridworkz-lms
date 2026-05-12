# Reporting And Compliance Contract

Status: Draft

Last updated: 2026-05-10

## Goal

Define the future reporting and compliance contract so GridWorkz can produce trustworthy weekly records without depending on hourly schedules or loose post-hoc summaries.

## Product Stance

Reports should reflect weekly accountability, not bell-schedule compliance.

The system is trying to answer:

- what was assigned this week
- what was completed this week
- how the student spent effort
- what evidence supports that work
- what parent notes or overrides changed the interpretation

## Core Objects

This spec depends on the future planning model:

- `CurriculumTemplate`
- `Assignment`
- `WeeklyPlan`
- `WeeklyBlock`
- `Project`

Reporting should describe the outcome of a published weekly plan, not invent an unrelated parallel structure.

## Weekly Report Contract

`WeeklyReport` should become the archival and compliance-facing record for one student in one week.

It should be derived from:

- the published `WeeklyPlan`
- student completion data
- timer/logged time data
- reflections and summaries
- parent review and overrides
- optional evidence

## Required Report Primitives

The reporting contract should include these required primitives.

### Identity and time context

- student identity
- parent identity
- school year and quarter labels
- week start and end labels
- week publication/archive timestamps

### Weekly plan snapshot

- the published weekly plan identity
- assignment references used that week
- block list as assigned at publication/archive time

### Completion summary

- total planned blocks
- total completed blocks
- remaining or incomplete blocks
- total logged or timed effort where relevant

### Per-assignment summary

- assignment or subject-area label
- planned effort
- completed effort
- progress notes or status flags

### Per-block actuals

- `WeeklyBlock.category`
- `WeeklyBlock.completion_mode`
- instructions or objective snapshot
- resources/source reference snapshot
- completion state
- time spent where relevant

## Optional Report Primitives

These should be supported, but they do not all need to be mandatory in the first pass.

- student reflections or summaries
- parent notes
- parent overrides
- evidence attachments
- standards tags
- assessment outcomes
- project notes or progress notes
- custom-field responses
- one-shot help request metadata if later deemed useful

## Evidence Placement

Evidence should belong to the reporting layer, not to the planning layer by default.

That means:

- `WeeklyPlan` is for live execution
- `WeeklyReport` is for archival evidence and compliance-facing output

Examples of evidence:

- uploaded photos
- PDFs
- scans of written work
- project artifacts
- screenshots

## Relationship To Projects

Projects should appear in reports only when they consumed effort during that week.

Recommended behavior:

- report project effort through the relevant `project_work` blocks
- optionally summarize project progress in a dedicated project section
- keep the project itself as a long-lived object outside the report

This prevents reports from becoming project registries while still preserving project-related proof of work.

## Relationship To Assessments

Assessments should appear as ordinary weekly blocks with `WeeklyBlock.category = assessment`.

Optional extra reporting behavior:

- attach a score or outcome
- attach parent notes or comments
- attach supporting file evidence if needed

## Snapshot And Immutability Rules

The future model should distinguish between live planning and archived records.

Recommended rules:

- `WeeklyPlan` is mutable while it is in draft
- `WeeklyPlan` is operational once published
- `WeeklyReport` captures an archived snapshot of what was assigned and what happened

First-pass recommendation:

- assigned block structure becomes immutable once archived into the report
- evidence and parent notes may remain editable until a stricter compliance lock feature exists

## Parent Overrides

The reporting contract should explicitly allow parent interpretation and correction.

Examples:

- excusing an unfinished block
- marking an oral assessment complete even without a timer session
- clarifying why a project was partially complete this week
- noting illness, travel, or reduced workload

These should be recorded as explicit parent review data, not hidden as silent mutations.

## Export Surfaces

The reporting contract should support these eventual surfaces:

- parent dashboard weekly report view
- printer-friendly report
- archived report browser
- evidence-aware report detail view
- later PDF export if needed

## Out Of Scope For This Spec

- exact print layout design
- file storage implementation details
- legal advice about district- or state-specific compliance rules

Those should be handled in adjacent design or implementation work.

## Open Decisions

- Whether standards coverage should be reported at the weekly block level, assignment summary level, or both.
- Whether evidence should be attachable during the week or only at report review time in the first implementation pass.
- Whether archival should happen automatically on rollover or require explicit parent review before finalization.

## Related Docs

- [../upgrades/baseline-product-foundation.md](../upgrades/baseline-product-foundation.md)
- [weekly-planning-and-review-flow.md](weekly-planning-and-review-flow.md)
- [projects-and-assessment-model.md](projects-and-assessment-model.md)
- [report-evidence-drawer.md](report-evidence-drawer.md)
- [../features/reporting-and-rollover.md](../features/reporting-and-rollover.md)
