import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Menu, X } from 'lucide-react';
import {
  EntitlementCatalog,
  EntitlementFeatureCatalog,
  EntitlementFeatureKeys,
  EntitlementLimitKeys,
  PlanIds,
  isUnlimitedPlanLimit,
} from '../constants/entitlements';

const marketingNavLinks = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'features', label: 'Parent experience' },
  { id: 'student-experience', label: 'Student experience' },
  { id: 'reports', label: 'Reports' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

const heroProofPoints = [
  'Multi-student planning',
  'Student portal access',
  'Timers and reflections',
  'Weekly reports',
];

const weeklyWorkflow = [
  {
    step: '01',
    title: 'Parents define the week',
    description:
      'Build subjects, assign work across students, and keep instructions, links, and expectations in one place.',
  },
  {
    step: '02',
    title: 'Students run the day',
    description:
      'Students open their own workspace, choose what to tackle next, use timers, and submit the work that happened.',
  },
  {
    step: '03',
    title: 'Reports prove the work',
    description:
      'The week ends with report history, parent review, and printable records instead of scattered notes and memory.',
  },
];

const parentStoryCards = [
  {
    title: 'One dashboard for the family',
    description:
      'The parent side keeps students, live activity, and weekly status visible without turning the product into a daily bell schedule.',
  },
  {
    title: 'Curriculum that stays editable',
    description:
      'Subjects can be managed from the dashboard, assigned across students, and updated as the real week changes.',
  },
  {
    title: 'Settings that keep reporting usable',
    description:
      'School-year labels, quarter context, and weekly reset timing stay attached to the records parents need later.',
  },
];

const studentStoryCards = [
  {
    title: 'A simple entrance',
    description:
      'Students use their own public portal link, with optional PIN protection when a family wants the extra gate.',
  },
  {
    title: 'A workspace, not an admin panel',
    description:
      'The student view focuses on assigned subjects, instructions, resources, timers, and what can be finished now.',
  },
  {
    title: 'Action over hovering',
    description:
      'Students can log progress, complete blocks, and leave short reflections without needing a parent beside them for every step.',
  },
];

const reportStoryPoints = [
  'Weekly report history that stays tied to school-year and quarter context',
  'A review surface for completion, summaries, and the shape of the week that was actually completed',
  'Print and export paths for families who need usable records outside the app',
];

const pricingPlanOrder = [PlanIds.FREE, PlanIds.CORE, PlanIds.LOCKDOWN];

const pricingCardMeta = Object.freeze({
  [PlanIds.FREE]: {
    eyebrow: 'Try the weekly system',
    description:
      'For trying GridWorkz with a smaller household before you need more room or more control.',
    ctaNote: 'No billing is required to begin on Free.',
    accentClassName: 'border-parchment/80 bg-white/84',
  },
  [PlanIds.CORE]: {
    eyebrow: 'Full planning workspace',
    description:
      'For active homeschool families who want the complete weekly planning surface and a larger household cap.',
    ctaNote: 'Public paid checkout is not self-serve yet, so the entry path still starts free.',
    accentClassName:
      'border-mysteria/18 bg-[linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(203,183,251,0.16))]',
  },
  [PlanIds.LOCKDOWN]: {
    eyebrow: 'Focus-control plan',
    description:
      'For families who want the Core planning workspace plus tighter focus controls as Lockdown expands.',
    ctaNote: 'Lockdown activation follows the current billing rollout after signup.',
    accentClassName:
      'border-charcoal-ink/12 bg-[linear-gradient(180deg,_rgba(27,25,56,0.04),_rgba(113,76,182,0.16))]',
  },
});

const faqItems = [
  {
    question: 'Is this for homeschool families only?',
    answer:
      'That is the product focus. The weekly planning language, student workspace, and reporting flow are built around homeschool households rather than a classroom roster.',
  },
  {
    question: 'Do students need their own accounts?',
    answer:
      'No. Parents use the dashboard account, and students work from their own portal link. Families can add an access PIN when they want a lighter gate without creating a full second login.',
  },
  {
    question: 'Can I manage multiple students?',
    answer:
      'Yes. Multi-student planning is part of the core product shape. The Free plan covers up to 2 students, and Core plus Lockdown cover up to 10 students.',
  },
  {
    question: 'Does this replace my curriculum?',
    answer:
      'No. GridWorkz is the planning and execution layer around your curriculum. Parents turn the week’s subjects, instructions, and resources into a workspace students can actually run.',
  },
  {
    question: 'How do reports work?',
    answer:
      'Work completed through the week rolls into report history with school-year and quarter context, summaries, reflections, and print or export paths for families who need clean records.',
  },
  {
    question: 'What is Lockdown?',
    answer:
      'Lockdown is the optional advanced plan for families who want tighter focus controls. It builds on Core and is the only plan that includes Lockdown extension and kiosk entitlements.',
  },
  {
    question: 'Can I start free?',
    answer:
      'Yes. The public entry path still starts through the current signup flow. The site does not advertise a live self-serve paid checkout yet, so families can begin on Free and move up when the paid path is ready.',
  },
];

const surfaceClassName =
  'rounded-[32px] border border-parchment/90 bg-white/82 p-6 shadow-[0_24px_80px_rgba(41,40,39,0.09)] backdrop-blur sm:p-8';

const formatPlanLimitLabel = (limitValue, singularLabel, pluralLabel = `${singularLabel}s`) => {
  if (isUnlimitedPlanLimit(limitValue)) {
    return `Unlimited ${pluralLabel}`;
  }

  return `Up to ${limitValue} ${limitValue === 1 ? singularLabel : pluralLabel}`;
};

const buildPricingPoints = (planId) => {
  const plan = EntitlementCatalog[planId];

  const points = [
    formatPlanLimitLabel(
      plan.limits[EntitlementLimitKeys.STUDENTS],
      'student',
    ),
    formatPlanLimitLabel(
      plan.limits[EntitlementLimitKeys.CURRICULUM_ITEMS],
      'curriculum item',
    ),
    plan.features[EntitlementFeatureKeys.PROJECTS]
      ? EntitlementFeatureCatalog[EntitlementFeatureKeys.PROJECTS].availableDescription
      : EntitlementFeatureCatalog[EntitlementFeatureKeys.PROJECTS].lockedDescription,
  ];

  if (plan.features[EntitlementFeatureKeys.LOCKDOWN_EXTENSION]) {
    points.push(EntitlementFeatureCatalog[EntitlementFeatureKeys.LOCKDOWN_EXTENSION].availableDescription);
  } else {
    points.push('Lockdown browser controls stay reserved for the Lockdown plan.');
  }

  if (plan.features[EntitlementFeatureKeys.LOCKDOWN_KIOSK]) {
    points.push(EntitlementFeatureCatalog[EntitlementFeatureKeys.LOCKDOWN_KIOSK].availableDescription);
  }

  return points;
};

function MarketingHome() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const anchorId = window.location.hash.replace('#', '');
    if (!anchorId) {
      return undefined;
    }

    const scrollTimeout = window.setTimeout(() => {
      const target = document.getElementById(anchorId);
      if (target) {
        target.scrollIntoView({ block: 'start' });
      }
    }, 0);

    return () => window.clearTimeout(scrollTimeout);
  }, []);

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const handleAnchorNavigation = (event, id) => {
    event.preventDefault();
    closeMobileMenu();

    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    window.history.pushState(null, '', `#${id}`);
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const pricingPlans = pricingPlanOrder.map((planId) => {
    const plan = EntitlementCatalog[planId];

    return {
      ...pricingCardMeta[planId],
      planId,
      displayName: plan.displayName,
      priceLabel: plan.priceLabel,
      points: buildPricingPoints(planId),
      priceContextLabel: planId === PlanIds.FREE ? 'Start here' : 'Current plan target',
    };
  });

  return (
    <div className="relative min-h-screen overflow-x-clip bg-warm-cream text-charcoal-ink">
      <div className="absolute inset-x-0 top-0 -z-10 overflow-hidden">
        <div className="mx-auto h-[40rem] max-w-7xl bg-[radial-gradient(circle_at_top_left,_rgba(203,183,251,0.42),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(113,76,182,0.2),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.6)_0%,_rgba(233,229,221,0)_78%)]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-parchment/80 bg-warm-cream/94 shadow-[0_10px_30px_rgba(41,40,39,0.05)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="inline-flex items-center gap-2 text-xs font-label uppercase tracking-[0.18em] text-charcoal-ink sm:gap-3 sm:text-sm sm:tracking-[0.24em]"
            onClick={(event) => handleAnchorNavigation(event, 'top')}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-lavender-glow" />
            GridWorkz
          </a>

          <nav className="ml-auto hidden items-center gap-5 xl:flex" aria-label="Primary">
            {marketingNavLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className="text-sm font-body text-charcoal-ink/72 transition hover:text-charcoal-ink"
                onClick={(event) => handleAnchorNavigation(event, link.id)}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 xl:flex">
            <Link
              to="/login"
              className="inline-flex items-center rounded-full border border-parchment px-4 py-2 text-sm font-label text-charcoal-ink transition hover:border-charcoal-ink"
            >
              Sign in
            </Link>
            <Link
              to="/login?mode=signup"
              className="inline-flex items-center gap-2 rounded-full bg-charcoal-ink px-5 py-2 text-sm font-label text-white transition hover:bg-mysteria"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2 xl:hidden">
            <Link
              to="/login?mode=signup"
              className="inline-flex h-10 items-center justify-center rounded-full bg-charcoal-ink px-4 text-xs font-label text-white transition hover:bg-mysteria sm:px-5 sm:text-sm"
              onClick={closeMobileMenu}
            >
              Start free
            </Link>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-parchment bg-white/60 text-charcoal-ink transition hover:border-charcoal-ink"
              aria-expanded={mobileMenuOpen}
              aria-controls="marketing-mobile-menu"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div
            id="marketing-mobile-menu"
            className="border-t border-parchment bg-warm-cream/98 px-4 py-4 shadow-[0_20px_50px_rgba(41,40,39,0.12)] xl:hidden"
          >
            <nav className="flex flex-col gap-2" aria-label="Mobile">
              {marketingNavLinks.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  className="rounded-2xl px-3 py-3 text-sm font-body text-charcoal-ink/80 transition hover:bg-white/70 hover:text-charcoal-ink"
                  onClick={(event) => handleAnchorNavigation(event, link.id)}
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-parchment pt-3">
                <Link
                  to="/login"
                  className="rounded-2xl border border-parchment bg-white/64 px-3 py-3 text-center text-sm font-label text-charcoal-ink"
                  onClick={closeMobileMenu}
                >
                  Sign in
                </Link>
                <Link
                  to="/login?mode=signup"
                  className="rounded-2xl bg-charcoal-ink px-3 py-3 text-center text-sm font-label text-white"
                  onClick={closeMobileMenu}
                >
                  Start free
                </Link>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="top">
        <section className="mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 sm:pb-18 sm:pt-16 lg:px-8 lg:pb-24">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(21rem,0.92fr)] lg:items-start">
            <div className="space-y-6">
              <p className="text-xs font-label uppercase tracking-[0.24em] text-amethyst-link">
                Homeschool planning, student independence, and weekly proof of work
              </p>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-display leading-[0.98] tracking-normal text-mysteria sm:text-6xl sm:leading-[0.96]">
                  Plan the week once. Let students run the day.
                </h1>
                <p className="max-w-2xl text-lg font-body leading-8 text-charcoal-ink/78 sm:text-xl">
                  GridWorkz is a weekly homeschool planner and student workspace for families who
                  want structure without constant rescheduling. Parents set the week, students work
                  from a simpler portal, and weekly reports keep the record straight.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login?mode=signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-charcoal-ink px-6 py-3 text-sm font-label text-white transition hover:bg-mysteria"
                >
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#pricing"
                  className="inline-flex items-center justify-center rounded-full border border-parchment bg-white/82 px-6 py-3 text-sm font-label text-charcoal-ink transition hover:border-charcoal-ink"
                  onClick={(event) => handleAnchorNavigation(event, 'pricing')}
                >
                  See pricing
                </a>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-label text-amethyst-link transition hover:text-mysteria"
                >
                  Sign in
                </Link>
              </div>

              <div className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-4">
                {heroProofPoints.map((point) => (
                  <div
                    key={point}
                    className="flex items-center gap-2 rounded-2xl border border-parchment/80 bg-white/76 px-4 py-3 text-sm font-body text-charcoal-ink/78"
                  >
                    <CheckCircle2 className="h-4 w-4 flex-none text-amethyst-link" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <aside className={`${surfaceClassName} lg:sticky lg:top-24`}>
              <p className="text-xs font-label uppercase tracking-[0.24em] text-amethyst-link">
                The GridWorkz rhythm
              </p>
              <h2 className="mt-3 text-2xl font-display tracking-normal text-mysteria">
                Parents define the week. Students run it. Reports prove it.
              </h2>
              <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/74">
                The public story stays product-led because the value is the handoff itself: one
                parent surface, one student workspace, and a weekly record that does not disappear
                when Friday ends.
              </p>

              <div className="mt-6 overflow-hidden rounded-[28px] bg-mysteria text-white shadow-[0_20px_60px_rgba(27,25,56,0.24)]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-lavender-glow/90" />
                    <span className="h-2 w-2 rounded-full bg-white/35" />
                    <span className="h-2 w-2 rounded-full bg-white/20" />
                  </div>
                  <p className="text-[11px] font-label uppercase tracking-[0.18em] text-white/58">
                    Weekly workspace
                  </p>
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-xs font-label uppercase tracking-[0.24em] text-lavender-glow">
                    This week in GridWorkz
                  </p>
                  <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
                    <p className="text-xs font-label uppercase tracking-[0.2em] text-white/66">
                      Parent setup
                    </p>
                    <p className="mt-2 text-base font-display tracking-normal text-white">
                      Math, reading, science, and PE across two students
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
                    <p className="text-xs font-label uppercase tracking-[0.2em] text-white/66">
                      Student portal
                    </p>
                    <p className="mt-2 text-base font-display tracking-normal text-white">
                      Work cards, timers, instructions, and progress in one warmer view
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
                    <p className="text-xs font-label uppercase tracking-[0.2em] text-white/66">
                      Weekly record
                    </p>
                    <p className="mt-2 text-base font-display tracking-normal text-white">
                      Completion history ready for parent review and print/export
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 hidden space-y-3 lg:block">
                {marketingNavLinks.map((link, index) => (
                  <a
                    key={link.id}
                    href={`#${link.id}`}
                    className="flex items-center justify-between rounded-2xl border border-parchment/80 bg-warm-cream/72 px-4 py-3 text-sm font-body text-charcoal-ink transition hover:border-charcoal-ink"
                    onClick={(event) => handleAnchorNavigation(event, link.id)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <span>{link.label}</span>
                  </a>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-12 lg:px-8">
          <div className={`${surfaceClassName} grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)] lg:items-start`}>
            <div>
              <p className="text-xs font-label uppercase tracking-[0.24em] text-amethyst-link">
                Problem framing
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-display tracking-normal text-mysteria sm:text-[2.5rem]">
                Less calendar micromanagement. More weekly clarity.
              </h2>
              <p className="mt-4 max-w-2xl text-base font-body leading-8 text-charcoal-ink/78">
                Many homeschool tools either keep the whole plan in the parent&apos;s head or push
                families into a rigid schedule that students cannot actually own. GridWorkz is built
                around the weekly contract instead: what has to get done, what the student can open
                right now, and what the parent can prove later.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-parchment/80 bg-warm-cream/78 p-5">
                <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/62">
                  Without a weekly system
                </p>
                <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/76">
                  Parents repeat the same directions, students lose the thread between subjects, and
                  the record of the week lives in scraps.
                </p>
              </div>
              <div className="rounded-[28px] border border-parchment/80 bg-white/84 p-5">
                <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/62">
                  With GridWorkz
                </p>
                <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/76">
                  The week starts with a parent plan, moves through a focused student workspace, and
                  ends with one report trail instead of guesswork.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-10 sm:scroll-mt-28 sm:px-6 sm:pb-12 lg:px-8"
        >
          <div className={`${surfaceClassName} grid gap-10 lg:grid-cols-[minmax(0,0.96fr)_minmax(18rem,0.84fr)] lg:items-start`}>
            <div>
              <p className="text-xs font-label uppercase tracking-[0.24em] text-amethyst-link">
                Workflow
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-display tracking-normal text-mysteria sm:text-[2.5rem]">
                A weekly handoff both parent and student can understand
              </h2>
              <p className="mt-4 max-w-2xl text-base font-body leading-8 text-charcoal-ink/78">
                GridWorkz does not ask a parent to build an hourly classroom. It gives the family a
                clear sequence: define the work, open the student workspace, and keep a report trail
                when the week is over.
              </p>

              <div className="mt-8 grid gap-4">
                {weeklyWorkflow.map((item) => (
                  <div
                    key={item.step}
                    className="rounded-[28px] border border-parchment/80 bg-white/78 p-5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-mysteria text-sm font-label text-white">
                        {item.step}
                      </span>
                      <h3 className="text-xl font-display tracking-normal text-mysteria">
                        {item.title}
                      </h3>
                    </div>
                    <p className="mt-4 text-sm font-body leading-7 text-charcoal-ink/76">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[30px] bg-[linear-gradient(145deg,_rgba(27,25,56,1),_rgba(113,76,182,0.94))] p-6 text-white shadow-[0_24px_80px_rgba(27,25,56,0.22)]">
                <p className="text-xs font-label uppercase tracking-[0.24em] text-lavender-glow">
                  Week view
                </p>
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs font-label uppercase tracking-[0.2em] text-white/60">
                      Math
                    </p>
                    <p className="mt-2 text-sm font-body text-white">
                      Fraction practice with timer support and a place to record the result
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs font-label uppercase tracking-[0.2em] text-white/60">
                      Reading
                    </p>
                    <p className="mt-2 text-sm font-body text-white">
                      Assigned resource plus a short summary after the student finishes
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3">
                    <p className="text-xs font-label uppercase tracking-[0.2em] text-white/60">
                      Science
                    </p>
                    <p className="mt-2 text-sm font-body text-white">
                      Instructions, links, and a completion record that rolls into reporting later
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[28px] border border-parchment/80 bg-warm-cream/74 p-5">
                  <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                    Planning stance
                  </p>
                  <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/76">
                    Weekly workload matters more than time-of-day micromanagement.
                  </p>
                </div>
                <div className="rounded-[28px] border border-parchment/80 bg-white/82 p-5">
                  <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                    Outcome
                  </p>
                  <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/76">
                    The student always knows what is live, and the parent is not rebuilding the week
                    from scratch every morning.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-10 sm:scroll-mt-28 sm:px-6 sm:pb-12 lg:px-8"
        >
          <div className={`${surfaceClassName} grid gap-10 lg:grid-cols-[minmax(0,0.94fr)_minmax(18rem,0.86fr)] lg:items-start`}>
            <div>
              <p className="text-xs font-label uppercase tracking-[0.24em] text-amethyst-link">
                Parent experience
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-display tracking-normal text-mysteria sm:text-[2.5rem]">
                Parent control without building a giant admin machine
              </h2>
              <p className="mt-4 max-w-2xl text-base font-body leading-8 text-charcoal-ink/78">
                The parent side is where the week gets defined, adjusted, and reviewed. It keeps
                household oversight visible while still letting the student portal stay lighter and
                easier to use.
              </p>

              <div className="mt-8 grid gap-4">
                {parentStoryCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-[28px] border border-parchment/80 bg-white/80 p-5"
                  >
                    <h3 className="text-xl font-display tracking-normal text-mysteria">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/76">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] bg-[linear-gradient(160deg,_rgba(113,76,182,0.14),_rgba(27,25,56,0.06))] p-6">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-mysteria px-3 py-1 text-xs font-label uppercase tracking-[0.18em] text-white">
                  Dashboard
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-label uppercase tracking-[0.18em] text-charcoal-ink">
                  Curriculum
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-label uppercase tracking-[0.18em] text-charcoal-ink">
                  Settings
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-[28px] border border-white/60 bg-white/84 p-5 shadow-[0_16px_40px_rgba(41,40,39,0.08)]">
                  <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                    Household overview
                  </p>
                  <p className="mt-3 text-base font-display tracking-normal text-mysteria">
                    A parent can see the family week, recent activity, and where intervention is
                    needed without leaving the main dashboard shell.
                  </p>
                </div>
                <div className="rounded-[28px] border border-white/60 bg-white/84 p-5 shadow-[0_16px_40px_rgba(41,40,39,0.08)]">
                  <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                    Weekly stability
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-warm-cream/74 p-4">
                      <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                        Multi-student assignment
                      </p>
                    </div>
                    <div className="rounded-2xl bg-warm-cream/74 p-4">
                      <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                        School-year settings
                      </p>
                    </div>
                    <div className="rounded-2xl bg-warm-cream/74 p-4">
                      <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                        Weekly reset timing
                      </p>
                    </div>
                    <div className="rounded-2xl bg-warm-cream/74 p-4">
                      <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                        Report context
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="student-experience"
          className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-10 sm:scroll-mt-28 sm:px-6 sm:pb-12 lg:px-8"
        >
          <div className={`${surfaceClassName} grid gap-10 lg:grid-cols-[minmax(18rem,0.88fr)_minmax(0,0.98fr)] lg:items-start`}>
            <div className="rounded-[32px] bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(233,229,221,0.88))] p-6 shadow-[0_20px_60px_rgba(41,40,39,0.08)]">
              <p className="text-xs font-label uppercase tracking-[0.24em] text-amethyst-link">
                Student portal
              </p>
              <div className="mt-5 space-y-4">
                <div className="rounded-[28px] border border-parchment/80 bg-white/90 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                        Now working
                      </p>
                      <p className="mt-2 text-lg font-display tracking-normal text-mysteria">
                        Math practice
                      </p>
                    </div>
                    <span className="rounded-full bg-mysteria px-3 py-1 text-xs font-label uppercase tracking-[0.18em] text-white">
                      Timer ready
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/76">
                    Instructions stay visible, the next block is obvious, and the student can keep
                    moving without reopening the parent side.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[28px] border border-parchment/80 bg-warm-cream/82 p-5">
                    <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                      Assigned resources
                    </p>
                    <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/76">
                      Links and supporting material stay attached to the work instead of living in a
                      separate message thread.
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-parchment/80 bg-warm-cream/82 p-5">
                    <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                      Reflection and completion
                    </p>
                    <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/76">
                      Students can finish the block, add a short note, and leave a cleaner record
                      behind for the report.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-label uppercase tracking-[0.24em] text-amethyst-link">
                Student experience
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-display tracking-normal text-mysteria sm:text-[2.5rem]">
                A student workspace built to be used without constant hovering
              </h2>
              <p className="mt-4 max-w-2xl text-base font-body leading-8 text-charcoal-ink/78">
                The student side should feel warmer and more direct than the parent shell. It is a
                work surface: open the portal, see what is live, use the timer when needed, and
                finish the block with enough context for accountability later.
              </p>

              <div className="mt-8 grid gap-4">
                {studentStoryCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-[28px] border border-parchment/80 bg-white/80 p-5"
                  >
                    <h3 className="text-xl font-display tracking-normal text-mysteria">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/76">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="reports"
          className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-10 sm:scroll-mt-28 sm:px-6 sm:pb-12 lg:px-8"
        >
          <div className={`${surfaceClassName} grid gap-10 lg:grid-cols-[minmax(0,0.94fr)_minmax(20rem,0.86fr)] lg:items-start`}>
            <div>
              <p className="text-xs font-label uppercase tracking-[0.24em] text-amethyst-link">
                Reports and accountability
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-display tracking-normal text-mysteria sm:text-[2.5rem]">
                Reports that keep the week from disappearing
              </h2>
              <p className="mt-4 max-w-2xl text-base font-body leading-8 text-charcoal-ink/78">
                GridWorkz matters most when the work can be reviewed afterward. The reporting side
                keeps the week tied to real records instead of asking a parent to reconstruct what
                happened from memory, paper scraps, and browser tabs.
              </p>

              <div className="mt-8 grid gap-4">
                {reportStoryPoints.map((point) => (
                  <div
                    key={point}
                    className="flex gap-3 rounded-[28px] border border-parchment/80 bg-white/82 p-5"
                  >
                    <CheckCircle2 className="mt-1 h-5 w-5 flex-none text-amethyst-link" />
                    <p className="text-sm font-body leading-7 text-charcoal-ink/78">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] bg-[linear-gradient(180deg,_rgba(27,25,56,0.06),_rgba(113,76,182,0.16))] p-6">
              <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(41,40,39,0.08)]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-mysteria px-3 py-1 text-xs font-label uppercase tracking-[0.18em] text-white">
                    Weekly reports
                  </span>
                  <span className="rounded-full bg-warm-cream px-3 py-1 text-xs font-label uppercase tracking-[0.18em] text-charcoal-ink">
                    Quarter labels
                  </span>
                  <span className="rounded-full bg-warm-cream px-3 py-1 text-xs font-label uppercase tracking-[0.18em] text-charcoal-ink">
                    Print / export
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-[24px] border border-parchment/80 bg-warm-cream/70 p-4">
                    <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                      What a parent sees
                    </p>
                    <p className="mt-3 text-base font-display tracking-normal text-mysteria">
                      A report list that can be filtered, reviewed, and taken out of the app when a
                      family needs a clean weekly record.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-parchment/80 bg-white p-4">
                    <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                      What it avoids
                    </p>
                    <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/76">
                      End-of-week guesswork, missing context, and reporting that only makes sense to
                      the person who built the plan.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-10 sm:scroll-mt-28 sm:px-6 sm:pb-12 lg:px-8"
        >
          <div className={surfaceClassName}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(18rem,0.78fr)] lg:items-start">
              <div>
                <p className="text-xs font-label uppercase tracking-[0.24em] text-amethyst-link">
                  Pricing
                </p>
                <h2 className="mt-3 max-w-2xl text-3xl font-display tracking-normal text-mysteria sm:text-[2.5rem]">
                  Start simple. Upgrade when your family needs more room or more control.
                </h2>
                <p className="mt-4 max-w-2xl text-base font-body leading-8 text-charcoal-ink/78">
                  The weekly story stays the same across every plan: parents shape the week,
                  students work from a focused portal, and reports keep the record straight. The
                  differences below come from the live entitlement contract already wired into the
                  app.
                </p>
              </div>

              <div className="rounded-[28px] border border-dashed border-parchment bg-warm-cream/80 p-5">
                <p className="text-xs font-label uppercase tracking-[0.2em] text-charcoal-ink/60">
                  Billing readiness note
                </p>
                <p className="mt-3 text-sm font-body leading-7 text-charcoal-ink/74">
                  Public pricing is informative now, but the site is not advertising a live
                  self-serve paid checkout yet. Every CTA here still routes through the current
                  signup or sign-in path.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to="/login?mode=signup"
                    className="inline-flex items-center gap-2 text-sm font-label text-amethyst-link transition hover:text-mysteria"
                  >
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center text-sm font-label text-charcoal-ink/78 transition hover:text-charcoal-ink"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 xl:grid-cols-3">
              {pricingPlans.map((plan) => (
                <article
                  key={plan.planId}
                  className={`rounded-[30px] border p-6 shadow-[0_18px_50px_rgba(41,40,39,0.08)] ${plan.accentClassName}`}
                >
                  <p className="text-xs font-label uppercase tracking-[0.24em] text-amethyst-link">
                    {plan.eyebrow}
                  </p>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-2xl font-display tracking-normal text-mysteria">
                        {plan.displayName}
                      </h3>
                      <p className="mt-3 max-w-xs text-sm font-body leading-7 text-charcoal-ink/76">
                        {plan.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/88 px-3 py-1 text-[11px] font-label uppercase tracking-[0.18em] text-charcoal-ink/68">
                      {plan.priceContextLabel}
                    </span>
                  </div>

                  <div className="mt-6 border-t border-parchment/70 pt-5">
                    <p className="text-4xl font-display tracking-normal text-charcoal-ink">
                      {plan.priceLabel}
                    </p>
                    <p className="mt-2 text-sm font-body text-charcoal-ink/64">
                      {plan.planId === PlanIds.FREE
                        ? 'Smaller-household entry plan'
                        : 'Paid plan pricing shown for decision-making clarity'}
                    </p>
                  </div>

                  <div className="mt-6 space-y-3">
                    {plan.points.map((point) => (
                      <div key={point} className="flex gap-3 rounded-[22px] bg-white/74 px-4 py-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-amethyst-link" />
                        <p className="text-sm font-body leading-6 text-charcoal-ink/78">{point}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <Link
                      to="/login?mode=signup"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-charcoal-ink px-5 py-3 text-sm font-label text-white transition hover:bg-mysteria"
                    >
                      Start free
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <p className="mt-3 text-sm font-body leading-6 text-charcoal-ink/68">
                      {plan.ctaNote}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="faq"
          className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-10 sm:scroll-mt-28 sm:px-6 sm:pb-12 lg:px-8"
        >
          <div className={`${surfaceClassName} grid gap-8 lg:grid-cols-[minmax(18rem,0.86fr)_minmax(0,0.94fr)] lg:items-start`}>
            <div>
              <p className="text-xs font-label uppercase tracking-[0.24em] text-amethyst-link">
                FAQ
              </p>
              <h2 className="mt-3 max-w-xl text-3xl font-display tracking-normal text-mysteria sm:text-[2.5rem]">
                Clear answers before a family hits the auth wall
              </h2>
              <p className="mt-4 max-w-xl text-base font-body leading-8 text-charcoal-ink/78">
                The goal here is not a giant support page. It is enough context to remove the
                common hesitation points before someone chooses between starting free, revisiting
                pricing, or signing back in.
              </p>

              <div className="mt-6 rounded-[28px] bg-[linear-gradient(155deg,_rgba(27,25,56,1),_rgba(113,76,182,0.92))] p-5 text-white shadow-[0_20px_60px_rgba(27,25,56,0.22)]">
                <p className="text-xs font-label uppercase tracking-[0.2em] text-lavender-glow">
                  Need the short version?
                </p>
                <p className="mt-3 text-sm font-body leading-7 text-white/86">
                  Parents keep the weekly planning account. Students work from a simpler portal.
                  Free is the current safe entry point, and paid plan details stay public without
                  pretending checkout is already a one-click homepage flow.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {faqItems.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-[28px] border border-parchment/80 bg-white/82 p-5 open:shadow-[0_16px_40px_rgba(41,40,39,0.06)]"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                    <span className="text-lg font-display tracking-normal text-mysteria">
                      {item.question}
                    </span>
                    <span className="flex-none pt-1 text-sm font-label uppercase tracking-[0.18em] text-charcoal-ink/52">
                      <span className="group-open:hidden">Open</span>
                      <span className="hidden group-open:inline">Close</span>
                    </span>
                  </summary>
                  <p className="mt-4 pr-6 text-sm font-body leading-7 text-charcoal-ink/76">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-18 lg:px-8 lg:pb-24">
          <div className="rounded-[36px] bg-[linear-gradient(150deg,_rgba(27,25,56,1)_0%,_rgba(60,40,111,0.96)_46%,_rgba(113,76,182,0.9)_100%)] px-6 py-8 text-white shadow-[0_24px_80px_rgba(27,25,56,0.24)] sm:px-8 sm:py-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <p className="text-xs font-label uppercase tracking-[0.24em] text-lavender-glow">
                  Final step
                </p>
                <h2 className="mt-3 max-w-3xl text-3xl font-display tracking-normal text-white sm:text-[2.6rem]">
                  Set the week once, hand students a clearer workspace, and keep the proof of work
                  in one place.
                </h2>
                <p className="mt-4 max-w-2xl text-base font-body leading-8 text-white/78">
                  Start with the free plan if you are new to GridWorkz. If you already have a
                  parent account, the existing sign-in path is still the fastest way back into the
                  dashboard.
                </p>
                <p className="mt-4 text-sm font-body leading-7 text-white/68">
                  Need one more pass first? Revisit <a href="#pricing" className="font-label text-lavender-glow transition hover:text-white" onClick={(event) => handleAnchorNavigation(event, 'pricing')}>pricing</a> or the <a href="#faq" className="font-label text-lavender-glow transition hover:text-white" onClick={(event) => handleAnchorNavigation(event, 'faq')}>FAQ</a>.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link
                  to="/login?mode=signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-label text-charcoal-ink transition hover:bg-warm-cream"
                >
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full border border-white/24 px-6 py-3 text-sm font-label text-white transition hover:border-white/60 hover:bg-white/8"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default MarketingHome;
