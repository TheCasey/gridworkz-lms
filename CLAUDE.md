# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

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
npm run lint         # Intended lint command, but currently unusable until ESLint config is added
npm run lint:fix     # Intended auto-fix lint command, same config caveat
firebase deploy --only firestore:rules  # Deploy Firestore security rules
```

Notes:

- No automated test suite is configured.
- As of 2026-05-04, `npm run build` passes.
- As of 2026-05-04, `npm run lint` fails because the repo has no ESLint config file yet.

## Architecture

GridWorkz LMS is a homeschool learning management system built as a React 18 SPA with Vite, backed by Firebase Auth and Firestore, and intended for deployment to Cloudflare Pages.

### User flows

- Parents authenticate with Firebase email/password and use the app through `/dashboard`.
- Students use the public portal at `/student/:slug`.
- Optional `access_pin` protection exists for student access.

Important route note:

- `/dashboard` is the main authenticated route.
- Curriculum, reports, and settings are internal dashboard sections, not separate top-level routes.

### Current app shape

- `src/App.jsx`: route wiring and auth guards
- `src/pages/ParentDashboard.jsx`: parent shell, student overview, live activity, rollover orchestration
- `src/pages/Curriculum.jsx`: subject builder/editor
- `src/pages/Reports.jsx`: weekly reports, filters, print/export
- `src/pages/Settings.jsx`: school year and weekly reset settings
- `src/pages/StudentPortal.jsx`: student flow, timers, summaries, resources, block completion

### Data model

Core collections:

- `parents`
- `students`
- `subjects`
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
- There is no shared data layer; pages own Firestore queries directly.
- Real-time Firestore listeners are set up with `onSnapshot()` and cleaned up in `useEffect` returns.

### Week and rollover logic

- Week calculations live in `src/utils/weekUtils.js`.
- Weeks are based on configurable `week_reset_day`, `week_reset_hour`, and `week_reset_minute`.
- Default behavior is Monday at 00:00 if no custom reset is present.
- Weekly rollover currently runs from client logic in `src/pages/ParentDashboard.jsx`; it is not handled by Cloud Functions yet.

### Timer system

- Timer logic lives in `src/utils/timerUtils.js`.
- Timers are target-end-time based, not interval-drift based.
- Timer state persists to local storage and is also synced through the `timerSessions` Firestore collection.

### Reporting

- Report-building helpers live in `src/utils/reportUtils.js`.
- School-year and quarter metadata logic lives in `src/utils/schoolSettingsUtils.js`.
- Reports exist, but the original “Evidence Drawer” file-attachment flow is still not implemented.

## Firestore Rules Reality

Do not assume the rules are fully hardened.

Current high-level posture:

- `parents`: owner-only access
- `students`: public read, owner-controlled create/update/delete
- `subjects`: public read, owner-controlled create/update/delete
- `submissions`: public read and create, authenticated update/delete
- `timerSessions`: unauthenticated access with assignment and shape checks
- `weeklyReports`: parent-scoped

If you touch the student portal or reporting architecture, check `firestore.rules` directly before making assumptions.

## UI And Design Conventions

- The active visual language is defined by the Tailwind theme tokens and the page-level palette constants already used in `ParentDashboard`, `Curriculum`, `Reports`, `Settings`, and `StudentPortal`.
- Prefer the current palette: `mysteria`, `lavender-glow`, `charcoal-ink`, `amethyst-link`, `warm-cream`, `parchment`.
- Prefer the current typography setup: `Super Sans VF` with `font-body`, `font-display`, and `font-label` weight conventions from `tailwind.config.js`.
- `src/index.css` still contains older generic `.btn-*`, `.card`, and `.input-field` styles; treat those as legacy utilities, not the source of truth for new UI.
- The parent experience is a structured editorial dashboard, not a default Tailwind admin template.
- The student experience should stay simpler, warmer, and more action-focused than the parent shell.

## Working Conventions

- Preserve the existing page-owned query pattern unless you are intentionally refactoring architecture.
- When documentation changes affect planning or implementation status, update the relevant file under `docs/` instead of only editing a legacy top-level note.
- If a task claims “lint passes,” verify whether the repo has actually gained an ESLint config first.
