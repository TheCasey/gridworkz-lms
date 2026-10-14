# Phase 5 Run Log

## Status Snapshot

- Phase: `phase-05-ship-correct-weekly-plan-persistence-and-conditional-timers`
- Current status: `local_verified`
- Current owner: `master-developer`
- Next downstream role: `none`
- Validation modes: `unit-regression`, `api-smoke`, `browser-smoke`
- Last updated: `2026-10-14`

## Master Developer Reviews

- Source Phase4 accepted locally. Sol high backend and frontend packets were serialized; fresh Sol medium reviewed authority, concurrency, calendar, rollover and stale completion boundaries. Root integrated rules, readers, timer checks and runtime/browser verification.
- Independent review found five concrete issues: legacy archive after adoption, live weekly reset, stale completion forms, report calendar keys and missing stored timezone. All were fixed; a follow-up closed a requirements-change race. Final bounded review found no remaining blocker. Server slot-history checks exposed a client history gap; generation now reserves published and removed slots alongside private drafts.
- Production remains pending coordinated Functions/rules/frontend deployment and external release gates. Current public submission/timer writes are the next phase’s explicit trust boundary; local revalidation is not an atomic server completion guarantee.
## Developer Results

### Backend developer — 2026-10-14

- Implemented owner-only `saveWeeklyPlanDraft`, `publishWeeklyPlan`, `saveStudentDefaultWeek`, and `archiveWeeklyPlan` in `functions/src/index.js`, backed by packaged `weeklyPlanningAuthority.js`, `weeklyPlanningContracts.js`, and browser-safe `weeklyPlanningFoundation.js`. Functions have no imports from the frontend source tree. Foundation planning semantics and public field allowlists match the source Phase 1 v1 contracts; frontend can re-export these canonical functions.
- Save/publish request: `{student_id, week_key, candidate, expected_draft_revision, expected_published_revision, idempotency_key}`. Candidate carries explicit `id`, `parent_id`, `student_id`, `week_key`, `assignment_ids`, `weekly_exceptions`, and stable `blocks`; optional `parent_notes` remains private. Server canonicalizes calendar ranges and owns status, revisions, creation/update/publication timestamps. Unknown top-level candidate/request fields and unsupported contract versions fail closed. Structured weekly exceptions remain unsupported because no implemented consumer defines a safe structured public schema.
- Defaults request: `{student_id, default_block_quantities, expected_revision, idempotency_key}`. Archive request: `{student_id, week_key, expected_published_revision, idempotency_key}`. Plan response: `{plan_id, student_id, week_key, draft_revision, published_revision, status, replayed}`; defaults response: `{defaults_id, student_id, revision, replayed}`. Save response status describes the saved draft; an existing published snapshot remains separately authoritative.
- Private storage: `weeklyPlanDrafts/{planId}`, `studentDefaultWeeks/{parentId_studentId}`, `weeklyPlanningReceipts/{sha256(parentId + NUL + idempotencyKey)}`. Published/archived authority remains `weeklyPlans/{parentId_studentId_weekKey}`. Receipts bind the action and complete canonical request fingerprint and replay the original response; reuse with a different request aborts. Both expected revisions participate in save/publish transactions; conflicts never silently overwrite newer state.
- Publish commits the exact validated candidate as both private draft and allowlisted public snapshot in one transaction, including intentional zero-block snapshots. It also sets server-owned `students.weekly_planning_version = 1` and preserves/sets `weekly_planning_adopted_at`; readers must treat missing and empty current published weeks as authoritative for that student, including after a future-week publish. Root integration owns the compatible readers and protective rules.
- Unversioned legacy persisted public plans use expected published revision `0` and become v1 revision `1` on publication. Existing v1 revision `1`/`2` fixtures retain optimistic version semantics. Legacy persisted block IDs are adopted unchanged with `legacy:{id}` instance keys. Private `block_identity_history` retains removed identities across saves/publications and rejects reuse or renumbering, including assignment, curriculum definition, legacy subject, and compatibility index changes.
- Ownership, student assignment, source activity, and curriculum-definition references are read from storage inside the transaction. Per-student default quantities never write subjects, another student's defaults, or current plans. New unknown definition IDs fail; already-saved missing definition quantities can remain unchanged for later generation to skip. Archive permits only past published weeks relative to server time and the parent's custom reset/timezone; repeated archive preserves the original archive timestamp and contents/revision.
- Calendar windows use seven local calendar days, rather than 168 hours. Missing DST reset times use the first valid local minute after the requested wall time; repeated reset times use the first occurrence without flipping the week back during the second occurrence. Cached Intl formatting measured 224 ms for ten Chicago calendar resolutions (~22 ms each).
- Scoped mutations touch only drafts/public plans, defaults, private retry receipts, and the planning marker on publish. Submissions, timer sessions, effective states, correction audits, reports, wallets, financial records, and original evidence are never written by these adapters.
- Validation (Node 20.20.2): `npx --yes --package=node@20 node scripts/check-weekly-planning-helpers.mjs` passed, covering ownership/assignment, legacy/v1 adoption, projections and malformed candidates, revisions, removed identities, empty publish, default scope, past/archive safeguards, custom reset/DST, and an in-memory atomic adapter/retry harness with read-before-write assertions. The harness has no Firebase connection.
- Node 20 full ESLint passed. Existing `check-product-direction-contracts.mjs` (106 assertions), `check-student-timer-sessions.mjs`, `check-lockdown-derived-policy.mjs`, `check-lockdown-policy-states.mjs`, and `check-lockdown-work-launcher.mjs` passed. No emulator, production, deployment, server-start, Git commit, push, or external data mutations were performed by this backend packet. Persisted emulator/PIN/rules/browser validation remains root/tester-owned and is not claimed by these pure checks.

