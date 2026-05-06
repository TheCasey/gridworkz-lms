# Reporting And Rollover

Status: Partial

## Scope

This area covers weekly reports, print/export behavior, school-year labels, quarter labels, and weekly rollover processing.

## Key Files

- `src/pages/Reports.jsx`
- `src/utils/reportUtils.js`
- `src/utils/schoolSettingsUtils.js`
- `src/utils/weekUtils.js`
- `src/pages/ParentDashboard.jsx`

## Current Behavior

- Weekly reports are stored in `weeklyReports`.
- Reports can be filtered and printed.
- School year and quarter metadata are generated from parent settings.
- Weekly rollover updates report state from the client dashboard.

## Open Gaps

- No evidence attachment workflow yet.
- No Firebase Storage integration yet.
- No backend-owned archival/reset workflow yet.
- The compliance story is functional for summaries and print views, but incomplete for supporting documents.
