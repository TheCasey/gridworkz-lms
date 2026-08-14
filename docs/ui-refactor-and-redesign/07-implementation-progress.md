# OwnPath — Implementation Progress

Last updated: 2026-07-03

This note tracks the route-by-route redesign implementation so the work order stays visible without reopening the full prototype docs.

## Started

- `/dashboard/homeschool` overview surface has been started in app code.
- `/dashboard/chores` overview surface has been started in app code.
- `/dashboard/chores/daily-routines` has started through the shared chores route; routine cards and editor shell are converted.
- `/dashboard/chores/weekly-chores` has started through the shared chores route; pool cards, shared editor shell, and review queue are converted.
- `/dashboard/chores/monthly-chores` has started through the shared chores route; it shares the converted weekly/monthly pool path.
- `/dashboard/chores/allowance` has started through the shared chores route; student allowance cards, allowance settings, quota/progress cards, and bookkeeping inputs are converted while preserving trusted allowance handlers.
- `/dashboard/chores/rewards` has started through the shared chores route; reward catalog, redemption cards, point settings, point wallet cards, reward editor, and built-in reward placeholders are converted while preserving trusted point/reward handlers.
- `/dashboard/students` has been started in app code; roster/detail shell, portal copy actions, Add Student modal, fallback `StudentCard`, and PIN visual/validation behavior use the redesign language.
- `/dashboard/curriculum` has started in app code; route shell, subject library cards, usage notice, add/edit modal frame, schedule/resources internals, and `BlockObjectivesEditor` have been moved to the redesign language. New subject creates now write per-student records through `useSubjectMutations` while legacy shared records remain readable/editable. Weekly publishing has moved out to the dedicated Weekly Blocking route.
- `/dashboard/weekly-blocking` has started in app code; navigation, route shell, subject-grouped weekly block editor, student/week selectors, reset-from-subjects, draft save, and publish now use the redesign language while preserving the existing `weeklyPlans` hook/schema behavior.
- `/dashboard/reports` has started in app code; live report shell, filters, student weekly cards, collapsible subject rows, and official records list have been moved to the redesign language while preserving save/print/delete semantics. Current behavior has been reviewed, and published weekly-plan snapshots now use an allow-with-warning readiness contract for incomplete assigned blocks and completed required-response blocks missing written detail.
- `/dashboard/settings` has started in app code; account plan/access status, usage cards, school-year controls, quarter preview, timezone, weekly reset, and save footer have been moved to the redesign language while preserving the parent settings save flow.
- Shared redesign tokens/classes for the new dashboard language have started.
- Parent dashboard shell/header/sidebar have started moving to the dark redesign language.

## Still Remaining

- Curriculum backfill/destructive split decision for existing multi-student subject records.
- Weekly Blocking deeper model work: persisted default-week templates, copy-week, quantity replacement, and reusable assignment-template persistence.
- Reports deeper evidence workflow: actual file/photo evidence drawer, parent override persistence, and official print inclusion of full assigned-block snapshots.
- Settings deeper account actions, billing management, and student access defaults after the related data-model decisions.
- Student portal redesign.
- Mobile polish pass across the student-facing surfaces.
- Final end-to-end QA of the redesign shell and route transitions.
- Remaining Chores polish only: any nested edge-case light utility panels discovered during visual QA.

## Suggested Next Order

1. Decide whether existing multi-student subject records need a backfill/split migration or should remain compatibility-only.
2. Decide whether Weekly Blocking template persistence is required before beta, or whether the current subject-derived `weeklyPlans` route is sufficient for launch.
3. Move into the student portal redesign after a student-facing prototype exists.
4. Run a mobile and regression polish pass across the completed parent surfaces.

## Current Rule

- Keep updating this note as each surface lands.
- Do not let implementation drift ahead of the documented order unless a product decision changes it first.
