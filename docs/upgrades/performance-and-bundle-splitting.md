# Performance And Bundle Splitting

Status: Complete

## Problem

The production build currently succeeds, but Vite reports a large main chunk after minification.

## Verified State

As of 2026-05-06:

- `npm run build` passes
- `dist/assets/index-W6cbzVic.js` is `889.72 kB` minified and `223.44 kB` gzip
- `dist/assets/index-CpuAJdYf.css` is `248.63 kB` minified and `29.94 kB` gzip
- Vite still emits the default chunk-size warning because the main JS bundle is over `500 kB`

## Baseline Capture

Command run on 2026-05-06:

```bash
npm run build
```

Relevant output:

```text
dist/index.html                   0.73 kB │ gzip:   0.44 kB
dist/assets/index-CpuAJdYf.css  248.63 kB │ gzip:  29.94 kB
dist/assets/index-W6cbzVic.js   889.72 kB │ gzip: 223.44 kB

(!) Some chunks are larger than 500 kB after minification.
```

## First Split Pass Results

Completed on 2026-05-06:

- lazy-loaded the top-level route boundaries in `src/App.jsx`
- split the dashboard child routes into dedicated modules under `src/pages/dashboard/`
- removed eager `Reports`, `Settings`, and students-route code from the parent shell bundle

Build output after the first split pass:

```text
dist/index.html                                   0.73 kB │ gzip:  0.45 kB
dist/assets/index-2iKXjy0k.css                  248.69 kB │ gzip: 29.97 kB
dist/assets/LoginPage-D6KubNdT.js                 4.52 kB │ gzip:  1.57 kB
dist/assets/StudentsRoute-CQw87ssf.js             5.11 kB │ gzip:  1.92 kB
dist/assets/SettingsRoute-Dz1RsMBm.js            15.38 kB │ gzip:  3.99 kB
dist/assets/Lockdown-B4aq53rZ.js                 21.70 kB │ gzip:  5.97 kB
dist/assets/ReportsRoute-CYikWT-E.js             32.44 kB │ gzip:  8.07 kB
dist/assets/Curriculum-NEva6LcZ.js               34.03 kB │ gzip:  7.92 kB
dist/assets/ParentDashboard-DU-RURtw.js          36.18 kB │ gzip:  9.61 kB
dist/assets/StudentPortal-CJrW7jMr.js            42.44 kB │ gzip: 11.44 kB
dist/assets/index.esm2017-CLfRf2Sc.js           288.01 kB │ gzip: 72.62 kB
dist/assets/index-DK9B4AF3.js                   381.57 kB │ gzip: 99.39 kB
```

Observed result:

- the previous single `889.72 kB` main JS bundle is now split across a `381.57 kB` app entry chunk, a `288.01 kB` shared vendor chunk, and route-specific async chunks
- the default Vite chunk-size warning no longer appears during `npm run build`

## Remaining Follow-Up

- Review whether the `248.69 kB` CSS bundle needs its own optimization pass.
- Only do deeper page-level extraction inside `ParentDashboard.jsx`, `Reports.jsx`, or `StudentPortal.jsx` if future features push the main entry chunk back toward the warning threshold.
- If more reduction is needed later, profile what still keeps `index-DK9B4AF3.js` and `index.esm2017-CLfRf2Sc.js` in the initial path before doing broader refactors.

## Runtime Smoke Check

Verified on 2026-05-06 against `npm run preview`:

- `/` resolves to `/login` and renders the sign-in screen correctly after the lazy route loads
- `/student/test-slug` loads the student portal chunk and resolves to the expected `Student Not Found` empty state for an invalid slug
- a disposable auth account was created through the real UI and routed into `/dashboard/students`
- one dummy student was created successfully through the dashboard modal, and the students module updated to show the new card plus `1/2` plan usage
- authenticated route checks passed for:
  - `/dashboard/students`
  - `/dashboard/curriculum`
  - `/dashboard/reports`
  - `/dashboard/settings`
  - `/dashboard/lockdown`
- no browser console errors appeared during the public-route or authenticated dashboard checks

## CSS Optimization Pass

Completed on 2026-05-06:

- removed the broad custom-color `safelist` from `tailwind.config.js`
- confirmed the repo uses concrete custom-color utility classes, so the safelist was no longer required for runtime coverage

Build output after the CSS pass:

```text
dist/index.html                                   0.73 kB │ gzip:  0.44 kB
dist/assets/index-Dz0VNvpY.css                   20.69 kB │ gzip:  4.74 kB
dist/assets/index.esm2017-BVr35Is2.js           288.01 kB │ gzip: 72.62 kB
dist/assets/index-Bncqyfj0.js                   381.57 kB │ gzip: 99.39 kB
```

Observed result:

- the CSS bundle dropped from `248.69 kB` minified (`29.97 kB` gzip) to `20.69 kB` minified (`4.74 kB` gzip)
- JS chunk sizes were effectively unchanged, which confirms the win came from CSS generation cleanup rather than route reshaping
- public-route browser smoke checks still passed after the CSS reduction

Current recommendation:

- keep the safelist removed unless a future dynamic class-generation pattern is introduced intentionally
- if CSS size grows again, inspect new Tailwind safelists or broad variant patterns before doing component-level style rewrites

## Suggested Scope

- Split large route-level code paths with lazy loading.
- Break the parent shell and student portal into smaller chunks.
- Review heavy inline view logic inside `ParentDashboard.jsx`, `Reports.jsx`, and `StudentPortal.jsx`.
- Measure bundle improvements after each split instead of doing one large refactor blindly.
