# Curriculum Modal Cleanup Workflow

Source plan: `docs/upgrades/curriculum-modal-cleanup.md`

## Summary

Clean up the current curriculum subject modal in bounded UI phases while preserving subject data shape, weekly-plan compatibility, and student/report behavior.

## Roles

- `master-developer`: Own workflow orchestration and keep this cleanup scoped to the current subject editor instead of turning it into a new curriculum-template or weekly-plan architecture project.
- `developer`: Implement only the active UI cleanup phase, preserve current subject write shape and weekly-plan derivation, and keep design consistent with the existing parent dashboard palette.
- `tester`: Validate only the active phase with lint/build and focused browser checks for create/edit modal behavior across desktop and mobile widths.
- `researcher`: Answer bounded blockers about current Curriculum state, modal interaction patterns, or weekly-plan compatibility without drifting into implementation.

## Phase Map

| Phase | Downstream Roles | Validation Modes | Depends On | Status |
| --- | --- | --- | --- | --- |
| [Phase 1: Extract Block Objectives Editor](phases/phase-01-extract-block-objectives-editor/phase.md) | `developer -> tester` | `build-health`, `code-review`, `browser-smoke` | None | `complete` |
| [Phase 2: Stable Modal Shell](phases/phase-02-stable-modal-shell/phase.md) | `developer -> tester` | `build-health`, `browser-smoke`, `interaction-smoke` | extract-block-objectives-editor | `complete` |
| [Phase 3: Compact Block Objective Workflow](phases/phase-03-compact-block-objective-workflow/phase.md) | `developer -> tester` | `build-health`, `browser-smoke`, `interaction-smoke` | stable-modal-shell | `complete` |
| [Phase 4: Responsive And Regression Pass](phases/phase-04-responsive-and-regression-pass/phase.md) | `developer -> tester` | `build-health`, `browser-smoke`, `interaction-smoke`, `manual-qa` | compact-block-objective-workflow | `complete_with_manual_follow_up` |

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
- Default allowed discovery rule: Start with the listed read-first files, then follow imports, hooks, styles, and adjacent curriculum components only as needed.

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
