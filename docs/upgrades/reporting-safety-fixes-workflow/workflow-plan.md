# Reporting Safety Fixes Workflow

Source plan: `docs/upgrades/reporting-safety-fixes.md`

## Summary

Harden the current reporting surface in bounded phases: print escaping, incomplete-week records, richer saved snapshots, evidence field reconciliation, and runtime validation fixtures.

## Roles

- `master-developer`: Own workflow orchestration and protect this workflow from becoming the full Evidence Drawer or backend rollover project.
- `developer`: Implement only the active reporting safety slice, preserve existing report filters and print surfaces, and add focused helper checks when reporting logic is extracted.
- `tester`: Validate only the active phase, verify lint/build and helper checks, and return concrete report output or browser evidence.
- `researcher`: Resolve bounded reporting, Firestore, browser print, or homeschool-compliance questions without giving legal advice or drifting into implementation.

## Phase Map

| Phase | Downstream Roles | Validation Modes | Depends On | Status |
| --- | --- | --- | --- | --- |
| [Phase 1: Print And Save-Record Safety](phases/phase-01-print-and-save-record-safety/phase.md) | `developer -> tester` | `build-health`, `code-review`, `browser-smoke` | None | `completed` |
| [Phase 2: Saved Snapshot Enrichment](phases/phase-02-saved-snapshot-enrichment/phase.md) | `developer -> tester` | `build-health`, `code-review`, `browser-smoke` | print-and-save-record-safety | `completed` |
| [Phase 3: Evidence Contract Reconciliation](phases/phase-03-evidence-contract-reconciliation/phase.md) | `developer -> tester` | `build-health`, `code-review` | saved-snapshot-enrichment | `completed` |
| [Phase 4: Runtime Validation Fixture](phases/phase-04-runtime-validation-fixture/phase.md) | `developer -> tester` | `build-health`, `browser-smoke`, `manual-qa` | evidence-contract-reconciliation | `completed` |

## Prompt Budget

- Downstream prompts should usually seed no more than `6` read-first files or docs.
- Downstream prompts should name only the files, routes, tests, or runtime targets needed to start the active slice.
- Downstream agents may discover adjacent files using the workflow allowed-discovery rule instead of preloading large background bundles.
- `master-developer` should avoid pasting repeated workflow background once the downstream agent has the active phase packet.

## Automated Test Policy

- Behavior-changing phases should include an automated test expectation, likely test files, focused test cases, and narrow test commands.
- `developer` owns implementation plus focused automated tests for the active slice.
- `tester` owns independent verification that the tests run and would catch the intended regression or behavior break.
- If automated tests are not useful for a phase, `master-developer` must record a no-test rationale and alternate validation evidence before accepting the phase.

## Validation Strategy

- `master-developer` must confirm or refine each phase `Read First`, `Automated Test Expectation`, `Test Files`, `Test Cases To Cover`, `No-Test Rationale`, `Validation Modes`, `Runtime Targets`, `Evidence Required`, and `Manual Verification Follow-Up` before dispatching work.
- `tester` should treat compile-only checks as sufficient only when the phase guidance explicitly keeps validation that narrow.
- Phase-local validation should stay attached to the implementation slice instead of drifting into a single final QA pass.
- Default allowed discovery rule: Start with the listed read-first files, then follow imports, hooks, report helpers, schema, and adjacent docs only as needed.

| Mode | Preferred Tools | Default Evidence | Use When |
| --- | --- | --- | --- |
| `api-smoke` | `shell`, `curl` | request or response summary, command output | Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape. |
| `browser-smoke` | `playwright`, `browser-use` | test output, screenshot | Load the live UI in a runtime and verify the main happy path for the active slice. |
| `build-health` | `shell` | command output | Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds. |
| `code-review` | `shell` | file and line references | Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks. |
| `extension-smoke` | `playwright`, `computer-use` | test output, screenshot | Validate the browser extension in a live browser context, including load, install, and core interaction paths. |
| `interaction-smoke` | `playwright`, `computer-use` | test output, screenshot | Drive a real interaction flow end to end and note visible regressions, console issues, or broken state. |
| `ios-simulator-smoke` | `xcodebuild`, `simctl`, `computer-use` | test output, screenshot | Validate the active slice in the iOS simulator or equivalent runtime instead of relying on static review alone. |
| `manual-qa` | `human` | manual verification note | Document the manual follow-up that a human must complete before final merge or release confidence. |
| `unit-regression` | `shell` | command output | Run the existing focused automated tests that cover the active slice before widening scope. |

## Git Workflow

- Repo root: `.`
- Base branch at scaffold time: `main`
- Base commit at scaffold time: `381b7368e9b2e974208fe40881c1bfb4abd42f31`
- Working branch for this workflow: `main`
- Branch bootstrap: `already on workflow branch`
- Initial dirty paths before scaffolding: `docs/upgrades/README.md`, `docs/upgrades/curriculum-modal-cleanup.md`, `docs/upgrades/reporting-safety-fixes.md`

- Branch template: `main`
- Branch in use: `main`
- Automatic branch bootstrap: `False`
- Require clean start for branch bootstrap: `False`
- Commit mode: `phase_acceptance`
- Push mode: `manual`
- PR mode: `manual`
- Runtime files tracked by default: `False`
- Stable workflow paths to track: `workflow-plan.md`, `start-master-developer-chat.md`, `agents/*.md`, `phases/*/phase.md`
- Volatile workflow paths to ignore or leave uncommitted: `workflow-state.yaml`, `phases/*/run-log.md`
- Commit message template: `{workflow_slug}: accept phase {phase_number} ({phase_slug})`

## Workflow Rules

- `master-developer` is the persistent orchestrator for the whole workflow.
- `workflow-state.yaml` is the source of truth for what should happen next.
- Each phase enters `ready_for_master_developer` before the first downstream handoff and after every downstream result.
- Each phase `role_sequence` is the expected downstream order under `master-developer` oversight.
- The scaffold does not prewrite downstream prompts. `master-developer` writes one runtime prompt at a time based on the live workflow state.
- Downstream agents should work only on the active phase and should return control to `master-developer` instead of handing off directly.
- `master-developer` owns branch, commit, push, and PR decisions for this workflow unless the workflow explicitly reassigns that responsibility.
- Agents should update the current phase `run-log.md` before moving the workflow forward.
- `researcher` may be inserted for a bounded blocker even if it was not the originally expected next role. Record the reason in `run-log.md` and `workflow-state.yaml`.
- Do not start a later phase while the current phase is `blocked` or still active.
