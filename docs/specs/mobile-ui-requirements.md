# GridWorkz Mobile UI Requirements And Easy-Viewing Suggestions

## Purpose

This document defines the UI requirements for iOS and Android versions of GridWorkz so the current web experience can be translated into screens that are easy to read, easy to tap, and fast to navigate on phones.

The main rule is simple:

- do not compress the existing desktop dashboard into mobile
- reorganize it into focused, single-purpose screens

## Product Split

Two mobile experiences should be designed separately.

### Parent app

- operational
- information-dense
- multi-student
- review and management oriented

### Student app

- action-driven
- low-cognitive-load
- single next step
- large touch targets and clear progress feedback

## Core Mobile UI Principles

1. One primary action per screen
2. No critical information should require horizontal scrolling
3. Summary first, detail on drill-in
4. Bottom navigation for primary sections
5. Sticky action bars only when the action is high-frequency
6. Charts and progress should be readable at arm’s length
7. Lists should be scannable in under 3 seconds

## Layout Requirements

### Safe spacing

- minimum horizontal padding: `16px`
- preferred card padding: `16px`
- section spacing: `20px` to `24px`
- minimum tap target: `44x44px`
- destructive actions must be visually separated from primary actions

### Typography

- body text minimum: `16px` for key content
- secondary metadata minimum: `12px`
- section titles: `20px` to `24px`
- avoid long all-caps labels except small metadata chips
- use line height generous enough for quick scanning

### Contrast and readability

- all primary text must meet accessible contrast
- progress bars need text values, not color alone
- subject colors cannot be the sole way to distinguish status
- modal overlays must remain readable in bright daylight

## Parent App Screen Requirements

## 1. Parent Home

Purpose:

- immediate understanding of family progress this week

Required content:

- overall weekly progress summary
- one card per student
- latest activity feed
- alert/status area for rollover issues or incomplete setup

Easy-viewing suggestions:

- use stacked student cards, not a multi-column dashboard
- each student card should show name, progress ratio, percentage, and latest activity time
- keep the latest 3 to 5 feed items visible before scrolling
- avoid tiny sidebar-style widgets entirely

## 2. Students List

Required content:

- student avatar/initial
- student name
- progress summary
- quick access to view details

Easy-viewing suggestions:

- cards or large list rows are preferable to dense tables
- show only the most useful metadata in the list
- move slug, PIN, and advanced actions into the detail screen

## 3. Student Detail

Required content:

- weekly progress across subjects
- subject breakdown
- recent block submissions
- manual completion action
- reset block action with confirmation

Easy-viewing suggestions:

- use segmented sections: Overview, Subjects, Activity
- represent blocks as larger pills or tiles, not tiny desktop buttons
- show submission detail in full-screen sheets rather than small centered modals

## 4. Curriculum List

Required content:

- subject title
- assigned students
- block count
- block duration
- status

Easy-viewing suggestions:

- make each subject row expandable or navigable to detail
- avoid exposing full form complexity on the list screen
- include quick filters such as Active and Archived

## 5. Subject Create/Edit

Required content:

- subject basics
- student assignment
- schedule settings
- resources
- custom fields
- block objectives

Easy-viewing suggestions:

- convert the current long form into a step flow
- use collapsible sections for optional fields
- keep a sticky Save button only if it does not obscure content
- use inline validation and progress markers

## 6. Reports

Required content:

- week selector
- student filter
- report cards/list
- report detail

Easy-viewing suggestions:

- default to report summaries, not print-style pages
- render subject sections as accordions
- provide export/share as a secondary action
- keep filter controls in a bottom sheet or compact horizontal chips

## 7. Settings

Required content:

- school name
- school year dates
- timezone
- weekly reset day/time

Easy-viewing suggestions:

- keep these in short grouped cards
- use native date/time pickers
- show a human-readable “current schedule” summary below controls

## Student App Screen Requirements

## 1. Pairing / Sign-In

Required content:

