# Reporting And Rollover

Status: Partial; runtime validation fixture available

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
- The richer reporting and compliance contract around weekly plans, project work, parent overrides, and evidence is still future work.
- The compliance story is functional for summaries and print views, but incomplete for supporting documents.
- Runtime fixture seeding has a dry-run path only; emulator/staging/live document writes and browser QA remain manual.

## Related Planning

- [../upgrades/baseline-product-foundation.md](../upgrades/baseline-product-foundation.md)
- [../specs/reporting-and-compliance-contract.md](../specs/reporting-and-compliance-contract.md)
- [../specs/report-evidence-drawer.md](../specs/report-evidence-drawer.md)
