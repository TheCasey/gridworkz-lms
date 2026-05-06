# Phase 3: Students and Settings Domain Hooks

## Goal

Extract student and parent-settings orchestration out of the largest shell page without changing the established UI behavior.

## Depends On

- shell-slots-and-rail-decoupling

## Role Sequence

`master-developer -> developer -> tester`

## Scope

- Extract `useStudents`, `useStudentMutations`, and `useParentSettings`-style hooks from the current shell/page code.
- Keep Firestore listeners and mutations inside the new hooks.
- Leave the visual structure mostly intact.

## Deliverables

- Student domain hooks
- Parent settings domain hooks
- Route container usage of the new hooks

## Files Or Areas To Touch

- src/pages/ParentDashboard.jsx
- src/pages/Settings.jsx
- src/hooks/

## Exit Criteria

- Route containers assemble student and settings data from hooks instead of creating those listeners inline.
- Student create/edit behavior remains intact and still uses the trusted backend path where already live.
- The shell page gets materially smaller and less orchestration-heavy.

## Test Commands

- npm run build

## Next Phase Inputs

- Stable student and settings hook contracts
- Cleaner route containers for follow-on extraction
