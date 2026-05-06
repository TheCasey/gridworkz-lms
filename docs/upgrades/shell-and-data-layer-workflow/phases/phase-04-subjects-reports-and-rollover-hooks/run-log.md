# Phase 4 Run Log

## Status Snapshot

- Phase: `phase-04-subjects-reports-and-rollover-hooks`
- Current status: `complete`
- Current owner: `tester`
- Last updated: `2026-05-06`

## Master Developer Notes

- Confirmed Phase 3 delivered the intended hook boundary for students and parent settings without changing the shell contract.
- Phase 4 stays behavioral, not architectural. Do not start entitlement-shell integration, Lockdown route moves, or student access-policy work here.
- Tightened the remaining extraction targets to the heaviest parent-domain orchestration still living inline:
  - subject listeners and subject create/update/archive/delete flows in `src/pages/Curriculum.jsx`
  - weekly submissions/report listeners and report record mutations in `src/pages/Reports.jsx`
  - subject listener, weekly activity helpers, live-pulse data shaping, and weekly rollover/report archival orchestration in `src/pages/ParentDashboard.jsx`
- Preserve the page-owned query pattern at the hook boundary. Keep Firestore listeners and writes inside hooks under `src/hooks/` rather than introducing a shared store or broader data-layer abstraction.
- Reuse the existing trusted active-subject create path exactly where it is already live. Keep current reporting output, report record behavior, and client-driven rollover behavior intact in this phase.
- Keep the current route and shell contracts stable: `Curriculum`, `Reports`, and `ParentDashboard` should become cleaner containers that assemble hook outputs, but they should not change module boundaries or visual structure beyond what extraction requires.

## Developer Notes

- Added `useSubjects`, `useSubjectMutations`, `useWeeklyActivity`, `useWeeklyReportRecords`, and `useWeeklyRollover` under `src/hooks/`.
- Rewired `Curriculum` to consume subject/student hooks and moved create/update/archive/delete writes behind subject hooks while keeping the trusted active-subject create path intact.
- Rewired `Reports` to consume student/subject/activity/report hooks; weekly record save/delete writes now live in hook helpers and report output stayed unchanged.
- Rewired `ParentDashboard` to consume subject/activity/report/rollover hooks; removed the dead inline student-submission listener and moved weekly activity/report download/manual completion/reset/rollover orchestration out of the page body.
- Validated with `npm run build`.

## Tester Notes

### Validation Results - 2026-05-06

- Inspected `src/pages/Curriculum.jsx`, `src/pages/Reports.jsx`, `src/pages/ParentDashboard.jsx`, `src/hooks/useSubjects.js`, `src/hooks/useSubjectMutations.js`, `src/hooks/useWeeklyActivity.js`, `src/hooks/useWeeklyReportRecords.js`, and `src/hooks/useWeeklyRollover.js` against the Phase 4 exit criteria only.
- Confirmed `Curriculum.jsx`, `Reports.jsx`, and `ParentDashboard.jsx` now consume hook outputs for their major subject, weekly activity/report, and rollover data instead of defining the heavy Firestore listeners inline.
- Confirmed `useSubjects.js` owns the parent-scoped subject listener behavior, including the active-only option used by the reports and shell containers.
- Confirmed `useSubjectMutations.js` owns subject create, update, archive, and delete behavior, and preserves the trusted active-subject create path through `createTrustedSubject`.
- Confirmed `useWeeklyActivity.js` owns weekly submissions loading plus the weekly progress helpers, weekly report download flow, manual block-complete write, and submission reset delete flow that were previously page-owned.
- Confirmed `useWeeklyReportRecords.js` owns weekly report record listeners plus record save, delete, and rollover-range batch creation helpers while preserving the existing report record payload builders.
- Confirmed `useWeeklyRollover.js` owns the client-driven weekly rollover orchestration and still archives the previous week by calling the weekly record batch helper before updating the parent rollover markers.
- Confirmed `Curriculum`, `Reports`, and `ParentDashboard` are now cleaner route containers or UI shells that assemble hook outputs while retaining their current rendering responsibilities.
- Confirmed no Phase 5+ scope was pulled forward in this slice: no new entitlement-shell integration work, no Lockdown route move, no student access-policy layer, and no broader shell contract redesign beyond the wiring needed for the new hooks.
- Ran `npm run build` on `2026-05-06`: `PASS` with the existing non-blocking Vite chunk-size warning only.

## Open Questions Or Blockers

- None

## Completion Summary

- Phase 4 passed validation and is complete.
- The workflow can advance to `phase-05-entitlement-shell-integration-and-lockdown-route` for the next `master-developer` pass.
