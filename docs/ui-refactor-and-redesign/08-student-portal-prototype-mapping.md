# Student Portal Prototype Mapping

Last updated: 2026-08-19

The review prototype is `ownpath_student_portal.html`. It is intentionally a UI contract, not a second application or data model. Mock values demonstrate states that the current portal already receives from real records and trusted operations.

| Prototype surface | Existing application source | Existing behavior to preserve | Implementation note |
| --- | --- | --- | --- |
| PIN entry | `src/pages/StudentPortal.jsx`, `students.access_pin` | 4–6 digit numeric PIN, attempt limiting, student slug lookup | Prototype uses `2468` only for local review. Production continues to compare against the real student PIN. |
| Published school plan | `useStudentPortalWeeklyPlan`, `buildStudentWorkLauncherContract` | Published weekly plan first, compatible subject fallback, completion state | Day grouping in the prototype is presentation-only until the weekly plan contract persists a day assignment. |
| Active school block | `StudentPortal.jsx`, `timerUtils.js`, `workLauncherUtils.js` | Start, pause, resume, reset, single-active-timer rules, resources and completion | The prototype maps the current timer and submission controls into a focused active-block panel. |
| Block response | `StudentPortal.jsx`, subject/weekly-plan response fields | Written response, custom fields, resource links, existing submission flow | Photo upload is a visual placeholder because the evidence file workflow is not implemented yet. |
| Daily routines | `useStudentChores`, `StudentChoresWorkspace` | Real checklist items and trusted `completeTrustedRoutine` submission | Individual taps are local selection state until the full routine is submitted, matching current trusted behavior. |
| Weekly/monthly chores | `useStudentChores`, `StudentChoresWorkspace` | Trusted claim, proof note, completion, cooldown, quota and review status | Prototype does not create client-side writes or bypass trusted callables. |
| Reward store | `useStudentChores`, `StudentRewardStore` | Wallet balance, trusted redemption request/cancel, request history and built-in unlocks | Reward prices and stock come from the existing trusted response in production. |
| Avatar builder | New prototype asset manifest | No persistence contract exists yet | Add parent-owned allowed asset IDs and a trusted/student-safe selection update before production wiring. Never accept arbitrary asset URLs from the student client. |
| Mobile saved link | Existing `/student/:slug` route | Browser bookmark/home-screen shortcut and PIN continuation | The responsive route works as a saved web link. A true installable PWA still needs a web manifest, icons, display mode, caching policy, and install verification. |

## Avatar data recommendation

Persist only stable IDs such as `avatar-01`, `outfit-02`, and `accessory-01`. Resolve those IDs through a parent-controlled catalog or bundled manifest. This keeps student writes narrow and avoids storing untrusted URLs. The layered art contract lives in `student-avatar-assets/README.md`.

## Responsive contract

- Desktop keeps the parent-prototype geometry: sticky top bar, compact top tabs, dense content, and a fixed contextual rail.
- Tablet narrows the rail and reward grids without removing actions.
- Mobile moves primary navigation to a four-item bottom bar, stacks contextual rail content below the workspace, keeps touch controls at practical sizes, and avoids horizontal page overflow.
- The PIN screen uses a numeric touch keypad and does not require a desktop keyboard.
