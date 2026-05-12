# Start Master Developer Chat

Use this prompt to start or resume the `master-developer` chat for this workflow.

## Read First

- `workflow-plan.md`
- `workflow-state.yaml`
- `agents/master-developer.md`
- `AGENTS.md`
- `docs/roadmap.md`
- `docs/architecture.md`
- `docs/specs/lockdown-browser-extension-plan.md`
- `docs/specs/weekly-planning-and-review-flow.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/archive/lockdown-browser-extension-poc/runs/phase-04.md`
- `firestore.rules`
- `src/utils/lockdownPolicyUtils.js`
- `extensions/chrome-lockdown-poc/policy.js`
- `phases/phase-01-trusted-policy-contract-and-pairing/phase.md`
- `phases/phase-01-trusted-policy-contract-and-pairing/run-log.md`

If `workflow-state.yaml` points to a later phase or a different next role, follow the live state instead of assuming Phase 1 is still current.

## Your Task

- Read the live workflow state and identify the active phase plus the next downstream role.
- Confirm the active phase still matches the source plan and current repo reality.
- Check for immediate blockers, missing prerequisites, or stale assumptions before dispatching work.
- Tighten the active phase scope if needed, but keep it consistent with the source plan.
- Write exactly one prompt for the next downstream agent.
- Update `workflow-state.yaml` and the active `run-log.md` so the workflow can pause and resume cleanly.

## Guardrails

- Do not implement, test, or research the phase yourself unless the workflow explicitly changes your role.
- Do not prewrite prompts for later phases or later downstream steps.
- Every downstream agent must return control to `master-developer` when done or blocked.
- If the active phase is not ready for handoff, keep the state at `ready_for_master_developer` or `blocked` and explain why.

## Output Format

- `Readiness`: one short paragraph.
- `State updates`: bullets for any edits made to `workflow-state.yaml` or the active `run-log.md`.
- `Next agent`: the role to receive the handoff, or `blocked`.
- `Prompt`: the exact prompt for that next agent. If blocked, replace this with the blocker note that needs resolution.
