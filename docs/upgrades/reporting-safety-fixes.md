# Reporting Safety Fixes

Last updated: 2026-05-22

Status: Workflow implementation and local validation complete; emulator/staging manual QA pending

## Goal

Make the current reporting surface safer and more launch-ready without trying to finish the full future compliance system or Evidence Drawer in the same pass.

This upgrade focuses on the immediate reporting issues that can affect trust, support, and early-user confidence:

- printed reports should not interpolate user-authored content as raw HTML
- parents should be able to save an official record for a planned but incomplete week
- saved reports should preserve enough weekly-plan detail to explain what was assigned, not only what was completed
- the evidence attachment field name should be settled before Storage-backed uploads are built
- reporting validation should cover the current weekly-plan bridge with realistic data

## Why This Exists

Reports are already useful: parents can view live weekly activity, save official records, filter records by student or school period, and print reports.

The current implementation is not yet strong enough to treat as a compliance-grade record system:

- `src/pages/Reports.jsx` builds print HTML strings directly from stored student and parent-entered content.
- Manual "Save official record" behavior is tied to completed activity, so a week with assigned work but no completed blocks can be hard to archive intentionally.
- `weeklyReports` now carries `snapshot_model` and `weekly_plan_id`, but the saved payload still summarizes weekly-plan work through legacy subject groups instead of storing a clear assigned block snapshot.
- The Evidence Drawer contract now uses `attachments`, matching the current schema and payload.
- Rollover/report archival is still client-driven and should not be broadened here into a full backend automation project.

## Current-Code Reality

Key files:

- `src/pages/Reports.jsx`
- `src/utils/reportUtils.js`
- `src/hooks/useWeeklyReportRecords.js`
- `src/hooks/useWeeklyPlansForWeek.js`
- `src/hooks/useWeeklyRollover.js`
- `src/constants/schema.js`
- `firestore.rules`

Current behavior:

- live report cards are computed from students, subjects, submissions, and published or archived weekly plans when present
- saved records are written to `weeklyReports/{parentId}_{studentId}_{weekKey}`
- saved records include `subjects_data`, `summaries`, `snapshot_model`, `weekly_plan_id`, school-year metadata, and `attachments: []`
- reports can be printed from live weekly data and saved official records
- weekly rollover can create report records and archive matching published weekly plans from client-side logic
- `scripts/seed-reporting-validation.mjs --dry-run` generates a repeatable reporting validation fixture summary at `/tmp/gridworkz-reporting-validation-fixture.json` by default

## MVP Scope

This workflow should fix safety and clarity problems only.

In scope:

1. Escape user-controlled text before writing report print HTML.
2. Allow official records to be saved for assigned-but-incomplete weeks.
3. Add a first-pass `assigned_blocks_snapshot` or equivalent field to saved reports so weekly-plan records can explain planned blocks, incomplete blocks, category, completion mode, instruction, and resource snapshots.
4. Choose the report evidence metadata field name for the codebase and docs.
5. Keep evidence uploads out of this workflow unless a later phase explicitly discovers that a tiny schema placeholder is needed.
6. Add focused scriptable checks or small utility-level tests where practical.
7. Preserve existing report filters, school-year and quarter metadata, saved-record browsing, and print/export behavior.

Out of scope:

- Firebase Storage upload UI
- Storage security rules
- backend-owned rollover automation
- full report locking or legal-compliance workflow
- project-specific reporting
- state-specific legal advice
- a redesign of the Reports page

## Product Decisions For This Workflow

### Evidence field name

Use `attachments` as the current code-facing field name unless the implementation phase finds a strong reason to migrate.

Rationale:

- `src/constants/schema.js` already documents `WeeklyReportSchema.attachments`
- `src/utils/reportUtils.js` already writes `attachments: []`
- renaming to `evidence_files` before Storage exists adds churn without user value

The Evidence Drawer spec is reconciled to this decision and should treat upload UI, Storage rules, and stricter metadata validation as future Evidence Drawer workflow scope.

### Incomplete official records

An official record can be valid even when no blocks were completed.

Recommended behavior:

- allow saving when a selected week has assigned blocks from a reportable weekly plan, even if `total_blocks` is `0`
- keep the current no-data disabled state only when there is neither assigned work nor completed work
- make print and saved-record copy clear enough that `0/N` blocks reads as an incomplete week, not an app error

### Snapshot detail

The first-pass saved snapshot should not require the final future reporting model.

It should preserve enough weekly-plan context to answer:

- what block was assigned
- which legacy subject or compatibility assignment it came from
- whether it was completed
- what category and completion mode applied
- what instruction and resources were visible to the student
- what completion summary or custom-field response was submitted, if any

## Implementation Phases

### Phase 1. Print and save-record safety

- add HTML escaping for report print builders
- remove the save-record dependency on completed blocks only
- keep current visual output and filters intact

### Phase 2. Saved report snapshot enrichment

- extend the report payload and schema with a planned-block snapshot
- preserve compatibility with existing `subjects_data`
- make saved records useful for incomplete weeks

### Phase 3. Evidence contract reconciliation

- settle `attachments` as the field name in code and docs
- add placeholder validation or helper contracts if needed
- explicitly leave Storage-backed upload implementation to the Evidence Drawer workflow

### Phase 4. Reporting runtime validation fixture

- added `scripts/seed-reporting-validation.mjs` as a dry-run fixture/runbook for parent, students, subjects, current published weekly plans, one current submission, and a previous-week rollover candidate
- dry-run output covers live report cards, saved official record payloads, incomplete-week records, student portal routes, and previous-week rollover expectations
- emulator/staging/live seeding, save, print, portal, and rollover validation remain manual follow-up; no live staging verification is claimed here

## Exit Criteria

- report print HTML escapes user-controlled strings
- a planned but incomplete week can be saved intentionally
- saved reports preserve assigned block context for weekly-plan-backed records
- evidence metadata naming is consistent between schema, payload, and docs
- current report browsing, filtering, and print behavior still passes lint/build and focused runtime smoke

## Runtime Validation Fixture

Run the deterministic local check from the repo root:

```bash
node scripts/seed-reporting-validation.mjs --dry-run
```

The script writes `/tmp/gridworkz-reporting-validation-fixture.json` unless `--output` is provided. It does not perform Firebase writes. The generated artifact is the runbook for emulator, staging, or live QA and includes:

- current-week published weekly plan with zero submissions
- current-week published weekly plan with one submission
- previous-week published weekly plan expected to archive during rollover
- expected `/dashboard/reports` and `/student/:slug` routes
- expected `weeklyReports` payload summaries, including `assigned_blocks_snapshot` and `attachments: []`

Manual follow-up is required before treating reporting as beta-ready: seed the fixture into an emulator or staging project, sign in as the fixture parent, save current-week official records, print one live and one saved report, open the student portal routes, and verify previous-week rollover writes a report and archives the published weekly plan.

## Related Docs

- [../features/reporting-and-rollover.md](../features/reporting-and-rollover.md)
- [../specs/reporting-and-compliance-contract.md](../specs/reporting-and-compliance-contract.md)
- [../specs/report-evidence-drawer.md](../specs/report-evidence-drawer.md)
- [curriculum-and-weekly-plan-rollout.md](curriculum-and-weekly-plan-rollout.md)
- [security-hardening.md](security-hardening.md)
