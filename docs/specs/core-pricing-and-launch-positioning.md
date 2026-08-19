# Core Pricing And Launch Positioning

Last updated: 2026-06-23

Status: Active planning spec

## Goal

Define the first paid-launch pricing and messaging surface for Own Path so the product can:

- present `Free`, `Core`, and `Lockdown` consistently
- launch the `$5/month` Core offer first
- keep Lockdown visible as a `coming soon` tier
- align public pricing, login entry, settings, dashboard locked states, and upgrade copy
- avoid implying that live self-serve billing or broad Lockdown paid reliance is already ready

This spec is for the first commercial positioning pass, not the final long-term packaging model.

## Shipping Unit Scope

This unit should ship as one linked pricing and messaging pass.

### Routes and surfaces in scope

- `/`
- `/login`
- `/dashboard/settings`
- dashboard shell locked states driven by `src/constants/dashboardFeatures.js`
- shared entitlement copy in `src/constants/entitlements.js`
- paid-module locked-state copy in `src/pages/dashboard/ChoresRoute.jsx`
- Lockdown locked and read-only copy in `src/components/LockdownPolicyPanel.jsx`

### Primary files

- `src/pages/MarketingHome.jsx`
- `src/pages/LoginPage.jsx`
- `src/pages/Settings.jsx`
- `src/constants/dashboardFeatures.js`
- `src/constants/entitlements.js`
- `src/pages/dashboard/ChoresRoute.jsx`
- `src/components/LockdownPolicyPanel.jsx`
- `docs/upgrades/subscriptions-and-entitlements.md`
- `docs/specs/public-marketing-site-and-landing-page.md`

## Locked Product Decisions

These decisions are already approved and should not be reopened in implementation chats unless explicitly changed by the project manager.

### Plan names and sequencing

- `Core` is the public paid-plan name for now.
- Internal plan ids remain `free`, `core`, and `lockdown`.
- Future packaging may split `Core` into narrower variants such as school-only, chores-only, or combined offers, but this pass should not pre-implement that split.

### Launch order

- The first paid launch should center on `Core` at `$5/month`.
- Lockdown stays in the pricing model and dashboard visibility model, but is not the immediate paid-launch focus.

### Lockdown visibility

- Lockdown should remain visible as a `coming soon` tier or module.
- Lockdown should act as a product attractor, not as a hidden future concept.
- Public and in-app copy must not imply that Lockdown is ready for broad paid reliance yet.
- Lockdown should use a visible `Get notified` CTA in public pricing and related launch-positioning surfaces.

### Billing readiness

- The app can show pricing and plan differences now.
- The app should not claim that live self-serve paid checkout is already available until the Stripe live-mode path is actually ready.

## Current-Code Reality

This spec must work with the current app state:

- `MarketingHome.jsx` already renders a pricing section using `EntitlementCatalog`.
- `LoginPage.jsx` is still mostly an auth card and does not yet help new parents understand plans.
- `Settings.jsx` already shows plan, usage, subscription-status, and feature-access cards.
- `dashboardFeatures.js` already exposes visible vs locked premium routes.
- `entitlements.js` already contains plan display names, prices, upgrade copy, and feature-copy definitions.
- Chores and Lockdown already use explicit locked-state copy instead of silently disappearing.

This unit is therefore mostly about copy, positioning, and locked-state consistency, not new billing infrastructure.

## Product Promise For This Unit

The pricing and plan story should communicate:

- Free is a meaningful on-ramp, not a crippled demo
- Core is the main paid homeschool planning workspace
- Lockdown is real enough to mention, but not ready enough to sell as broadly available today

Recommended public framing:

- `Free`: try the weekly system with a small household
- `Core`: the full homeschool planning and household workspace
- `Lockdown`: the future focus-control tier built on Core

## Route-Level Requirements

### 1. Marketing Home `/`

This page should be the clearest public expression of the commercial model.

Required outcomes:

- Show `Free`, `Core`, and `Lockdown` in the pricing section.
- Present `Core` as the main paid plan.
- Present `Lockdown` as visibly `coming soon`.
- Keep `Start free` as the primary CTA while live paid checkout is not public-ready.
- Avoid `Upgrade now` or `Buy now` language for Lockdown.
- Make the homepage feel more interactive than the current mostly static story layout.

Required pricing behavior:

- `Free` shows current free limits and what is included now.
- `Core` shows the `$5/month` target and its current included value.
- `Lockdown` shows `$10/month` with a visible `coming soon` treatment.

Required copy direction:

