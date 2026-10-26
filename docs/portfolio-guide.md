# Testing and support evidence

This guide maps implemented repository artifacts to reviewable examples. It describes where checks live, not a claim that all checks were run during a documentation edit.

| Review area | Repository evidence | Scope |
| --- | --- | --- |
| Regression checks | [Student timer assertions](../scripts/check-student-timer-sessions.mjs) | Timer identity and stale-session behavior |
| Reporting correctness | [Print checks](../scripts/check-report-print.mjs), [reporting safety checks](../scripts/check-reporting-safety.mjs) | Report presentation, escaping, and selected reporting invariants |
| Access and persistence | [Runtime test strategy](upgrades/product-direction-execution/testing.md) | Rules and callables against isolated Firebase emulators |
| Browser flows | [Playwright specifications](../tests/product-direction) | Planning, routines, reports, corrections, and billing scenarios |
| Repeatable validation | [CI workflow](../.github/workflows/ci.yml) | Install, lint, helper checks, build, emulator/browser job, and report artifacts |
| Release handoff | [Internal-testing release record](upgrades/product-direction-execution/internal-testing-release-2026-10-16.md) | Recorded release evidence, gates, and limitations |

## Support investigation example

For a report that a student's work is missing after refresh:

1. Record the commit/deployment, browser, parent or student route, affected week, and expected versus actual behavior.
2. Reproduce with synthetic records in the isolated emulator project described in the test strategy.
3. Check authentication state, portal access policy, network errors, and whether the household uses the adopted or compatibility flow.
4. Compare the published plan and canonical completion state with the rendered report. Do not infer identity from matching titles or array positions.
5. Attach redacted steps, relevant errors, and the smallest failing fixture to a bug report; retest after a fix.

Keep student records, portal links, PINs, tokens, and billing details out of public issues. Run mutations against isolated fixtures rather than family records.

## Interpretation limits

Helper checks cannot establish backend authorization or cloud index readiness. Emulator tests cannot establish production deployment health. Existing release records are dated evidence; use current CI results and scoped retesting when assessing a new commit.
