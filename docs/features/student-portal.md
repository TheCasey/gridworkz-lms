# Student Portal

Status: Active

## Scope

The student portal is the public-facing flow at `/student/:slug`.

## Key Files

- `src/pages/StudentPortal.jsx`
- `src/hooks/useStudentAccessPolicy.js`
- `src/utils/timerUtils.js`
- `src/utils/weekUtils.js`

## Current Behavior

- Resolves the student from the slug.
- Requires PIN entry when `access_pin` is set.
- Loads assigned subjects and current-week submissions.
- Supports required summaries, resources used, custom field responses, and per-block instructions.
- Supports timers with Firestore persistence plus local storage fallback.
- Presents current-week school work as subject accordions with student-chosen numbered blocks and inline block details.
- Provides Daily Routine, Weekly Chores, and Monthly Chores through the existing trusted chore operations.
- Provides the real points wallet, reward catalog, and trusted redemption request/cancel flow.
- Includes a responsive Allowance Coming Soon state and a preview-only layered avatar workspace.
- Evaluates subject visibility, timer start, and block submission through one shared access-policy layer.
- The same student identity, published weekly-plan context, timer state, and `lockdown_schedule` inputs also feed the trusted Lockdown browser-extension policy for paired devices.
- Approved off-hours resources and approved YouTube creators are enforced by the paired browser extension on top of that derived policy contract, not by a separate student auth model inside the portal.

## Open Gaps

- The current access model requires permissive read/write rules for the student flow.
- The launched Lockdown browser-extension path does not remove the broader student-portal hardening work around public reads, timer sessions, and submissions.
- Student authentication/session hardening is still an upgrade path, not a solved problem.
- Deeper project progress and more explicit "what should I do next?" guidance remain future work.
- The worksheet runtime and bounded `Ask for help` hint flow are still future work.
- Avatar selection persistence is approved around stable catalog IDs, with final artwork supplied through secure storage-backed uploads. Storage rules, catalog publication, and the trusted/student-safe asset-ID update still need implementation.
- A full installable PWA is approved. Manifest/icons, standalone behavior, update strategy, offline-data boundaries, and install verification still need implementation; the current responsive route can already be saved as a normal home-screen browser link.
- Kiosk mode is still future work and should not be treated as part of the current student-portal runtime.

## Related Planning

- [../upgrades/baseline-product-foundation.md](../upgrades/baseline-product-foundation.md)
- [../specs/weekly-planning-and-review-flow.md](../specs/weekly-planning-and-review-flow.md)
- [../specs/ai-assisted-planning-and-student-help.md](../specs/ai-assisted-planning-and-student-help.md)
