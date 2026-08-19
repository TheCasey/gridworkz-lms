# Student Portal Prototype Mapping

Last updated: 2026-08-19

The approved/frozen prototype is `ownpath_student_portal.html`. It is a UI contract, not a second application or data model. The first live route implementation now maps those states to real records and trusted operations.

| Prototype surface | Existing application source | Existing behavior to preserve | Implementation note |
| --- | --- | --- | --- |
| PIN entry | `src/pages/StudentPortal.jsx`, `students.access_pin` | 4–6 digit numeric PIN, attempt limiting, student slug lookup | Prototype uses `2468` only for local review. Production continues to compare against the real student PIN. |
| Published school plan | `useStudentPortalWeeklyPlan`, `buildStudentWorkLauncherContract` | Published weekly plan first, compatible subject fallback, completion state | Prototype groups the current week by subject and exposes its numbered blocks. It deliberately does not create day assignments or daily quotas. |
| Selected school block | `StudentPortal.jsx`, `timerUtils.js`, `workLauncherUtils.js` | Student-chosen block, start, pause, resume, reset, single-active-timer rules, resources and completion | Tapping a subject expands its weekly blocks; tapping a block expands that same subject row further and moves the shared instruction/resource/timer controls into it. |
| Block response | `StudentPortal.jsx`, subject/weekly-plan response fields | Written response, custom fields, resource links, existing submission flow | Photo upload is a visual placeholder because the evidence file workflow is not implemented yet. |
| Daily routines | `useStudentChores`, `StudentChoresWorkspaceV2` | Real checklist items and trusted `completeTrustedRoutine` submission | Individual taps are local selection state until the full routine is submitted, matching current trusted behavior. |
| Weekly/monthly chores | `useStudentChores`, `StudentChoresWorkspaceV2` | Trusted claim, proof note, completion, cooldown, quota and review status | The live UI does not create direct client-side writes or bypass trusted callables. |
| Allowance | Current parent allowance records; no student allowance surface yet | No student write behavior is assumed | Prototype presents a separate Coming Soon workspace until base earning, bounty, adjustment, and payout details are finalized. |
| Reward store | `useStudentChores`, `StudentRewardStoreV2` | Wallet balance, trusted redemption request/cancel, request history and built-in unlocks | Reward prices and stock come from the existing trusted response in production. |
| Avatar builder | `StudentAvatarWorkspace`, prototype asset manifest | Stable-ID persistence is approved but not implemented | The live route provides a CSS-backed preview. Final art will use secure storage-backed uploads plus a controlled catalog; the student record will persist only approved asset IDs through a trusted/student-safe update. |
| Mobile/PWA entry | Existing `/student/:slug` route | Browser shortcut and PIN continuation work today | A full installable PWA is approved. It still needs a web manifest, complete icon set, standalone display behavior, update handling, bounded offline policy, and install verification. |

## Avatar data recommendation

Persist only stable IDs such as `avatar-01`, `outfit-02`, and `accessory-01`. Resolve those IDs through a controlled catalog whose approved files are uploaded to secured storage. This keeps student writes narrow and avoids storing untrusted URLs. The layered art contract lives in `student-avatar-assets/README.md`.

## Responsive contract

- Desktop keeps the parent-prototype geometry: sticky top bar, compact top tabs, dense content, and a fixed contextual rail.
- Tablet narrows the rail and reward grids without removing actions.
- Mobile moves primary navigation to a five-item bottom bar, stacks contextual rail content below the workspace, keeps touch controls at practical sizes, and avoids horizontal page overflow.
- The PIN screen uses a numeric touch keypad and does not require a desktop keyboard.
