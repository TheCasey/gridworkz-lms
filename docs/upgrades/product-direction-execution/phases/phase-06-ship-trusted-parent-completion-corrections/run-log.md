# Phase 6 Run Log

## Status Snapshot

- Phase: `phase-06-ship-trusted-parent-completion-corrections`
- Current status: `locally_verified`
- Current owner: `master-developer`
- Next downstream role: `developer` for operational Phase7 / sourcePhase6
- Validation modes: `unit-regression`, `api-smoke`, `browser-smoke`
- Last updated: `2026-10-15`

## Master Developer Reviews

- SourcePhase4 locally verified at `60e9e8f`; production gates carry forward. Activate sourcePhase5 implementation, starting with a serialized Sol high backend packet. Freeze callable/state contracts before frontend integration; fresh Sol medium independent QA follows.
- Server-owned effective status must preserve original evidence. New PIN-verified completions and trusted timer context must prevent bypass by the current public submission/timer paths once authority activates. Owner corrections and archived report amendments remain private and auditable. No points, billing, production migrations or deployment in this packet.
## Developer Results

- Backend, private publication inheritance, shared parent/student consumers and transactional report filing integrated. Details below.
## Tester Results

- Independent Sol-medium review reproduced migration, report-filing, timer-scope and filing-nonce failures. Repairs and focused runtime regressions passed; no concrete local blocker remains.

## Validation Evidence

- Node20 lint/build and focused calendar/identity/authority/timer/report/Lockdown/helper suites pass. Emulator project `demo-gridworkz-direction` only; logs below.

## Automated Test Evidence

- `phase5-final-runtime.log`: 12 rules, 4 compatibility, 13 routine, 8 planning, 14 school callable and 26 browser checks pass. `phase5-mobile-final.log`: added mobile keyboard correction passes. CI now collects all 27 browser cases. `phase5-final-validation.log` and `phase5-repair-helpers.log`: focused regressions pass.

## Manual Verification

- Inspected the rendered official-report version/history dialog; mobile keyboard correction and no-overflow assertions pass. Synthetic screenshots stay ignored under tmp/product-direction/. Full report PDF/print inspection is operational Phase7.

## Project Manager Questions And Answers

- None yet

## Human Assistance

- None yet

## Git Checkpoint

- Pending

## Next Handoff

- SourcePhase6: simplify reports and verify Letter/A4 print/PDF output. Keep trusted filing, effective state, original/amendment versions and immutable evidence.

## Open Questions Or Blockers

- No local implementation blocker. Cloudflare authenticated release access, cloud index readiness, live billing authorization/verification and observation remain later production gates.

## Completion Summary

- Trusted completion/timers, parent correction provenance/history, migration continuity and atomic official report filing are locally verified. Production remains unchanged.

## Backend Implementation Packet (source Phase 5)

- Implemented `functions/src/schoolCompletionAuthority.js`, `schoolCompletionContracts.js`, `schoolCompletionFoundation.js`, and `schoolLegacyFoundation.js`; wired four callable exports in `functions/src/index.js`. The deploy package imports no frontend modules.
- Frozen callables: `getStudentSchoolState` (PIN context, optional current `week_key`), `correctSchoolBlock` (authenticated owner; student/week/stable block, expected revision, new status/reason/note/idempotency key), `submitSchoolBlock` (PIN context + current scoped block/revision/idempotency, summary/resources/custom responses/optional issued timer ID), and `commandStudentSchoolTimer` (PIN context + current scoped block/revision/idempotency, start/pause/resume/reset and issued session ID). Read supplies an allowlisted frozen `weekly_plan`, safe block statuses/revisions/provenance/evidence counts, safe timer context, and public `school_state_revision`.
- Parent corrections preserve original submission IDs, append immutable events/state history, release only a target block's timer, and use atomic revision/receipt checks. New student evidence is immutable and distinct after undo. Parent completions create no submission, response, timer duration, wallet or points entry.
- Legacy execution snapshots are separate from `weeklyPlans`, keyed by exported `schoolExecutionSnapshotId`; they never establish planning adoption. Missing/empty adopted planning weeks never regenerate. Historical corrections require unambiguous saved assignment identities and a recorded calendar window; missing historical attribution returns actionable review guidance. Legacy manual evidence keeps `legacy_parent` provenance and unknown actor remains null.
- Trusted singleton timer `timerSessions/{studentId}` has server-issued session/context/duration/start/elapsed/target fields. Context includes stable week/block/state revision and requirements; publication revision alone does not invalidate untouched work. Server elapsed validation enforces timed submission; read reconciliation releases removed/changed/expired-authority contexts, and corrections/undo never restart timers.
- Saved reports remain unchanged. Explicit chained amendment snapshots and `schoolReportAmendmentHeads/{originalReportId}` record each correction. Subjects-only original reports without block attribution keep their counts/evidence and carry an explicit correction overlay plus `completion_counts_require_review`; consumers must label this limitation. New fully attributed snapshots have corrected counts while retaining original summaries/time.
- Transaction reads precede writes; limits are student-assigned source query bounds, 500 assigned blocks, 1000 scoped states, 2000 scoped evidence records, 20 reports, and 70 queued data writes. Scope, unknown fields, revisions and private actor/time/status spoofing fail closed.
- Node 20 evidence: `node scripts/check-school-authority-helpers.mjs` passed (pure parity/provenance/state-shape/response/timer/report preservation and in-memory atomic adapter/replay/revision/undo-resubmit/owner/PIN/forged-field cases); targeted ESLint of new Functions files/index passed. These checks are not persisted emulator/browser validation; root integration/runtime QA remains separate.
- Activation/deployment contract: server-owned `school_authority_version`, `school_authority_adopted_at`, and `school_state_revision` must be protected. Reserve new authority fields and deny all direct private authority/audit/execution/report-head/amendment writes before activation; deny adopted-student direct submission/timer mutation, including cross-household changes and forged authority fields on unadopted records. Original reports with amendment heads must deny updates/deletes. Deploy compatible readers/backend and coordinated write restrictions before enabling the callable adoption path. Production remains gated; no deployment, data migration, commit, push, server reset or billing operation occurred in this packet.