### Frontend developer — 2026-10-14

- Replaced parent direct `weeklyPlans` writes with the trusted save/publish/default callables. The domain hook independently subscribes to owner-private drafts and student defaults plus the published/archived snapshot; save-draft never rewrites published authority. Added the archive callable wrapper for root-owned rollover/report integration.
- The persistent Weekly Plan header exposes exact accessible actions `Save Draft`, `Save as Default Week`, and `Publish This Week`, selected student/week/status, and labeled Student/Week selects. Separate indicators report local unsaved changes, saved/current differences from publication, and differences from student defaults. Success notices identify exactly which student/week or student default was saved. Publication confirms current on-screen blocks and explicitly confirms an empty week; zero subjects/blocks do not disable publication. Archived plans disable all editing/writes.
- Editor loading captures draft/published/default revisions. Real-time updates preserve a dirty candidate and its expected revisions. Aborted conflicts retain edits and offer `Reload and review`; no last-write-wins fallback. Uncertain callable failures retain the exact request payload/idempotency key for retry, including while remote snapshots arrive. A changed action/candidate receives a new key.
- Future generation applies only selected-student defaults, with legacy subject defaults as fallback. Save-default submits one full atomic student-scoped map while retaining unchanged unavailable historical subject/definition entries; existing weeks and shared curriculum records are untouched. Generation skips missing/archived definitions. Current default targets and No timer labels are reflected in the editor.
- Quantity reconciliation retains persisted IDs, instance keys, compatibility indices and saved copied block content. New copies allocate a `nanoid` instance once and use the canonical browser-safe stable-ID helper. Legacy persisted IDs adopt `legacy:{id}` without renumbering. Local/private historical identities keep removed compatibility indices from being reassigned to new copies. Parent editing only changes candidate blocks; original completion/timer/report evidence is untouched.
- Added `scripts/check-weekly-plan-view-model.mjs`, covering student defaults/legacy fallback, intentional empty generation including legacy subjects, active-definition filtering, immutable source records, retained copied content and identity, new opaque instances after removal, historical default retention, and field-order independent content comparison.
- Node 20.20.2 validation: focused view-model checks passed; full `npm run lint` and `npm run build` passed after root integration fixed its transient unused import and the archive wrapper landed. Vite emitted the pre-existing outdated Browserslist-data notice. React best-practices review checked subscription cleanup, memoized generation, captured transient revisions, action loading guards, and keyboard-accessible labels. Persisted emulator/rules/browser verification remains root/tester-owned and is not claimed by these checks.
- No server starts, resets, emulator/production writes, deployment, commits, pushes, or extra agents were performed by this packet. All code edits stayed within the assigned frontend/helper boundaries.

## Tester Results

- Independent Sol medium review completed with no remaining concrete blocker after fixes. Root runtime/browser evidence is recorded below.

## Validation Evidence

- See integrated verification below; all mutations targeted the isolated demo project.

## Automated Test Evidence

- Pure/clean suite and focused responsive follow-up commands and outcomes are recorded below.

## Manual Verification

- None yet

## Project Manager Questions And Answers

- None yet

## Human Assistance

- None yet

## Git Checkpoint

- Pending

## Next Handoff

- SourcePhase5 trusted completion/correction backend packet, followed by frontend integration and independent QA.

## Open Questions Or Blockers

- None yet

## Completion Summary

- SourcePhase4 locally verified; production activation and deployed smoke remain pending release gates.

## Integrated Verification — 2026-10-14

Story: parent selects a student/week, saves a private draft or per-student default, or publishes the current editor contents through trusted Functions; the student reads that publication and completes timed or non-timed work against its current scope.

| Boundary | Evidence |
| --- | --- |
| Parent editor → API | Browser checks inspect save/default/publish responses, concurrent-tab conflict, and identical lost-response retry payload/receipt replay. |
| API → data | Eight runtime planning cases verify persisted isolation, optimistic races, owner/assignment denial, public allowlist, default scope, empty publication, stored timezone and legacy/v1 archive. |
| Data → student/report | Adopted empty/missing weeks remain empty on new devices; calendar parity/DST and Tokyo report keys pass; private drafts stay out of reporting and Lockdown. |
| Student UI/timers | Timed pause/resume/completion, same-subject non-timed completion, timer removal after requirement change, removed-work modal closure, and custom reset listener replacement pass. |
| Small screen | Screenshot review found desktop sidebar squeezing the planner; responsive navigation drawer and full-width planner fixed it. Width/actions, keyboard entry/Escape/focus return and screenshot verified in follow-up. |

- Node20.20.2: lint/build, planning helpers/view model/authority readers,106 foundation assertions,3 fixture checks, timer, Lockdown launcher/derived policy and report payload/safety checks passed.
- Clean isolated `demo-gridworkz-direction` suite:8 rules,4 compatibility callables,13 routine callables,8 planning callables,20 Chromium browser tests passed. After responsive shell changes,9 focused planning browser tests passed; final mobile keyboard check is recorded separately.
- Evidence (ignored local files):`tmp/product-direction/phase4-release-validation.log`, `phase4-mobile-validation.log`, `phase4-mobile-keyboard-final.log`, `browser-planning-mobile.png`, `browser-planning-default-next-week.png`, `browser-planning-no-timer.png`. No production data writes, deployment, payment or migration occurred.
- All owned emulator processes closed after validation. The user’s port3000 dev process was untouched.
- Next: source Phase5 trusted parent corrections/student completions, common effective state and preserved report amendments.