- `Core` should be described as the complete current paid experience for planning, multi-student scale, chores, and rewards.
- `Lockdown` should be described as the future focus-control tier that builds on Core.
- If a plan feature is not ready for general paid reliance, the copy should say so without sounding broken or apologetic.

Recommended Lockdown pricing treatment:

- visible card
- `Coming soon` badge
- one-sentence explanation of what it will add
- secondary CTA: `Get notified`

Do not:

- make Lockdown look purchasable today if it is not
- bury Lockdown entirely
- imply kiosk mode is shipping now

### 2. Login `/login`

This page should stay auth-first, but it should stop feeling disconnected from the public plan story.

Required outcomes:

- Existing parents can still sign in quickly.
- New parents can tell they are entering the Own Path parent account flow, not a generic admin screen.
- Sign-up mode should feel compatible with the Free-to-Core path.
- Sign-in and sign-up should feel meaningfully distinct instead of reading like one reused form with a text toggle.

Required copy direction:

- Keep the auth form primary.
- Add light plan-aware context only if it reduces confusion.
- Avoid turning login into a second marketing landing page.
- Do not place the full pricing table or detailed plan comparison directly on the login screen.

Recommended additions:

- separate sign-in and create-account tabs or an equivalent segmented control
- a short line about starting on Free
- a small link back to pricing or homepage
- sign-up language that suggests households can begin without live paid checkout
- sign-up language that makes it clear new accounts start on Free by default
- sign-up language that briefly explains the advantages of Core and the future Lockdown tier without turning the page into a pricing table

Do not:

- show heavy Lockdown upsell on the login card
- imply paid checkout happens inside the auth flow if it does not
- turn the login screen into a second pricing page

Recommended account-creation positioning:

- default all self-serve new accounts to the Free plan
- explain that Free is the starting path
- explain that Core expands household scale and unlocks paid planning and household features
- mention Lockdown only lightly as a future coming-soon tier

### 3. Settings `/dashboard/settings`

This page should become the parent-facing source of truth for current plan visibility.

Required outcomes:

- The current plan name and usage remain easy to scan.
- The page distinguishes current entitlement state from future pricing or launch status.
- Locked premium capabilities remain visible with clear explanations.
- Lockdown stays visible here as a future available tier, not a hidden feature.
- Core accounts should see Lockdown framed as a future upgrade path with a visible `coming soon` label.

Required plan-summary behavior:

- Show the parent’s active plan and current limits.
- Show feature-access cards with consistent plan language.
- Use copy that matches the homepage pricing story.

Required copy direction:

- Free accounts should understand what Core unlocks today.
- Core accounts should understand that Lockdown exists but is not broadly available yet.
- Lockdown-specific settings copy should not promise live availability unless that state is actually true for the account and launch phase.

### 4. Dashboard shell locked states

The shell should reinforce the product story:

- `Chores` remains visible and locked only when the plan does not include the paid household module.
- `Lockdown` remains visible in nav, even when unavailable.
- The unavailable Lockdown route should feel like a `coming soon` premium surface, not a dead end.

Required behavior:

- locked routes should explain why they are locked
- locked routes should explain what plan relationship exists
- Lockdown locked states should avoid a hard sell if general availability is intentionally deferred
- Lockdown locked states should still point toward the future paid path, with `coming soon` language rather than simple removal or silence

## Copy And Messaging Rules

These rules should govern implementation across all files in scope.

### Core

- Use `Core` consistently as the public plan name.
- Describe it as the current main paid plan.
- Emphasize multi-student scale, unlimited curriculum, chores, rewards, and future-ready expansion.
- Call out chores and rewards explicitly in the homepage pricing and feature story rather than burying them inside a generic workspace summary.

### Lockdown

- Use `coming soon` language in public-facing pricing and non-entitled locked states.
- Describe Lockdown as building on Core.
- Mention extension and kiosk direction carefully, without implying that the full public release path is live now.
- Prefer `Get notified` as the public CTA language for the Lockdown tier in this pass.

Recommended wording pattern:

- `Lockdown is our coming-soon focus-control tier for families who want tighter browsing and device boundaries on top of Core.`

### Free

- Position Free as a genuine starting plan.
- Avoid language that makes it sound like a temporary trial if it is not.
- Make the Free-to-Core upgrade path explicit without pressure-heavy copy.

### Billing state

- If pricing is shown but live self-serve billing is not ready, say so directly and calmly.
- Prefer language like:
  - `Start free`
  - `Paid checkout is rolling out separately`
  - `Pricing is shown here so families can compare plans before paid activation is opened broadly`

