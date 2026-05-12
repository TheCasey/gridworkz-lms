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
- Evaluates subject visibility, timer start, and block submission through one shared access-policy layer.
- The same student identity, published weekly-plan context, timer state, and `lockdown_schedule` inputs also feed the trusted Lockdown browser-extension policy for paired devices.
- Approved off-hours resources and approved YouTube creators are enforced by the paired browser extension on top of that derived policy contract, not by a separate student auth model inside the portal.

## Open Gaps

- The current access model requires permissive read/write rules for the student flow.
- The launched Lockdown browser-extension path does not remove the broader student-portal hardening work around public reads, timer sessions, and submissions.
- Student authentication/session hardening is still an upgrade path, not a solved problem.
- The future student workspace for weekly plans, project progress, and more explicit "what should I do next?" guidance is not implemented yet.
- The worksheet runtime and bounded `Ask for help` hint flow are still future work.
- Future prerequisite modules such as chores are not implemented yet, but they should extend the shared access-policy contract instead of adding scattered inline checks.
- Kiosk mode is still future work and should not be treated as part of the current student-portal runtime.

## Related Planning

- [../upgrades/baseline-product-foundation.md](../upgrades/baseline-product-foundation.md)
- [../specs/weekly-planning-and-review-flow.md](../specs/weekly-planning-and-review-flow.md)
- [../specs/ai-assisted-planning-and-student-help.md](../specs/ai-assisted-planning-and-student-help.md)
