# Public Marketing Site And Landing Page

Last updated: 2026-05-11

Status: Draft

## Goal

Define the first public-facing GridWorkz marketing site so the root experience can explain the product clearly, reduce buyer hesitation, and route visitors into signup, login, or pricing without dropping cold traffic directly onto an auth wall.

This doc is intentionally focused on the first homepage and pricing experience, not on a full long-term content-marketing system.

## Why This Exists

Today, the public root experience does not tell a new visitor what GridWorkz is.

Current route reality:

- `/` redirects into the authenticated product flow
- `/login` is the first substantial public-facing screen
- the login page is usable for existing parents, but weak for discovery traffic

That creates avoidable friction:

- a new parent has to infer the product from the login form
- pricing and plan differences are not explained in a public decision-making surface
- the product stance is buried in internal docs instead of translated into customer-facing copy
- premium features such as Lockdown exist in planning and code, but not in a clear public story

## Product Positioning To Preserve

The homepage should reflect the existing product stance already defined in the roadmap and baseline planning docs.

GridWorkz is:

- a homeschool planning and student workspace product
- optimized around weekly autonomy rather than hourly scheduling
- strongest when framed as: parents define the week, students run the day, the system tracks what happened, and reports prove the work

The public site should not lead with generic LMS language alone. `LMS` is technically true, but it is weaker than the actual value proposition.

Recommended public framing:

- `A weekly homeschool planner and student workspace`
- `Plan the week once. Let students run the day.`
- `Built for families who want structure, independence, and proof of work.`

## Primary Visitor Questions

The homepage should answer these questions in the first scroll without making a parent hunt for the basics:

1. What is GridWorkz?
2. Who is it for?
3. How is it different from a normal planner or scheduler?
4. What does the student actually see?
5. How does reporting work?
6. How much does it cost?
7. What should I do next?

If those answers are hidden below the fold, behind a pricing page, or behind signup, friction stays high.

## Primary Audiences

### 1. New homeschool parent evaluating tools

This is the main homepage audience.

They need confidence that GridWorkz can help them:

- organize multiple students
- give students more ownership
- maintain accountability
- produce usable weekly records

### 2. Returning parent ready to sign in

This audience needs a fast path back into the app.

### 3. Parent comparing plans

This audience needs pricing clarity, feature boundaries, and a simple explanation of what changes between Free, Core, and Lockdown.

## Conversion Goals

Primary CTA:

- `Start free`

Secondary CTAs:

- `See pricing`
- `See how it works`
- `Sign in`

Optional later CTA:

- `Book a demo`

Do not make a demo request the primary conversion path unless the product becomes sales-led. For this product shape, the public site should stay self-serve first.

## Launch Constraint

The entitlement model and pricing targets exist in code and planning, but real payment rollout is still operationally separate from sandbox billing.

That means the marketing site must avoid overpromising before live billing is ready.

Recommended rule:

- If live self-serve payments are not ready yet, keep the main CTA as `Start free` and treat pricing as informative rather than transactional.
- If exact paid checkout is not available yet, label pricing carefully or defer hard sell messaging until the live Stripe path is ready.

## Route Strategy

Recommended public route structure:

- `/`
  - marketing homepage
- `/login`
  - auth entry for existing parents
- `/pricing`
  - optional later dedicated pricing page
- `/faq`
  - optional later dedicated FAQ page

Phase 1 can stay as a single scrolling homepage on `/` with anchored sections and a header link to `/login`.

Recommended immediate route behavior:

- `/` should no longer redirect to `/dashboard`
- unauthenticated users should land on the public homepage
- authenticated users can still be routed into `/dashboard` from product CTAs or post-auth flows

## Information Architecture

The homepage should be a substantial scroll with short, readable sections. Each section should answer one decision-making question.

Recommended sticky top navigation:

- Logo
- How it works
- Features
- Student experience
- Reports
- Pricing
- FAQ
- Sign in
- Start free

Recommended desktop side behavior:

- a small sticky scroll-progress rail or anchored quick-links module for the major sections
- keep it subtle; it should help orientation, not feel like a documentation sidebar

Recommended mobile behavior:

