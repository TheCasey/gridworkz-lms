# Product Direction Working Notes — September 2026

Status: Exploratory working note. Nothing in this document is committed implementation scope yet.

## Short Version

Refocus Own Path around two primary jobs:

1. school planning and student work
2. simple daily routines with lightweight rewards

Keep the implemented weekly chores, monthly chores, allowance, bounty-style work, and broader reward machinery in the codebase, but table those product surfaces for now. Do not delete historical data or close off a future return to those features.

The next likely cleanup areas are:

- simplify Daily Routines and connect them cleanly to points, avatars, and cosmetic rewards
- clarify the difference between saving a draft week, saving a reusable default week, and publishing the current week
- restore convenient in-place parent controls for marking work complete or undoing completion
- hide timer controls entirely on blocks that do not require a timer
- simplify reports and verify the printed report layout
- simplify subscriptions around Free, a `$5/month` unlimited school plan, and a later Lockdown tier

## 1. Make Daily Routines The Household Focus

### Direction

- Reframe the current Chores area around `Daily Routines` rather than a full household chore and allowance system.
- Keep Morning, Afternoon, and Evening routines as the primary structure.
- Keep a lightweight reward loop tied to routine completion.
- Preserve avatar-based and cosmetic rewards where they make the routine experience more engaging.

### Table For Later

- weekly chore pools
- monthly chore pools
- allowance calculations and payment tracking
- bounty-style chores
- the broader configurable reward economy, unless a small piece is still useful for routine rewards

### Important Implementation Boundary

Treat this as a product-surface rollback, not a destructive data-model rollback:

- hide or de-emphasize the tabled routes and controls
- stop expanding those features for now
- preserve existing collections, trusted operations, entitlement keys, and household history
- keep compatibility reads so existing records are not lost
- revisit deletion or schema consolidation only if the narrower product direction becomes permanent

### Decisions To Make Later

- Should the dashboard label be `Daily Routines`, `Routines`, or something broader?
- Does completing the full day award points once, or can individual routine periods award points?
- Are rewards limited to avatar/cosmetic unlocks, or can parents still add a small custom reward catalog?
- Should streaks matter, or should the first version avoid pressure-heavy gamification?

## 2. Clarify Weekly Saving And Publishing

### Current Problem

The Weekly Blocking page mixes several different intentions. It is not obvious whether an action changes only this week, saves a reusable default, or makes work visible to the student. Action placement also makes the workflow harder to understand without scrolling.

### Recommended Mental Model

Use three clearly separated actions:

- `Save Draft` — save edits to this specific week without changing what the student currently sees
- `Save as Default Week` — update the reusable starting structure for future weeks
- `Publish This Week` — make this exact week the active student plan

### UX Ideas To Explore

- Put the week status and primary action in a persistent page header or sticky action bar.
- Keep `Publish This Week` visually primary and close to the current draft/published status.
- Treat `Save as Default Week` as a secondary action with explanatory copy because it affects future planning.
- Show a concise confirmation describing exactly what each action changes.
- Show whether the current draft differs from both the published week and the saved default.
- Consider renaming `Weekly Blocking` to `Weekly Plan` or `Plan the Week` if that better matches the parent’s mental model.

### Product Question

Decide whether publishing should save the draft automatically, require an explicit review step, or simply publish the current on-screen state. Avoid adding more buttons until that sequence is settled.

## 3. Restore In-Place Parent Completion Corrections

### Direction

Keep the existing completion controls on the Students page, but add a more contextual place for parents to correct student work without navigating away from what they are reviewing.

Potential locations:

- the current weekly-plan view
- a subject’s expanded weekly block list
- the report detail view
- a compact recent-activity or block-detail drawer shared by those surfaces

### Minimum Actions

- mark an incomplete block complete
- undo a completed block
- show who made the correction and when
- update progress and reports consistently

### Guardrail

Parent corrections should be explicit override records or auditable correction events, not invisible destructive mutations. Reports should be able to distinguish student-submitted completion from a parent correction.

### Decisions To Make Later

- Can a parent edit the completion date, written response, duration, or only completion status?
- Should undo restore the block to the active student week immediately?
- What happens when a correction is made after a weekly report has been saved or archived?

## 4. Only Show Timers When A Block Requires One

### Direction

- If a block requires a timer, show the timer and require it before completion.
- If a block does not require a timer, do not show an inactive timer panel by default.
- Give non-timed blocks a direct, clear completion action.

This supports both kinds of work:

- `time_boxed`: spend a required amount of time on the block
- `task_complete`: work until the assignment is finished

### First-Pass Recommendation

Use a simple binary choice first: `Timer required` or `No timer`. Avoid a third “optional timer” mode unless there is a real household use case for it.

## 5. Simplify And Verify Reports

### Direction

- Reduce the amount of competing information on the main Reports page.
- Make the report hierarchy clearer: student and week, assigned work, completed work, parent corrections, notes, then evidence/export.
- Review the current print output with real household data.
- Decide what belongs in the on-screen management view versus the official printed record.

