# OwnPath — App Architecture & Data Model

## Reconciliation Note
This file describes the redesign/prototype direction, not the current production data model. Where it differs from the broader repository docs, the decisions in `03-design-decisions.md` explain the intended product direction for the redesign package.

## What OwnPath Is
A homeschool + chores tracking web app for families. Parents set up curriculum and chores, publish weekly plans, students complete work independently and log it. Includes allowance tracking, a points/rewards economy, and an optional browser lockdown mode (Chrome extension, future).

## User Types
- **Parent** — sets up students, subjects, blocks, chores, publishes weekly plans, reviews completions
- **Student** — enters through their portal link with either a parent-set PIN or password, sees their weekly assignments, completes blocks, earns points

## Plan Tiers
Packaging and locked-state UX are not the focus of the current prototype pass unless a Settings, Account, or Billing surface is being designed.

Current launch posture from the repo docs:
- **Free** — daily routines only for the chores module
- **Core** — first paid plan; includes chore pools, allowance, points, rewards, and the broader paid household module
- **Lockdown** — top-tier extension/kiosk path; keep public-facing prototype treatment as coming soon until specifically designed

---

## Homeschool Data Model

### Subject
Per-student. Not shared between students (use duplicate/copy for similar subjects).

This is an intentional redesign decision. Some canonical repo docs describe a future shared `CurriculumTemplate` + per-student `Assignment` split, but this redesign package keeps the parent-facing model cleaner by making subjects student-owned.
```
Subject {
  id, studentId, name, color,
  blocksPerWeek: int,
  blockLength: int (minutes),
  blocks: Block[]
}
```

### Block (template)
Lives inside a Subject. Reusable assignment template.
```
Block {
  id, subjectId,
  type: 'standard' | 'project' | 'parent_led' | 'test' | 'custom',
  customTypeName?: string,
  name,
  instructions,
  resources: { label, url }[],
  completionRequirements: {
    timer: boolean,
    writtenResponse: boolean,
    photoUpload: boolean
  },
  pinned: boolean,          // pinned = appears in quick planner tray
  // Project-only fields:
  totalBlocks?: int,        // total blocks to complete the project
  blocksCompleted?: int
}
```

### Weekly Plan
Per-student, per-week. Weeks identified by their start date (ISO string). Special key: 'default'.
```
WeeklyPlan {
  studentId,
  weekKey: 'default' | 'YYYY-MM-DD',
  assignments: {
    [subjectId]: {
      [blockId]: quantity  // number of this block assigned this week
    }
  },
  publishedAt?: timestamp,
  isDraft: boolean
}
```

**Key rules:**
- Any week not explicitly set inherits from 'default'
- Project blocks track progress across weeks (blocksCompleted is global, not per-week)
- Quantity on project blocks = how many of the total to assign this specific week
- Overflow allowed (assigned > blocksPerWeek) with soft warning, no hard block

---

## Chores Data Model
The current parent chore prototypes are accepted as the visual and interaction baseline. Monthly Chores remains the main missing chore page and should mirror Weekly Chores with monthly cadence and monthly pool language.

### Chore Types
- **Daily Routine** — per-student routine template; appears every day, tied to time of day (morning / afternoon / evening)
- **Weekly Chore** — goes into a shared household pool; students claim from pool; each chore claimable once per week by one student
- **Monthly Chore** — similar to weekly but monthly cadence

### Daily Routine Template
Daily routines are per-student and grouped by time of day. The student may see checklist-style guidance, but the core completion is the routine/day, not a separate chore completion for every tiny item.
```
RoutineTemplate {
  id, studentId,
  title,
  timeOfDay: 'morning' | 'afternoon' | 'evening',
  checklistItems: string[],
  pointValue?: int,
  allowanceEligible: boolean
}
```

### Chore Pool Item
Weekly and monthly chores are shared household pool items. Students claim from the pool; claimed chores become unavailable to siblings until released, completed, or reset by period/cooldown rules.
```
Chore {
  id, householdId,
  type: 'weekly' | 'monthly',
  name,
  instructions?,
  eligibleStudentIds?: string[], // empty/null = all students
  pointValue: int,
  allowanceEligible: boolean,
  estimatedMinutes?: int,
  cooldownDays?: int,
  approvalRequired?: boolean
}
```

### Student Chore Assignment / Completion
```
ChoreCompletion {
  id, choreId, studentId,
  weekKey | monthKey,
  claimedAt, completedAt?,
  status: 'claimed' | 'completed' | 'pending_review' | 'approved' | 'rejected' | 'returned'
}
```

---

## Allowance System
```
AllowanceSettings {
  householdId,
  period: 'weekly' | 'biweekly' | 'monthly',
  resetDay,
  resetHour,
  completionPolicy: 'all-or-nothing' | 'proportional',
  includeRoutineDays: boolean
}

StudentAllowanceQuota {
  studentId,
  weeklyAmount: decimal,
  routineDaysTarget: int,
  weeklyChoresTarget: int,
  monthlyChoresTarget: int
}

AllowanceLedgerEntry {
  studentId, period,
  baseEarned, parentAdjustment, paid,
  recordedAt
}
```

---

## Points & Rewards Economy
```
PointSettings {
  householdId,
  schoolBlockPoints: int,
  choreBlockPoints: int,
  routineDayPoints: int,
  routinePointAwardsEnabled: boolean
}

StudentWallet {
  studentId,
  currentBalance: int,
  lifetimeEarned: int,
  ledger: PointLedgerEntry[]
}

Reward {
  id, householdId,
  type: 'built_in' | 'parent_created',
  name, description,
  pointCost: int,
  category: 'avatar' | 'badge' | 'theme' | 'custom',
  stock?: int,  // null = unlimited
  autoApprove: boolean
}

RewardRedemption {
  id, rewardId, studentId,
  requestedAt, status: 'pending' | 'approved' | 'fulfilled' | 'rejected',
  fulfilledAt?
}
```

---

## Student Portal
- Access through a student portal link protected by either a parent-set 4-6 digit PIN or a parent-set password
- Parent chooses PIN or password per child
- Sees only their own data
- Themeable: students earn/buy themes with points. Theme = swappable color accent layer. Base structure stays constant (navy foundation), only accent colors + optional background texture swap.
- Age range: designed to serve 6–16 year olds. Student portal is more visually engaging than parent portal. Base must support theming from day one (CSS custom properties, not hardcoded colors).

---

## Weekly Reset
- Parent configures reset day (e.g. Monday) and reset time (e.g. 00:00)
- All weekly pools, claims, and plan windows reset at that time
- Week key = ISO date of the reset day for that week

---

## Lockdown Mode (future)
- Chrome extension + kiosk mode
- During active block: only approved resources/URLs accessible
- Resources defined per-block in curriculum
- Extension enforces at browser level
- Parent can approve/deny temporary unlocks
