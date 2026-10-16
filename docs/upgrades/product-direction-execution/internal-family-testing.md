# Internal Family Testing

Status: live for the selected household on 2026-10-16. This is the nonpayment family-testing release; Stripe/payment acceptance and broader launch observation remain later work. See the [release record](internal-testing-release-2026-10-16.md).

## Where to start

Use [the parent dashboard](https://dashboard.own-path.com/login) with your usual account. Refresh existing browser tabs to load the compatible client. Existing student portal links and PINs stay the same; open them from Students in the dashboard. Only the owner-selected existing household is activated. Its current plan access is preserved without a purchase.

## Suggested first pass

1. **Check existing records.** Confirm your students, curriculum, old reports and routine checklists are present. Settings should retain the household timezone and week-reset settings. Checkout stays unavailable.
2. **Set up one child’s current Weekly Plan.** Save a draft, reload it, save a Default Week, then publish the current week. Draft/default changes stay private until publishing. Review any existing-work reconciliation prompt so prior completion/evidence stays linked to the intended work. Publishing only a future week does not populate the current student week.
3. **Open the child’s portal on another device.** Confirm only the published work appears. Complete an untimed block, then start/pause/resume a timed block. Timed completion requires the server’s actual elapsed time. Reload or use a second device to check persistence.
4. **Try parent corrections.** Open block details, mark complete or undo with a reason, and confirm the student view updates. Original student responses and recorded time remain visible.
5. **Check reports and print.** File a report, review its totals/evidence, make a correction and compare the original with its amendment. Print or save Letter/A4 output and inspect a long evidence page on your printer.
6. **Try Daily Routines and avatars.** Save a checklist for the selected child. Complete all populated routine periods for the day. Points award once per child/local day, using the saved setting; disabled points stay disabled. Unlock/equip an affordable built-in cosmetic and reload. School blocks do not award routine points.
7. **Check Household History.** Confirm prior chore/allowance/reward records remain available. New broad setup is suspended; existing obligations retain their permitted settlement actions.

Use a block/checklist you intend to change when testing on real family data. Disposable release QA runs separately and never fills your children’s records with test work.

## If something fails

Record the page, student, approximate time, action and exact visible error. Avoid including PINs or private student responses in shared screenshots. Refresh once if a tab was open before deployment. Do not clear published work, historical reports or account data to work around a failure.

The release record tracks deployed commits, backend/rules/index versions, owner-only activation and smoke-test results. Stripe purchase/portal creation remains undeployed and the existing billing webhook is unchanged. No payment is necessary for the owner’s preserved access.
