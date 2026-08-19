# Lockdown Simplification And Extension Launcher Workflow

Source plan: `docs/specs/lockdown-simplification-and-extension-launcher.md`

## Summary

Simplify the parent Lockdown management surface, add a household resource library with student assignments, harden paired extension controls, and ship a small extension-side student launcher with phase-level validation.

## Roles

- `master-developer`: Own workflow orchestration, phase scoping, runtime prompt writing, validation strategy, PM questions, and phase acceptance.
- `developer`: Implement only the active phase and add focused automated checks for behavior changes.
- `tester`: Validate only the active phase, confirm test relevance, perform declared smoke checks when possible, and return concrete evidence.
- `researcher`: Answer bounded product, platform, or API blockers without drifting into implementation.

## Phase Map

| Phase | Downstream Roles | Validation Modes | Depends On | Status |
| --- | --- | --- | --- | --- |
| [Phase 1: Resource And Policy Contract](phases/phase-01-resource-and-policy-contract/phase.md) | `developer -> tester` | `code-review`, `unit-regression`, `build-health` | None | `accepted` |
| [Phase 2: Parent Summary Shell](phases/phase-02-parent-summary-shell/phase.md) | `developer -> tester` | `code-review`, `build-health`, `browser-smoke` | Phase 1: Resource And Policy Contract | `accepted` |
| [Phase 3: Household Resource Library](phases/phase-03-household-resource-library/phase.md) | `developer -> tester` | `unit-regression`, `build-health`, `browser-smoke` | Phase 2: Parent Summary Shell | `accepted` |
| [Phase 4: Schedule And Allowed Preview](phases/phase-04-schedule-and-allowed-preview/phase.md) | `developer -> tester` | `unit-regression`, `build-health`, `browser-smoke` | Phase 3: Household Resource Library | `accepted` |
| [Phase 5: Pairing Wizard And Device Summaries](phases/phase-05-pairing-wizard-and-device-summaries/phase.md) | `developer -> tester` | `unit-regression`, `build-health`, `browser-smoke`, `manual-qa` | Phase 4: Schedule And Allowed Preview | `accepted` |
| [Phase 6: Extension Paired-State Hardening](phases/phase-06-extension-paired-state-hardening/phase.md) | `developer -> tester` | `unit-regression`, `build-health`, `extension-smoke` | Phase 5: Pairing Wizard And Device Summaries | `blocked` |
| [Phase 7: Trusted Launcher Endpoints](phases/phase-07-trusted-launcher-endpoints/phase.md) | `developer -> tester` | `unit-regression`, `api-smoke`, `build-health` | Phase 6: Extension Paired-State Hardening | `pending` |
| [Phase 8: Extension Student Launcher](phases/phase-08-extension-student-launcher/phase.md) | `developer -> tester` | `unit-regression`, `extension-smoke`, `build-health` | Phase 7: Trusted Launcher Endpoints | `pending` |
| [Phase 9: Integration QA And Store Readiness](phases/phase-09-integration-qa-and-store-readiness/phase.md) | `developer -> tester` | `unit-regression`, `build-health`, `browser-smoke`, `extension-smoke`, `manual-qa` | Phase 8: Extension Student Launcher | `pending` |

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

- Use gpt-5.5 high for cross-phase architecture, trusted-device security, hard debugging, or final integration review.
- Use gpt-5.5 xhigh only for master-level planning, recovery, or high-risk acceptance decisions.

## Automated Test Policy

- Behavior-changing phases should include an automated test expectation, likely test files, focused test cases, and narrow test commands.
- `developer` owns implementation plus focused automated tests for the active slice.
- `tester` owns independent verification that the tests run and would catch the intended regression or behavior break.
- If automated tests are not useful for a phase, `master-developer` must record a no-test rationale and alternate validation evidence before accepting the phase.

## Validation Strategy

- `master-developer` must confirm or refine each phase `Read First`, `Automated Test Expectation`, `Test Files`, `Test Cases To Cover`, `No-Test Rationale`, `Validation Modes`, `Runtime Targets`, `Evidence Required`, and `Manual Verification Follow-Up` before dispatching work.
- `tester` should treat compile-only checks as sufficient only when the phase guidance explicitly keeps validation that narrow.
- Phase-local validation should stay attached to the implementation slice instead of drifting into a single final QA pass.
- Default allowed discovery rule: Start with the listed read-first files, then follow imports, routes, adjacent scripts, and nearby implementation files only as needed for the active phase.

| Mode | Preferred Tools | Default Evidence | Use When |
| --- | --- | --- | --- |
| `api-smoke` | `shell`, `curl` | request or response summary, command output | Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape. |
| `browser-smoke` | `browser-use`, `playwright` | screenshot, route or interaction notes | Load the live UI in a runtime and verify the main happy path for the active slice. |
| `build-health` | `shell` | command output | Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds. |
| `code-review` | `shell` | code references | Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks. |
| `extension-smoke` | `Chrome`, `computer-use`, `playwright` | Chrome profile notes, screenshot | Validate the browser extension in a live browser context, including load, install, and core interaction paths. |
| `interaction-smoke` | `browser-use`, `computer-use` | test output, screenshot | Drive a real interaction flow end to end and note visible regressions, console issues, or broken state. |
| `ios-device-smoke` | `xcodebuild`, `connected device`, `human` | device test note, screenshot or screen recording | Validate the active slice on a connected iOS device when simulator coverage is unavailable or device-specific confidence matters. |
| `ios-simulator-smoke` | `xcodebuild`, `simctl`, `computer-use` | test output, screenshot | Validate the active slice in the iOS simulator or equivalent runtime instead of relying on static review alone. |
| `manual-qa` | `human`, `Chrome` | manual verification note | Document the manual follow-up that a human must complete before final merge or release confidence. |
| `unit-regression` | `shell` | command output | Run the existing focused automated tests that cover the active slice before widening scope. |

