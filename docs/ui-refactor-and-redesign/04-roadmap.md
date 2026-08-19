# OwnPath — Design Roadmap

## Status Key
- ✅ Prototyped & approved
- 🟣 Mostly complete / accepted baseline
- 🧪 Drafted, needs user review
- 🔄 In progress
- 🛠 App implementation started
- 📋 Defined, not yet prototyped
- ❓ Needs discussion before designing

---

## Parent Portal

### ✅ Curriculum Page
Full prototype complete and approved.
- Subject library (per-student, color-coded cards, pip indicators)
- Subject detail / block editor (all block types, pin controls, completion req icons)
- Quick planner tray (pinned blocks, qty controls, default fill, show unpinned fallback)
- Three-mode layout — no scrolling, all on one page
- File: `curriculum.html`

### ✅ Weekly Blocking Page
Full prototype complete and approved.
- Student switcher with hours-per-week
- Week chips (Default + dated weeks, modified indicator, current week dot)
- Subject rows with expand/collapse, assigned block pills, qty controls, add-from-unassigned
- Default week inheritance model
- Summary panel (total blocks, hours, per-subject counts with diff indicators)
- Reset to default, Save as default week, Copy to another week
- File: `weekly-blocking.html`

---

### 🛠 Chores Section (app implementation started)
Daily Routines, Weekly Chores, Allowance, and Rewards are accepted as mostly complete baseline prototypes. Monthly Chores and Chores Overview now have draft prototypes ready for review.

#### 🟣 Daily Routines
- Morning / afternoon / evening groupings
- Toggle-style completion (student side mirrors this)
- Parent creates per-student routine templates; system repeats daily
- File: `ownpath_daily_routines_v2.html`

#### 🟣 Weekly Chores
- Household pool model — chores visible to all eligible students
- Each chore claimable once per week by one student
- Parent sets pool; students claim and complete
- Allowance-eligible flag per chore
- Cooldown, parent approval, photo/proof, and activity review patterns represented
- File: `ownpath_weekly_chores.html`

#### 🧪 Monthly Chores
- Same pool model as weekly, monthly cadence
- Mirror Weekly Chores interaction and visual pattern
- Use monthly pool, monthly quota/progress language, and monthly availability/cooldown state
- File: `ownpath_monthly_chores.html`
- App status: first shared weekly/monthly pool visual slice landed in `src/pages/dashboard/ChoresRoute.jsx`.

#### 🟣 Allowance
- Per-student quota settings (routine days target, weekly chores target, monthly chores target)
- Period settings (weekly/biweekly/monthly), reset day, completion policy (all-or-nothing vs proportional)
- Ledger view — base earned, parent adjustment, paid out, remaining
- Record paid out action (external — money moves outside the app)
- Advisory warnings when chore pool can't satisfy quota demand
- File: `ownpath_allowance_v2.html`

#### 🟣 Rewards
- Points settings (per block type — school block, chore block, routine day)
- Per-student wallet (current balance, lifetime earned, manual adjustment)
- Reward store — built-in placeholder rewards (avatars, badges, themes) + parent-created rewards
- Redemption queue — pending requests for parent to fulfill
- Parent-created rewards: name, point cost, stock (limited or unlimited), auto-approve toggle
- File: `ownpath_rewards_v3.html`

---

### 🧪 Reports Page
- Filter by student, subject, school year, quarter
- Per-student weekly summary (blocks completed, hours, % progress)
- Expandable subject rows with block-level detail
- Print report action
- Save record action
- Exact report structure to be resolved during the Reports prototype pass
- Draft file: `ownpath_reports.html`

### 🛠 Students Page
- Add / edit / archive students
- Per-student: name, avatar/color, portal access mode, grade level (optional)
- Parent chooses either a 4-6 digit PIN or password for each child's portal
- Student portal preview link
- Plan tier usage indicator (X of Y students used)
- Draft file: `ownpath_students.html`
- App status: first roster/detail implementation landed in `src/pages/dashboard/StudentsRoute.jsx`; PIN creation now accepts 4-6 digits. Persisted password mode remains a planned schema/rules/portal migration.