- enter code or scan QR
- optional PIN screen
- friendly explanation of what the student can do

Easy-viewing suggestions:

- keep this extremely minimal
- only one input focus at a time
- use large entry fields and clear failure states

## 2. Student Home

Required content:

- current week progress
- assigned subjects
- next recommended action

Easy-viewing suggestions:

- show “continue current subject” if a timer is active
- use large subject cards with progress, not small grid blocks by default
- keep the weekly progress visible near the top at all times

## 3. Subject Detail

Required content:

- subject title and color
- block progress
- resources
- block objectives
- start block action

Easy-viewing suggestions:

- reveal blocks progressively instead of showing a dense matrix first
- allow quick switching between instruction and resources
- make completed vs available vs locked states obvious by both icon and label

## 4. Active Block / Timer

Required content:

- active subject
- current block number
- countdown
- pause/resume
- completion action

Easy-viewing suggestions:

- this screen should be visually calm and single-purpose
- timer numerals should be large enough to read across a room
- keep only the timer and primary controls above the fold
- do not overload the screen with extra navigation

## 5. Submission Screen

Required content:

- summary input
- resource selection
- custom field inputs
- submit button

Easy-viewing suggestions:

- place the text input first
- use clear minimum-character guidance
- keep submit fixed near the bottom only when keyboard-safe
- turn custom fields into one-field-per-row cards

## 6. Progress / History

Required content:

- this week’s completion by subject
- recent submissions

Easy-viewing suggestions:

- timeline and accordion patterns are easier to scan than tables
- show date, block, and short summary preview

## Navigation Requirements

### Parent app tabs

- Home
- Students
- Curriculum
- Reports
- Settings

### Student app tabs

- Home
- Progress
- Settings

Notes:

- subject detail and timer flow should be stack screens, not tabs
- modals should be reserved for confirmations and short detail views

## Component Requirements

### Cards

- rounded corners
- clear elevation or border separation
- consistent internal spacing
- top-level tap area should cover the whole row/card when appropriate

### Progress indicators

- always show numeric values with bars
- progress bars need enough height to be visible without precision tapping
- show “x of y” alongside percentages

### Forms

- use native pickers where possible
- support keyboard-safe scrolling
- validate early, not only on submit
- group optional settings below required ones

### Lists

- each row should communicate one decision
- keep left alignment consistent
- avoid more than two lines of primary text in row layouts

## Modal And Sheet Rules

- use bottom sheets for filters, sorting, and small forms
- use full-screen sheets for submission detail and multi-step editing
- destructive confirmations must explicitly name the student/subject/block affected

## Easy-Viewing Rules For Dense Information

1. Move from dashboard widgets to stacked summaries
2. Replace desktop sidebars with bottom tabs
3. Replace small modals with sheets or dedicated screens
4. Replace compact block grids with larger tappable chips or progressive lists
5. Replace print-first report layouts with summary-first mobile layouts

## Accessibility Requirements

- dynamic text support where practical
- screen-reader labels for progress, buttons, and subject colors
- no information conveyed by color alone
- visible focus states for keyboard and switch control compatibility
- support reduced motion preferences

## Tablet Behavior

- parent app can use split view on tablets
- student timer screen should remain centered and distraction-light
- tablet layouts should add space, not extra clutter

## Visual Style Guidance

Preserve GridWorkz brand cues from the current product:

- warm neutrals
- lavender/amethyst accents
- soft card surfaces
- calm academic tone

But adapt them for mobile:

- less chrome
- fewer simultaneous panels
- larger type
- stronger hierarchy

## What To Avoid

- desktop-style three-column layouts on phones
- tiny weekly grids as the first screen
- overuse of centered pop-up modals
- long uninterrupted forms without sectioning
- dense filter bars that consume top-of-screen space

## Definition Of Easy Viewing

A screen is easy to view if the user can:

- identify where they are in under 2 seconds
- identify the main action in under 2 seconds
- read the key summary without zooming or squinting
- complete the primary task one-handed on a standard phone
