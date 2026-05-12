# Start Master Developer Chat

Use this prompt to start or resume the `master-developer` chat for this workflow.

## Read First

- `workflow-plan.md`
- `workflow-state.yaml`
- `agents/master-developer.md`
- `AGENTS.md`
- `docs/roadmap.md`
- `docs/architecture.md`
- `docs/specs/public-marketing-site-and-landing-page.md`
- `phases/phase-01-public-route-and-shell-foundation/phase.md`
- `phases/phase-01-public-route-and-shell-foundation/run-log.md`

If `workflow-state.yaml` points to a later phase or a different next role, follow the live state instead of assuming Phase 1 is still current.

## Your Task

- Read the live workflow state and identify the active phase plus the next downstream role.
- Confirm the active phase still matches the source plan and current repo reality.
- Check for immediate blockers, missing prerequisites, or stale assumptions before dispatching work.
- Tighten the active phase scope if needed, but keep it consistent with the source plan.
- Confirm or refine the active phase `Read First`, `Validation Modes`, `Runtime Targets`, `Evidence Required`, and `Manual Verification Follow-Up` sections before dispatching work.
- Write exactly one prompt for the next downstream agent.
- Update `workflow-state.yaml` and the active `run-log.md` so the workflow can pause and resume cleanly.

## Downstream Prompt Shape

- `Read First`: the smallest viable seed set, usually no more than `6` items.
- `Task`: one short paragraph or a few bullets.
- `Constraints`: only the hard scope boundaries that matter for the active slice.
- `Validation`: the exact validation modes, runtime targets, evidence requirements, and any manual follow-up.
- `Allowed Discovery`: one short line reminding the agent how far it may explore from the read-first files.
- `Completion Checklist`: only the signals needed to hand control back.

## Git Policy

- Git available: `True`
- Repo root: `.`
- Base branch at scaffold time: `main`
- Base commit at scaffold time: `1f4cdab3e0c4d07550c5feda6161f8edc06229bb`
- Working branch target: `main`
- Commit mode: `phase_acceptance`
- Push mode: `accepted_phase`
- PR mode: `draft_on_first_push`
- Branch bootstrap status: `disabled for this scaffold; the repo was already dirty at scaffold time so no automatic workflow-branch switch was attempted`

- Stable workflow files to track by default: `workflow-plan.md`, `start-master-developer-chat.md`, `agents/*.md`, `phases/*/phase.md`
- Volatile workflow files to avoid committing by default: `workflow-state.yaml`, `phases/*/run-log.md`

## Guardrails

- Do not implement, test, or research the phase yourself unless the workflow explicitly changes your role.
- Do not prewrite prompts for later phases or later downstream steps.
- Downstream prompts should not repeat long workflow background or long file inventories when a smaller seed packet will do.
- Every downstream agent must return control to `master-developer` when done or blocked.
- Keep branch, commit, push, and PR decisions under `master-developer` ownership unless the workflow explicitly changes that rule.
- If the active phase is not ready for handoff, keep the state at `ready_for_master_developer` or `blocked` and explain why.

## Output Format

- `Readiness`: one short paragraph.
- `State updates`: bullets for any edits made to `workflow-state.yaml`, the active `phase.md`, or the active `run-log.md`.
- `Git status`: one short line about whether a git checkpoint decision is needed now.
- `Next agent`: the role to receive the handoff, or `blocked`.
- `Prompt`: the exact prompt for that next agent. If blocked, replace this with the blocker note that needs resolution.
