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

## Open Gaps

- The current access model requires permissive read/write rules for the student flow.
- Student authentication/session hardening is still an upgrade path, not a solved problem.
- Future prerequisite modules such as chores are not implemented yet, but they should extend the shared access-policy contract instead of adding scattered inline checks.
