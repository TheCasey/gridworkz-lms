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
};

const inputClassName = 'op-input text-[14px] font-body';

const statusToneStyles = {
  accent: {
    backgroundColor: 'rgba(203,183,251,0.14)',
    color: C.lavender,
    borderColor: 'rgba(203,183,251,0.38)',
  },
  warning: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    color: '#fbbf24',
    borderColor: 'rgba(245,158,11,0.32)',
  },
  muted: {
    backgroundColor: 'rgba(238,234,248,0.06)',
    color: 'rgba(238,234,248,0.62)',
    borderColor: 'rgba(238,234,248,0.14)',
  },
  neutral: {
    backgroundColor: 'rgba(52,211,153,0.1)',
    color: '#6ee7b7',
    borderColor: 'rgba(52,211,153,0.28)',
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
  <div className="op-stat p-4">
    <p className="op-eyebrow mb-3">{title}</p>
    <p className="text-[28px] font-display text-[rgba(250,249,255,0.96)]" style={{ lineHeight: 1 }}>{value}</p>
    <p className="op-subtle mt-3 text-[12px] font-body leading-5">{detail}</p>
  </div>
);

const FeatureAccessCard = ({ feature }) => {
  const isLocked = !feature?.isEnabled;

  return (
    <div
      className="op-surface p-4"
      style={{
        borderLeft: `3px solid ${isLocked ? 'rgba(245,158,11,0.76)' : 'rgba(52,211,153,0.72)'}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="op-eyebrow">
            Premium Access
          </p>
          <h4 className="mt-2 text-[15px] font-display text-[rgba(250,249,255,0.94)]">{feature.title}</h4>
        </div>
        <span
          className="inline-flex min-h-[26px] shrink-0 items-center border px-2.5 text-[10px] uppercase tracking-[0.12em] font-label"
          style={isLocked ? statusToneStyles.warning : statusToneStyles.neutral}
        >
          {feature.statusLabel}
        </span>
      </div>
      <p className="op-subtle mt-3 text-[13px] font-body leading-5">{feature.description}</p>
      {feature.availabilityNote ? (
        <p className="mt-2 text-[12px] font-body text-[rgba(238,234,248,0.42)]">{feature.availabilityNote}</p>
      ) : null}
      {isLocked && feature.upgradeCopy ? (
        <p className="mt-3 text-[12px] font-body text-[#fbbf24]">
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
    <div className="op-page">
      <div className="op-shell space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="op-eyebrow">Settings</p>
            <h1 className="op-title mt-3">Account and school controls</h1>
            <p className="op-subtle mt-4 max-w-2xl text-[14px] font-body leading-6">
              Review plan visibility, household limits, school-year metadata, and the weekly reset schedule used by reports and student work.
            </p>
          </div>
          <div className="op-pill w-fit">
            {formatResetSchedule(formData)}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="op-panel p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-lavender-glow" />
              <div>
                <p className="op-eyebrow">Plan and Access</p>
                <h2 className="mt-2 text-[20px] font-display text-[rgba(250,249,255,0.96)]">Subscription state</h2>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div
                className="op-surface p-5"
                style={{ borderLeft: '3px solid rgba(203,183,251,0.78)' }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-h-[28px] items-center border px-3 text-[11px] uppercase tracking-[0.12em] font-label" style={statusTone}>
                    {entitlementSummary?.subscriptionStatusMeta?.label || 'No Billing State'}
                  </span>
                  <span className="inline-flex min-h-[28px] items-center border px-3 text-[11px] uppercase tracking-[0.12em] font-label" style={statusToneStyles.muted}>
                    {planSourceLabel}
                  </span>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="op-eyebrow mb-2">
                      Current Plan
                    </p>
                    <h3 className="text-[34px] font-display text-[rgba(250,249,255,0.96)]" style={{ lineHeight: 1 }}>
                      {entitlementSummary?.plan?.displayName || 'Free'}
                    </h3>
                    <p className="op-subtle mt-3 text-[14px] font-body leading-6">
                      {entitlementSummary?.plan?.priceLabel || '$0'} | {entitlementSummary?.subscriptionStatusMeta?.description || 'No provider-backed billing state is connected yet.'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="op-panel-muted px-4 py-3">
                    <p className="op-eyebrow">Trial Ends</p>
                    <p className="mt-2 text-[14px] font-body text-[rgba(250,249,255,0.9)]">{trialEndsLabel || 'Not set'}</p>
                  </div>
                  <div className="op-panel-muted px-4 py-3">
                    <p className="op-eyebrow">Period Ends</p>
                    <p className="mt-2 text-[14px] font-body text-[rgba(250,249,255,0.9)]">{currentPeriodEndLabel || 'Not set'}</p>
                  </div>
                </div>

                {entitlementSummary?.isMissingEntitlementDoc ? (
                  <div className="op-panel-muted mt-5 px-4 py-3" style={{ borderLeft: '3px solid rgba(245,158,11,0.74)' }}>
                    <p className="op-eyebrow text-[#fbbf24]">Visibility Note</p>
                    <p className="op-subtle mt-2 text-[13px] font-body leading-5">
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
                <Shield className="h-4 w-4 text-lavender-glow" />
                <p className="op-eyebrow">Premium Capability States</p>
              </div>
              <div className="grid gap-3 xl:grid-cols-3">
                {featureAccessList.map(feature => (
                  <FeatureAccessCard key={feature.key} feature={feature} />
                ))}
              </div>
            </div>

            {lockedFeatures.length > 0 ? (
              <div className="op-panel-muted mt-5 px-4 py-3" style={{ borderLeft: '3px solid rgba(245,158,11,0.74)' }}>
                <p className="op-eyebrow text-[#fbbf24]">Upgrade Needed</p>
                <p className="op-subtle mt-2 text-[13px] font-body leading-5">
                  {lockedFeatures.map(feature => feature.shortTitle).join(', ')} remain locked on the {entitlementSummary?.plan?.displayName || 'Free'} plan. Upgrade messaging stays explicit here so future premium surfaces do not disappear without explanation.
                </p>
              </div>
            ) : null}
          </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <section className="op-panel p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-lavender-glow" />
              <div>
                <p className="op-eyebrow">School Year</p>
                <h2 className="mt-2 text-[20px] font-display text-[rgba(250,249,255,0.96)]">Calendar metadata</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <label className="op-eyebrow mb-1.5 block">School Name</label>
                <input
                  value={formData.school_name || ''}
                  onChange={event => handleChange('school_name', event.target.value)}
                  placeholder="Casey Academy"
                  className={inputClassName}
                />
              </div>

              <div>
                <label className="op-eyebrow mb-1.5 block">Start Date</label>
                <input
                  type="date"
                  value={formData.school_year_start || ''}
                  onChange={event => handleChange('school_year_start', event.target.value)}
                  className={inputClassName}
                />
              </div>

              <div>
                <label className="op-eyebrow mb-1.5 block">End Date</label>
                <input
                  type="date"
                  value={formData.school_year_end || ''}
                  onChange={event => handleChange('school_year_end', event.target.value)}
                  className={inputClassName}
                />
              </div>

              <div>
                <label className="op-eyebrow mb-1.5 block">Timezone</label>
                <input
                  value={formData.timezone || ''}
                  onChange={event => handleChange('timezone', event.target.value)}
                  placeholder="America/Chicago"
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="op-panel-muted mt-5 p-4" style={{ borderLeft: '3px solid rgba(203,183,251,0.72)' }}>
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-lavender-glow" />
                <p className="op-eyebrow">Quarter Calendar</p>
              </div>

              {quarters.length === 0 ? (
                <p className="op-subtle text-[13px] font-body leading-5">
                  Add a valid school-year start and end date to generate quarter ranges automatically.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {quarters.map(quarter => (
                    <div key={quarter.label} className="op-surface p-4">
                      <p className="op-eyebrow mb-2">{quarter.label}</p>
                      <p className="text-[14px] font-display text-[rgba(250,249,255,0.92)]">{formatWeekRange(quarter.start, quarter.end)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="space-y-6">
            <section className="op-panel p-5 md:p-6">
              <div className="mb-5 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-lavender-glow" />
                <div>
                  <p className="op-eyebrow">Weekly Reset</p>
                  <h2 className="mt-2 text-[20px] font-display text-[rgba(250,249,255,0.96)]">Rollover timing</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="op-eyebrow mb-1.5 block">Reset Day</label>
                  <select
                    value={formData.week_reset_day}
                    onChange={event => handleChange('week_reset_day', event.target.value)}
                    className={inputClassName}
                  >
                    {RESET_DAY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="op-eyebrow mb-1.5 block">Reset Time</label>
                  <input
                    type="time"
                    value={formData.reset_time}
                    onChange={event => handleChange('reset_time', event.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="op-panel-muted mt-5 px-4 py-3" style={{ borderLeft: '3px solid rgba(203,183,251,0.72)' }}>
                <p className="op-eyebrow mb-2">Current Schedule</p>
                <p className="text-[14px] font-body text-[rgba(250,249,255,0.9)]">{formatResetSchedule(formData)}</p>
              </div>
            </section>

            <section className="op-panel-muted p-5">
              <p className="op-eyebrow">Save Behavior</p>
              <p className="op-subtle mt-3 text-[13px] font-body leading-5">
                Saving updates the parent profile and propagates reset timing to existing students so reports, weekly plans, and portal timing stay aligned.
              </p>
            </section>
          </div>
        </div>

        <div className="op-panel-muted flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="op-subtle text-[13px] font-body leading-5">
            Settings changes take effect for new report windows immediately after save.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="op-button w-full disabled:cursor-not-allowed sm:w-auto"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};

export default Settings;
