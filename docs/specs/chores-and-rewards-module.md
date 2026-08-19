# Chores And Rewards Module

Status: Implemented after Phase 9 validation

Last updated: 2026-05-26

## Goal

Define the Own Path module for household chores, daily routines, allowance tracking, and student rewards without weakening the core school-work model.

The module should extend the current product stance:

- parents define the expectations
- students choose the order and take ownership
- the system tracks what happened
- parents get a low-maintenance review and payout workflow

This should not become a calendar-heavy family task manager. It should feel like the household side of the same weekly autonomy system that already drives school work.

## Product Thesis

Most kid chore apps make parents manage too many individual tasks, especially when daily routines are entered as separate chores. Own Path can do better by separating:

- daily routine checklists that every student repeats
- weekly chore pools that any eligible student can choose from
- monthly chore pools that should not immediately reset just because the calendar turned over
- allowance and rewards that are calculated from completion instead of handled through a payment card

The parent should be able to set up the household once, then let students work through available choices inside clear boundaries.

## Implemented Product Shape

The module now ships as one dashboard module and one student-portal area.

Parent surface:

- `/dashboard/chores` behind the shared feature registry
- setup for daily routines, weekly chores, monthly chores, quotas, allowance policy, and reward-store items
- review surfaces for completions, allowance owed, paid status, and redemption requests

Student surface:

- same student portal, with separate `School`, `Chores`, and `Rewards` areas when enabled
- no separate public portal unless the student-access model changes later
- daily routine shown as one grouped routine, not dozens of tiny chore records
- available weekly and monthly chore pools with clear instructions and completion requirements
- earned allowance and reward progress shown in a student-safe way

## Core Concepts

### Daily Routines

Daily routines are not ordinary chores.

They should be modeled as grouped routines because parents do not want to create and maintain 70-80 repeated chore entries per kid.

Recommended behavior:

- parent creates one or more routine templates, such as Morning Routine or Evening Routine
- each routine template contains checklist items, such as brush teeth, get dressed, feed pets, make bed
- the student sees the checklist and can use item-level checks as guidance
- the persisted completion is one routine completion for the day, not one chore completion per checklist item
- routine completion can count toward points or allowance only if the parent enables that

Routines should support per-student customization because younger and older children will not always share the same checklist.

### Chore Pools

Household chores should be selected from pools rather than pre-assigned to fixed days.

Recommended pools:

- `weekly`
- `monthly`

Each chore definition should include:

- title
- frequency pool
- eligible student ids or all-student eligibility
- instructions
- definition of done
- optional proof requirement, such as note or photo later
- effort or difficulty label
- cooldown rule
- active or archived state

The student experience should show the pool as available choices. When a student claims or completes a chore, that chore becomes unavailable to other students until its next eligible date.

### Availability And Cooldowns

Chores need both a period rule and a minimum cooldown rule.

The next eligible time should be:

```text
max(next_period_boundary, completed_at + minimum_cooldown)
```

Examples:

- Weekly chore completed Saturday with a 2-day cooldown: unavailable until Monday, even if the week resets Sunday.
- Monthly chore completed May 29 with a 15-day cooldown: unavailable until June 13, not June 1.
- Monthly chore completed May 2 with a 15-day cooldown: unavailable until June 1, because the month boundary comes later.

This keeps chores from being repeated at the end of one period and again immediately at the start of the next.

### Claiming And Completion

The pool needs a lightweight claim step so siblings do not start the same chore at the same time.

Recommended lifecycle:

- `available`
- `claimed`
- `completed`
- `approved` if parent approval is required
- `rejected` or `returned` if parent sends it back

Claims should expire automatically if a student does not complete the chore within a parent-configured window.

For the first pass, support auto-approved chores by default and parent-approval-required chores as an option for tasks that need inspection.

### Quotas

Students should have chore quotas rather than fixed chore assignments.

Per student, per allowance period or week:

- required routine days
- required weekly chore blocks
- required monthly chore blocks

The term `block` can stay intentionally simple: one completed chore normally equals one block. Later, effort weighting can let harder chores count more than one block, but that should not be required in the MVP.

The parent setup should warn when the household pool cannot satisfy the remaining quotas for all eligible students. This matters when one child finishes early and locks too many shared chores before siblings have a fair chance.

## Allowance Tracking

The app should track allowance earned and paid, but should not move money in the first implementation.

Parents can keep using Greenlight, Venmo, cash, a bank transfer, or another financial app for the actual payout.

Allowance settings should support:

- weekly, biweekly, or monthly allowance period
- allowance amount per student
- all-or-nothing policy
- prorated policy
- optional routine inclusion
- optional bonus or overage rules later

Recommended calculation:

