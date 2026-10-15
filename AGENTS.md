# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

## First Read

For planning or documentation tasks, start here:

1. `docs/roadmap.md`
2. `docs/architecture.md`
3. A focused doc under `docs/features/`, `docs/specs/`, `docs/upgrades/`, or `docs/audits/`

`gridworkz-lms-plan.md` is now only a pointer to the docs system. Do not treat it as the active roadmap.

## Commands

```bash
npm run dev          # Start dev server (Vite, port 3000)
npm run build        # Production build
npm run lint         # ESLint, using .eslintrc.cjs
npm run lint:fix     # ESLint auto-fix
npm run check:student-timers  # Timer identity/stale-session regression checks
firebase deploy --only firestore:rules  # Deploy Firestore security rules
```

Notes:

- Node 20 is the Functions and CI runtime; use it for release validation.
- Focused Node assertion scripts live under `scripts/check-*.mjs`; these do not all exercise a live backend.
- As of 2026-10-12, lint, build, timer, and sampled entitlement/report/chores/points checks pass under Node 20.
- Auth, Firestore, and Functions emulator ports are configured in `firebase.json`.

## Architecture

GridWorkz LMS is a homeschool learning management system built as a React 18 SPA with Vite, backed by Firebase Auth, Firestore, and trusted Cloud Functions, and deployed through Cloudflare Pages.

### User flows

- Parents authenticate with Firebase email/password and use the app through `/dashboard`.
- Students use the public portal at `/student/:slug`.
- Optional `access_pin` protection exists for student access.

Important route note:

- `/dashboard` is the main authenticated route.
- Dashboard sections use nested `/dashboard/*` routes through the shared feature registry; they are not independent public routes.

### Current app shape

- `src/App.jsx`: route wiring and auth guards
- `src/pages/ParentDashboard.jsx`: parent shell, student overview, live activity, rollover orchestration
- `src/constants/dashboardFeatures.js`: registry-backed dashboard routes and shell metadata
- `src/hooks/`: extracted dashboard/weekly-plan/entitlement domain loading and actions
- `src/pages/Curriculum.jsx`: subject builder/editor
- `src/pages/Reports.jsx`: weekly reports, filters, print/export
- `src/pages/Settings.jsx`: school year and weekly reset settings
- `src/pages/StudentPortal.jsx`: student flow, timers, summaries, resources, block completion

### Data model

Core collections:

- `parents`
- `students`
- `subjects`
- `weeklyPlans`
- `accountEntitlements`
- `submissions`
- `weeklyReports`
- `dailyLogs`
- `timerSessions`

`src/constants/schema.js` is the schema source of truth.

Important data conventions:

- Subjects support multi-student assignment through `student_ids`.
- Some logic still supports legacy single-student `student_id` subject records.
- Student slugs are generated from the student name plus a `nanoid()` suffix.
- Weekly reports cache school-year and quarter metadata for filtering/reporting.

### State and data loading

- State management is React Context (`AuthContext`, `ThemeContext`) plus page-local state.
- Dashboard data loading is extracted into domain hooks, with page-local queries where still present. Preserve the existing hook/registry boundaries for new work.
- Real-time Firestore listeners are set up with `onSnapshot()` and cleaned up in `useEffect` returns.

### Week and rollover logic

- Week calculations live in `src/utils/weekUtils.js`.
- Weeks are based on configurable `week_reset_day`, `week_reset_hour`, and `week_reset_minute`.
- Default behavior is Monday at 00:00 if no custom reset is present.
- Weekly rollover currently runs from client logic in `src/pages/ParentDashboard.jsx`; it is not handled by Cloud Functions yet.

### Timer system

- Timer logic lives in `src/utils/timerUtils.js`.
- Timers are target-end-time based, not interval-drift based.
- Current school clients use trusted singleton `timerSessions/{studentId}` sessions. Server-issued identity/context and elapsed time govern completion; device target-end-time ticks are display only. Legacy per-subject/local-storage paths remain compatibility code before adoption.
- `functions/src/schoolCompletionAuthority.js` owns PIN-verified reads/submission/timers and owner correction/report filing. Parent consumers resolve canonical block state before any immutable publication bridge baseline.
- First school-authority publication preserves legacy execution or older canonical publication state through private `schoolPublicationBridges`; differing instance identities require explicit source reconciliation. Never infer links from subject/index/title.
- Official original reports are filed transactionally, never updated. Corrections append explicit report amendments; historical operations must not affect another week’s timer.

### Reporting

- Report-building helpers live in `src/utils/reportUtils.js`.
- School-year and quarter metadata logic lives in `src/utils/schoolSettingsUtils.js`.
- Reports exist, but the original “Evidence Drawer” file-attachment flow is still not implemented.

## Firestore Rules Reality

Do not assume the rules are fully hardened.

Current high-level posture:

- `parents`: owner-only access
- `students`: public read, trusted callable create, owner-controlled update/delete
- `subjects`: public read, trusted callable create, owner-controlled update/delete
- `submissions`: public read; adopted students require trusted writes and immutable evidence. Legacy creates remain constrained to assigned scope before adoption.
- `timerSessions`: trusted singleton server writes for adopted students; owner reads and PIN-safe callable projection. Legacy assignment/shape compatibility remains before adoption.
- `weeklyReports`: parent-readable, trusted create, no original updates; owner deletion only before any amendment.
- `accountEntitlements`: owner-readable, server-writable only
- School states/events/history/executions/bridges/receipts and report amendments/heads are owner-readable and server-writable only.
- Chores/routines/rewards writes use trusted callables; collection reads are parent-scoped.
- `firestore.indexes.json` preserves production inventory plus authority queries. Emulator tests cannot validate cloud composite-index readiness; build indexes before coordinated release.

If you touch the student portal or reporting architecture, check `firestore.rules` directly before making assumptions.

## UI And Design Conventions

- The active visual language is defined by the Tailwind theme tokens and the page-level palette constants already used in `ParentDashboard`, `Curriculum`, `Reports`, `Settings`, and `StudentPortal`.
- Prefer the current palette: `mysteria`, `lavender-glow`, `charcoal-ink`, `amethyst-link`, `warm-cream`, `parchment`.
- Prefer the current typography setup: `Super Sans VF` with `font-body`, `font-display`, and `font-label` weight conventions from `tailwind.config.js`.
- `src/index.css` still contains older generic `.btn-*`, `.card`, and `.input-field` styles; treat those as legacy utilities, not the source of truth for new UI.
- The parent experience is a structured editorial dashboard, not a default Tailwind admin template.
- The student experience should stay simpler, warmer, and more action-focused than the parent shell.

## Working Conventions

- Preserve extracted domain hooks, the dashboard feature registry, and remaining page-owned queries unless intentionally refactoring architecture.
- When documentation changes affect planning or implementation status, update the relevant file under `docs/` instead of only editing a legacy top-level note.
- If a task claims “lint passes,” verify whether the repo has actually gained an ESLint config first.
- Routine-first execution state lives in `docs/upgrades/product-direction-execution/`; read `decisions.md` and `workflow-state.yaml` before continuing that work. New contracts/rules remain additive until their implementation phase activates them.
