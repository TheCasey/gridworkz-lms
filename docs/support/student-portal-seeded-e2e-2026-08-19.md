# Student Portal Seeded E2E — 2026-08-19

## Scope

Verified the redesigned `/student/:slug` route through a disposable local Firebase environment from browser interaction to Auth, Firestore, trusted Functions, persisted records, parent review, and student response rendering.

The dedicated mobile and accessibility pass was intentionally left for the user after this seeded functional pass.

## Environment

- Firebase Auth, Firestore, and Functions emulators on the documented ports in `firebase.json`
- Vite development server with `VITE_USE_FIREBASE_EMULATORS=true`
- Disposable two-student Lockdown fixture from `seed-private-beta-smoke-fixtures.mjs`
- PIN-protected students `Ada Smoke` (`1111`) and `Max Smoke` (`2222`)
- Browser automation through `agent-browser`

No staging or production data was written.

## Verified Flow

| Boundary | Result | Evidence |
| --- | --- | --- |
| PIN entry | Pass | Both seeded students unlocked with their own 4-digit PIN. |
| Student privacy | Pass | Max rendered his own 20-point wallet, routine state, school subject, and no Ada reward request. |
| Weekly school launcher | Pass | Ada's published Smoke Math subject exposed two numbered weekly blocks and expanded the selected block in place. |
| Timer lifecycle | Pass | Start and pause updated the browser and persisted `timerSessions`; reset removed the remote record and restored block availability. |
| School submission | Pass | Required custom response and 150+ character summary persisted; weekly progress advanced to 2/2 and the modal closed after success. |
| Daily routine | Pass | Max selected all three real checklist items and the trusted completion returned the template as completed. |
| Weekly chore | Pass | Ada submitted the claimed chore with a proof note; the trusted completion appeared in the parent pending-review queue. |
| Parent chore review | Pass | Approval cleared the queue, increased Ada's wallet from 75 to 85, and recalculated the current allowance period to one weekly block, two total blocks, 40%, and $4 earned. |
| Reward cancellation/refund | Pass | Canceling the seeded request restored Ada's wallet from 75 to 100 and reward stock from two to three. |
| Reward request/review | Pass | Ada requested the 25-point reward, the parent approved and fulfilled it, and Ada then saw a fulfilled history item with an 85-point balance after the chore award. |
| Entitlement gating | Pass | Switching the disposable household to Free kept Daily Routine available while hiding Rewards, point balance, and Weekly/Monthly chore-pool controls. Restoring Lockdown restored paid surfaces. |
| Allowance placeholder | Pass | Student Allowance renders the approved Coming Soon state without exposing parent ledger controls. |
| Avatar preview | Pass | Base, outfit, and accessory placeholder selectors render against the approved stable asset IDs without performing untrusted persistence. |

## Defects Found And Fixed

1. Missing timer documents caused a Firestore denied-listener loop because timer rules dereferenced null `resource.data`. Missing gets/deletes now resolve safely while existing timer records retain assignment checks.
2. A successful school submission could be shown as failed when post-write timer cleanup failed. Timer cleanup is now non-authoritative after the committed submission.
3. Sanitized trusted reward catalog responses omit client-only `can_redeem` flags, leaving all redemption buttons disabled. The client view model now derives eligibility from trusted wallet, point cost, stock, and unlock facts.
4. Free students saw a misleading zero-point balance and empty paid chore tabs. The shell and chore workspace now reflect the trusted entitlement response.
5. The repository lacked a runnable callable emulator harness. Auth, Firestore, and Functions ports plus a development-only client emulator switch are now configured.

## Automated Evidence

- All chore/reward contract scripts in `docs/support/chores-and-rewards-runbook.md` passed.
- Seeded callable smoke passed for student chore state, operator session, parent search, entitlement detail, and Lockdown device list.
- `npm run lint`, `npm run build`, and `git diff --check` passed after the final emulator bootstrap refactor.

## Approved Follow-On Decisions

- Persist avatar selection as approved stable catalog IDs.
- Supply final avatar art through secure storage-backed uploads and a controlled catalog.
- Build a full PWA with manifest/icons, standalone behavior, update handling, a bounded offline-data policy, and installation verification.

The current repository does not yet contain a web app manifest, service worker, install icon set, or offline strategy. Those are implementation work, not part of this E2E pass.
