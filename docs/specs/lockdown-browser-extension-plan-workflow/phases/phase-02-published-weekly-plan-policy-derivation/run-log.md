# Phase 2 Run Log

## Status Snapshot

- Phase: `phase-02-published-weekly-plan-policy-derivation`
- Current status: `complete`
- Current owner: `master-developer`
- Next downstream role: `none`
- Last updated: `2026-05-11`

## Master Developer Reviews

- 2026-05-11 review:
  - Confirmed Phase 1 is complete and Phase 2 is now the correct active phase.
  - Confirmed the repo already has live weekly-plan groundwork instead of a speculative Phase 2 starting point:
    - `weeklyPlans` exists in schema and Firestore rules
    - weekly plans can be published and are already consumed by the student portal through `useStudentPortalWeeklyPlan`
    - `weeklyPlanUtils.js` already carries published-week vocabulary, including `project_work`
  - Confirmed the current trusted lockdown contract still depends on a temporary Phase 1 migration source:
    - `functions/src/index.js` still loads device policy from `lockdownPolicies/{parentId}`
    - the trusted policy response still marks `source_policy.kind = lockdown_policy_poc_document`
  - Phase 2 should therefore focus on replacing that temporary source with published-weekly-plan derivation plus school-time or off-hours behavior, without redesigning the dashboard surface or migrating the MV3 runtime yet.
- 2026-05-11 post-developer review:
  - Reviewed the Phase 2 changes in `functions/src/index.js`, `src/constants/schema.js`, `src/utils/lockdownPolicyUtils.js`, `src/utils/weekUtils.js`, `src/utils/schoolSettingsUtils.js`, `src/utils/weeklyPlanUtils.js`, and `src/utils/planningCompatibilityUtils.js`.
  - Confirmed the trusted derivation source moved from the parent-owned PoC policy document to published-weekly-plan derivation:
    - trusted source marker now uses `published_weekly_plan_derived_policy_v1`
    - trusted device records and enrollment records now carry `student_id`
    - the backend resolves the current student-week plan from `weeklyPlans/{parentId}_{studentId}_{weekKey}`
    - active block selection is derived from `timerSessions.subject_id + block_index` matched against published weekly-plan blocks
  - Confirmed the intended three-state derivation shape is present in code:
    - `active_block`
    - `no_active_block`
    - `outside_school_time`
  - Confirmed off-hours windows now derive from `student.lockdown_schedule` and reuse `ResourceSchema` instead of inventing a second resource contract.
  - Re-ran command baselines on the current tree:
    - `node --check functions/src/index.js` passed on 2026-05-11
    - `npm run lint` passed on 2026-05-11
    - `npm run build` passed on 2026-05-11
  - No Phase 2 code-level blocker was identified in master review.
  - Important testing boundary:
    - multi-student pairing now requires an explicit backend `student_id` bind
    - the backend contract exists in Phase 2, but the parent-facing selector remains Phase 3 scope
    - tester should validate that requirement directly rather than expecting the current dashboard UI to cover it yet
## Developer Results

