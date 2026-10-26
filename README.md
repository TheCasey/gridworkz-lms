# GridWorkz LMS

A React and Firebase application for homeschool planning, student work, timers, and weekly reports. The repository also contains routines, rewards, and a browser extension for managed study sessions.

**Status:** active development. The routine-first release is deployed for a selected internal-testing household; broader adoption and paid launch remain gated. See the [current roadmap](docs/roadmap.md) and [release record](docs/upgrades/product-direction-execution/internal-testing-release-2026-10-16.md). A local build is not evidence that every production flow has been verified.

## Start here

- [Architecture and data model](docs/architecture.md)
- [Testing and support evidence](docs/portfolio-guide.md)
- [Runtime test strategy](docs/upgrades/product-direction-execution/testing.md)
- [GitHub Actions checks](.github/workflows/ci.yml)

## Application workflows

- Parents manage students, curriculum, weekly plans, and reports through authenticated dashboard routes.
- Students access assigned work through a generated portal link, with optional PIN protection.
- Trusted Firebase Functions govern adopted school timers, completion, corrections, and report filing.
- Reports preserve original snapshots; corrections append amendments.
- Daily Routines, points, and built-in cosmetics support the current routine-first release. Compatibility paths remain for households that have not adopted it.

## Stack

React 18, Vite, Tailwind CSS, Firebase Authentication, Firestore, and Cloud Functions. The web hosting target is Cloudflare Pages. The repository includes Node assertion scripts, Firebase emulator tests, Playwright browser tests, and synthetic print-report fixtures.

## Local development

Use **Node 20**, matching the Functions and CI runtime.

```sh
npm ci
npm ci --prefix functions
cp .env.example .env.local
npm run dev
```

Vite uses port 3000. Populate `.env.local` for a development Firebase project, or follow the isolated emulator setup in [testing.md](docs/upgrades/product-direction-execution/testing.md). The checked-in example contains placeholders, not working credentials. Keep local configuration out of version control.

```sh
npm run lint
npm run check:student-timers
npm run check:weekly-planning-helpers
npm run check:school-authority-helpers
npm run check:report-print
npm run build
```

These are selected local checks. The complete CI workflow also exercises policy, entitlement, fixture, and billing helper checks. Its separate runtime job uses isolated Firebase emulators and Playwright; consult [the workflow](.github/workflows/ci.yml) for Java and browser prerequisites.

## Current boundaries

- New-account activation and purchase/portal creation are disabled in the current internal-testing release.
- Lockdown rollout and paid-launch acceptance remain separate release decisions.
- Firebase rules retain compatibility paths; the repository does not claim a completed security audit.
- Emulator results do not verify production composite indexes or actual payment-provider lifecycle behavior.

Use the [roadmap](docs/roadmap.md) for current priorities and the [architecture](docs/architecture.md) for implementation details. Development used AI-assisted tooling; repository evidence should be reviewed alongside the code and test limits.
