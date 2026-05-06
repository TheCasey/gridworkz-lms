import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, GraduationCap, Save, Shield, Sparkles } from 'lucide-react';
import {
  RESET_DAY_OPTIONS,
  calculateQuarterRanges,
  formatResetSchedule,
  parseTimeInputValue,
} from '../utils/schoolSettingsUtils';
import { formatWeekRange } from '../utils/weekUtils';

const C = {
  lavender: '#cbb7fb',
  charcoal: '#292827',
  amethyst: '#714cb6',
  cream: '#e9e5dd',
  parchment: '#dcd7d3',
  lavenderTint: '#f0eaff',
};

const inputClassName = 'w-full px-3 py-2.5 rounded-lg bg-white text-[14px] focus:outline-none';

const statusToneStyles = {
  accent: {
    backgroundColor: 'rgba(203,183,251,0.2)',
    color: C.amethyst,
    borderColor: 'rgba(203,183,251,0.5)',
  },
  warning: {
    backgroundColor: 'rgba(233,229,221,0.85)',
    color: C.charcoal,
    borderColor: 'rgba(220,215,211,0.95)',
  },
  muted: {
    backgroundColor: 'rgba(220,215,211,0.45)',
    color: 'rgba(41,40,39,0.6)',
    borderColor: 'rgba(220,215,211,0.8)',
  },
  neutral: {
    backgroundColor: 'rgba(240,234,255,0.65)',
    color: C.charcoal,
    borderColor: 'rgba(203,183,251,0.45)',
  },
};

