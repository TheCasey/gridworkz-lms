# Routine-First Product Direction Execution

Source plan: `docs/upgrades/product-direction-execution-plan-2026-09.md`

## Summary

Checkpoint 2026-10-16: the nonpayment app/backend/rules/indexes are live and the selected existing household is activated for internal family testing. All nine disposable cloud smoke stages pass. The owner deferred Stripe; full paid-launch and observation gates remain open. See the [release record](internal-testing-release-2026-10-16.md) and [testing guide](internal-family-testing.md).

Execute source phases 0–8 as operational phases 1–9. Production acceptance remains separate from local completion.

## Roles

- `master-developer`: Own workflow orchestration: validate phase scope, assign validation strategy, write downstream prompts, review results, and manage state transitions plus git checkpoints.
- `developer`: Implement only the active phase, starting from the runtime prompt read-first list, keeping the change set narrow, and adding focused automated tests for behavior changes.
- `tester`: Validate only the active phase using the phase validation modes, runtime targets, and evidence requirements. Confirm automated tests exist or the no-test rationale is sound, then record concrete failures, approvals, or manual follow-ups.
- `researcher`: Answer a bounded blocker for the active phase, starting from the runtime prompt read-first list without drifting into implementation.

## Phase Map

| Phase | Downstream Roles | Validation Modes | Depends On | Status |
| --- | --- | --- | --- | --- |
| [Phase 1: Adopt The Product Contract And Establish The Baseline (source Phase 0)](phases/phase-01-adopt-the-product-contract-and-establish-the-baseline/phase.md) | `developer -> tester` | `code-review`, `build-health`, `unit-regression` | None | `verified; production metadata recorded` |
| [Phase 2: Fix Shared Contracts And Build Persisted QA Fixtures (source Phase 1)](phases/phase-02-fix-shared-contracts-and-build-persisted-qa-fixtures/phase.md) | `developer -> tester` | `code-review`, `build-health`, `unit-regression` | Operational Phase 1 / source Phase 0 | `local_verified` |
| [Phase 3: Implement Routine Reward And Entitlement Authority (source Phase 2)](phases/phase-03-implement-routine-reward-and-entitlement-authority/phase.md) | `developer -> tester` | `unit-regression`, `api-smoke`, `browser-smoke` | Operational Phase 2 / source Phase 1 | `verified; selected household live` |
| [Phase 4: Ship Daily Routines, Avatars, And The Narrow Household Surface (source Phase 3)](phases/phase-04-ship-daily-routines-avatars-and-the-narrow-household-surface/phase.md) | `developer -> tester` | `unit-regression`, `api-smoke`, `browser-smoke` | Operational Phase 3 / source Phase 2 | `verified; selected household live` |
| [Phase 5: Ship Correct Weekly Plan Persistence And Conditional Timers (source Phase 4)](phases/phase-05-ship-correct-weekly-plan-persistence-and-conditional-timers/phase.md) | `developer -> tester` | `unit-regression`, `api-smoke`, `browser-smoke` | Operational Phase 4 / source Phase 3 | `verified; selected household live` |
| [Phase 6: Ship Trusted Parent Completion Corrections (source Phase 5)](phases/phase-06-ship-trusted-parent-completion-corrections/phase.md) | `developer -> tester` | `unit-regression`, `api-smoke`, `browser-smoke` | Operational Phase 5 / source Phase 4 | `verified; selected household live` |
| [Phase 7: Ship Simplified Reports And Verified Print Output (source Phase 6)](phases/phase-07-ship-simplified-reports-and-verified-print-output/phase.md) | `developer -> tester` | `unit-regression`, `api-smoke`, `browser-smoke` | Operational Phase 6 / source Phase 5 | `verified; selected household live` |
| [Phase 8: Ship Live Core Billing And Consistent Product Copy (source Phase 7)](phases/phase-08-ship-live-core-billing-and-consistent-product-copy/phase.md) | `developer -> tester` | `unit-regression`, `api-smoke`, `browser-smoke` | Operational Phase 7 / source Phase 6 | `implementation verified; billing launch deferred` |
| [Phase 9: Complete Production Acceptance And Operational Handoff (source Phase 8)](phases/phase-09-complete-production-acceptance-and-operational-handoff/phase.md) | `developer -> tester` | `unit-regression`, `api-smoke`, `browser-smoke` | Operational Phase 8 / source Phase 7 | `internal testing live; full observation deferred` |

## Prompt Budget

- Downstream prompts should usually seed no more than `6` read-first files or docs.
- Downstream prompts should name only the files, routes, tests, or runtime targets needed to start the active slice.
- Downstream agents may discover adjacent files using the workflow allowed-discovery rule instead of preloading large background bundles.
- `master-developer` should avoid pasting repeated workflow background once the downstream agent has the active phase packet.

## Human PM Collaboration

- Treat `user` as the project manager for product intent, acceptance criteria, manual setup, and human-only verification.
- Ask the project manager before guessing when the source plan or phase brief leaves user-facing behavior, creative direction, UX copy, data contracts, platform assumptions, or acceptance criteria underspecified.
- If a simulator, physical device, account, credential, service, fixture, or human-only check blocks validation, ask for project manager assistance instead of treating the phase as conclusively failed.
- Record project manager answers and manual-assist results in the active `run-log.md`; update the phase brief or workflow state when the answer changes durable scope.

## Subagent Dispatch