Do not use:

- `Buy now`
- `Unlock instantly`
- `Upgrade today`

unless the actual self-serve billing flow is ready for that exact surface.

## Auth UX And Trust Notes

These notes were raised during page review and should be preserved for implementation planning.

### In-scope for this shipping unit

- make sign-in and sign-up visually distinct, ideally with tabs or a segmented control
- improve the legitimacy and polish of the auth entry experience
- clarify that new households begin on Free
- provide a route back to the homepage and pricing context

### Likely separate follow-up workstream

These are important, but they may deserve their own focused auth hardening scope instead of being bundled casually into pricing-copy work:

- email verification requirements
- stronger account-creation data collection, if any beyond email and password
- social sign-in providers such as Google and Apple
- multi-factor authentication or 2-step verification

Implementation planning should treat these as product and security decisions, not just styling tasks.

Current code reality:

- auth currently uses email and password only through Firebase Auth
- password reset exists
- email verification is not currently enforced
- social sign-in providers are not currently wired
- MFA is not currently wired

Feasibility note:

- Google sign-in should be straightforward with Firebase Auth
- Apple sign-in should also be possible, but typically needs more provider and platform setup
- email verification and MFA are both possible with Firebase Auth, but they should be intentionally designed as part of the account lifecycle rather than dropped in as visual add-ons

## Homepage Interaction Direction

The homepage should become more interactive than the current mostly static launch page.

For this pricing and launch-positioning pass:

- the page should feel more alive than a simple text stack
- the pricing and feature storytelling should include clearer examples or preview treatments where practical
- chores and rewards should be called out specifically as part of Core
- the page does not yet need final production screenshots for every module
- once the other major surfaces are finalized and production ready, the homepage should be updated again to include stronger real-product examples and visuals

This means the first implementation pass can improve interaction, hierarchy, and examples without pretending the final screenshot library is already complete.

## Locked-State UX Requirements

### Chores locked state

For Free accounts:

- daily routines remain available
- paid chores, allowance, points, rewards, redemptions, and related cosmetics stay clearly identified as Core features

The copy should support:

- a real Free experience
- a clear Core upsell
- no ambiguity about which parts of the household module are already usable

### Lockdown locked state

For Free and Core accounts:

- route stays visible
- route explains that Lockdown is a separate tier
- route uses `coming soon` framing where appropriate for the broader launch
- route can still preserve read-only visibility for saved Lockdown state if the account has existing data

The copy should balance two truths:

- `this is not generally ready for broad paid rollout yet`
- `this is a real planned premium tier, not a fake placeholder`

## Non-Goals

- Do not implement live Stripe checkout in this unit.
- Do not redesign chores, reports, curriculum, or the student portal beyond messaging touched by the plan story.
- Do not reopen the broader Lockdown implementation workflow.
- Do not split Core into multiple paid variants in code yet.
- Do not build a waitlist backend unless separately scoped.

## Implementation Notes

### Entitlement constants

`src/constants/entitlements.js` should remain the source of truth for:

- display names
- plan prices
- upgrade copy
- feature availability descriptions

Implementation should normalize plan copy there instead of scattering new strings across pages where possible.

### Marketing pricing cards

`src/pages/MarketingHome.jsx` should remain data-driven from `EntitlementCatalog`, but the Lockdown card likely needs explicit display treatment beyond generic plan rendering.

### Settings feature-access cards

`src/pages/Settings.jsx` already renders feature cards and locked-copy areas. This unit should improve consistency, not replace that surface with a different model.

## Validation Requirements

Before this unit is considered done:

- homepage pricing and FAQ reflect Free, Core, and Lockdown consistently
- login page still supports sign-in, sign-up, and password reset cleanly
- settings page still renders plan usage and feature cards without regressions
- dashboard nav still shows the right visible vs locked routes
- chores locked state and Lockdown locked state use the updated copy model
- `npm run build` passes
- `npm run lint` passes

Manual QA should include:

- logged-out homepage review on desktop and mobile
- `/login` sign-in and sign-up mode copy check
- Free account settings review
- Core account settings review
- Free/Core locked-state pass on `/dashboard/chores` and `/dashboard/lockdown`

## Follow-Up Specs Likely Needed After This Unit

- auth hardening and signup lifecycle
- students and dashboard-shell polish
- curriculum and weekly-planning finalization
- reports and rollover finalization
- chores and rewards UX finalization

## Implementation Readiness

This spec is now product-decision complete enough to hand to an implementation chat for execution planning.
