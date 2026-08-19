# OwnPath — New Session Starter Prompt

Copy and paste this entire prompt when starting a new design chat. Upload the attached HTML files and markdown files alongside it.

---

## PASTE THIS AS YOUR FIRST MESSAGE:

I'm designing a web app called **OwnPath** — a homeschool curriculum tracker and chores management system for families. I've been working on this design iteratively with Claude and I'm continuing that work in this session.

I'm attaching the following files to give you full context:

**Markdown context files:**
- `01-design-system.md` — color palette, typography, component patterns, visual direction
- `02-app-architecture.md` — data models, user types, plan tiers, full feature inventory
- `03-design-decisions.md` — rationale for key decisions already made (don't re-litigate these)
- `04-roadmap.md` — what's done, what's next, current focus
- `05-product-reconciliation-notes.md` — decisions that reconcile this redesign package with broader repo docs
- `06-implementation-mapping.md` — prototype-to-app route/file mapping for later implementation

**HTML prototypes (interactive — open in browser to see them):**
- `curriculum.html` — Curriculum page prototype (complete and approved)
- `weekly-blocking.html` — Weekly Blocking page prototype (complete and approved)
- `ownpath_daily_routines_v2.html` — Daily Routines prototype (mostly complete / accepted baseline)
- `ownpath_weekly_chores.html` — Weekly Chores prototype (mostly complete / accepted baseline)
- `ownpath_allowance_v2.html` — Allowance prototype (mostly complete / accepted baseline)
- `ownpath_rewards_v3.html` — Rewards prototype (mostly complete / accepted baseline)

Please read all four markdown files before we begin. The design system in `01-design-system.md` is the source of truth for all visual decisions — match it exactly when building new prototypes.

---

## CURRENT FOCUS

We are finishing the **parent portal prototype package** before any real app implementation starts.

Current status:
1. **Curriculum** — complete and approved
2. **Weekly Blocking** — complete and approved
3. **Daily Routines** — mostly complete / accepted baseline
4. **Weekly Chores** — mostly complete / accepted baseline
5. **Allowance** — mostly complete / accepted baseline
6. **Rewards** — mostly complete / accepted baseline
7. **Monthly Chores** — draft created for review
8. **Chores Overview** — draft created for review
9. **Homeschool Overview** — draft created for review
10. **Students** — draft created for review
11. **Reports** — draft created for review

Next priority:
1. Review and polish the drafted parent prototypes
2. **Settings / Account surfaces**
3. Shared interaction patterns
4. Student portal prototypes after parent portal direction is stable

Do not reopen the accepted chore prototypes unless the user explicitly asks for revisions.

---

## IMPORTANT DESIGN CONSTRAINTS

These are non-negotiable — don't deviate from them:

1. **Dark-first UI** — deep navy base (#181828), layered lighter surfaces. No light mode.
2. **Sharp geometry** — zero border-radius on cards and containers. Buttons may have 0px radius.
3. **Left-edge color accents** — subject/chore colors appear as 3px left border only, not full card colors.
4. **No scrolling on core pages** — layouts should fit in viewport using panels, tabs, and expand/collapse. The Curriculum and Weekly Blocking prototypes demonstrate this correctly.
5. **Subjects are per-student** — already decided, don't suggest shared subjects.
6. **Week-level assignment only** — students choose their own daily schedule. Never design day-level block assignment for the parent portal.
7. **Student portal is separate** — don't design student-facing views yet. We're completing the parent portal first.
8. **Student portal access requires a parent-set credential** — each child uses either a 4-6 digit PIN or a password, chosen by the parent.
9. **Match the existing prototype aesthetic exactly** — use the CSS variables from `01-design-system.md`. New prototypes should look like they belong in the same app as `curriculum.html` and `weekly-blocking.html`.

---

## HOW WE WORK

- Build prototypes as interactive HTML widgets (rendered inline in chat using the visualize tool)
- Each prototype should be fully interactive where possible — real click handlers, state changes, expandable sections
- After each prototype, I'll give feedback and we'll iterate
- When a prototype is approved, move to the next item on the roadmap
- Keep an eye on context length — when this chat gets long, remind me to start a new session with the updated files

---

## WHEN SAVING FILES FOR NEXT SESSION

At the end of each session (or when I ask), produce:
1. Updated HTML files for any newly completed or revised prototypes
2. Updated `03-design-decisions.md` with any new decisions made this session
3. Updated `04-roadmap.md` with status changes
4. A brief "session summary" of what was decided and built

This package becomes the input for the next session.