## First Publication Continuity Repair (2026-10-15)

- Repaired the emulator-probed legacy execution → first publication loss with private immutable `schoolPublicationBridges/{canonicalPlanId}`. Publication atomically snapshots normalized inherited effective states, original evidence IDs, provenance/actor/time/revision, exact frozen source blocks, and one-to-one source links. Original execution/state/event/evidence records remain unchanged; no per-block migration writes or later mutable-source inheritance occur.
- `candidate.legacy_source_links` is a private draft map of target stable block ID to exact frozen source block ID, or `null` for explicit new work. Exact same stable IDs with equivalent execution content may link automatically. Differing unreconciled IDs fail with `legacy-link-review-required`. Prepublication choices can be reconciled; after publication, mappings (including retired identities) cannot remap or reuse a source. Newly added copies are unlinked.
- New published plans carry public `school_completion_version: 1`; raw legacy subject/index completion fallback is disabled for publication-era new/unlinked work. Server status indexes by full derived state ID. Precedence is canonical state, then exact normalized inherited baseline, then applicable scoped evidence; canonical undo and later new student submissions remain authoritative.
- First bridge publication advances the public school state marker/authority and releases legacy execution timers. Publication and correction transactions read the same student/public-plan/source state scope, so concurrent operations retry or fail with a revision conflict rather than losing accepted status.
- Linked legacy reports use explicit source/target lineage to amend only the original linked stable assignment. Original report and correction event scopes remain intact. Subject/index fallback is excluded from attributed reports; absent linked assignments are skipped, and ambiguous attribution returns safe review guidance.
- Removed the unrelated-curriculum quota: published/frozen/empty school operations do not read subjects. Only constructing a missing current legacy snapshot queries student-assigned multi-student and legacy single-student subjects, deduplicates them, and enforces a 500-block execution limit (plus bounded source query reads).
- Added safe `server_now_ms` to school read/command envelopes, including refreshed replay envelopes, for timer display clock offsets.
- Node 20 `scripts/check-school-authority-helpers.mjs` passes expanded continuity, parent complete/undo, student evidence/resubmit, exact scope IDs, copy/new-work/index suppression, changed-definition/remap/duplicate-source refusals, report lineage, first publish retry, and 201-unrelated-subject cases. Its optimistic in-memory transaction harness observes a shared-read retry during a concurrent publication/correction overlap and preserves final completion. Existing weekly-planning helper regression and targeted Functions ESLint also pass. Persisted emulator probes and browser integration remain root-owned and are not claimed by this packet.

## Parent Consumer Implementation Packet (2026-10-15)

