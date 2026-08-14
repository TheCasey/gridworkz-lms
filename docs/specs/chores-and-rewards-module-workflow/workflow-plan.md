# Chores And Rewards Module Workflow

Source plan: `docs/specs/chores-and-rewards-module.md`

## Summary

Implement the future chores, routines, allowance, points, and rewards module in bounded phases that preserve Own Path's weekly-autonomy model, use the shared entitlement rail, and harden student-facing household data before launch.

## Roles

- `master-developer`: Own workflow orchestration, PM decision capture, runtime prompt writing, phase acceptance, security posture, validation strategy, and git checkpoints.
- `developer`: Implement only the active phase with narrow file ownership, add focused automated checks where behavior changes, update the run log, and return control to master-developer.
- `tester`: Validate only the active phase, confirm tests or no-test rationale are meaningful, perform declared browser/API/security checks, update the run log, and return control to master-developer.
- `researcher`: Answer bounded blockers such as Firebase callable, Firestore rules, or entitlement-pattern questions without drifting into implementation.

## Phase Map

| Phase | Downstream Roles | Validation Modes | Depends On | Status |
| --- | --- | --- | --- | --- |
| [Phase 1: Entitlement And Route Foundation](phases/phase-01-entitlement-and-route-foundation/phase.md) | `developer -> tester` | `build-health`, `unit-regression`, `code-review` | None | `accepted` |
| [Phase 2: Schema And Availability Helpers](phases/phase-02-schema-and-availability-helpers/phase.md) | `developer -> tester` | `unit-regression`, `build-health`, `code-review` | Phase 1: Entitlement And Route Foundation | `accepted` |
| [Phase 3: Trusted Chore Operations](phases/phase-03-trusted-chore-operations/phase.md) | `developer -> tester` | `unit-regression`, `security-rules-review`, `api-smoke`, `build-health` | Phase 2: Schema And Availability Helpers | `accepted` |
| [Phase 4: Parent Chore Setup](phases/phase-04-parent-chore-setup/phase.md) | `developer -> tester` | `unit-regression`, `browser-smoke`, `interaction-smoke`, `build-health` | Phase 3: Trusted Chore Operations | `accepted` |
| [Phase 5: Student Chore Workspace](phases/phase-05-student-chore-workspace/phase.md) | `developer -> tester` | `unit-regression`, `browser-smoke`, `interaction-smoke`, `security-rules-review`, `build-health` | Phase 4: Parent Chore Setup | `accepted` |
| [Phase 6: Allowance Ledger](phases/phase-06-allowance-ledger/phase.md) | `developer -> tester` | `unit-regression`, `browser-smoke`, `security-rules-review`, `build-health` | Phase 5: Student Chore Workspace | `accepted` |
| [Phase 7: Points And Wallet Foundation](phases/phase-07-points-and-wallet-foundation/phase.md) | `developer -> tester` | `unit-regression`, `security-rules-review`, `browser-smoke`, `build-health` | Phase 6: Allowance Ledger | `accepted` |
| [Phase 8: Reward Store And Redemptions](phases/phase-08-reward-store-and-redemptions/phase.md) | `developer -> tester` | `unit-regression`, `browser-smoke`, `interaction-smoke`, `security-rules-review`, `build-health` | Phase 7: Points And Wallet Foundation | `accepted` |
| [Phase 9: Integration Hardening And Launch QA](phases/phase-09-integration-hardening-and-launch-qa/phase.md) | `developer -> tester` | `unit-regression`, `security-rules-review`, `browser-smoke`, `interaction-smoke`, `build-health`, `manual-qa` | Phase 8: Reward Store And Redemptions | `accepted` |

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
| `master-developer` | `gpt-5.5` | `xhigh` |
| `developer` | `gpt-5.4` | `high` |
| `tester` | `gpt-5.4` | `high` |
| `researcher` | `gpt-5.4` | `high` |

Escalation rules:

- Use gpt-5.5 high for cross-phase data architecture, security-sensitive student-session work, Firestore rules hardening, or final integration review.
- Use gpt-5.5 xhigh only for master-level recovery, scope replanning, or high-risk acceptance decisions.

## Automated Test Policy

- Behavior-changing phases should include an automated test expectation, likely test files, focused test cases, and narrow test commands.
- `developer` owns implementation plus focused automated tests for the active slice.
- `tester` owns independent verification that the tests run and would catch the intended regression or behavior break.
- If automated tests are not useful for a phase, `master-developer` must record a no-test rationale and alternate validation evidence before accepting the phase.

## Validation Strategy

- `master-developer` must confirm or refine each phase `Read First`, `Automated Test Expectation`, `Test Files`, `Test Cases To Cover`, `No-Test Rationale`, `Validation Modes`, `Runtime Targets`, `Evidence Required`, and `Manual Verification Follow-Up` before dispatching work.
- `tester` should treat compile-only checks as sufficient only when the phase guidance explicitly keeps validation that narrow.
- Phase-local validation should stay attached to the implementation slice instead of drifting into a single final QA pass.
- Default allowed discovery rule: Start with the listed read-first files, then follow imports, route registrations, adjacent utilities, Firebase callable wrappers, Firestore rules, and nearby scripts only as needed.