const formatEntitlementDate = (value) => {
  if (!value) return null;

  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const UsageSummaryCard = ({ title, value, detail }) => (
  <div className="rounded-2xl p-4 bg-white" style={{ border: `1px solid ${C.parchment}` }}>
    <p className="text-[11px] uppercase tracking-wider font-label mb-2 text-charcoal-ink/40">{title}</p>
    <p className="text-[22px] font-display text-charcoal-ink" style={{ lineHeight: 1 }}>{value}</p>
    <p className="mt-2 text-[13px] font-body text-charcoal-ink/55">{detail}</p>
  </div>
);

const FeatureAccessCard = ({ feature }) => {
  const isLocked = !feature?.isEnabled;

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: isLocked ? `${C.lavenderTint}70` : '#ffffff',
        border: `1px solid ${isLocked ? 'rgba(203,183,251,0.65)' : C.parchment}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-label" style={{ color: isLocked ? C.amethyst : 'rgba(41,40,39,0.45)' }}>
            Premium Access
          </p>
          <h4 className="mt-1 text-[16px] font-display text-charcoal-ink">{feature.title}</h4>
        </div>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wider font-label border"
          style={isLocked ? statusToneStyles.accent : statusToneStyles.neutral}
        >
          {feature.statusLabel}
        </span>
      </div>
      <p className="mt-3 text-[13px] font-body text-charcoal-ink/70">{feature.description}</p>
      {feature.availabilityNote ? (
        <p className="mt-2 text-[12px] font-body text-charcoal-ink/45">{feature.availabilityNote}</p>
      ) : null}
      {isLocked && feature.upgradeCopy ? (
        <p className="mt-3 text-[12px] font-body" style={{ color: C.amethyst }}>
          {feature.upgradeCopy}
        </p>
      ) : null}
    </div>
  );
};

const Settings = ({ settings, onSave, saving, entitlementSummary }) => {
  const [formData, setFormData] = useState(settings);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const quarters = useMemo(
    () => calculateQuarterRanges(formData.school_year_start, formData.school_year_end),
    [formData.school_year_start, formData.school_year_end]
  );

  const trialEndsLabel = formatEntitlementDate(entitlementSummary?.trialEndsAt);
  const currentPeriodEndLabel = formatEntitlementDate(entitlementSummary?.currentPeriodEnd);
  const studentLimitCheck = entitlementSummary?.studentLimitCheck || null;
  const curriculumLimitCheck = entitlementSummary?.curriculumLimitCheck || null;
  const featureAccessList = entitlementSummary?.featureAccessList || [];
  const lockedFeatures = featureAccessList.filter(feature => !feature.isEnabled);
  const statusTone = statusToneStyles[entitlementSummary?.subscriptionStatusMeta?.tone] || statusToneStyles.muted;
  const planSourceLabel = entitlementSummary?.isMissingEntitlementDoc
    ? 'Free-plan fallback'
    : 'Server entitlement record';

  const usageCards = [
    {
      title: 'Students',
      value: studentLimitCheck
        ? (studentLimitCheck.isUnlimited ? `${studentLimitCheck.usage}` : `${studentLimitCheck.usage}/${studentLimitCheck.limit}`)
        : '0',
      detail: studentLimitCheck?.isUnlimited
        ? 'Active students stay unlimited on this plan.'
        : `${studentLimitCheck?.remaining ?? 0} student slot${studentLimitCheck?.remaining === 1 ? '' : 's'} remaining.`,
    },
    {
      title: 'Curriculum',
      value: curriculumLimitCheck
        ? (curriculumLimitCheck.isUnlimited ? `${curriculumLimitCheck.usage}` : `${curriculumLimitCheck.usage}/${curriculumLimitCheck.limit}`)
        : '0',
      detail: curriculumLimitCheck?.isUnlimited
        ? 'Active curriculum stays unlimited on this plan.'
        : `${curriculumLimitCheck?.remaining ?? 0} active curriculum slot${curriculumLimitCheck?.remaining === 1 ? '' : 's'} remaining.`,
    },
  ];

  if (studentLimitCheck?.isOverLimit) {
    usageCards[0].detail = 'This account is over the student cap. Deletes remain available so you can get back under the limit.';
  } else if (studentLimitCheck?.hasReachedLimit) {
    usageCards[0].detail = studentLimitCheck.upgradeCopy;
  }

  if (curriculumLimitCheck?.isOverLimit) {
    usageCards[1].detail = 'This account is over the active-curriculum cap. Archive or delete older subjects to get back under the limit.';
  } else if (curriculumLimitCheck?.hasReachedLimit) {
    usageCards[1].detail = curriculumLimitCheck.upgradeCopy;
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { hour, minute } = parseTimeInputValue(formData.reset_time);

    await onSave({
      ...formData,
      week_reset_day: Number(formData.week_reset_day),
      week_reset_hour: hour,
      week_reset_minute: minute,
    });
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-[26px] font-display text-charcoal-ink" style={{ lineHeight: 1.1, letterSpacing: '-0.5px' }}>Settings</h2>
        <p className="text-[14px] text-charcoal-ink/50 font-body mt-1">Review your plan, usage, and account settings in one place.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-[28px] p-6 md:p-7" style={{ border: `1px solid ${C.parchment}` }}>
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4" style={{ color: C.amethyst }} />
            <h3 className="text-[17px] font-display text-charcoal-ink">Plan & Access</h3>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div
              className="rounded-[24px] p-5"
              style={{ backgroundColor: `${C.lavenderTint}85`, border: '1px solid rgba(203,183,251,0.6)' }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-wider font-label border" style={statusTone}>
                  {entitlementSummary?.subscriptionStatusMeta?.label || 'No Billing State'}
                </span>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-wider font-label border" style={statusToneStyles.muted}>
                  {planSourceLabel}
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-label mb-1" style={{ color: C.amethyst }}>
                    Current Plan
                  </p>
                  <h4 className="text-[28px] font-display text-charcoal-ink" style={{ lineHeight: 1 }}>
                    {entitlementSummary?.plan?.displayName || 'Free'}
                  </h4>
                  <p className="mt-2 text-[14px] font-body text-charcoal-ink/65">
                    {entitlementSummary?.plan?.priceLabel || '$0'} • {entitlementSummary?.subscriptionStatusMeta?.description || 'No provider-backed billing state is connected yet.'}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white px-4 py-3" style={{ border: `1px solid ${C.parchment}` }}>
                  <p className="text-[11px] uppercase tracking-wider font-label text-charcoal-ink/40">Trial Ends</p>
                  <p className="mt-1 text-[14px] font-body text-charcoal-ink">{trialEndsLabel || 'Not set'}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3" style={{ border: `1px solid ${C.parchment}` }}>
                  <p className="text-[11px] uppercase tracking-wider font-label text-charcoal-ink/40">Period Ends</p>
                  <p className="mt-1 text-[14px] font-body text-charcoal-ink">{currentPeriodEndLabel || 'Not set'}</p>
                </div>
              </div>

              {entitlementSummary?.isMissingEntitlementDoc ? (
                <div className="mt-5 rounded-2xl px-4 py-3" style={{ backgroundColor: '#ffffff', border: `1px solid ${C.parchment}` }}>
                  <p className="text-[12px] uppercase tracking-wider font-label" style={{ color: C.amethyst }}>Visibility Note</p>
                  <p className="mt-1.5 text-[13px] font-body text-charcoal-ink/70">
                    This account is currently rendering the free-plan fallback because no server-owned entitlement record is available yet.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {usageCards.map(card => (
                <UsageSummaryCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  detail={card.detail}
                />
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4" style={{ color: C.amethyst }} />
              <p className="text-[12px] uppercase tracking-wider font-label" style={{ color: C.amethyst }}>Premium Capability States</p>
            </div>
            <div className="grid gap-3 xl:grid-cols-3">
              {featureAccessList.map(feature => (
                <FeatureAccessCard key={feature.key} feature={feature} />
              ))}
            </div>
          </div>

          {lockedFeatures.length > 0 ? (
            <div className="mt-5 rounded-2xl px-4 py-3" style={{ backgroundColor: C.cream, border: `1px solid ${C.parchment}` }}>
              <p className="text-[12px] uppercase tracking-wider font-label text-charcoal-ink/40">Upgrade Needed</p>
              <p className="mt-1.5 text-[13px] font-body text-charcoal-ink/70">
                {lockedFeatures.map(feature => feature.shortTitle).join(', ')} remain locked on the {entitlementSummary?.plan?.displayName || 'Free'} plan. Upgrade messaging stays explicit here so future premium surfaces do not disappear without explanation.
              </p>
            </div>
          ) : null}
        </div>

        <div className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${C.parchment}` }}>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-4 h-4" style={{ color: C.amethyst }} />
            <h3 className="text-[17px] font-display text-charcoal-ink">School Year</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">School Name</label>
              <input
                value={formData.school_name || ''}
                onChange={event => handleChange('school_name', event.target.value)}
                placeholder="Casey Academy"
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">Start Date</label>
              <input
                type="date"
                value={formData.school_year_start || ''}
                onChange={event => handleChange('school_year_start', event.target.value)}
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">End Date</label>
              <input
                type="date"
                value={formData.school_year_end || ''}
                onChange={event => handleChange('school_year_end', event.target.value)}
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">Timezone</label>
              <input
                value={formData.timezone || ''}
                onChange={event => handleChange('timezone', event.target.value)}
                placeholder="America/Chicago"
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              />
            </div>
          </div>

          <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: `${C.lavenderTint}70`, border: `1px solid rgba(203,183,251,0.55)` }}>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4" style={{ color: C.amethyst }} />
              <p className="text-[12px] uppercase tracking-wider font-label" style={{ color: C.amethyst }}>Quarter Calendar</p>
            </div>

            {quarters.length === 0 ? (
              <p className="text-[13px] font-body text-charcoal-ink/45">
                Add a valid school-year start and end date to generate quarter ranges automatically.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quarters.map(quarter => (
                  <div key={quarter.label} className="rounded-xl p-4 bg-white" style={{ border: `1px solid ${C.parchment}` }}>
                    <p className="text-[11px] uppercase tracking-wider font-label mb-1" style={{ color: C.amethyst }}>{quarter.label}</p>
                    <p className="text-[14px] font-display text-charcoal-ink">{formatWeekRange(quarter.start, quarter.end)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${C.parchment}` }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock3 className="w-4 h-4" style={{ color: C.amethyst }} />
            <h3 className="text-[17px] font-display text-charcoal-ink">Weekly Reset</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">Reset Day</label>
              <select
                value={formData.week_reset_day}
                onChange={event => handleChange('week_reset_day', event.target.value)}
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              >
                {RESET_DAY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">Reset Time</label>
              <input
                type="time"
                value={formData.reset_time}
                onChange={event => handleChange('reset_time', event.target.value)}
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              />
            </div>
          </div>

          <div className="mt-5 rounded-xl px-4 py-3" style={{ backgroundColor: C.cream }}>
            <p className="text-[11px] uppercase tracking-wider font-label mb-1 text-charcoal-ink/40">Current Schedule</p>
            <p className="text-[14px] font-body text-charcoal-ink">{formatResetSchedule(formData)}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: C.charcoal, color: '#fff', fontSize: 14, fontWeight: 700 }}
            onMouseEnter={event => { if (!saving) event.currentTarget.style.backgroundColor = '#3a3937'; }}
            onMouseLeave={event => event.currentTarget.style.backgroundColor = C.charcoal}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