- 2026-05-11 implementation:
  - Replaced the trusted `readLockdownDevicePolicy` derivation in [functions/src/index.js](/Users/caseyburesh/caseyrepo/gridworkz-lms/functions/src/index.js) so the production policy path no longer reads `lockdownPolicies/{parentId}`.
  - Chose a student-bound derivation model:
    - trusted enrollment and device records now carry `student_id`
    - if the parent has exactly one active student, enrollment auto-binds implicitly
    - if the parent has multiple active students, Phase 2 now requires an explicit `student_id` bind rather than deriving a parent-wide blended policy
  - Made published weekly plans authoritative for device policy content:
    - the current week plan is resolved as `weeklyPlans/{parentId}_{studentId}_{weekKey}`
    - active block selection comes from matching `timerSessions.subject_id` plus `block_index` against published weekly-plan blocks
    - the trusted path does not fall back to raw subject queries when resolving live block resources
  - Added school-time and off-hours derivation support from the student record:
    - `student.lockdown_schedule.school_days`
    - `student.lockdown_schedule.school_day_start_time`
    - `student.lockdown_schedule.school_day_end_time`
    - `student.lockdown_schedule.off_hours_resource_windows[]`
  - Off-hours windows reuse `ResourceSchema` entries instead of inventing a second resource contract; resource metadata can now carry `lockdown_origin` or `youtube_channel_*` hints for device-facing derivation.
  - Updated the trusted source marker from the PoC document to `published_weekly_plan_derived_policy_v1` and added explicit derived context in the policy response.
  - Files changed:
    - [functions/src/index.js](/Users/caseyburesh/caseyrepo/gridworkz-lms/functions/src/index.js)
    - [src/constants/schema.js](/Users/caseyburesh/caseyrepo/gridworkz-lms/src/constants/schema.js)
    - [src/utils/lockdownPolicyUtils.js](/Users/caseyburesh/caseyrepo/gridworkz-lms/src/utils/lockdownPolicyUtils.js)
    - [src/utils/weekUtils.js](/Users/caseyburesh/caseyrepo/gridworkz-lms/src/utils/weekUtils.js)
    - [src/utils/schoolSettingsUtils.js](/Users/caseyburesh/caseyrepo/gridworkz-lms/src/utils/schoolSettingsUtils.js)
    - [src/utils/weeklyPlanUtils.js](/Users/caseyburesh/caseyrepo/gridworkz-lms/src/utils/weeklyPlanUtils.js)
    - [src/utils/planningCompatibilityUtils.js](/Users/caseyburesh/caseyrepo/gridworkz-lms/src/utils/planningCompatibilityUtils.js)
    - [docs/specs/lockdown-browser-extension-plan-workflow/phases/phase-02-published-weekly-plan-policy-derivation/run-log.md](/Users/caseyburesh/caseyrepo/gridworkz-lms/docs/specs/lockdown-browser-extension-plan-workflow/phases/phase-02-published-weekly-plan-policy-derivation/run-log.md)
  - Validation commands run:
    - `node --check functions/src/index.js`
    - `node --input-type=module -e "import './src/utils/weekUtils.js'; import './src/utils/schoolSettingsUtils.js'; import './src/utils/lockdownPolicyUtils.js'; import './src/utils/planningCompatibilityUtils.js'; import './src/utils/weeklyPlanUtils.js';"`
    - `npm run lint`
    - `npm run build`
    - `node --input-type=module <<'NODE' ... derivePublishedWeeklyPlanDevicePolicy ... NODE`
  - Validation results:
    - `npm run lint`: PASS
    - `npm run build`: PASS
  - Concrete derivation evidence from the direct Phase 2 helper fixture:
    - `active_block`
      - input shape: published weekly plan contains one `project_work` block, matching timer session exists, local time is inside `08:00-15:00` school hours
      - output:
        - `policy_state = active_block`
        - `policy.is_enabled = true`
        - `policy.allowed_origins = ["https://www.khanacademy.org"]`
        - `policy_context.active_block.category = project_work`
    - `no_active_block`
      - input shape: same published weekly plan, no matching timer session, local time still inside school hours
      - output:
        - `policy_state = no_active_block`
        - `policy.is_enabled = true`
        - `policy.allowed_origins = []`
        - `policy_context.active_block = null`
    - `outside_school_time`
      - input shape: same student and published weekly plan, local time moved into the configured off-hours window `18:00-20:00`
      - output:
        - `policy_state = outside_school_time`
        - `policy.is_enabled = true`
        - `policy.allowed_origins = ["https://www.desmos.com"]`
        - `policy_context.off_hours_window.id = evening-math`
        - `policy_context.active_block = null`
## Tester Results

