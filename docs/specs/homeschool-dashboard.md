# Homeschool Dashboard

Last updated: 2026-06-23

Status: Active planning spec

## Goal

Define the top-level `Homeschool` section dashboard so it becomes the main parent launch point for school planning and review.

This page should:

- give a quick student-focused school overview
- show progress over time
- show recent school activity
- launch common school workflows through guided entry points
- make deeper pages like Curriculum, Weekly Blocking, and Reports feel like detail and fine-tuning surfaces rather than the only way to start work

This is a section-dashboard spec, not a detailed spec for curriculum editing, weekly block design, or report rendering.

## Parent Role Of The Page

The `Homeschool` dashboard should act like the parent’s school command center.

Conceptually:

- `Homeschool` dashboard = overview, progress, shortcuts, and guided starts
- `Curriculum` = library and content setup
- `Weekly Blocking` = actual assigned weekly block planning and templates
- `Reports` = review, printing, and record outputs

The dashboard should help a parent answer:

1. How is this student doing this week?
2. What has happened most recently?
3. What do I need to start or adjust next?
4. Which school workflow do I want to launch right now?

## Locked Direction From Review

These points came directly from review and should be treated as the working direction.

- The top-level `Homeschool` page should be a neat dashboard, not just a redirect to Curriculum.
- A parent should be able to select a student from this page.
- The page should show a graph of weekly progress for the selected student.
- The progress graph should be adjustable to different time views or ranges.
- The page should show the selected student's most recent activity.
- The page should surface wizard entry points for:
  - `New curriculum wizard`
  - `Weekly blocking wizard`
  - `Report wizard`
- The deeper pages should exist for fine-tuning and detailed work, but the dashboard should be where common workflows begin.
- The first graph version should emphasize planned vs completed blocks, with time spent as a secondary metric.
- Recommended graph ranges are `This week`, `Last 4 weeks`, and `School year`.
- Wizard launchers should use large actionable cards rather than subtle text links or buried controls.
- The dashboard should show student-specific school alerts such as no published week or missing blocks when relevant.

## Core Page Structure

Recommended high-level structure:

1. Student selector and period controls
2. Weekly progress graph
3. Recent school activity
4. Wizard launch area
5. Quick links into Curriculum, Weekly Blocking, and Reports

## Required Sections

### 1. Student selector

The page should support selecting a student directly from the dashboard.

Expected behavior:

- one student is active at a time
- the rest of the dashboard updates to that student
- the selector should be easy to use for multi-student households

This page is not trying to compare all students at once. The primary mode should be focused review of one student.

## 2. Weekly progress graph

The dashboard should include a visual weekly progress graph for the selected student.

Required behavior:

- graph shows school progress for the selected student
- graph should support changing the visible time range or view
- graph should help the parent understand pacing and completion, not just raw totals
- first version should prioritize planned vs completed blocks
- time spent can appear as secondary supporting data rather than the main chart story

Review direction:

- the graph should be adjustable to various times
- recommended time ranges are:
  - `This week`
  - `Last 4 weeks`
  - `School year`

Open implementation questions:

- whether the graph is day-by-day within the current week, multi-week trend, or both
- whether the time controls are tabs, pills, dropdown, or compact chart filters

## 3. Recent activity

The page should show recent school activity for the selected student.

Expected content:

- most recent completions
- recent submissions or responses
- recent timer or work activity if meaningful
- items that help the parent understand what happened most recently without opening the student portal or reports page
- student-specific alerts such as no published week, missing blocks, or similar school-state warnings when relevant

This area should feel like a concise activity stream, not a full report.

## 4. Wizard launch area

The dashboard should surface common guided workflows as prominent actions.

Required wizard entry points:

- `New curriculum wizard`
- `Weekly blocking wizard`
- `Report wizard`

Presentation direction:

- wizard launches should be large actionable cards
- they should read like the main “start something” actions on the page
- they should be visibly distinct from ordinary deep-link navigation

Purpose:

- let the parent begin common tasks from the dashboard
- reduce the feeling that every workflow starts by digging into a dense detail page

Product intent:

- the wizards can also exist from their relevant pages
- the dashboard should still be the easiest place to begin them

## 5. Quick links into deeper pages

The dashboard should also include clear entry points into:

- `Curriculum`
- `Weekly Blocking`
- `Reports`

Those pages should feel like:

- where the parent fine-tunes
- where detailed editing lives
- where advanced or full-page work happens after the dashboard entry point

## Relationship To Other School Pages

### Curriculum

`Curriculum` should be where the parent:

- adds subjects
- adds projects to subjects
- stores and organizes the broader school content library

The dashboard can launch the wizard, but Curriculum remains the home of detailed setup and editing.

### Weekly Blocking

`Weekly Blocking` should be where the parent:

- defines how many blocks from each subject are assigned to each student
- chooses block contents
- manages templates
- sets defaults and publishes the week

The dashboard can launch the wizard, but Weekly Blocking remains the home of detailed block assignment and weekly template management.

### Reports

`Reports` should be where the parent:

- views printable reports
- reviews attendance-style outputs
- sees assignment and response details

The dashboard can launch the wizard, but Reports remains the full record and output surface.

## UX Direction

The page should feel:

- organized
- visual
- actionable
- student-specific without becoming cluttered

The dashboard should not be a dumping ground for every school control.

It should prioritize:

- progress visibility
- recent activity
- next actions
- workflow launchers

## Non-Goals

- Do not define the full curriculum wizard here.
- Do not define the full weekly blocking wizard here.
- Do not define the full reports wizard here.
- Do not define the final report layouts here.
- Do not define the detailed chart implementation here.

Those should get their own specs if needed after this page role is accepted.

## Expected Follow-On Specs

After this spec, likely follow-on specs are:

- students overview and progress entry behavior
- curriculum wizard and curriculum page refinement
- weekly blocking page and weekly blocking wizard
- reports dashboard behavior and report wizard
- persistent live pulse panel behavior

Focused related spec:

- `docs/specs/weekly-blocking-and-assignment-templates.md`

## Implementation Readiness

This spec is now defined enough to guide a focused implementation planning chat for the top-level `Homeschool` dashboard.