```text
completion_ratio = eligible_completed_blocks / required_blocks

all_or_nothing:
  earned = allowance_amount if completion_ratio >= 1 else 0

prorated:
  earned = allowance_amount * min(completion_ratio, 1)
```

The allowance ledger should store:

- period start and end
- required counts
- completed counts
- calculated earned amount
- parent adjustment amount
- paid amount
- paid status
- paid at timestamp

This makes Own Path the source of chore accountability without becoming a debit-card product.

## Rewards And Points

Rewards should be a shared student motivation layer, not only a chore feature.

Point sources:

- school weekly blocks
- project work blocks
- chore completions
- daily routine completions if enabled
- achievements or streaks later

Students should have one point wallet with source attribution, so parents can see where points came from without making the student manage multiple currencies.

Recommended parent settings:

- points per school block
- points per chore block
- points per routine day
- optional suggested points based on estimated weekly minutes

The suggestion should look at approximate planned workload rather than pretending all families define blocks the same way. A family with many short blocks should receive a lower per-block suggestion than a family with fewer large blocks.

### Reward Store

The reward store should support both built-in and parent-created rewards.

Built-in rewards:

- avatar options
- profile cosmetics
- badges or small visual unlocks
- progression milestones

Parent-created rewards:

- title
- description
- point cost
- quantity or stock
- eligibility by student
- redemption approval behavior
- fulfillment status

Example:

- `$10 Roblox gift card`
- cost: `10,000 points`
- stock: `1`
- after redemption, the reward becomes unavailable until the parent restocks it

Do not store gift card codes or sensitive payout credentials in the first pass. The app can track that a reward was requested, approved, and fulfilled without becoming a secret manager.

### Redemptions

Recommended redemption lifecycle:

- `available`
- `requested`
- `approved`
- `fulfilled`
- `rejected`
- `canceled`

For parent-created rewards, the default should be parent approval before points are permanently spent. Built-in cosmetic unlocks can spend points immediately.

## Entitlement And Packaging

Use feature flags so product packaging can change later without rewriting the module:

- `can_use_daily_routines`
- `can_use_chores`
- `can_use_rewards`

PM packaging decision as of 2026-05-26:

- Mark the module as implemented in launch docs after final Phase 9 validation.
- Free accounts may use daily routines only.
- Chore pools, weekly chores, monthly chores, allowance tracking, achievements, reward-store behavior, and related cosmetics are locked behind the first paid plan.
- The paid chores/rewards surface is included in the current paid Core/Pro plan and in Lockdown. The codebase currently uses the `core` plan id for that first paid plan.

Implemented technical stance:

- Free includes `can_use_daily_routines` only.
- Core and Lockdown include `can_use_daily_routines`, `can_use_chores`, and `can_use_rewards`.
- The dashboard route is visible when any chores/rewards module feature is enabled.
- Daily routines remain editable on Free; paid sections are read-only/locked unless Core or Lockdown is active.
- Trusted callables backstop the UI: routine setup/completion requires daily routine access, chore pools/allowance/review require chores access, and points/rewards/redemptions require rewards access.
- Existing chore and reward data stays read-mostly on downgrade; new paid creates and review/redemption mutations are blocked above the active plan.

## Suggested Data Model

Current module collections:

Parent-owned settings:

- `choreSettings/{parentId}`
- `routineTemplates`
- `choreDefinitions`
- `rewardSettings`

Student and period records:

- `routineCompletions`
- `choreClaims`
- `choreCompletions`
- `allowancePeriods`
- `pointLedgerEntries`
- `studentPointWallets`
- `rewardCatalogItems`
- `rewardRedemptions`

Important modeling rules:

- chore definitions are parent-owned household records
- completions must be student-scoped and parent-scoped
- allowance ledgers should snapshot the policy used at calculation time
- point ledger entries should be append-only after creation, with adjustments represented as new entries
- reward redemptions should snapshot title, cost, and fulfillment terms so historical requests survive later store edits

## Security Requirements

This module should not inherit the current public-read posture casually.

Chores and rewards expose more sensitive household behavior than ordinary school blocks:

- who is home doing what
- allowance amounts
- reward preferences
- sibling activity patterns
- possible gift-card-like fulfillment details

Student actions use trusted callable flows rather than public collection writes.

Implemented requirements:

- parents can read and write their own household chore and reward settings
- students can only read their own student-safe chore view
- students cannot read sibling allowance balances or private reward history
- student completion writes must validate student identity, parent ownership, chore eligibility, claim status, and availability
- allowance and point calculations should be trusted backend operations, not client-authoritative totals
- reward fulfillment state should be parent-only

The public slug model is still in use, so trusted student chore/reward calls require PIN-verified student context and return only a student-safe view. Free student state returns routines only; paid chore/reward state is included only when the parent account is entitled.

