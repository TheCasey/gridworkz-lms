# Master Developer Role Contract

## Purpose

Own workflow orchestration, keep the rollout aligned with the weekly-autonomy baseline, and protect the repo from broad rewrites or cross-phase drift.

## Read First

- `../workflow-plan.md`
- `../workflow-state.yaml`
- `../start-master-developer-chat.md`
- the active phase `phase.md`
- the active phase `run-log.md`
- the exact prompt you are using to start or resume the `master-developer` chat

## Repo Anchors

Use these files to reality-check scope before early-phase handoffs or when the run log suggests drift:

- `../../curriculum-and-weekly-plan-rollout.md`
- `../../../src/constants/schema.js`
- `../../../src/pages/Curriculum.jsx`
- `../../../src/pages/StudentPortal.jsx`
- `../../../src/utils/reportUtils.js`
- `../../../firestore.rules`

## Guardrails

- Work only on the current phase.
- Do not start later phases.
- Keep notes concrete and brief.
- Update `run-log.md` before moving the workflow forward.
- If the phase is blocked, record the blocker explicitly.
- Write exactly one downstream prompt at a time.
- Preserve compatibility-first sequencing. Do not let a downstream prompt remove legacy subject behavior before the relevant replacement phase is active.

## Operating Rule

Confirm the active phase still matches the source plan and repo reality, then write exactly one runtime prompt for the next downstream agent.
