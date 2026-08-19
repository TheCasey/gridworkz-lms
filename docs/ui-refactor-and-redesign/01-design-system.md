# OwnPath — Design System Reference

## Brand
- App name: OwnPath
- Tagline: "The path between structure and freedom"
- Two portals: Parent Portal, Student Portal
- Logo: stepping stones path (upward blocks, widening at base)
- The stepping stones motif echoes in progress bars, achievement indicators, block completion states

## Visual Direction
Dark-first. Sharp geometry (zero or near-zero border radius on most elements). Left-edge color accents instead of full card borders. Premium, modern, structured — not bubbly or rounded SaaS.

## Color Palette
```
--n0: #181828   (deepest navy — sidebar, topbar bg)
--n1: #1f1f32   (main content bg)
--n2: #26263c   (surface / card bg)
--n3: #2e2e48   (hover state, input bg)
--n4: #383858   (active / pressed)
--vi: #7c6fd4   (violet primary accent)
--vl: #b8adff   (violet light — text on dark)
--vf: rgba(124,111,212,0.14)   (violet fill — active nav, banners)
--bd: rgba(255,255,255,0.08)   (default border)
--bd2: rgba(255,255,255,0.14)  (emphasis border)
--t1: #eeeaf8   (primary text)
--t2: #c4bedc   (secondary text)
--t3: #8f8aaa   (muted text)
--t4: #585674   (disabled / hint text)
--amber: #f59e0b
--green: #34d399
--red:   #f87171
--blue:  #60a5fa
```

## Typography
- Font: system-ui / sans-serif (match host)
- Sizes: 9px labels, 10px meta, 11px body/nav, 12px card titles, 13–14px panel titles, 18–20px page headings
- Weights: 400 regular, 500 medium only
- All caps + letter-spacing for section labels (9–10px)

## Layout Patterns
- Sidebar: 190px, --n0 bg, left-edge 2px accent on active nav item
- Topbar: 50px, --n0 bg, border-bottom
- Content: --n1 bg
- Surfaces/cards: --n2 bg, 0.5px border (--bd or --bd2), NO border-radius (or 0px)
- Left-edge accent: 3px solid [subject color] on rows/cards — this is the primary way color enters the UI
- Grid gaps: 1px gap with background set to --bd creates seamless ruled grid effect
- Section labels: 9px uppercase, letter-spacing .08–.1em, color --t4

## Navigation Structure
```
Sidebar
├── Students
├── Homeschool  [clickable → overview, expandable → subnav]
│   ├── Curriculum
│   ├── Weekly Blocking
│   └── Reports
├── Chores  [clickable → overview, expandable → subnav]
│   ├── Daily Routines
│   ├── Weekly Chores
│   ├── Monthly Chores
│   ├── Allowance
│   └── Rewards
└── Lockdown  [coming soon]
```

Nav sections are collapsible (chevron right = collapsed, rotated = expanded). Clicking the section label navigates to an overview page. Clicking the chevron toggles subnav visibility.

## Component Patterns

### Subject/item rows
```
[3px color left edge] [dot] [name] [meta] [count badge] [chevron]
```
Expand inline to show block pills or detail content.

### Block pills (assigned blocks)
```
[TYPE badge] [block name] [− qty +] [×]
```
TYPE badges: STD (violet), PROJ (amber), P.LED (green), TEST (red), CUSTOM (purple)

### Quantity controls
```
[−] [n] [+]   15×15px buttons, --n3 bg
```

### Buttons
- Default: transparent bg, 0.5px --bd2 border, --t2 text
- Primary: --vi bg, white text
- Sizes: standard (5px 12px pad), sm (3px 8px pad)
- No border-radius

### Student tabs
Underline-style tabs (border-bottom: 2px solid --vi when active). Show student name + "~Xh/wk planned" subtitle.

### Week chips (Weekly Blocking)
Pill-style week selectors. Active = --vf bg + --vl text. Modified weeks show amber dot indicator. Default week uses dashed border.

### Banners
Left-edge 3px accent, matching bg tint. Used for contextual status (default mode, modified, warnings).

### Summary panel
Right-side 200px panel. Stat cards (large number + label). Per-item list with color-coded counts. Action buttons at bottom.