- collapsed menu for section links
- sticky bottom or sticky header CTA for `Start free`

## Homepage Section Order

### 1. Hero

Purpose:

- explain the product in one glance
- give immediate next steps
- set the tone visually

Recommended content:

- eyebrow: `Homeschool planning, student independence, and weekly proof of work`
- headline: `Plan the week once. Let students run the day.`
- supporting copy: `GridWorkz helps homeschool families turn curriculum into a manageable weekly workspace students can actually follow on their own.`
- CTAs:
  - `Start free`
  - `See pricing`
- small proof row:
  - `Multi-student households`
  - `Student portal`
  - `Weekly reports`
  - `Optional Lockdown plan`

Avoid:

- leading with generic dashboard jargon
- leading with technical infrastructure
- making the hero about login

### 2. Problem / Why It Feels Different

Purpose:

- name the pain clearly so the rest of the page feels relevant

Recommended framing:

- many homeschool tools either feel too loose to keep students accountable or too rigid and calendar-heavy to support independence
- GridWorkz is designed around the weekly contract instead of the hourly schedule

Possible headline:

- `Less calendar micromanagement. More weekly clarity.`

### 3. How GridWorkz Works

Purpose:

- reduce the “I still do not understand the workflow” problem

Recommended three-step story:

1. `Parents define the week`
   - create subjects, assign resources, set block expectations
2. `Students run the day`
   - open their workspace, choose what to tackle next, use timers, log reflections
3. `Reports prove the work`
   - review weekly output, summaries, resources used, and completion history

This section should be simple and visual.

### 4. Parent Experience

Purpose:

- show what the parent actually gets, beyond vague promises

Recommended feature clusters:

- multi-student planning
- shared curriculum assignment
- weekly block setup
- live progress visibility
- plan-aware settings and management

Copy direction:

- emphasize control without implying constant supervision
- show that the dashboard is where the week is shaped, reviewed, and adjusted

### 5. Student Experience

Purpose:

- surface the strongest differentiator early enough

Recommended emphasis:

- students get a focused weekly workspace, not a cluttered admin screen
- work is broken into clear blocks
- timers, summaries, and progress feedback support independence
- optional student access protection exists through unique links and PIN behavior

Possible headline:

- `A student portal built for doing the work, not just viewing assignments.`

### 6. Reports And Accountability

Purpose:

- answer the trust question for parents who need real records

Recommended proof points:

- weekly reports
- block summaries and reflections
- resources used
- print/export orientation

This section matters because it turns the product from “planner” into “accountability system.”

### 7. Lockdown And Premium Expansion

Purpose:

- acknowledge the premium path without letting it dominate the site

Recommended approach:

- mention Lockdown as an optional advanced plan for families who want tighter focus control
- keep the copy concise and avoid making the homepage feel like browser-control software first

Important:

- Lockdown is a differentiator, but it is not the core entry story
- the core story is weekly planning plus student execution plus reporting

### 8. Pricing

Purpose:

- remove uncertainty before the visitor has to ask

Recommended layout:

- three simple cards for `Free`, `Core`, and `Lockdown`
- one short line on who each plan is for
- 3 to 5 bullets per card
- one primary CTA under each card

Current planning-aligned pricing story:

- `Free`
  - for trying the system with a small household
  - up to 2 students
  - up to 3 curriculum entries
- `Core`
  - for active homeschool families who want the full planning workspace
  - current pricing target: `$5/month`
  - up to 10 students
  - unlimited curriculum
  - future projects support
- `Lockdown`
  - for families who want the full planning workspace plus focus controls
  - current pricing target: `$10/month`
  - Core features included
  - Lockdown browser controls

Public-copy caution:

- if live billing is not ready, either label those prices as launch targets internally only or keep the exact cards hidden until the operational path is ready

### 9. FAQ

Purpose:

- clear objections without needing support contact

Recommended first FAQ set:

1. `Is this for homeschool families only?`
2. `Do students need their own accounts?`
3. `Can I manage multiple students?`
4. `Does this replace my curriculum?`
5. `How do reports work?`
6. `What is Lockdown?`
7. `Can I start free?`

### 10. Final CTA