### 🛠 Homeschool Overview Page
- Standalone draft created
- Quick stats: active subjects, this week's publish status, recent completions
- Quick actions: Add subject, Plan this week, View reports
- Draft file: `ownpath_homeschool_overview.html`
- App status: first overview/launch implementation landed in `src/pages/dashboard/HomeschoolRoute.jsx`; Weekly Blocking remains a launch note, not a full route.

### 🛠 Chores Overview Page
- Similar to Homeschool overview
- Quick stats: active chores, this week's pool status, allowance period status
- Quick actions: Add chore, View allowance, Manage rewards
- Draft file: `ownpath_chores_overview.html`
- App status: first overview implementation landed in `src/pages/dashboard/ChoresRoute.jsx`.

### 📋 Settings Pages
- Household settings: week reset day/time, timezone, school year dates
- Plan / billing (reference only — no deep design needed)
- Student management (may fold into Students page)

### 📋 Lockdown Mode Page (future)
- Coming soon state for now
- Placeholder with extension install instructions
- Per-student lockdown config when ready

---

## Student Portal
Design after parent Chores section is complete (chores appear on student side too).

### 📋 Student Dashboard
- Weekly progress bar (blocks completed this week)
- Subject cards — each showing block count and progress
- Chore section — daily routines + weekly chore pool
- Points/wallet display (prominent)
- Theme selector (earned themes)

### 📋 Block Detail View
- Block instructions
- Resource links
- Timer (if required)
- Written response input (if required)
- Photo upload (if required)
- Mark complete button
- Progress indicator for project blocks

### 📋 Chore View (Student)
- Daily routines grouped by time of day
- Weekly chore pool — browse and claim
- Monthly chore pool

### 📋 Rewards Store (Student)
- Browse available rewards
- Current point balance (always visible)
- Redeem button → sends request to parent
- Built-in rewards auto-unlock at threshold
- Earned themes applied immediately

### 📋 Profile / Achievements (Student)
- Current theme, avatar, badge
- Lifetime stats
- Achievement badges earned

### ❓ Theme System
- Needs design: what exactly does a theme change? (accent color, background texture, icon tint?)
- How are themes previewed before purchase?
- How is a theme applied? (instant, requires page reload?)
- Built-in themes to design: at minimum Sunrise, Twilight + 2-3 others

---

## Interaction Patterns Still Needed
These cut across multiple pages and need dedicated design passes:

### ❓ Block editor form (add/edit block)
- Slide-in panel or modal?
- Fields: name, type, instructions (rich text?), resources (add URL + label), completion requirements toggles, project total blocks
- Custom block type creation

### ❓ Add subject form
- Fields: name, color picker, blocks per week, block length
- Possibly: school year assignment, grade level tag

### ❓ Add chore form
- Fields: name, type (daily/weekly/monthly), time of day (daily), instructions, point value, allowance eligible, estimated minutes

### ❓ Student portal access flow
- Parent chooses PIN or password per child
- How does parent generate/share the portal link?
- Can credentials be reset/regenerated?
- Student onboarding — first time they log in, what do they see?

### ❓ Mobile responsiveness
- Parent portal: tablet minimum (parents may use iPad)
- Student portal: mobile-first (kids will primarily use phones)
- Sidebar collapses to bottom nav or hamburger on mobile

---

## Suggested Session Order
1. ✅ ~~Curriculum~~
2. ✅ ~~Weekly Blocking~~
3. 🟣 ~~Chores baseline~~ (Daily Routines, Weekly Chores, Allowance, Rewards)
4. 🧪 Monthly Chores
5. 🧪 Chores Overview
6. 🧪 Homeschool Overview
7. 🧪 Students page
8. 🧪 Reports
9. 🔄 Review and polish drafted parent prototypes ← YOU ARE HERE
10. Settings / Account surfaces
11. Block editor form + Add subject form + Add chore form
12. Student portal — Dashboard + Block detail
13. Student portal — Chores + Rewards store
14. Student portal — Profile + Themes
15. Mobile pass on student portal
16. Final polish pass across all views

## Implementation Prep

- Prototype-to-app implementation mapping exists in `06-implementation-mapping.md`.
- Do not start persisted data-model changes without resolving the explicit decision points in that mapping doc.
- App implementation has begun with shared `op-*` design classes, Students, Homeschool Overview, and the Chores overview/shared pool slice.
- Continue with Chores child surfaces before Curriculum, then Reports, then Settings / Account.
