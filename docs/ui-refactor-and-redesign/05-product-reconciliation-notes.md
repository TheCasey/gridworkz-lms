# OwnPath — Product Reconciliation Notes

Last updated: 2026-07-03

This note records decisions made while reconciling the redesign package with the broader repository docs. It exists so future design/prototype sessions do not silently re-open the same conflicts.

## Decisions

### Per-student subjects win for the redesign
The redesign package keeps subjects per-student. This intentionally differs from canonical docs that describe a future shared `CurriculumTemplate` plus per-student `Assignment` model.

Reason: the intended product direction for the redesign is cleaner parent mental models and fewer shared-state edge cases. If two students both take Chess, the UI treats them as two student-owned Chess subjects. Copy/duplicate can handle similar setup later.

### Keep Weekly Blocking as the page name
The page remains `Weekly Blocking` for now. The prototype can keep the default week, modified week, and save/publish mental model.

Do not rename the page to Weekly Plans or Weekly Templates during this prototype pass unless explicitly requested later.

### Existing chore prototypes are the accepted baseline
The existing Daily Routines, Weekly Chores, Allowance, and Rewards prototypes are mostly complete and acceptable as baseline designs.

Monthly Chores should be built next by mirroring the Weekly Chores interaction model with monthly cadence, monthly quota/progress language, and monthly chore pool status.

### Daily routines are per-student
Daily routines are not household pool chores. They are per-student routine templates grouped by morning, afternoon, and evening.

### Weekly and monthly chores are household pools
Weekly and monthly chores are shared pool items that all eligible students can work from. Students claim chores from the pool; claimed or completed chores are unavailable to siblings according to the period/cooldown rules.

### Student portal access uses PIN or password
Student portal access should require either:
- a parent-set 4-6 digit PIN
- a parent-set password

Parents choose which credential type is used for each child.

### Entitlement and route details are not prototype blockers
Locked states, Free/Core/Lockdown packaging details, and exact dashboard route boundaries should not block the current visual prototype pass unless the current surface being designed is Account, Billing, Settings, or plan-gated UX.

For standalone HTML files, separate prototype pages are acceptable even if future implementation may group them inside one dashboard module.

## Open Later

- Reports details should be resolved during the Reports prototype pass.
- Student portal details should be resolved when the parent portal redesign package is stable enough to move into student-facing views.