- Prefer subagents for downstream `developer`, `tester`, and bounded `researcher` work when the environment supports them.
- Spawn one downstream agent at a time for the active phase unless a bounded researcher task can run independently.
- When spawning a subagent, set its model and reasoning effort from the workflow model policy unless an escalation rule applies.
- Do not fork the full master-developer chat context by default. Send compact prompts that reference workflow files and the active read-first packet.
- If subagents are unavailable, output the exact downstream prompt so the project manager can start a manual role chat.

| Role | Default Model | Reasoning Effort |
| --- | --- | --- |
| `master-developer` | `gpt-6.1-sol` | `medium` |
| `developer` | `gpt-6.1-sol` | `high` |
| `tester` | `gpt-6.1-sol` | `medium` |
| `researcher` | `gpt-6-luna` | `medium` |

Escalation rules:

- Use gpt-6-astra high only for a bounded trust/migration/payment review or reproducible unresolved hard failure.

## Automated Test Policy

- Behavior-changing phases should include an automated test expectation, likely test files, focused test cases, and narrow test commands.
- `developer` owns implementation plus focused automated tests for the active slice.
- `tester` owns independent verification that the tests run and would catch the intended regression or behavior break.
- If automated tests are not useful for a phase, `master-developer` must record a no-test rationale and alternate validation evidence before accepting the phase.

## Validation Strategy

- `master-developer` must confirm or refine each phase `Read First`, `Automated Test Expectation`, `Test Files`, `Test Cases To Cover`, `No-Test Rationale`, `Validation Modes`, `Runtime Targets`, `Evidence Required`, and `Manual Verification Follow-Up` before dispatching work.
- `tester` should treat compile-only checks as sufficient only when the phase guidance explicitly keeps validation that narrow.
- Phase-local validation should stay attached to the implementation slice instead of drifting into a single final QA pass.
- Default allowed discovery rule: Start with the listed read-first files, then follow imports, routes, adjacent tests, and nearby implementation files only as needed. Do not preload broad workflow or product background unless the active phase exposes a concrete blocker.

| Mode | Preferred Tools | Default Evidence | Use When |
| --- | --- | --- | --- |
| `api-smoke` | `shell`, `curl` | request or response summary, command output | Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape. |
| `browser-smoke` | `playwright`, `browser-use` | test output, screenshot | Load the live UI in a runtime and verify the main happy path for the active slice. |
| `build-health` | `shell` | command output | Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds. |
| `code-review` | `shell` | code references | Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks. |
| `extension-smoke` | `playwright`, `computer-use` | test output, screenshot | Validate the browser extension in a live browser context, including load, install, and core interaction paths. |
| `interaction-smoke` | `playwright`, `computer-use` | test output, screenshot | Drive a real interaction flow end to end and note visible regressions, console issues, or broken state. |
| `ios-device-smoke` | `xcodebuild`, `connected device`, `human` | device test note, screenshot or screen recording | Validate the active slice on a connected iOS device when simulator coverage is unavailable or device-specific confidence matters. |
| `ios-simulator-smoke` | `xcodebuild`, `simctl`, `computer-use` | test output, screenshot | Validate the active slice in the iOS simulator or equivalent runtime instead of relying on static review alone. |
| `manual-qa` | `human` | manual verification note | Document the manual follow-up that a human must complete before final merge or release confidence. |
| `unit-regression` | `shell` | command output | Run the existing focused automated tests that cover the active slice before widening scope. |

## Git Workflow

- Repo root: `.`
- Base branch at scaffold time: `codex/product-direction-routine-first`
- Base commit at scaffold time: `e3120e1c16a2920b2d062ed18012345040188ac3`
- Working branch for this workflow: `codex/product-direction-routine-first`
- Branch bootstrap: `already on workflow branch`
- Initial dirty paths before scaffolding: `ocs/roadmap.md`, `docs/upgrades/README.md`, `scripts/check-entitlement-resolution.mjs`, `docs/product-direction-working-notes-2026-09.md`, `docs/upgrades/product-direction-execution-plan-2026-09.md`

- Branch template: `codex/product-direction-routine-first`
- Branch in use: `codex/product-direction-routine-first`
- Automatic branch bootstrap: `False`
- Require clean start for branch bootstrap: `False`
- Commit mode: `phase_acceptance`
- Push mode: `accepted_phase`
- PR mode: `draft_on_first_push`
- Runtime files tracked by default: `True`
- Stable workflow paths to track: `workflow-plan.md`, `start-master-developer-chat.md`, `agents/*.md`, `phases/*/phase.md`
- Volatile workflow paths to ignore or leave uncommitted: `workflow-state.yaml`, `phases/*/run-log.md`
- Commit message template: `{workflow_slug}: accept phase {phase_number} ({phase_slug})`

## Workflow Rules

- `master-developer` is the persistent orchestrator for the whole workflow.
- `workflow-state.yaml` is the source of truth for what should happen next.
- Each phase enters `verified; selected household live` before the first downstream handoff and after every downstream result.
- Each phase `role_sequence` is the expected downstream order under `master-developer` oversight.
- The scaffold does not prewrite downstream prompts. `master-developer` writes one runtime prompt at a time based on the live workflow state.
- Downstream agents should work only on the active phase and should return control to `master-developer` instead of handing off directly.
- `master-developer` owns branch, commit, push, and PR decisions for this workflow unless the workflow explicitly reassigns that responsibility.
- Agents should update the current phase `run-log.md` before moving the workflow forward.
- `researcher` may be inserted for a bounded blocker even if it was not the originally expected next role. Record the reason in `run-log.md` and `workflow-state.yaml`.
- Do not start a later phase while the current phase is `blocked` or still active.
