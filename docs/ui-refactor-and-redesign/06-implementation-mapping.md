# OwnPath — Prototype To Implementation Mapping

Last updated: 2026-08-19

This file maps the redesign prototypes to the current React app so implementation can proceed route-by-route without guessing. App implementation began on 2026-07-03 after user approval.

## Implementation Stance

- Implement the parent portal first.
- Keep student portal redesign separate until the parent surfaces are stable.
- Replace current UI route surfaces incrementally instead of rebuilding the whole app at once.
- Preserve existing trusted callable, entitlement, report, chore, and weekly-plan data flows where possible.
- Treat prototype HTML as visual and interaction reference, not literal implementation code.
- Keep the route-backed dashboard shell and feature registry.
- Keep docs current as each app slice lands; do not let app implementation drift beyond the recorded redesign decisions.

## Prototype Surface Map

| Prototype | Current route / module | Current files to inspect first | Implementation notes |
| --- | --- | --- | --- |
| `ownpath_students.html` | `/dashboard/students` | `src/pages/dashboard/StudentsRoute.jsx`, `src/components/AddStudentModal.jsx`, `src/components/StudentCard.jsx`, `src/hooks/useStudents.js`, `src/hooks/useStudentMutations.js` | Prototype split-pane pass landed: compact topbar, roster/search pane, selected-student detail pane, portal link copy, credential status, subject assignments, dark modal, fallback `StudentCard`, and 4-6 digit PIN support use the redesign language. Password mode is visible as planned but still requires schema/rules/portal migration before persistence. |
| `ownpath_homeschool_overview.html` | `/dashboard/homeschool` | `src/pages/dashboard/HomeschoolRoute.jsx`, `src/hooks/useWeeklyActivity.js`, `src/hooks/useWeeklyPlansForWeek.js`, `src/hooks/useWeeklyReportRecords.js` | Closer prototype pass landed: compact overview topbar, all-family/student focus tabs, add/plan/reports actions, draft week status band, three-card navigation strip, active-subjects-by-student panel, right-rail quick stats, and attention items. Current implementation is real-data driven from students/subjects/week settings; it does not yet load the prototype's lower recent-completions feed or real all-family publish state from weekly plan records. |
| `curriculum.html` | `/dashboard/curriculum` | `src/pages/Curriculum.jsx`, `src/components/curriculum/BlockObjectivesEditor.jsx`, `src/hooks/useSubjects.js`, `src/hooks/useSubjectMutations.js` | UI slices landed: prototype-style topbar, student tabs, compact subject tile grid, subject detail/block list view, usage notice, modal frame, schedule/resources internals, and `BlockObjectivesEditor` now use the redesign language. New subject creates fan out into per-student subject records through `useSubjectMutations`; existing multi-student `student_ids` and legacy `student_id` records remain readable/editable as compatibility records. Backfill or destructive split behavior for existing shared records is not implemented. The embedded weekly-plan bridge has been replaced by a handoff to the dedicated Weekly Blocking route. Subject detail now manages a reusable `curriculum_blocks` library directly: parents can add, edit, remove, pin, type, describe, and set default weekly quantity for block definitions without reopening the full subject wizard. The block editor is now a focused modal with instruction/resources/timer controls and a student-response section for written response plus custom text/number/upload requirements. Legacy `block_objectives` are still generated for compatibility reads. |
| `weekly-blocking.html` | `/dashboard/weekly-blocking` | `src/pages/dashboard/WeeklyBlockingRoute.jsx`, `src/components/curriculum/WeeklyPlanReviewPanel.jsx`, `src/hooks/useWeeklyPlanRecord.js`, `src/hooks/useWeeklyPlansForWeek.js`, `src/utils/weeklyPlanUtils.js` | First real route landed. It keeps the page name `Weekly Blocking`, uses the prototype-style topbar, student tabs, week chips, subject-row schedule, and summary rail, and supports reset-from-subject-defaults, draft save, and publish through the existing `weeklyPlans` flow. Each subject row now shows all reusable curriculum block definitions as compact quantity chips, supports per-block add/subtract controls, allows whole-subject enable/disable by zeroing or restoring quantities, and expands repeated selections into unique weekly plan blocks for compatibility with existing student/report completion flows. Weekly Blocking intentionally does not expose title/instruction edit fields; detailed block content editing lives in Curriculum. Expanded weekly blocks still carry block-specific resources, timer requirements, written-response requirements, and custom response fields when defined, falling back to subject defaults otherwise. The summary rail can save the current selections back to subject defaults. Saved-plan warnings clarify when subject edits require reset/save/publish. Copy-week, separate assignment-template persistence, and day-level scheduling remain deferred until a schema/rules decision. |
| `ownpath_chores_overview.html` | `/dashboard/chores` | `src/pages/dashboard/ChoresRoute.jsx`, `src/hooks/useChoreSetup.js`, `src/utils/choreParentViewModel.js`, `src/utils/choreUtils.js`, `src/utils/rewardUtils.js` | Prototype overview pass is ready for basic home testing: compact contextual topbar/subbar, five-card stats strip, five-card navigation strip, student snapshot list, focused-student panel, and real-data activity feed. Existing route branching, entitlement state, and all trusted handlers are preserved. |
| `ownpath_daily_routines_v2.html` | `/dashboard/chores/daily-routines` | `src/pages/dashboard/ChoresRoute.jsx`, `src/hooks/useChoreSetup.js`, `src/utils/choreParentViewModel.js` | Dense prototype-style pass landed with real-data student tabs, current-week summary rail, compact routine rows, contextual Add routine action, and a viewport-contained editor overlay. Free access and existing grouped-checklist persistence remain unchanged. The prototype's morning/afternoon/evening buckets and editable historical day dots are not hardcoded because the current routine schema does not persist those concepts. |
| `ownpath_weekly_chores.html` | `/dashboard/chores/weekly-chores` | `src/pages/dashboard/ChoresRoute.jsx`, `src/utils/choreUtils.js`, `src/firebase/trustedOperations.js` | Screenshot-reconciliation pass landed: the route now uses the prototype's actual period-strip and two-pane composition, with the real shared chore pool on the left and real student tabs, quota stats, claims, approvals, and completed activity on the right. Add/edit/archive and review controls stay on existing handlers. Period arrows are intentionally disabled until historical period reads exist; no fake history is rendered. |
| `ownpath_monthly_chores.html` | `/dashboard/chores/monthly-chores` | `src/pages/dashboard/ChoresRoute.jsx`, `src/utils/choreUtils.js`, `src/utils/allowanceUtils.js` | Monthly uses the same screenshot-matched two-pane pool/activity console, with monthly period and quota language, real cooldown/claim/completion state, and the existing trusted review path. Period arrows remain visual-disabled rather than inventing historical data. |
| `ownpath_allowance_v2.html` | `/dashboard/chores/allowance` | `src/pages/dashboard/ChoresRoute.jsx`, `src/utils/allowanceUtils.js`, `src/firebase/trustedOperations.js` | Screenshot-reconciliation pass landed: the current period strip leads into selectable real student summary cards and one focused ledger with requirement percentages, base earned, adjustment input, total earned, and paid-out bookkeeping. Settings use a right-side panel and all trusted sync/bookkeeping handlers are unchanged. The prototype's mock bounty rows are not hardcoded because no bounty collection exists in the current model. |
| `ownpath_rewards_v3.html` | `/dashboard/chores/rewards` | `src/pages/dashboard/ChoresRoute.jsx`, `src/utils/rewardUtils.js`, `src/components/StudentRewardStore.jsx`, `src/firebase/trustedOperations.js` | Rewards now has prototype-style Reward store / Student points / Requests tabs, contextual topbar actions, compact stats, catalog cards, viewport-contained reward editor, wallet adjustments, and a focused redemption queue. Trusted point/reward handlers, stock behavior, request decisions, and placeholder cosmetic scope are preserved. |
| `ownpath_reports.html` | `/dashboard/reports` | `src/pages/dashboard/ReportsRoute.jsx`, `src/pages/Reports.jsx`, `src/hooks/useWeeklyReportRecords.js`, `src/utils/reportUtils.js` | Prototype console pass landed: compact topbar actions, filter toolbar, live summary strip, student/subject report list, and right compliance/official-record rail use the redesign language. Current save, print, delete, manual-save, auto-archive, and filter behavior has been reviewed and preserved. Evidence/readiness now uses an allow-with-warning contract for published weekly-plan snapshots: incomplete assigned blocks and completed required-response blocks missing written detail are surfaced before save, but official record saving is not blocked. |
| Settings / Account direct app slice | `/dashboard/settings` | `src/pages/dashboard/SettingsRoute.jsx`, `src/pages/Settings.jsx`, `src/hooks/useParentSettings.js`, `src/hooks/useEntitlements.js` | First UI slice landed directly in app code: plan/access status, usage cards, school-year fields, quarter preview, timezone, and weekly reset now use the redesign language while preserving the parent settings save flow. Student access defaults and persisted password access remain out of scope until schema/rules/callable decisions are made. |

