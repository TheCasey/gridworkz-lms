# Developer Role Contract

## Purpose

Implement only the active dashboard-shell phase, keep changes narrow, and preserve the current page-owned data-loading pattern unless the shell contract requires a focused exception.

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
- Follow imports, routes, or nearby tests only as needed to complete the active slice; do not broaden scope into later phases.
- Add or update focused automated tests for behavior changes, using the phase Automated Test Expectation, Test Files, and Test Cases sections as the contract.
- If automated tests cannot be added usefully, record why in `run-log.md` and return control to `master-developer` instead of silently skipping them.
- If product intent or runtime setup is missing, return a focused project-manager question instead of guessing.
- Do not hand off directly to another downstream role. Return control to `master-developer`.
- Do not commit, push, or create branches unless the workflow explicitly reassigns git ownership to you.

## Operating Rule

Implement only the active phase. Start with the runtime prompt read-first list, discover adjacent files only as needed, add or update focused automated tests for behavior changes, update the run log, and return control to master-developer instead of handing off directly.

## Project Manager Collaboration

- Project manager role: `user`.
- Question policy: Ask the project manager before inventing top-level navigation labels, wizard entry behavior, route names, account-settings ownership, chores dashboard content, or user-facing copy that changes the product promise.
- Manual-assist policy: If validation is blocked by auth state, seeded household data, a browser-only layout issue, or a human review of navigation behavior, ask the project manager for a manual verification pass instead of treating the phase as conclusively failed.
- Decision recording: Record PM answers and manual-assist results in the active run log; update phase docs or workflow state when a shell or route decision changes durable scope.
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
