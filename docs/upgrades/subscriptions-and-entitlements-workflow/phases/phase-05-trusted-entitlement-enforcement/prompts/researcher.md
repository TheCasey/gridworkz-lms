# Researcher Prompt

## Read First

- `docs/upgrades/subscriptions-and-entitlements-workflow/workflow-state.yaml`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-05-trusted-entitlement-enforcement/phase.md`
- `docs/upgrades/subscriptions-and-entitlements-workflow/phases/phase-05-trusted-entitlement-enforcement/run-log.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/upgrades/security-hardening.md`
- `docs/architecture.md`
- `firestore.rules`

## Your Task

Answer one bounded question: where should trusted entitlement writes and billing webhooks live in this Cloudflare Pages plus Firebase repo so clients cannot self-upgrade? Compare only the smallest viable options and recommend one concrete path.

## Constraints

- Stay inside Phase 5 only.
- Compare only the smallest viable trusted-backend options for this repo.
- End with one recommended authority path, not an open-ended option list.
- Do not start later phases.
- Follow the stated exit criteria instead of inventing broader scope.
- Keep notes in `../run-log.md` concise and concrete.

## Completion Checklist

- update `../run-log.md` with what you changed or validated
- record blockers explicitly if the phase cannot advance
- set `workflow-state.yaml` to `ready_for_developer` and hand off to `developer`
