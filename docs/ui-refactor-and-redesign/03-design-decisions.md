# OwnPath — Design Decisions Log

This file records the *why* behind key decisions so future sessions don't re-litigate them.

---

## Curriculum Page

### Subjects are per-student, not shared
**Decision:** Each subject belongs to one student. Two students taking "Chess" get two separate Chess subjects.
**Rationale:** Block pools, completion requirements, and resources almost always diverge between students even when subject names are the same. A duplicate/copy feature is the right solution for similar subjects.
**Status:** Decided as the intended redesign direction. This intentionally overrides the shared `CurriculumTemplate` + per-student `Assignment` direction in some broader repo planning docs for this prototype package.

### Three-mode single-page layout
**Decision:** Curriculum page has three modes on one URL — Subject Library (default), Subject Detail (click a subject), and Quick Planner (slide-in tray). No separate pages.
**Rationale:** Eliminates scroll problem of original UI. Parent can view/edit blocks while planning the week simultaneously.
**Status:** Implemented in prototype.

### Block types
**Decision:** Standard, Project, Parent Led, Test, Custom.
**Rationale:** Covers the majority of real homeschool assignment types in parent-facing language. Custom type with parent-defined label handles edge cases. If implementation later maps these labels to lower-level categories or completion modes, that mapping should stay behind the UI.
**Status:** Implemented in prototype. Custom type creation UI not yet designed.

### Pinned blocks in Quick Planner tray
**Decision:** Planner tray shows only pinned blocks by default. Unpinned blocks hidden behind "Show X more" disclosure.
**Rationale:** Parents with many blocks per subject need a fast path for the typical week. Pinning is a one-time setup. Heavy-duty scheduling happens in Weekly Blocking, not the tray.
**Status:** Implemented. Pin toggle lives in block editor (amber pin icon).

### Project block quantity
**Decision:** When assigning a project block, parent picks how many of the remaining blocks to assign this week. System tracks total done vs total remaining.
**Rationale:** Projects span multiple weeks at parent-controlled pace. Parent may want 1 block/week or 8 blocks/week depending on deadlines.
**Status:** Implemented. Overflow allowed with soft warning.

### Block completion requirements
**Decision:** Per-block configuration: timer required, written response, photo upload. All optional, combinable.
**Rationale:** Different assignment types need different evidence. Beast Academy = timer + written; worksheet = photo upload.
**Status:** Data model defined. Completion requirement UI in block editor not yet prototyped.

---

## Weekly Blocking Page

### Keep the page name
**Decision:** Keep the page name "Weekly Blocking" for now.
**Rationale:** The existing prototype already has the desired parent mental model: default week, modified weeks, per-student planning, and publish/save actions. Renaming to "Weekly Plans" or "Weekly Templates" is not part of this prototype pass.
**Status:** Decided.

### Week-level assignment only (not day-level)
**Decision:** Parent assigns blocks to a week, not to specific days. Students choose which days to do what.
**Rationale:** Core philosophy — give students ownership of their daily schedule as long as they complete weekly work. Day-level scheduling would undermine this.
**Status:** Decided. Non-negotiable design constraint.

### Default week as the inheritance base
**Decision:** Every week starts as a copy of "Default Week." Parents only edit weeks that differ from the default.
**Rationale:** Most weeks are the same. Editing only exceptions dramatically reduces recurring work.
**Status:** Implemented. Modified weeks show amber dot indicator on week chip. Reset to default available.

### Week identification
**Decision:** Weeks identified by the reset day date (ISO string), configured in household settings (reset day + reset time).
**Rationale:** Families have different week start days. System respects their configured reset.
**Status:** Data model defined. Reset day config shown in existing settings screenshot.

### Quick Planner tray vs Weekly Blocking page
**Decision:** Two separate tools with different scopes.
- Quick Planner tray (on Curriculum page): fast, pinned-blocks-only, for typical weeks
- Weekly Blocking page: full power, all blocks visible, multi-week planning ahead
**Rationale:** Most weeks don't need the full tool. The tray handles 80% of cases in seconds.
**Status:** Both implemented. Tray links to Weekly Blocking with "Full control →" footer link.

---

## Navigation

### Section headers are clickable + expandable
**Decision:** "Homeschool" and "Chores" in the sidebar are both clickable (→ overview page) and have a separate chevron to expand/collapse subnav.
**Rationale:** Supports both "I want the overview" and "I want to jump directly to a sub-page" without ambiguity.
**Status:** Implemented.

### Overview pages
**Decision:** Each section (Homeschool, Chores) has an overview page with quick-action buttons and navigation cards to sub-pages.
**Status:** Implemented for Homeschool overview. Chores overview to be designed.

---

## Student Portal

### Student access credential
**Decision:** Student portal access requires a parent-chosen credential per child: either a 4-6 digit PIN or a password.
**Rationale:** Younger students may need the simplicity of a PIN, while older students or families wanting stronger access control may prefer a password. The parent controls which access mode each child uses.
**Status:** Decided. First parent Students implementation exposes the direction and supports 4-6 digit PIN creation/unlock. Persisted password mode is not live yet; it requires schema, rules, trusted callable, and student portal auth migration.