## Parent UX Requirements

The parent setup should be efficient enough that the module does not create the same burden it is trying to replace.

Implemented setup flow:

1. Create daily routine templates.
2. Add weekly chores.
3. Add monthly chores.
4. Set per-student quotas.
5. Choose allowance policy.
6. Choose point settings.
7. Add optional reward-store items.

The parent dashboard should show:

- each student's routine status
- weekly chore quota progress
- monthly chore quota progress
- allowance earned and owed
- unpaid allowance periods
- pending approval chores
- pending reward redemptions
- chore distribution by student over time

## Student UX Requirements

The student view should stay simple and action-focused.

Implemented sections:

- `Routine`: today's grouped routine checklist and one completion action
- `Chores`: counters for weekly and monthly chore blocks remaining
- `Available`: eligible chores with instructions and definition of done
- `Claimed`: chores the student started but has not finished
- `Rewards`: point balance, avatar/progression, and available store items

Avoid showing an overwhelming household operations board to the student. The student needs to know what they can do now and what progress it earns.

## Implementation Phases

These phases describe the implementation history. The workflow completed through Phase 9 on 2026-05-26; seeded browser and callable runtime smoke remains launch QA, not an implementation-phase blocker.

### Phase 1. Product And Entitlement Foundation

- Added entitlement keys and route metadata for daily routines, chores, and rewards.
- Resolved rewards as part of the same household module for launch.
- Added the planning vocabulary to `src/constants/schema.js`.

### Phase 2. Chore Data And Trusted Operations

- Create chore settings, routine templates, chore definitions, claims, and completion records.
- Add trusted claim, complete, approve, reject, and release flows.
- Add availability calculation helpers with period boundary plus cooldown behavior.

### Phase 3. Parent Chore Setup MVP

- Build parent setup and management inside the dashboard shell.
- Support daily routines, weekly chores, monthly chores, quotas, and approval requirements.
- Show basic progress and pending review.

### Phase 4. Student Chore Workspace

- Add the Chores area to the student portal.
- Show daily routine, available pools, claimed chores, and completion flow.
- Keep sibling data hidden or generalized.

### Phase 5. Allowance Ledger

- Add allowance settings, period calculation, earned amount calculation, and paid markers.
- Support weekly, biweekly, and monthly payout periods.
- Keep actual money movement out of scope.

### Phase 6. Rewards Foundation

- Add point settings, append-only point ledger, student wallet, reward catalog, and redemption flow.
- Support built-in avatar/cosmetic unlocks and parent-stocked rewards.
- Make reward costs configurable without requiring the parent to tune every internal achievement.

### Phase 7. Achievements And Polish

- Keep simple deterministic achievements and streak cosmetics behind the paid entitlement boundary until final assets and achievement rules ship.
- Add fairness and history views, such as who completed which chore categories over time.
- Packaging is resolved for launch: routines are free, paid chores/rewards are in Core/Lockdown.

## Non-Goals For MVP

- direct money payout
- debit-card or banking integration
- storing gift card secrets
- complex rotating schedules
- hourly chore calendars
- AI-generated chore plans
- public household leaderboards
- multi-household custody workflows

## Open Decisions

- Should routine checklist items be persistently item-level, or should item checks remain local UI state under one daily completion record?
- Should chores use simple one-block completion only, or should effort weighting ship in the first version?
- Should parent approval default to off for all chores, or should higher-effort chores default to approval required?
- Should school points and chore points share one wallet from day one, or should parents be able to keep them separate?
- What additional student-auth hardening should replace or supplement PIN-verified public slug access before broader production rollout?

## Resolved Decisions

- Packaging decision: daily routines are free; chore pools, weekly/monthly chores, allowance tracking, achievements, rewards, and related cosmetics are included in the first paid Core/Pro plan and Lockdown.
- Daily routine completions remain one grouped daily completion; checklist item checks are guidance captured under that completion.
- Child point balances cannot go below zero.
- Allowance payout is manual parent paid-out bookkeeping only; the app does not move money.
- Parent-created reward requests reserve points immediately and refund on rejection/cancel where the state transition calls for it.
- School-block point awards remain deferred until school completion moves to a trusted server-owned flow.

## Related Docs

- [../roadmap.md](../roadmap.md)
- [../architecture.md](../architecture.md)
- [../upgrades/baseline-product-foundation.md](../upgrades/baseline-product-foundation.md)
- [../upgrades/subscriptions-and-entitlements.md](../upgrades/subscriptions-and-entitlements.md)
- [weekly-planning-and-review-flow.md](weekly-planning-and-review-flow.md)
- [projects-and-assessment-model.md](projects-and-assessment-model.md)
