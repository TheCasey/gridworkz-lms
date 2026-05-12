# DESIGN.md

This file is the working design reference for the current GridWorkz product UI.

It replaces the old inspiration-heavy note. Use this document to match the app that exists in the repo today.

## Source Of Truth

Use these files first:

- `tailwind.config.js` for theme tokens, font stacks, and custom font-weight names
- `src/pages/ParentDashboard.jsx`
- `src/pages/Curriculum.jsx`
- `src/pages/Reports.jsx`
- `src/pages/Settings.jsx`
- `src/pages/StudentPortal.jsx`

Important note:

- `src/index.css` still contains older generic `.btn-*`, `.card`, and `.input-field` utility classes.
- Those styles do not represent the current product direction and should not be used as the main reference for new UI.

## Visual Direction

GridWorkz is not a bright default-Tailwind dashboard.

The current UI direction is:

- editorial rather than template-like
- restrained rather than colorful
- warm rather than clinical
- structured for parents
- distraction-light for students

The parent app uses a darker branded shell with white work surfaces. The student portal uses the same palette, but in a softer and more focused way.

## Color System

Current palette tokens:

- `mysteria`: `#1b1938`
- `lavender-glow`: `#cbb7fb`
- `charcoal-ink`: `#292827`
- `amethyst-link`: `#714cb6`
- `warm-cream`: `#e9e5dd`
- `parchment`: `#dcd7d3`

Usage guidance:

- Use `mysteria` for major branded surfaces such as the parent sidebar or dark sections.
- Use `charcoal-ink` for primary text and dark CTA buttons.
- Use `lavender-glow` as the main accent for highlights, progress, selected states, and guided content.
- Use `amethyst-link` for emphasized links and small accent labels.
- Use `warm-cream` for secondary buttons and soft emphasis surfaces.
- Use `parchment` for borders, dividers, and subtle containment.

Avoid:

- default Tailwind blue/indigo as the main visual language
- adding new saturated brand colors unless there is a deliberate system change
- bright “success green” or “danger red” as primary UI identity colors

## Typography

Primary font stack:

- `Super Sans VF`
- fallback: `system-ui`, `-apple-system`, `Segoe UI`, `Roboto`, `Helvetica Neue`, `sans-serif`

Tailwind weight conventions already in the repo:

- `font-body`: `460`
- `font-display`: `540`
- `font-ui`: `600`
- `font-label`: `700`

Practical rules:

- Use `font-display` for page titles, card titles, and major section headings.
- Use `font-body` for paragraphs, helper copy, and most interface text.
- Use `font-label` for uppercase labels, button text, and compact UI metadata.
- Keep display text slightly tight in line-height and tracking.
- Keep body text comfortable and readable.

## Shape And Surface

Current shape language:

- cards: usually `rounded-2xl`
- buttons and inputs: usually `rounded-lg`
- borders: light, warm, and low-contrast
- shadows: minimal, often hover-only

Surface patterns:

- white cards on light work surfaces
- parchment borders for definition
- lavender-tinted panels for contextual emphasis
- dark branded surfaces used sparingly and intentionally

Avoid:

- glassmorphism
- heavy shadow stacks
- overly rounded pill-heavy layouts unless a specific control needs it

## Parent Experience

The parent experience should feel like an organized control room.

Principles:

- show hierarchy clearly
- prefer cards, sections, and clear action clusters
- keep dense workflows readable
- make reports and settings feel deliberate, not like forms thrown on a page

Patterns already in use:

- dark left navigation shell
- white header and content surfaces
- compact uppercase labels
- strong dark primary actions
- cream secondary actions

## Student Experience

The student portal should feel lighter and simpler than the parent shell.

Principles:

- one clear next action
- large touch targets
- obvious block states
- clear timer state
- low distraction

Patterns already in use:

- large block controls
- clear locked/completed/current states
- strong contrast between active actions and supporting information
- instructional callouts with lavender accents

## Component Guidance

### Buttons

- Primary: dark `charcoal-ink` background with white text
- Secondary: `warm-cream` background with `charcoal-ink` text
- Hover: subtle shade shift, not flashy animation

### Inputs

- White background
- `parchment` border at rest
- `charcoal-ink` border on focus
- Small uppercase label above the field when a label exists

### Cards

- White surface
- `parchment` border
- `rounded-2xl`
- Minimal shadow, if any

### Progress And Status

- Prefer lavender-based progress fills and accent dots
- Pair color with text or icon changes so status is not color-only

## Working Rules For Agents

- Reuse existing palette and type tokens before inventing new ones.
- Prefer matching the style already present in the target page over applying a generic design system abstraction.
- If you add a new reusable pattern, keep it compatible with the current `mysteria` / `lavender` / `cream` language.
- If you touch shared visual direction, update `DESIGN.md` and, when relevant, `docs/architecture.md`.