## Git Workflow

- Repo root: `.`
- Base branch at scaffold time: `feat/chores-and-rewards-module`
- Base commit at scaffold time: `c4f511000751cf044bcb9add6f492a1415db654b`
- Working branch for this workflow: `feat/chores-and-rewards-module`
- Branch bootstrap: `git repository detected`
- Initial dirty paths before scaffolding: `docs/README.md`, `docs/architecture.md`, `docs/features/parent-dashboard.md`, `docs/roadmap.md`, `docs/specs/README.md`, `docs/specs/lockdown-browser-extension-plan.md`, `docs/specs/public-marketing-site-and-landing-page.md`, `docs/support/operator-entitlement-console-runbook.md`, `docs/upgrades/curriculum-modal-cleanup.md`, `docs/upgrades/reporting-safety-fixes.md`, `docs/upgrades/shell-and-data-layer.md`, `docs/upgrades/subscriptions-and-entitlements.md`, `extensions/chrome-lockdown-poc/allowlist.html`, `extensions/chrome-lockdown-poc/allowlist.js`, `extensions/chrome-lockdown-poc/background.js`, `extensions/chrome-lockdown-poc/blocked.html`, `extensions/chrome-lockdown-poc/blocked.js`, `extensions/chrome-lockdown-poc/manifest.json`, `extensions/chrome-lockdown-poc/options.html`, `extensions/chrome-lockdown-poc/options.js`, `extensions/chrome-lockdown-poc/policy.js`, `extensions/chrome-lockdown-poc/popup.html`, `extensions/chrome-lockdown-poc/popup.js`, `extensions/chrome-lockdown-poc/youtube-content.js`, `firestore.rules`, `functions/src/index.js`, `src/App.jsx`, `src/components/LockdownPolicyPanel.jsx`, `src/constants/dashboardFeatures.js`, `src/constants/entitlements.js`, `src/constants/schema.js`, `src/firebase/trustedOperations.js`, `src/pages/StudentPortal.jsx`, `src/utils/entitlementUtils.js`, `src/utils/lockdownPolicyUtils.js`, `docs/icons/`, `docs/specs/chores-and-rewards-module-workflow/`, `docs/specs/chores-and-rewards-module.md`, `docs/specs/lockdown-production-behavior-contract-workflow/`, `docs/specs/lockdown-production-behavior-contract.md`, `docs/specs/lockdown-simplification-and-extension-launcher.md`, `docs/support/chores-and-rewards-runbook.md`, `docs/support/lockdown-chrome-web-store-upload-plan.md`, `docs/support/lockdown-support-runbook.md`, `docs/support/pre-merge-readiness-checklist.md`, `extensions/chrome-lockdown-poc/guidance.js`, `functions/src/allowanceUtils.js`, `functions/src/choreTrustedValidators.js`, `functions/src/pointLedgerUtils.js`, `functions/src/rewardRedemptionUtils.js`, `scripts/check-allowance-ledger.mjs`, `scripts/check-chores-availability.mjs`, `scripts/check-chores-entitlements.mjs`, `scripts/check-chores-parent-view-model.mjs`, `scripts/check-chores-rewards-e2e.mjs`, `scripts/check-chores-trusted-contracts.mjs`, `scripts/check-lockdown-derived-policy.mjs`, `scripts/check-lockdown-device-management.mjs`, `scripts/check-lockdown-extension-states.mjs`, `scripts/check-lockdown-policy-states.mjs`, `scripts/check-lockdown-release-package.mjs`, `scripts/check-lockdown-resource-normalization.mjs`, `scripts/check-lockdown-work-launcher.mjs`, `scripts/check-points-ledger.mjs`, `scripts/check-reward-redemptions.mjs`, `scripts/check-student-chores-view.mjs`, `scripts/seed-private-beta-smoke-fixtures.mjs`, `scripts/smoke-private-beta-callables.mjs`, `src/components/StudentRewardStore.jsx`, `src/components/student/`, `src/hooks/useChoreSetup.js`, `src/hooks/useStudentChores.js`, `src/pages/dashboard/ChoresRoute.jsx`, `src/utils/allowanceUtils.js`, `src/utils/choreParentViewModel.js`, `src/utils/choreUtils.js`, `src/utils/rewardUtils.js`, `src/utils/workLauncherUtils.js`

- Branch template: `codex/lockdown-simplification-and-extension-launcher`
- Branch in use: `feat/chores-and-rewards-module` (scaffold did not create or switch branches)
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
- Each phase enters `ready_for_master_developer` before the first downstream handoff and after every downstream result.
- Each phase `role_sequence` is the expected downstream order under `master-developer` oversight.
- The scaffold does not prewrite downstream prompts. `master-developer` writes one runtime prompt at a time based on the live workflow state.
- Downstream agents should work only on the active phase and should return control to `master-developer` instead of handing off directly.
- `master-developer` owns branch, commit, push, and PR decisions for this workflow unless the workflow explicitly reassigns that responsibility.
- Agents should update the current phase `run-log.md` before moving the workflow forward.
- `researcher` may be inserted for a bounded blocker even if it was not the originally expected next role. Record the reason in `run-log.md` and `workflow-state.yaml`.
- Do not start a later phase while the current phase is `blocked` or still active.
