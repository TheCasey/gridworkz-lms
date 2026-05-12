# Public Marketing Site And Landing Page Workflow

Source plan: `docs/specs/public-marketing-site-and-landing-page.md`

## Summary

Build the first public GridWorkz homepage in bounded phases: expose a real public root route first, then land the narrative sections, then pricing plus FAQ, and finally responsive polish and launch QA without destabilizing the authenticated dashboard or advertising billing flows that are not live yet.

## Roles

- `master-developer`: Own workflow orchestration for the marketing-site rollout, keep the homepage aligned with the source spec and current product reality, and preserve existing auth, dashboard, and student-route behavior while dispatching narrow downstream work.
- `developer`: Implement only the active homepage slice, preserve the current dashboard and student flows, and keep marketing copy truthful to the live product plus the documented pricing caveats.
- `tester`: Validate only the active homepage slice with build plus browser-based checks on localhost, and return concrete evidence about routing, anchor behavior, CTA behavior, and visible regressions.
- `researcher`: Resolve only a bounded blocker about route behavior, browser validation, or plan-aligned messaging without drifting into implementation.

## Phase Map

| Phase | Downstream Roles | Validation Modes | Depends On | Status |
| --- | --- | --- | --- | --- |
| [Phase 1: Public Route And Shell Foundation](phases/phase-01-public-route-and-shell-foundation/phase.md) | `developer -> tester` | `build-health`, `browser-smoke`, `interaction-smoke` | None | `ready_for_master_developer` |
| [Phase 2: Core Story And Section Content](phases/phase-02-core-story-and-section-content/phase.md) | `developer -> tester` | `build-health`, `browser-smoke`, `manual-qa` | Phase 1: Public Route And Shell Foundation | `pending` |
| [Phase 3: Pricing FAQ And Conversion Paths](phases/phase-03-pricing-faq-and-conversion-paths/phase.md) | `developer -> tester` | `build-health`, `browser-smoke`, `interaction-smoke`, `manual-qa` | Phase 2: Core Story And Section Content | `pending` |
| [Phase 4: Responsive Polish And Launch QA](phases/phase-04-responsive-polish-and-launch-qa/phase.md) | `developer -> tester` | `build-health`, `interaction-smoke`, `manual-qa` | Phase 3: Pricing FAQ And Conversion Paths | `pending` |

## Prompt Budget

- Downstream prompts should usually seed no more than `6` read-first files or docs.
- Downstream prompts should name only the files, routes, tests, or runtime targets needed to start the active slice.
- Downstream agents may discover adjacent files using the workflow allowed-discovery rule instead of preloading large background bundles.
- `master-developer` should avoid pasting repeated workflow background once the downstream agent has the active phase packet.

## Validation Strategy

- `master-developer` must confirm or refine each phase `Read First`, `Validation Modes`, `Runtime Targets`, `Evidence Required`, and `Manual Verification Follow-Up` before dispatching work.
- `tester` should treat compile-only checks as sufficient only when the phase guidance explicitly keeps validation that narrow.
- Phase-local validation should stay attached to the implementation slice instead of drifting into a single final QA pass.
- Default allowed discovery rule: Start with the listed read-first docs and files, then follow imports, routes, nearby styles, and adjacent assets only as needed. Do not widen the task into dashboard refactors, billing implementation, or unrelated product redesign.

| Mode | Preferred Tools | Default Evidence | Use When |
| --- | --- | --- | --- |
| `api-smoke` | `shell`, `curl` | request or response summary, command output | Exercise the live endpoint or local HTTP contract for the active slice and confirm the expected shape. |
| `browser-smoke` | `browser-use`, `playwright` | test output, screenshot | Load the live UI in a runtime and verify the main happy path for the active slice. |
| `build-health` | `shell` | command output | Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds. |
| `code-review` | `shell` | code references | Use static inspection only when the phase is contract-only, config-only, or blocked from runtime checks. |
| `extension-smoke` | `playwright`, `computer-use` | test output, screenshot | Validate the browser extension in a live browser context, including load, install, and core interaction paths. |
| `interaction-smoke` | `browser-use`, `playwright`, `computer-use` | test output, screenshot | Drive a real interaction flow end to end and note visible regressions, console issues, or broken state. |
| `ios-simulator-smoke` | `xcodebuild`, `simctl`, `computer-use` | test output, screenshot | Validate the active slice in the iOS simulator or equivalent runtime instead of relying on static review alone. |
| `manual-qa` | `human` | manual verification note | Document the manual follow-up that a human must complete before final merge or release confidence. |
| `unit-regression` | `shell` | command output | Run the existing focused automated tests that cover the active slice before widening scope. |

## Git Workflow

- Repo root: `.`
- Base branch at scaffold time: `main`
- Base commit at scaffold time: `1f4cdab3e0c4d07550c5feda6161f8edc06229bb`
- Working branch for this workflow: `main`
- Branch bootstrap: `disabled for this scaffold; the repo was already dirty at scaffold time so no automatic workflow-branch switch was attempted`
- Initial dirty paths before scaffolding: `docs/roadmap.md`, `docs/specs/README.md`, `docs/upgrades/subscriptions-and-entitlements.md`, `docs/specs/operator-entitlement-console.md`, `docs/specs/public-marketing-site-and-landing-page.md`

- Branch template: `feat/{plan_slug}`
- Branch in use: `main`
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
