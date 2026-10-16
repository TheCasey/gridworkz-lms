# Reporting And Rollover

Status: routine-first reporting locally verified; physical print and production acceptance remain pending in the execution workflow

## Scope

This area covers weekly reports, print/export behavior, school-year labels, quarter labels, and weekly rollover processing.

## Key Files

- `src/pages/Reports.jsx`
- `src/utils/reportUtils.js`
- `src/utils/schoolSettingsUtils.js`
- `src/utils/weekUtils.js`
- `src/pages/ParentDashboard.jsx`

## Current Behavior

- Original weekly reports are stored in `weeklyReports`. Trusted `fileSchoolWeeklyReport` builds immutable snapshots transactionally from effective states, assignments and original evidence. Parent corrections append `weeklyReportAmendments`; selecting a version controls both screen and print.
- New originals freeze exact recorded minutes, publication revision, household timezone, correction watermark/events, assigned block definitions and all attributed original responses/resources/custom fields. Parent corrections add no timed minutes or student evidence. Unknown legacy duration remains unknown.
- Reports show student/week assignments, completed/incomplete totals, corrections/notes and original evidence in that order. Student and subject filters select whole weekly snapshots; school-year/quarter filters select saved records.
- Live views, original saved versions, amendments and all print buttons use `src/utils/reportPresentation.js`. Every printed dynamic string is escaped. Letter/A4 PDFs use flowing content, bounded evidence keep-together behavior, repeated context and supported browser page counters.
- School year and quarter metadata are generated from parent settings.
- Weekly rollover updates report state from the client dashboard.
- Report print builders escape report strings before writing HTML into the print window.
- Weekly-plan-backed report records preserve assigned block context in `assigned_blocks_snapshot`, including incomplete assigned blocks when available.
- Manual official-record saves are allowed for a published weekly plan with assigned blocks even when no blocks have been completed yet.
- A dry-run reporting validation fixture is available at `scripts/seed-reporting-validation.mjs`.

## Validation Fixture

Run this local check from the repo root:

```bash
node scripts/seed-reporting-validation.mjs --dry-run
```

The script writes `/tmp/gridworkz-reporting-validation-fixture.json` by default and does not mutate Firebase data. The artifact documents realistic fixture records for:

- a current-week published weekly plan with zero submissions
- a current-week published weekly plan with one submission
- a previous-week published weekly plan for rollover archival

Use the generated runbook in an emulator or staging project to validate `/dashboard/reports`, `/student/:slug`, manual official-record save, print output, incomplete-week records, and previous-week rollover. Live staging verification is still pending until credentials and an intentionally seeded environment are available.

## Open Gaps

- No evidence attachment workflow yet.
- No Firebase Storage integration yet.
- No backend-owned archival/reset workflow yet.
- Broader project/compliance reporting and evidence file uploads remain future work. Auditable block corrections and immutable original/amended report versions are implemented locally.
- The compliance story is functional for summaries and print views, but incomplete for supporting documents.
- The isolated Auth/Firestore/Functions/browser harness and reproducible synthetic PDF fixtures are documented in [runtime validation](../upgrades/product-direction-execution/testing.md). Production cloud-query/index verification, physical print and release acceptance remain separate gates.

## Related Planning

- [../upgrades/baseline-product-foundation.md](../upgrades/baseline-product-foundation.md)
- [../specs/reporting-and-compliance-contract.md](../specs/reporting-and-compliance-contract.md)
- [../specs/report-evidence-drawer.md](../specs/report-evidence-drawer.md)
