# Baseline Plan Audit

Audit date: 2026-05-04

## Verification Summary

- `npm run build`: passes
- `npm run lint`: fails because no ESLint config file exists in the repo

## What From The Original Plan Is Clearly Shipped

### Parent side

- Firebase-authenticated parent access exists.
- The parent dashboard shell exists and includes student overview, live activity, curriculum management, reports, and settings.
- Parents can add students with slug generation and optional PIN protection.
- Curriculum supports multi-student subjects, resources, custom fields, timers, and per-block objectives.
- Parents can manually complete a block from the dashboard.

### Student side

- Student access by magic-link slug exists.
- Optional PIN gating exists.
- Students can complete subject blocks, submit summaries, use resources, and run per-subject timers.
- Timer state persists across refreshes and syncs through Firestore.

### Reporting and scheduling

- Weekly reports exist.
- School year, quarter metadata, timezone, and weekly reset configuration exist.
- Weekly rollover logic exists and writes report/archive-style data from the client.

## What Is Only Partial

### Reporting/compliance

- The original “Evidence Drawer” idea is only represented in schema/planning. There is no evidence upload UI and no Firebase Storage workflow yet.
- Reports can be reviewed and printed, but there is no finished attachment/archive compliance flow.

### Backend automation

- Weekly rollover exists, but it is client-driven from the dashboard rather than handled by trusted backend automation.
- Cloud Functions are not part of the current implementation.

### Security hardening

- Parent-owned data is partially scoped.
- The student portal still depends on public reads and permissive writes for some collections.
- This matches the current product model, but it should be treated as unfinished hardening work rather than “done.”

### Tooling and maintainability

- The build is healthy enough to ship.
- The lint command is not healthy enough to gate work because the repo is missing its ESLint config.
- The production bundle is large enough to justify a performance pass.

## What Still Looks Unstarted

- Donation/support workflow
- Evidence-file attachments
- Cloud Functions-backed archival/reset automation
- Native mobile app workspace

## Recommended Next Actions

1. Fix the tooling baseline so linting is real.
2. Finish the reporting/compliance gap before adding too many new surface-area features.
3. Tighten the security/backend model before mobile or broader public rollout.
