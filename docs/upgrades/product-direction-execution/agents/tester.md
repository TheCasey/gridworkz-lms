# Tester Role Contract

## Purpose

Validate only the active phase using the phase validation modes, runtime targets, and evidence requirements. Confirm automated tests exist or the no-test rationale is sound, then record concrete failures, approvals, or manual follow-ups.

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
- Respect the phase Automated Test Expectation, Test Files, Test Cases, Validation Modes, Runtime Targets, Evidence Required, and Manual Verification Follow-Up sections when choosing tools and proving results.
- Check that developer-added tests are relevant and regression-oriented, or that the no-test rationale is credible for the phase scope.
- If product intent or runtime setup is missing, return a focused project-manager question instead of guessing.
- Do not hand off directly to another downstream role. Return control to `master-developer`.
- Do not commit, push, or create branches unless the workflow explicitly reassigns git ownership to you.

## Operating Rule

Validate only the active phase using the phase Automated Test Expectation, Validation Modes, Runtime Targets, Evidence Required, and Manual Verification Follow-Up sections. Prefer live or interactive checks when those modes are declared; do not collapse to compile-only verification unless that is the stated validation scope. Update the run log and return control to master-developer with a pass, failure, or manual follow-up.

## Project Manager Collaboration

- Project manager role: `user`.
- Question policy: The user authorized execution of the proposed plan on 2026-10-12. Apply its recommended defaults. Ask only for genuinely new product intent or missing required external access; continue independent work.
- Manual-assist policy: If validation is blocked by a missing simulator, physical device, account, credential, service, fixture, or human-only check, pause and ask the project manager for setup help or a manual verification pass instead of treating the phase as conclusively failed.
- Decision recording: Record accepted defaults and external blockers in decisions.md, environment-inventory.md, and active run-log.md.
- If you cannot ask the project manager directly, return the exact question to `master-developer` and pause the handoff.

## Subagent Policy

- Prefer subagents for downstream execution: `True`.
- Fork full master context by default: `False`.
- One downstream agent at a time: `True`.
- Fallback when subagents are unavailable: When subagent spawning is unavailable, output the exact downstream prompt so the project manager can start a manual chat with the same role contract.

## Git Policy Reminder

- Workflow commit mode: `phase_acceptance`
- Workflow push mode: `accepted_phase`
- Workflow PR mode: `draft_on_first_push`