- 2026-05-11 tester validation:
  - Overall result: `PASS`
  - Compile and build health:
    - `node --check functions/src/index.js`: `PASS`
    - `npm run lint`: `PASS`
    - `npm run build`: `PASS`
  - Exact commands used:
    - `node --check functions/src/index.js`
    - `npm run lint`
    - `npm run build`
    - `npx firebase emulators:start --config firebase.phase2-test.json --only auth,firestore,functions --project demo-gridworkz-lms`
    - `node --input-type=module < /tmp/gridworkz-phase2-lockdown-validation.mjs`
  - Runtime evidence source:
    - Used local Firebase Auth, Firestore, and Functions emulators because the current Phase 2 code is present in the working tree and can be exercised directly without needing a separate live deploy.
    - Seeded disposable fixture parents, students, a published `weeklyPlans/{parentId}_{studentId}_{weekKey}` document, a matching `timerSessions` record, a conflicting raw `subjects/{subjectId}` record, and a conflicting PoC `lockdownPolicies/{parentId}` record.
  - Student-binding validation:
    - Single-active-student parent without explicit `student_id`: `HTTP 200`
      - `result.contract = trusted_lockdown_enrollment_v1`
      - `result.student_id = student-single`
      - `result.source_policy_kind = published_weekly_plan_derived_policy_v1`
    - Multi-student parent without explicit `student_id`: `HTTP 400`
      - `error.status = FAILED_PRECONDITION`
      - `error.message = Trusted lockdown pairing now requires a student binding when multiple active students exist.`
    - Multi-student parent with explicit `student_id = student-multi-a`: `HTTP 200`
      - `result.contract = trusted_lockdown_enrollment_v1`
      - `result.student_id = student-multi-a`
      - `result.source_policy_kind = published_weekly_plan_derived_policy_v1`
  - Enrollment exchange evidence:
    - `POST lockdownExchangeEnrollment`: `HTTP 200`
      - `contract = trusted_lockdown_enrollment_v1`
      - `student_id = student-single`
      - `policy_read_contract = trusted_lockdown_device_policy_v1`
      - `initial_policy.policy_state = active_block`
      - `initial_policy.source_policy.kind = published_weekly_plan_derived_policy_v1`
  - Trusted `readLockdownDevicePolicy` derivation evidence:
    - `active_block`: `HTTP 200`
      - `source_policy.kind = published_weekly_plan_derived_policy_v1`
      - `policy_state = active_block`
      - `policy.allowed_origins = ["https://plan-active.example.com"]`
      - `policy_context.active_block.id = block-project-work`
      - `policy_context.active_block.category = project_work`
      - `policy_context.active_block.legacy_subject_id = subject-conflict`
      - `policy_context.weekly_plan_id = <parentId>_student-single_2026-05-11`
    - `no_active_block`: `HTTP 200`
      - Trigger: deleted the matching `timerSessions/timer-active` fixture while leaving the student inside school time
      - `source_policy.kind = published_weekly_plan_derived_policy_v1`
      - `policy_state = no_active_block`
      - `policy.allowed_origins = []`
      - `policy_context.active_block = null`
    - `outside_school_time`: `HTTP 200`
      - Trigger: updated `student.lockdown_schedule` so the current local time was outside school hours but inside the fixture off-hours window
      - `source_policy.kind = published_weekly_plan_derived_policy_v1`
      - `policy_state = outside_school_time`
      - `policy.allowed_origins = ["https://offhours.example.com"]`
      - `policy_context.off_hours_window.id = evening-window`
      - `policy_context.active_block = null`
  - Production-source isolation evidence:
    - Seeded a conflicting PoC `lockdownPolicies/{parentId}` document with `allowed_origins = ["https://poc-conflict.example.com"]`.
    - The trusted `active_block` and `outside_school_time` responses did not include `https://poc-conflict.example.com`, which shows the production read path no longer depends on `lockdownPolicies/{parentId}` as its source.
    - Seeded a conflicting raw `subjects/{subjectId}` fixture with `resources = ["https://raw-subject-conflict.example.com/resource"]`.
    - The trusted `active_block` response still returned only `["https://plan-active.example.com"]`, which shows the trusted path does not fall back to raw subject-record resources when a published weekly plan exists.
  - Required validation outcome summary:
    - `active_block` derivation: `PASS`
    - `no_active_block` derivation: `PASS`
    - `outside_school_time` derivation: `PASS`
    - trusted source no longer depends on `lockdownPolicies/{parentId}`: `PASS`
    - student binding enforcement and implicit single-student bind: `PASS`
    - trusted response shape from `readLockdownDevicePolicy`: `PASS`
    - no fallback to raw subject reads when a published weekly plan exists: `PASS`
  - Manual-only gaps:
    - None. The required runtime checks were exercised directly against the local callable and HTTP functions with disposable fixtures.
  - Remaining blockers:
    - None for Phase 2 validation.
    - Tooling note only: the repo-level `firebase.json` does not currently declare an Auth emulator, so this test run used a temporary `firebase.phase2-test.json` config to stand up the required local auth fixture path. That did not affect the Phase 2 product behavior under test.
  - Correct next role:
    - `master-developer`

## Next Handoff

- Return control to `master-developer`.
- Phase 2 validation passed on the current tree with local runtime evidence:
  - the trusted device-policy path derives `active_block`, `no_active_block`, and `outside_school_time` correctly
  - the trusted read path ignores conflicting `lockdownPolicies/{parentId}` data
  - multi-student pairing is rejected without `student_id` and succeeds with an explicit backend bind
  - a published weekly plan stays authoritative even when a conflicting raw subject record exists

## Open Questions Or Blockers

- Phase 3 still needs to surface explicit parent UX for choosing the `student_id` binding when an account has multiple active students. Phase 2 adds the backend contract and enforcement, but it does not build that selector UI.

## Completion Summary

- Phase 2 is implemented and validated at the trusted backend layer: the device-policy contract derives from student-bound published weekly plans, timer-selected active blocks, and student schedule or off-hours windows instead of the parent-owned PoC policy document. The correct next role is `master-developer`.
