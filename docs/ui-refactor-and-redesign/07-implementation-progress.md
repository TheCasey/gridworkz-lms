# OwnPath — Implementation Progress

Last updated: 2026-08-19

This note tracks the route-by-route redesign implementation so the work order stays visible without reopening the full prototype docs.

## Started

- `/dashboard/homeschool` overview surface has been started in app code and now closely follows `ownpath_homeschool_overview.html` for the visible dashboard: compact topbar, all-family/student focus tabs, week draft banner, navigation strip, active-subjects-by-student panel, quick stats, and attention items. It remains real-data driven from students/subjects/week settings; lower recent-completions feed and real all-family publish state are not wired yet.
- `/dashboard/chores` overview surface has been started in app code and now reflects `ownpath_chores_overview.html` with compact topbar/subbar, stats strip, navigation strip, student snapshot list, focused-student summary, and activity feed while preserving trusted chore/reward/allowance handlers.
- `/dashboard/chores/daily-routines` is ready for basic home testing: it has real-data student tabs, a compact current-week rail, dense routine rows, contextual create controls, and a viewport-contained editor while preserving Free access and grouped routine handlers.
- `/dashboard/chores/weekly-chores` has completed a screenshot-driven correction: the route now follows the prototype's period strip and fixed two-pane structure, with the real pool on the left and real student quota/activity/review state on the right. Existing add/edit/archive and trusted review behavior remains intact.
- `/dashboard/chores/monthly-chores` has completed the same screenshot-driven two-pane correction with monthly period, quota, cooldown, claim, and completion language.
- `/dashboard/chores/allowance` has completed a screenshot-driven correction: selectable real student summary cards now lead into one focused requirement/earnings/adjustment/payment ledger, with settings in a right-side panel. Trusted sync/bookkeeping handlers are preserved. The seeded local environment still returns the existing Firebase callable error for allowance sync; the route recovers and displays unsynced records.
- `/dashboard/chores/rewards` is ready for basic home testing: Store, Student points, and Requests are separate dense tabs; reward creation, wallet adjustments, stock controls, and redemption decisions keep their existing trusted handlers.
- `/dashboard/students` has been started in app code; the route now follows `ownpath_students.html` with compact topbar, roster/search pane, selected-student detail pane, portal copy actions, Add Student modal, fallback `StudentCard`, and PIN visual/validation behavior in the redesign language.
- `/dashboard/curriculum` has started in app code; route shell, student tabs, compact subject tile grid, subject detail/block library view, usage notice, add/edit modal frame, schedule/resources internals, and `BlockObjectivesEditor` have been moved closer to `curriculum.html`. New subject creates now write per-student records through `useSubjectMutations` while legacy shared records remain readable/editable. Weekly publishing has moved out to the dedicated Weekly Blocking route. Subject detail now supports direct reusable block add/edit/remove/pin/type/default-quantity controls without reopening the full subject wizard, while continuing to project compatible legacy `block_objectives`. Block editing now opens a focused modal with instructions/resources/timer controls and a student-response section for written response plus custom text/number/upload requirements.
- `/dashboard/weekly-blocking` has started in app code; navigation, prototype-style topbar, student tabs, week chips, subject-row weekly schedule, summary rail, reset-from-subject-defaults, draft save, and publish now use the redesign language while preserving the existing `weeklyPlans` hook/schema behavior. Each subject row exposes all reusable curriculum blocks as compact add/subtract quantity chips, with whole-subject enable/disable, repeated-block expansion into unique weekly plan blocks, and a save-as-default-week action that writes subject defaults. Weekly Blocking no longer exposes per-instance title/instruction edit rows; detailed block content editing lives in Curriculum. Published/draft weekly plan blocks now carry block-specific resources, timer requirements, written-response requirements, and custom response fields when set on the curriculum block.
- `/dashboard/reports` has started in app code; the route now follows `ownpath_reports.html` with a compact topbar, filter toolbar, summary strip, report list, compliance rail, and official records panel while preserving save/print/delete semantics. Current behavior has been reviewed, and published weekly-plan snapshots now use an allow-with-warning readiness contract for incomplete assigned blocks and completed required-response blocks missing written detail.
- `/dashboard/settings` has started in app code; account plan/access status, usage cards, school-year controls, quarter preview, timezone, weekly reset, and save footer have been moved to the redesign language while preserving the parent settings save flow.
- Shared redesign tokens/classes for the new dashboard language have started.
- Parent dashboard shell/header/sidebar have started moving to the dark redesign language and now use the compact 190px rail/topbar proportions from the HTML examples.

## Still Remaining

- Curriculum backfill/destructive split decision for existing multi-student subject records.
- Weekly Blocking deeper model work: copy-week, separate reusable assignment-template persistence, and a cleaner objective-selection/publishing workflow around saved/published week state.
- Reports deeper evidence workflow: actual file/photo evidence drawer, parent override persistence, and official print inclusion of full assigned-block snapshots.
- Settings deeper account actions, billing management, and student access defaults after the related data-model decisions.
- Student portal redesign.
- Mobile polish pass across the student-facing surfaces.
- Final end-to-end QA of the redesign shell and route transitions.
- Chores follow-on model gaps are deliberately not mocked: routine time-of-day buckets/history correction dots, weekly/monthly historical period navigation, and allowance bounty rows still need persisted contracts before those prototype interactions can be reproduced exactly.

## Suggested Next Order

1. Run the chore module against a seeded home/staging household with working trusted callables, including create/edit/archive, approval decisions, allowance bookkeeping, point adjustments, reward stock, and redemption decisions.
2. Decide whether routine time-of-day/history and chore period-navigation contracts are required before beta or remain a follow-on model change.
3. Decide whether existing multi-student subject records need a backfill/split migration or should remain compatibility-only.
4. Run a mobile and regression polish pass across the completed parent surfaces.

## Current Rule

- Keep updating this note as each surface lands.
- Do not let implementation drift ahead of the documented order unless a product decision changes it first.
