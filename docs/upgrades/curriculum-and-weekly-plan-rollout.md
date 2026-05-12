# Curriculum And Weekly Plan Rollout

Last updated: 2026-05-10

Status: Ready for execution

## Goal

Implement the first production rollout of the future planning model by introducing `CurriculumTemplate`, `Assignment`, `WeeklyPlan`, and `WeeklyBlock` in bounded slices without breaking the current parent dashboard, student portal, reporting flows, entitlement gates, or lockdown proof-of-concept behavior.

## Why This Upgrade Exists

The product baseline is now explicitly weekly-autonomy-first rather than subject-form-first.

That creates one immediate implementation gap:

- the current app still treats `subjects` as the live curriculum object, the student-assignment object, and the weekly execution object all at once
- the student portal still reads live work directly from `subjects` plus `submissions`
- reporting still snapshots weekly progress without a real published-week contract
- future projects, AI planning, and richer Lockdown behavior all depend on a stronger weekly-plan model

This upgrade is the execution bridge between the baseline product docs and the current shipping codebase.

## Current-Code Reality

Today the app is built around these live collections and behaviors:

- `subjects` remains the active curriculum and assignment object
- `submissions` remains the block-completion stream
- `weeklyReports` remains the archived weekly record
- `timerSessions` remains the timer persistence layer
- `Curriculum.jsx` creates and edits active subject records
- `StudentPortal.jsx` reads assigned subjects directly and derives the live work queue from those records
- `Reports.jsx` and `reportUtils.js` summarize weekly work from `subjects` and `submissions`
- `ParentDashboard.jsx` still owns client-side rollover behavior

Important compatibility burden:

- active subjects can already be assigned to multiple students through `student_ids`
- some current logic still supports legacy single-student `student_id` records
- timer and submission behavior is still keyed by `subject_id`

This rollout therefore cannot be a big-bang rewrite.

## Rollout Principles

### 1. Preserve the shipping app while the model changes

- keep the route-backed dashboard shell, feature registry, and extracted hook boundaries intact
- avoid broad visual redesign during this rollout
- keep entitlement and Lockdown routing behavior as-is unless this rollout directly needs a compatibility hook

### 2. Introduce the future model beside the current one

- add future planning objects beside the current `subjects` model first
- keep `subjects` as compatibility input until `WeeklyPlan` becomes the live execution surface
- do not delete the current subject-driven path until the replacement path is proven

### 3. Prefer compatibility fields over forced rewrites

During the rollout, new planning records may carry temporary compatibility references such as:

- `legacy_subject_id`
- `legacy_subject_title`
- `legacy_block_index`

Those fields exist only to keep timers, submissions, reports, and the student portal stable while the live execution surface moves.

### 4. Ship one student-week path first

The first end-to-end success case is not full feature parity.

The first success case is:

- one parent can publish one student's week from existing active subject data
- the student portal can read that published week
- reporting can snapshot that published week

Only after that exists should the workflow expand into projects, worksheet runtime, AI help, or Lockdown derivation from weekly blocks.

## Target Model For This Rollout

This workflow should introduce these new planning layers:

1. `CurriculumTemplate`
   - reusable instructional structure
   - no student-specific progress
2. `Assignment`
   - student-specific pacing and current-position record
   - may initially be derived from current active subject assignments
3. `WeeklyPlan`
   - one student + one week operational record
   - holds publication state and final live block list
4. `WeeklyBlock`
   - one assigned piece of work in a week
   - keeps `category` and `completion_mode` explicit

Out of scope for this workflow:

- first-class `Project` implementation
- AI generation or worksheet runtime
- Evidence Drawer and storage-backed attachments
- live-mode Stripe rollout
- hardened device trust for Lockdown
- a new student authentication/session model

## Implementation Order

### Phase 1. Schema and compatibility foundation

Add the future planning vocabulary and compatibility helpers without switching the UI yet.

Expected work:

- add collection constants and schema definitions for `curriculumTemplates`, `assignments`, and `weeklyPlans`
- add shared planning vocabulary for `WeeklyBlock.category` and `WeeklyBlock.completion_mode`
- document how one current subject maps to future template, assignment, and block concepts
- add compatibility helpers that can derive student-specific assignment inputs from current `subjects` records

This phase should stay data-contract-first and should not change the live parent or student surfaces yet.

### Phase 2. Weekly plan generation and publish foundation

Introduce the first writable `WeeklyPlan` flow for one student-week.

Expected work:

- create the draft and publish data contract for `WeeklyPlan`
- generate a weekly plan from active subject-derived assignment inputs plus current week settings
- preserve subject compatibility references needed by timers and submissions
- add parent-owned reads and writes for the new planning records without redesigning the security model beyond what this slice needs

The output of this phase is a stable published-week record, not a finished weekly-planning UI.

### Phase 3. Parent weekly planning surface

Add the narrowest useful parent surface for reviewing and publishing a week.

Expected work:

- expose the generated weekly plan in the dashboard or curriculum area
- support a minimal review and direct-edit flow before publish
- show current publication state for a student-week
- avoid turning this phase into a full curriculum-builder redesign

This phase should optimize for a real weekly publish action, not for a polished long-term planning interface.

### Phase 4. Student portal weekly workspace foundation

Move the student portal onto published weekly work while preserving current completion behavior.

Expected work:

- read published `WeeklyPlan` records before falling back to raw subject-derived work
- render weekly blocks as the primary live work queue
- preserve timer and submission behavior through compatibility references until later cleanup
- keep the shared access-policy layer in control of visibility and completion guardrails

The portal should become weekly-plan-aware in this phase, but not yet depend on projects, worksheets, or AI help.

### Phase 5. Reporting and rollover integration

Reconnect weekly reporting to the published-week model instead of the implicit subject model.

Expected work:

- snapshot the published weekly plan into `weeklyReports`
- update reporting helpers to summarize assigned vs completed work from `WeeklyPlan`
- adapt rollover behavior so weekly-plan publication and report archival stay aligned
- keep backend-owned archival and reset automation as a follow-on hardening track, not a blocker for this workflow

This phase is the bridge from live weekly execution to the future reporting/compliance contract.

## First Shippable Milestone

The first meaningful shipped milestone for this workflow is:

- a parent can publish a weekly plan for one student from current active subject data
- the student portal can render that published week as the primary work queue
- current timers and submissions still function without a regression

If the workflow reaches that point cleanly, the remaining reporting and rollover integration becomes follow-through rather than a model gamble.

## Exit Condition For This Workflow

This rollout is complete when:

- the repo contains live planning contracts for `CurriculumTemplate`, `Assignment`, and `WeeklyPlan`
- published weekly plans are the primary operational surface for at least one student-week path
- the student portal can execute that weekly plan without falling back to raw subjects in the normal case
- weekly reports archive a published-week snapshot instead of relying only on implicit subject state
- the current subject model remains only as compatibility input or legacy support, not as the primary definition of live weekly work

## Related Docs

- [baseline-product-foundation.md](baseline-product-foundation.md)
- [../specs/curriculum-template-and-assignment-model.md](../specs/curriculum-template-and-assignment-model.md)
- [../specs/weekly-planning-and-review-flow.md](../specs/weekly-planning-and-review-flow.md)
- [../specs/projects-and-assessment-model.md](../specs/projects-and-assessment-model.md)
- [../specs/reporting-and-compliance-contract.md](../specs/reporting-and-compliance-contract.md)
- [../features/student-portal.md](../features/student-portal.md)
- [../features/reporting-and-rollover.md](../features/reporting-and-rollover.md)