- Added `useParentSchoolState` and `parentSchoolStateUtils`: owner/student/week scoped queries load private executions, projections, publication bridges, correction events, state history, saved reports and amendments. No parent path calls the PIN-protected student read or directly reads missing private documents. Effective status resolves by full plan/block state ID, canonical projection then inherited bridge baseline then applicable immutable evidence; stored execution/report calendar windows preserve historical evidence after reset changes. Current legacy preview uses the exact canonical server execution/block IDs; historical assignments with no unambiguous snapshot require review.
- Replaced Students' fake manual submissions and destructive submission deletion with shared `SchoolBlockDetails`, also available in Weekly Plan and Reports/current and official record details. The panel shows provenance/known actor/time, original evidence, correction history and state history; completion is explicitly a parent correction with required reason and optional note. Undo reopens work without modifying evidence/time or starting a timer. Live Pulse progress now uses effective state and its feed separately labels immutable evidence and parent correction events.
- A selection captures expected revision/status/intended target before the parent writes a reason. Live changes block submission and require reload/review rather than changing Complete into Undo. Uncertain commands retain the exact payload/nonce in session storage plus memory across view/reload changes; retry sends that same request. Known conflicts clear the pending command and require review. Successful responses update the selection baseline.
- Weekly Plan uses a frozen execution as its initial draft preview only when there is no saved draft/publication. Private `legacy_source_links` travel with the draft/candidate. Before a first publication with a frozen source, differing identities require explicit equivalent-content source selection or explicit new-work selection; dropdown choices prevent reusing a source. Same stable identity with equivalent content remains eligible for automatic linkage. Existing saved drafts are retained for reconciliation rather than silently replaced.
- Reports and `useWeeklyReportRecords` pass canonical plan/execution, private completion states and publication bridge into the shared report snapshot builder for live counts, saved snapshots and rollover. Existing official originals are skipped on save, and amended originals cannot be deleted from the UI. Original/amendment versions are separately selectable in the official list and detail dialog. Subjects-only ambiguous-count amendments show a review warning and do not claim a corrected total in the selected print output; original responses/times remain available. First-save errors direct the parent to reload official records before retrying because another tab may have filed the immutable original.
- Added `scripts/check-parent-school-view.mjs`: canonical legacy identity parity, undo evidence and zero-time preservation, full-plan/inherited/current state precedence, explicit source history, adopted missing-week suppression, historical assignment refusal, stored calendar behavior, archived view and exact retry persistence across module remount all pass.
- Node 20.20.2 local checks: full `npm run lint` passes (real `.eslintrc.cjs` verified), production `npm run build` passes, `npm run check:school-authority-helpers` passes, and `npm run check:weekly-planning-helpers` passes. Build only reports the existing stale Browserslist database notice. These are local static/helper/build results; persisted API/rules/browser results remain root-owned and are not claimed by this packet.
- No production mutations, emulator reseeding/reset, deployment, commits, pushes or billing operations were performed. Parent frontend is frozen for root-owned integrated browser QA after this packet.

## Root Integration and Review (2026-10-15, in progress)

- Integrated the student trusted adapter: PIN context, stable block/revision commands, exact uncertain retries, safe status projection, server-issued timer controls and authoritative server week/clock envelopes. Direct old submission/timer listeners and writes are suppressed for current clients. Non-timed completion preserves another block's timer; student/credential changes clear local authentication scope. Public publication and protected student markers invalidate reads; server-derived timeout and foreground refresh cover skewed device clocks.
- Added owner-scoped weekly plan list access (still no public/foreign listing) for common parent-state queries. Adopted submissions/timers and authority markers cannot be forged, edited or deleted by stale clients. Private school histories/executions/bridges/receipts/heads remain owner-readable/server-writable. Saved official originals cannot update, and report creation now requires the trusted adapter.
- Independent Sol-medium QA reproduced two remaining publication gaps: raw evidence before any source freeze, and old Phase4 publication republish. Backend repair constructs applicable legacy execution transactionally or snapshots the actual old canonical publication, preserving actual source IDs, canonical undo, raw evidence and explicit report lineage. The parent reconciler uses exact owner previews/old publications without silently guessing assignment correspondence.
- QA identified a first-report filing/correction race. Added owner-authenticated `fileSchoolWeeklyReport` and `schoolReportFoundation`; official snapshots derive assignment/state/evidence/time in the same trusted transaction that observes report existence. Concurrent corrections serialize against those reads and either enter the original or produce an explicit amendment. Report UI/rollover use this adapter; client-provided status/totals are not accepted.
- Added version-controlled `firestore.indexes.json`, preserving all read-only production inventory entries and adding source/authority queries. No cloud index deployment performed. Emulator success cannot validate cloud index readiness.
- Node20 full lint/build, school/parent/timer/report helper checks, planning helpers/readers/calendars, 106 direction assertions and 3 fixture checks pass. Persisted latest run has 12 rules, 4 compatibility, 13 routine, 8 planning and 13 school API checks passing; browser acceptance remains in progress. Ignored logs: `phase5-build-final.log`, `phase5-regression-helpers.log`, `phase5-release-runtime.log`.
- Browser QA confirmed Students undo retains original evidence, updates another student device, exposes unchanged original and correction amendment versions, and permits a later distinct valid submission. Exact parent retry survives reload; another live status change requires explicit review. First-publish browser fixture needed a genuine prepublication private draft baseline (0) after removing its synthetic public fixture; retaining base1 correctly produced a conflict.
- Review carry-forward repairs being verified before acceptance: historical report/correction must not release the unrelated current timer; each new report-filing intent needs a fresh nonce so prior empty/deleted results cannot suppress later filing. No production rollout, payment, real household mutation or phase acceptance has occurred.

## Local Acceptance (2026-10-15)

- Final full emulator/browser chain passes and stops only its owned services; the user's port3000 server was not stopped. Added mobile correction test passes separately, bringing the browser suite to27 cases for CI.
- Historical filing/corrections now guard singleton timer week/plan before release, including repeated block IDs across weeks; persisted current timer remains byte-identical. New filing intents use fresh nonces and preserve exact requests only on uncertain outcomes, so empty/deleted results do not suppress later valid filings.
- Unknown legacy duration remains unknown/zero in totals rather than becoming invented parent time. Report filing persists fully attributed assignment/state/evidence snapshots, server revision and original version metadata. A concurrent correction is reflected either in the atomic original or a separate explicit amendment.
- No production mutation, billing charge, deployment, rules/index promotion or live acceptance is claimed. Final checkpoint/push and CI references follow.
