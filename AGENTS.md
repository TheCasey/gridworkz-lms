# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Vite, port 3000)
npm run build        # Production build
npm run lint         # ESLint (zero warnings allowed)
npm run lint:fix     # ESLint with auto-fix
firebase deploy --only firestore:rules  # Deploy Firestore security rules
```

No test suite is configured.

## Architecture

GridWorkz LMS is a homeschool learning management system. It's a React 18 SPA backed entirely by Firebase (Firestore + Auth), deployed to Cloudflare Pages.

**Key data hierarchy:** Parents → Students → Subjects → Submissions → WeeklyReports

**Two user types, two access patterns:**
- **Parents** — authenticated via Firebase email/password, access `/dashboard`, `/curriculum`, `/reports`
- **Students** — unauthenticated, access portal via magic link slug: `/student/:slug`

`App.jsx` defines all routes with `ProtectedRoute` (requires auth) and `PublicRoute` (redirects if already authed) wrappers.

**State management:** React Context (`AuthContext`, `ThemeContext`) + local component state. No Redux or Zustand. Firestore data is fetched per-page using `onSnapshot()` real-time listeners with manual `unsubscribe()` cleanup in `useEffect` returns.

**Schema:** `src/constants/schema.js` is the single source of truth for all Firestore collection structures. It includes a `validateSchema()` helper and documents all collections: `students`, `subjects`, `submissions`, `weeklyReports`, `parents`, `dailyLogs`.

**Timer system** (`src/utils/timerUtils.js`): Background-safe — stores target end time rather than counting down with an interval. Persists to localStorage with key `timer_${studentId}_${subjectId}`, expires after 24 hours.

**Week handling** (`src/utils/weekUtils.js`): Weeks are Monday–Sunday (not ISO Sunday–Saturday). All weekly report logic uses `getCurrentWeekRange()` which returns `{ weekStart, weekEnd }`.

**Firestore security rules** (`firestore.rules`): Currently permissive for `students`, `subjects`, and `submissions` (open read/write). The `parents` collection is locked to the owner's UID.

## Key Conventions

- Pages own their own Firestore queries directly (no shared data layer)
- Student slugs are generated as `nanoid()` appended to the student name, used as the magic link URL
- Subjects support multi-student assignment via `student_ids: []` array
- Dark mode uses Tailwind's `class` strategy — toggled via `ThemeContext`, persisted to localStorage
- `src/utils/deduplicationUtils.js` handles occasional duplicate submission cleanup
- `DebugInfo.jsx` is a dev-only overlay; `src/firebase/firebaseTest.js` tests Firebase connectivity
