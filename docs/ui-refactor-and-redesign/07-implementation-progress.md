# OwnPath — Implementation Progress

Last updated: 2026-08-14

This note tracks the route-by-route redesign implementation so the work order stays visible without reopening the full prototype docs.

## Started

- `/dashboard/homeschool` overview surface has been started in app code and now uses the prototype compact topbar, week/setup banner, navigation strip, stats, coverage, planning notes, and recent-subject layout.
- `/dashboard/chores` overview surface has been started in app code and now reflects `ownpath_chores_overview.html` with compact topbar/subbar, stats strip, navigation strip, student snapshot list, focused-student summary, and activity feed while preserving trusted chore/reward/allowance handlers.
- `/dashboard/chores/daily-routines` has started through the shared chores route; routine cards and editor shell are converted.
- `/dashboard/chores/weekly-chores` has started through the shared chores route; pool cards, shared editor shell, and review queue are converted.
- `/dashboard/chores/monthly-chores` has started through the shared chores route; it shares the converted weekly/monthly pool path.
- `/dashboard/chores/allowance` has started through the shared chores route; student allowance cards, allowance settings, quota/progress cards, and bookkeeping inputs are converted while preserving trusted allowance handlers.
- `/dashboard/chores/rewards` has started through the shared chores route; reward catalog, redemption cards, point settings, point wallet cards, reward editor, and built-in reward placeholders are converted while preserving trusted point/reward handlers.
- `/dashboard/students` has been started in app code; the route now follows `ownpath_students.html` with compact topbar, roster/search pane, selected-student detail pane, portal copy actions, Add Student modal, fallback `StudentCard`, and PIN visual/validation behavior in the redesign language.
- `/dashboard/curriculum` has started in app code; route shell, student tabs, compact subject tile grid, subject detail/block library view, usage notice, add/edit modal frame, schedule/resources internals, and `BlockObjectivesEditor` have been moved closer to `curriculum.html`. New subject creates now write per-student records through `useSubjectMutations` while legacy shared records remain readable/editable. Weekly publishing has moved out to the dedicated Weekly Blocking route. Subject detail now supports direct reusable block add/edit/remove/pin/type/default-quantity controls without reopening the full subject wizard, while continuing to project compatible legacy `block_objectives`.
- `/dashboard/weekly-blocking` has started in app code; navigation, prototype-style topbar, student tabs, week chips, subject-row weekly schedule, summary rail, reset-from-subject-defaults, draft save, and publish now use the redesign language while preserving the existing `weeklyPlans` hook/schema behavior. Each subject row exposes all reusable curriculum blocks with per-block quantity controls, whole-subject enable/disable, repeated-block expansion into unique weekly plan blocks, and a save-as-default-week action that writes subject defaults. Saved weekly-plan views now explicitly warn that regenerated subject objectives require reset/save/publish, and block rows surface objective/field badges.
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
- Chores child-page deep prototype polish: daily routines, weekly chores, monthly chores, allowance, and rewards still use preserved editor/detail sections inside the compact chores frame; the overview is the most closely matched child surface in this pass.

## Suggested Next Order

1. Decide whether existing multi-student subject records need a backfill/split migration or should remain compatibility-only.
2. Decide whether Weekly Blocking copy-week/template persistence and additional per-week objective overrides are required before beta, or whether the current subject-derived `weeklyPlans` route is sufficient for launch.
3. Move into the student portal redesign after a student-facing prototype exists.
4. Run a mobile and regression polish pass across the completed parent surfaces.

## Current Rule

- Keep updating this note as each surface lands.
- Do not let implementation drift ahead of the documented order unless a product decision changes it first.
