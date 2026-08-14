# Lockdown Production Behavior Contract Workflow

Source plan: `docs/specs/lockdown-production-behavior-contract.md`

## Summary

Turn the Lockdown behavior contract into production-ready implementation phases covering state vocabulary, policy derivation, resource normalization, device management, student blocked UX, embedded work launcher foundation, and release validation for extension and future kiosk mode.

## Roles

- `master-developer`: Own the Lockdown production-readiness sequence, keep the browser extension and future kiosk mode on the same policy contract, write one runtime handoff at a time, and decide git checkpoints after phase acceptance.
- `developer`: Implement only the active Lockdown phase, preserve the route-backed dashboard shell and trusted device-policy boundary, and add focused validation scripts or tests for behavior changes.
- `tester`: Validate only the active Lockdown phase with build, lint, helper-script, browser, extension, or API evidence as declared by the phase.
- `researcher`: Answer bounded blockers around Chrome MV3, Chrome Web Store policy, kiosk deployment, Firebase trusted APIs, or YouTube resolution without drifting into implementation.

## Phase Map

| Phase | Downstream Roles | Validation Modes | Depends On | Status |
| --- | --- | --- | --- | --- |
| [Phase 1: State Vocabulary And Active Work Contract](phases/phase-01-state-vocabulary-and-active-work-contract/phase.md) | `developer -> tester` | `unit-regression`, `build-health`, `code-review` | None | `accepted` |
| [Phase 2: Policy Derivation And System Allowlist](phases/phase-02-policy-derivation-and-system-allowlist/phase.md) | `developer -> tester` | `unit-regression`, `api-smoke`, `build-health` | Phase 1: State Vocabulary And Active Work Contract | `accepted` |
| [Phase 3: Resource Normalization And Parent Testing](phases/phase-03-resource-normalization-and-parent-testing/phase.md) | `developer -> tester` | `unit-regression`, `browser-smoke`, `build-health` | Phase 2: Policy Derivation And System Allowlist | `accepted` |
| [Phase 4: Device Management And Revocation](phases/phase-04-device-management-and-revocation/phase.md) | `developer -> tester` | `unit-regression`, `api-smoke`, `extension-smoke`, `build-health` | Phase 3: Resource Normalization And Parent Testing | `accepted` |
| [Phase 5: Student Blocked Experience And Access Requests](phases/phase-05-student-blocked-experience-and-access-requests/phase.md) | `developer -> tester` | `unit-regression`, `extension-smoke`, `browser-smoke`, `build-health` | Phase 4: Device Management And Revocation | `accepted` |
| [Phase 6: Embedded Work Launcher Foundation](phases/phase-06-embedded-work-launcher-foundation/phase.md) | `developer -> tester` | `unit-regression`, `browser-smoke`, `extension-smoke`, `build-health` | Phase 5: Student Blocked Experience And Access Requests | `accepted` |
| [Phase 7: Release Hardening And Paid Readiness](phases/phase-07-release-hardening-and-paid-readiness/phase.md) | `developer -> tester` | `unit-regression`, `extension-smoke`, `manual-qa`, `build-health` | Phase 6: Embedded Work Launcher Foundation | `accepted` |

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
- Default allowed discovery rule: Start with the listed read-first files, then follow imports, routes, existing check scripts, extension files, functions, and nearby docs only as needed for the active phase.

| Mode | Preferred Tools | Default Evidence | Use When |
| --- | --- | --- | --- |
| `api-smoke` | `shell`, `curl`, `Firebase callable or HTTP function smoke` | request or response summary, command output | Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape. |
| `browser-smoke` | `playwright`, `browser-use` | test output, screenshot or DOM summary | Load the live UI in a runtime and verify the main happy path for the active slice. |
| `build-health` | `shell` | npm run lint output, npm run build output | Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds. |
| `code-review` | `shell` | code references | Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks. |
| `extension-smoke` | `playwright`, `computer-use`, `Chrome extension manual load` | extension runtime evidence, screenshot or storage/policy summary | Validate the browser extension in a live browser context, including load, install, and core interaction paths. |
| `interaction-smoke` | `playwright`, `computer-use` | test output, screenshot | Drive a real interaction flow end to end and note visible regressions, console issues, or broken state. |
| `ios-simulator-smoke` | `xcodebuild`, `simctl`, `computer-use` | test output, screenshot | Validate the active slice in the iOS simulator or equivalent runtime instead of relying on static review alone. |
| `manual-qa` | `human` | manual verification note | Document the manual follow-up that a human must complete before final merge or release confidence. |
| `unit-regression` | `shell` | focused check script output | Run the existing focused automated tests that cover the active slice before widening scope. |

## Git Workflow

- Repo root: `.`
- Base branch at scaffold time: `main`
- Base commit at scaffold time: `c4f511000751cf044bcb9add6f492a1415db654b`
- Working branch for this workflow: `main`
- Branch bootstrap: `automatic branch creation disabled because the behavior-contract docs were already dirty`
- Initial dirty paths before scaffolding: `docs/specs/README.md`, `docs/specs/lockdown-browser-extension-plan.md`, `docs/specs/lockdown-production-behavior-contract.md`

- Branch template: `codex/{plan_slug}`
- Implementation branch target: `codex/lockdown-production-behavior-contract`
- Automatic branch bootstrap: `False`
- Require clean start for branch bootstrap: `False`
- Commit mode: `phase_acceptance`
- Push mode: `accepted_phase`
- PR mode: `draft_on_first_push`
- Runtime files tracked by default: `False`
- Stable workflow paths to track: `workflow-plan.md`, `start-master-developer-chat.md`, `agents/*.md`, `phases/*/phase.md`
- Volatile workflow paths to ignore or leave uncommitted: `workflow-state.yaml`, `phases/*/run-log.md`
- Commit message template: `{workflow_slug}: accept phase {phase_number} ({phase_slug})`

## Workflow Rules

- `master-developer` is the persistent orchestrator for the whole workflow.
- `workflow-state.yaml` is the source of truth for what should happen next.
- Automatic branch switching was intentionally not performed during scaffold creation. `master-developer` should create or switch to `codex/lockdown-production-behavior-contract` only after the current docs are accepted or the user asks for a branch now.
- Each phase enters `ready_for_master_developer` before the first downstream handoff and after every downstream result.
- Each phase `role_sequence` is the expected downstream order under `master-developer` oversight.
- The scaffold does not prewrite downstream prompts. `master-developer` writes one runtime prompt at a time based on the live workflow state.
- Downstream agents should work only on the active phase and should return control to `master-developer` instead of handing off directly.
- `master-developer` owns branch, commit, push, and PR decisions for this workflow unless the workflow explicitly reassigns that responsibility.
- Agents should update the current phase `run-log.md` before moving the workflow forward.
- `researcher` may be inserted for a bounded blocker even if it was not the originally expected next role. Record the reason in `run-log.md` and `workflow-state.yaml`.
- Do not start a later phase while the current phase is `blocked` or still active.