## Recommended Implementation Phases

### Phase 0. Foundations

- Add shared design tokens/classes/components matching `01-design-system.md`. First shared `op-*` classes landed in `src/index.css`.
- Update the dashboard shell visual language to dark-first, sharp geometry, compact type, and left-edge accents. Route-level dark surfaces have begun; the global dashboard shell still needs a pass.
- Keep route contracts and existing data hooks intact.
- Do not change data writes yet.

### Phase 1. Low-risk dashboard surfaces

- Implement `HomeschoolRoute` from `ownpath_homeschool_overview.html`. First slice landed.
- Implement `ChoresRoute` overview state from `ownpath_chores_overview.html`. First slice landed.
- Implement route linking/navigation cleanup, including real Weekly Blocking navigation if approved.

Reason: these mostly consume existing summarized data and establish the new shell/UI language.

### Phase 2. Students and access management

- Redesign `/dashboard/students` from `ownpath_students.html`. First slice landed.
- Add persisted password access mode only after schema and rules are explicitly updated.
- Decide how existing `access_pin` records migrate.

Required decision before coding credential changes:
- Existing PIN-protected students stay PIN mode by default.
- Existing unprotected students remain unset until parent chooses a credential.
- Current implementation now accepts 4-6 digit PINs in the modal, trusted create callable, and student portal unlock input.

