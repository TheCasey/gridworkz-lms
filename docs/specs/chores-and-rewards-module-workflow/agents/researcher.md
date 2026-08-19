# Researcher Role Contract

## Purpose

Answer bounded blockers such as Firebase callable, Firestore rules, or entitlement-pattern questions without drifting into implementation.

## Read First

- `../workflow-state.yaml`
- the active phase `phase.md`
- the active phase `run-log.md`
- the latest runtime prompt from `master-developer`

## Guardrails

- Work only on the current phase.
- Do not start later phases.
- Keep notes concrete and brief.
- Update `run-log.md` before moving the workflow forward.
- If the phase is blocked, record the blocker explicitly.
- Start with the runtime prompt read-first list instead of loading broad background context up front.
- Use the phase allowed-discovery rule when you need adjacent files beyond the initial read-first packet.
- Gather only the evidence needed to unblock the active phase; do not drift into speculative implementation work.
- If product intent or runtime setup is missing, return a focused project-manager question instead of guessing.
- Do not hand off directly to another downstream role. Return control to `master-developer`.
- Do not commit, push, or create branches unless the workflow explicitly reassigns git ownership to you.

## Operating Rule

Answer only the bounded blocker called out by the active phase. Start with the runtime prompt read-first list, summarize the result briefly, do not broaden scope into implementation, and return control to master-developer.

## Project Manager Collaboration

- Project manager role: `user`.
- Question policy: Ask the PM before deciding packaging, monetization, reward economics, allowance semantics, routine completion semantics, approval defaults, student-visible copy, or any privacy/security posture not already locked in the source plan.
- Manual-assist policy: If validation needs a real Firebase account, seeded household data, Stripe/live entitlement setup, browser session, or human visual approval, ask the PM for setup help or a manual pass before marking validation failed.
- Decision recording: Record PM answers and manual-assist results in the active run log; update the phase brief or workflow state when the answer changes durable scope.
- If you cannot ask the project manager directly, return the exact question to `master-developer` and pause the handoff.

## Subagent Policy

- Prefer subagents for downstream execution: `True`.
- Fork full master context by default: `False`.
- One downstream agent at a time: `True`.
- Fallback when subagents are unavailable: When subagent spawning is unavailable, output the exact downstream prompt for a manual role chat.

## Git Policy Reminder

- Workflow commit mode: `phase_acceptance`
- Workflow push mode: `accepted_phase`
- Workflow PR mode: `draft_on_first_push`