### Themeable accent layer
**Decision:** Student portal base is the same dark navy structure as parent portal. Theme = CSS custom property swap for accent colors + optional background. Base structure never changes.
**Rationale:** Predictable layout for parents reviewing. Themes feel earned/special without breaking usability.
**Status:** Approved prototype direction is frozen in `ownpath_student_portal.html` and the first real route implementation has landed in `StudentPortal.jsx`.

### Age range
**Decision:** Design for 6–16. No age-gating within the student portal — same interface serves all ages.
**Rationale:** Household may have a 7-year-old and a 15-year-old. Parent controls complexity via block setup, not portal version.
**Status:** Decided.

### Weekly-choice school launcher
**Decision:** The student school workspace is organized by subject for the current week, not by day. Tapping a subject reveals its numbered blocks; tapping a block expands that same subject row further to reveal instructions, resources, response requirements, and timer controls in place.
**Rationale:** Weekly Blocking defines the work that must be completed during the week while students retain ownership of when and in what order they complete it. A student may complete one subject in a day or spread it across the week.
**Status:** Implemented in both the approved prototype and the live React route using the existing published weekly-plan launcher contract and compatible subject fallback.

### Student chore navigation
**Decision:** The student Chores workspace contains three explicit subviews: Daily Routine, Weekly Chores, and Monthly Chores. Allowance is a separate primary workspace.
**Rationale:** Each cadence has a different student action model—checking routine items versus claiming from weekly or monthly pools—and should not be mixed in one long page.
**Status:** Implemented in the prototype and live route. Allowance remains intentionally marked Coming Soon until bounty and earning details are finalized.

### Mobile student navigation
**Decision:** The student portal is desktop-capable but mobile-first at narrow widths. Desktop uses top workspace tabs and a contextual right rail; mobile uses a five-item bottom navigation bar and stacks rail content below the active workspace.
**Rationale:** Students should be able to save the portal link to a phone or tablet home screen and reach School, Chores, Allowance, Rewards, and Avatar without navigating the parent-oriented sidebar pattern.
**Status:** Implemented in the standalone prototype and live responsive route. A full installable PWA is now an approved follow-on, including manifest, icons, standalone display behavior, update strategy, and an explicitly bounded offline policy.

### Layered avatar assets
**Decision:** Avatars use stable catalog IDs for a base, outfit, and accessory. Art layers share one transparent canvas and are resolved from a controlled manifest; student clients do not supply arbitrary asset URLs.
**Rationale:** This allows generated artwork to replace placeholders without changing layout or persistence contracts, while keeping future student writes narrow and safe.
**Status:** Prototype asset folders, manifest, replacement guidance, and a CSS-backed live preview have landed. Stable-ID avatar persistence is approved; its trusted selection update is not implemented yet.

### Avatar asset storage
**Decision:** Final avatar, outfit, and accessory artwork will use securely configured storage-backed uploads and a controlled catalog/manifest. The student record persists only approved catalog IDs, never arbitrary upload URLs.
**Rationale:** Storage-backed assets allow art to evolve without app releases while preserving a narrow trusted write surface and preventing students from injecting external assets.
**Status:** Decided. Storage rules, upload tooling, catalog publication, and trusted selection persistence remain implementation work.

---

## Chores

### Existing chore prototypes are the accepted baseline
**Decision:** Daily Routines, Weekly Chores, Allowance, and Rewards prototypes are mostly complete and acceptable as the baseline.
**Rationale:** They already match the dark, sharp, left-edge-accent design direction and establish the chore module's core interaction patterns.
**Status:** Decided. Monthly Chores prototype exists and mirrors Weekly Chores with monthly cadence. First app implementation slice has started in `src/pages/dashboard/ChoresRoute.jsx`.

### Daily routines are per-student
**Decision:** Daily routines are per-student, grouped by morning / afternoon / evening.
**Rationale:** Routine checklists differ by age and responsibility level. Keeping them per-student avoids forcing household-wide routines to cover every child.
**Status:** Implemented in prototype.

### Weekly and monthly chores use shared pools
**Decision:** Weekly and monthly chores are household chore pools that eligible students work from.
**Rationale:** Pool-based chores support student ownership without making parents assign every task to a specific day or child. A student claims a chore from the pool, and that chore becomes unavailable to siblings according to the period/cooldown state.
**Status:** Weekly Chores implemented in prototype. Monthly Chores pending.

### Entitlement and route details are deferred for this pass
**Decision:** Locked states, Free/Core/Lockdown package gates, and exact implementation route boundaries should not block the current prototype pass.
**Rationale:** The current goal is visual and product-flow reconciliation. Entitlement UX should be designed when working on Account, Billing, Settings, or explicitly gated surfaces. Separate HTML prototype files may represent subviews even if implementation later groups them inside one dashboard module.
**Status:** Decided.
