# Curriculum And Weekly Plan Rollout Workflow

Source plan: `docs/upgrades/curriculum-and-weekly-plan-rollout.md`

## Summary

Incrementally introduce the future curriculum, assignment, and weekly-plan model while preserving the current subject-driven app until weekly plans become the live student and reporting surface.

## Implementation Notes

- This workflow is compatibility-first. `subjects`, `submissions`, `weeklyReports`, and `timerSessions` remain live until later phases explicitly replace a slice.
- The first shipped win is not full parity. The target is one student-week that can be published, executed in the portal, and archived into reporting without breaking existing flows.
- Keep the existing route-backed dashboard shell, entitlement layer, and Lockdown routing intact unless a phase explicitly needs a compatibility hook.
- Projects, AI surfaces, Evidence Drawer uploads, live-mode billing rollout, and Lockdown device-trust hardening are out of scope for this workflow.
- Automated validation is limited to `npm run lint` and `npm run build`. There is no dedicated test suite yet.

## Roles

- `master-developer`: Own workflow orchestration, keep the rollout aligned with the weekly-autonomy baseline, and protect the repo from broad rewrites or cross-phase drift.
- `developer`: Implement only the active phase, preserve the current route-backed shell and subject-driven app behavior unless the phase explicitly replaces a slice, and favor compatibility-first changes over destructive migrations.
- `tester`: Validate only the active phase, focus on regressions in the student portal, reports, and weekly rollover behavior, and return failures with exact reproduction details.
- `researcher`: Resolve only bounded blockers around rollout shape, Firestore data contracts, or compatibility risks without drifting into implementation.

## Phase Map

| Phase | Downstream Roles | Depends On | Status |
| --- | --- | --- | --- |
| [Phase 1: Schema And Compatibility Foundation](phases/phase-01-schema-and-compatibility-foundation/phase.md) | `developer -> tester` | None | `ready_for_master_developer` |
| [Phase 2: Weekly Plan Generation And Publish Foundation](phases/phase-02-weekly-plan-generation-and-publish-foundation/phase.md) | `developer -> tester` | schema-and-compatibility-foundation | `pending` |
| [Phase 3: Parent Weekly Planning Surface](phases/phase-03-parent-weekly-planning-surface/phase.md) | `developer -> tester` | weekly-plan-generation-and-publish-foundation | `pending` |
| [Phase 4: Student Portal Weekly Workspace Foundation](phases/phase-04-student-portal-weekly-workspace-foundation/phase.md) | `developer -> tester` | parent-weekly-planning-surface | `pending` |
| [Phase 5: Reporting And Rollover Integration](phases/phase-05-reporting-and-rollover-integration/phase.md) | `developer -> tester` | student-portal-weekly-workspace-foundation | `pending` |

## Workflow Rules

- `master-developer` is the persistent orchestrator for the whole workflow.
- `workflow-state.yaml` is the source of truth for what should happen next.
- Each phase enters `ready_for_master_developer` before the first downstream handoff and after every downstream result.
- Each phase `role_sequence` is the expected downstream order under `master-developer` oversight.
- The scaffold does not prewrite downstream prompts. `master-developer` writes one runtime prompt at a time based on the live workflow state.
- Downstream agents should work only on the active phase and should return control to `master-developer` instead of handing off directly.
- Agents should update the current phase `run-log.md` before moving the workflow forward.
- `researcher` may be inserted for a bounded blocker even if it was not the originally expected next role. Record the reason in `run-log.md` and `workflow-state.yaml`.
- Do not start a later phase while the current phase is `blocked` or still active.