### Phase 3. Chores module visual replacement

- Rework `ChoresRoute` child surfaces in this order:
  1. Daily Routines
  2. Weekly Chores
  3. Monthly Chores
  4. Allowance
  5. Rewards
- Keep trusted callable behavior and entitlement gating.
- Refactor carefully if `ChoresRoute.jsx` remains a large single route file.

### Phase 4. Curriculum and Weekly Blocking

- Rebuild Curriculum against the approved prototype.
- Weekly Blocking has been converted from placeholder/embedded bridge into an explicit parent route while keeping the current `weeklyPlans` data flow. Subject-level reusable block definitions expand into quantity-selected weekly blocks; saved weekly plans intentionally remain stable until reset, saved, or published.
- Continue handling per-student subject direction deliberately.

Required decision before persisted curriculum changes:
- New creates now write per-student subject records.
- Existing multi-student `student_ids` subjects are not backfilled or destructively split; they remain compatibility records until a separate migration decision is made.

### Phase 5. Reports

- Implement Reports after user review of `ownpath_reports.html`.
- Preserve existing reporting safety fixes.
- Keep report filing weekly-accountability-focused, not day-schedule-focused.

Reports decision recorded:
- Save Record stays allowed with readiness warnings, not blocked.
- Readiness checks apply to published weekly-plan snapshots and flag incomplete assigned blocks plus completed required-response blocks missing written detail.
- Block-level status editing is not implemented in the live app until the evidence drawer and parent override model are explicit.

### Phase 6. Settings / Account

- First app slice landed without a separate HTML prototype because the current route already exposed the needed account and school controls.
- Keep school year, week reset, timezone, and plan/account information on this route.
- Add student access defaults only after the credential model is explicitly designed and backed by schema, rules, and trusted callable support.

## Near-term Build Order

1. Finalize prototype polish pass.
2. Continue shared add/edit flow polish.
3. Implement Phase 0 foundations.
4. Implement Homeschool Overview.
5. Implement Chores Overview.
6. Implement Students UI without credential persistence changes.
7. Add credential persistence after schema/rules decision.
8. Continue route-by-route.

## Do Not Start Yet Without A Decision

- Migrating existing subjects from `student_ids` to per-student records.
- Replacing the student access model with password support.
- Adding separate persisted Weekly Blocking templates, copy-week behavior, or day-level scheduling.
- Changing report archival/save-blocking behavior.
- Removing current entitlement locked states.