Purpose:

- end with a clean decision point

Recommended content:

- short restatement of the value proposition
- `Start free`
- `Sign in`

## Messaging Rules

### Lead with outcomes, not features

Better:

- `Students know what to do next. Parents can see what got done.`

Worse:

- `React-powered LMS with dashboards and timers`

### Use homeschool language, but keep it readable

Preferred terms:

- week
- student workspace
- blocks
- progress
- reports
- proof of work
- resources

Use `curriculum` when helpful, but do not assume every visitor thinks in formal LMS terminology.

### Do not over-index on LMS jargon

`LMS` can appear in metadata or secondary copy, but it should not carry the main homepage message by itself.

### Keep sections bite-sized

Each section should answer one thing well. Avoid long walls of copy.

## Trust And Friction Reduction

The first version should intentionally reduce hesitation.

Recommended friction reducers:

- show pricing publicly
- show a real product screenshot or product mockup in the hero
- explain the workflow in 3 steps
- show the student portal, not only the parent dashboard
- include reporting/accountability language early
- keep `Sign in` visible for existing users
- avoid surprise pricing or hidden plan differences

Recommended future trust builders:

- parent testimonials
- sample weekly report preview
- short product walkthrough video
- “who this is best for” comparison section

## Visual Direction

The public site should preserve the existing brand language already visible in the login page and dashboard work.

Keep:

- `mysteria`, `lavender-glow`, `charcoal-ink`, `amethyst-link`, `warm-cream`, `parchment`
- `Super Sans VF`
- editorial, premium, structured layout direction

Recommended composition:

- deep mysteria hero with warm cream sections below
- alternating light and dark section bands for scroll rhythm
- annotated product frames instead of generic SaaS cards everywhere
- large headlines with restrained supporting copy

Avoid:

- default Tailwind marketing-template layouts
- overly playful homeschool clipart aesthetics
- a page that feels more corporate than the product itself

## Suggested First-Wave Assets

The first public homepage does not need a full photo shoot, but it should not ship with only text.

Recommended asset list:

1. hero screenshot or composed product mockup
2. parent dashboard crop with callouts
3. student portal crop with callouts
4. report preview crop
5. optional Lockdown visual chip or diagram

If lifestyle imagery is used, keep it sparse and secondary to the actual product.

## Suggested Copy Skeleton

### Hero

`Plan the week once. Let students run the day.`

`GridWorkz helps homeschool families organize weekly work, give students a focused workspace, and keep clear records of what got done.`

### How it works

`Set the week.`

`Students work through clear blocks, resources, and expectations instead of guessing what comes next.`

`Review the proof.`

`Weekly reports, summaries, and progress records make it easier to stay organized and accountable.`

### Pricing intro

`Start simple. Upgrade when your family needs more room or more control.`

## Implementation Phases

### Phase 1. Public homepage on `/`

Scope:

- route `/` to a real marketing homepage
- keep `/login` as the auth route
- build anchored scroll sections
- include hero, workflow, parent experience, student experience, reports, pricing, FAQ, final CTA

This is the minimum viable public site.

### Phase 2. Dedicated supporting pages

Scope:

- `/pricing`
- `/faq`
- optional `/about` or `/contact`
- optional sample report preview page

### Phase 3. Conversion and trust improvements

Scope:

- testimonials
- demo video
- better screenshots
- content experiments
- plan comparison refinements

## Open Decisions

1. Should public pricing go live before live-mode Stripe is ready, or should the site wait to show exact paid amounts?
2. Should the first CTA be `Start free`, `Create account`, or `Try GridWorkz free`?
3. Should Lockdown be visible on the homepage as a full section or only as a pricing-tier differentiator in Phase 1?
4. Should the first public site include a sample report preview to strengthen compliance and accountability trust?
5. Should testimonials wait until real customer language is available?

## Recommended Immediate Next Step

Build the first version as a single anchored homepage on `/` and keep the story disciplined:

- hero
- why it is different
- how it works
- parent experience
- student experience
- reports
- pricing
- FAQ
- final CTA

That is enough to replace the current auth-wall first impression without forcing the project into a full multi-page marketing build immediately.