| Mode | Preferred Tools | Default Evidence | Use When |
| --- | --- | --- | --- |
| `api-smoke` | `shell`, `firebase emulator when configured` | request or response summary, command output | Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape. |
| `browser-smoke` | `browser-use`, `playwright` | runtime URL, screenshot or interaction notes | Load the live UI in a runtime and verify the main happy path for the active slice. |
| `build-health` | `shell` | command output | Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds. |
| `code-review` | `shell` | code references | Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks. |
| `extension-smoke` | `playwright`, `computer-use` | test output, screenshot | Validate the browser extension in a live browser context, including load, install, and core interaction paths. |
| `interaction-smoke` | `browser-use`, `playwright` | interaction notes, console/error observations | Drive a real interaction flow end to end and note visible regressions, console issues, or broken state. |
| `ios-device-smoke` | `xcodebuild`, `connected device`, `human` | device test note, screenshot or screen recording | Validate the active slice on a connected iOS device when simulator coverage is unavailable or device-specific confidence matters. |
| `ios-simulator-smoke` | `xcodebuild`, `simctl`, `computer-use` | test output, screenshot | Validate the active slice in the iOS simulator or equivalent runtime instead of relying on static review alone. |
| `manual-qa` | `human` | manual verification note | Document the manual follow-up that a human must complete before final merge or release confidence. |
| `security-rules-review` | `shell`, `code-review` | rules/code references, risk notes | Inspect Firestore rules, trusted callable boundaries, and public student portal exposure for the active slice. |
| `unit-regression` | `shell` | command output | Run the existing focused automated tests that cover the active slice before widening scope. |

## Git Workflow

- Repo root: `.`
- Base branch at scaffold time: `main`
- Base commit at scaffold time: `c4f511000751cf044bcb9add6f492a1415db654b`
- Working branch for this workflow: `main`
- Branch bootstrap: `git repository detected`
- Initial dirty paths before scaffolding: `docs/architecture.md`, `docs/roadmap.md`, `docs/specs/README.md`, `docs/specs/lockdown-browser-extension-plan.md`, `docs/upgrades/subscriptions-and-entitlements.md`, `extensions/chrome-lockdown-poc/allowlist.html`, `extensions/chrome-lockdown-poc/allowlist.js`, `extensions/chrome-lockdown-poc/background.js`, `extensions/chrome-lockdown-poc/blocked.html`, `extensions/chrome-lockdown-poc/blocked.js`, `extensions/chrome-lockdown-poc/manifest.json`, `extensions/chrome-lockdown-poc/options.html`, `extensions/chrome-lockdown-poc/options.js`, `extensions/chrome-lockdown-poc/policy.js`, `extensions/chrome-lockdown-poc/popup.html`, `extensions/chrome-lockdown-poc/popup.js`, `extensions/chrome-lockdown-poc/youtube-content.js`, `functions/src/index.js`, `src/components/LockdownPolicyPanel.jsx`, `src/constants/schema.js`, `src/firebase/trustedOperations.js`, `src/pages/StudentPortal.jsx`, `src/utils/lockdownPolicyUtils.js`, `docs/specs/chores-and-rewards-module.md`, `docs/specs/lockdown-production-behavior-contract-workflow/`, `docs/specs/lockdown-production-behavior-contract.md`, `docs/support/lockdown-chrome-web-store-upload-plan.md`, `docs/support/lockdown-support-runbook.md`, `extensions/chrome-lockdown-poc/guidance.js`, `scripts/check-lockdown-derived-policy.mjs`, `scripts/check-lockdown-device-management.mjs`, `scripts/check-lockdown-extension-states.mjs`, `scripts/check-lockdown-policy-states.mjs`, `scripts/check-lockdown-release-package.mjs`, `scripts/check-lockdown-resource-normalization.mjs`, `scripts/check-lockdown-work-launcher.mjs`, `src/utils/workLauncherUtils.js`

- Branch template: `feat/chores-and-rewards-module`
- Branch in use: `feat/chores-and-rewards-module`
- Automatic branch bootstrap: `False`
- Require clean start for branch bootstrap: `False`
- Commit mode: `phase_acceptance`
- Push mode: `accepted_phase`
- PR mode: `draft_on_first_push`
- Runtime files tracked by default: `False`
- Stable workflow paths to track: `workflow-plan.md`, `start-master-developer-chat.md`, `agents/*.md`, `phases/*/phase.md`
- Volatile workflow paths to ignore or leave uncommitted: `workflow-state.yaml`, `phases/*/run-log.md`
- Commit message template: `chores-rewards: accept phase {phase_number} ({phase_slug})`

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