### Print Review Checklist

- readable student, week, school-year, and quarter headings
- clear assigned-versus-completed totals
- understandable per-subject or per-assignment summaries
- incomplete work represented intentionally rather than omitted
- parent corrections and notes shown clearly
- sensible page breaks and no clipped content
- optional evidence references without overwhelming the summary

### Dependency

The report cleanup should follow, or at least coordinate with, the parent-correction contract so printed reports do not silently rewrite history.

## 6. Simplify The Subscription Model

### Tentative Plan Shape

#### Free

- Include the complete schoolwork experience.
- Include the fully developed Daily Routines experience rather than treating routines as a stripped-down preview.
- Limit the number of students.
- Limit the number of active curriculum records.
- Keep the exact student and curriculum limits open until the intended household fit is reviewed.

#### Core — Target `$5/month`

- Include the same schoolwork and Daily Routines capabilities as Free.
- Remove the practical student and curriculum limits.
- Sell scale and convenience, not access to basic routine functionality.
- Avoid using the tabled weekly/monthly chore and allowance features as the reason to upgrade.

#### Lockdown — Tentative `$10–15/month`

- Build on the unlimited Core plan.
- Add the polished Lockdown experience once it is ready for dependable paid use.
- Keep the exact price open until the extension, device controls, onboarding, recovery, and support burden are better understood.
- Continue treating Lockdown as `coming soon` until that polish and validation work is complete.

### Packaging Principle

Daily Routines should be genuinely complete on Free. If routine points, avatar progress, or cosmetic rewards are part of the core routine loop, they should not be awkwardly split across a paywall merely because the older chores/rewards architecture treated them as premium features.

### Existing-Code Difference To Remember

The current entitlement catalog is close to this structure, but not identical:

- Free currently uses explicit student and curriculum limits.
- Core currently has unlimited curriculum but a finite student limit rather than fully unlimited household scale.
- Points, rewards, redemptions, and cosmetics are currently packaged with the paid chores/rewards features.
- Lockdown currently targets `$10/month` in planning documents.

Adopting this new direction will therefore require an intentional entitlement and messaging migration, not only a pricing-copy change.

### Decisions To Make Later

- What are the exact Free student and active-curriculum limits?
- Does “unlimited” mean technically unlimited, or a high fair-use household limit presented as unlimited?
- Which routine-linked points, avatars, and cosmetics are part of the complete Free routine experience?
- Should the paid middle tier keep the public name `Core`?
- Is Lockdown ultimately `$10`, `$15`, or another price based on support and infrastructure costs?
- How should existing subscriptions and saved premium household data behave when packaging changes?

## Suggested Order — Not Yet A Commitment

1. Lock the Free/Core/Lockdown packaging direction together with the routine-first product decision.
2. Decide which existing household surfaces become hidden or read-only and which routine-linked rewards belong on Free.
3. Reorganize the Weekly Plan actions and language around draft, default, and publish.
4. Make the student timer UI conditional on `Timer required`.
5. Design and implement the auditable parent completion-correction flow.
6. Simplify Reports and perform a real print-layout review using the correction model.
7. Return to avatar/cosmetic reward depth after the basic routine reward loop feels right.

## Copy/Paste Parking-Lot Outline

- **Product focus:** Prioritize school planning/student work and Daily Routines.
- **Daily Routines:** Make Morning, Afternoon, and Evening routines the primary household feature; connect completion to lightweight points and avatar/cosmetic rewards.
- **Tabled features:** Preserve but stop prioritizing weekly chores, monthly chores, allowance, bounties, and the larger reward economy.
- **Weekly planning:** Clearly separate Save Draft, Save as Default Week, and Publish This Week; improve action placement and status messaging.
- **Parent corrections:** Add contextual controls to mark a block complete or undo completion, with an auditable parent-override record.
- **Timers:** Show timers only for blocks that require them; give non-timed blocks a direct completion path.
- **Reports:** Simplify the screen, coordinate it with parent overrides, and verify the real printed output and page breaks.
- **Subscriptions:** Free includes complete schoolwork and Daily Routines with student/curriculum limits; Core targets `$5/month` for unlimited students and curriculum; Lockdown becomes a later polished `$10–15/month` tier.

## Documentation Impact If These Decisions Are Adopted

If this direction moves from exploration into implementation, update these documents together:

- `docs/roadmap.md`
- `docs/architecture.md`
- `docs/specs/chores-and-rewards-module.md`
- `docs/specs/core-pricing-and-launch-positioning.md`
- `docs/specs/weekly-planning-and-review-flow.md`
- `docs/specs/weekly-blocking-and-assignment-templates.md`
- `docs/specs/reporting-and-compliance-contract.md`
- `docs/features/parent-dashboard.md`
- `docs/features/student-portal.md`
- `docs/features/reporting-and-rollover.md`
- `docs/upgrades/subscriptions-and-entitlements.md`
