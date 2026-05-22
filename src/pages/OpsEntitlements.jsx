import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  applyTrustedEntitlementOverride,
  clearTrustedEntitlementOverride,
  getTrustedOperatorEntitlementRecord,
  getTrustedOperatorSession,
  initializeTrustedEntitlementRecord,
  searchTrustedParentAccounts,
} from '../firebase/trustedOperations';
import {
  EntitlementFeatureCatalog,
  EntitlementResolutionSources,
  EntitlementUpdatedVia,
  PlanIds,
  SubscriptionStatuses,
  getEntitlementPlan,
  getSubscriptionStatusDefinition,
} from '../constants/entitlements';
import {
  OPS_FEATURE_KEYS,
  OPS_STATE_LABELS,
  buildOverrideDiffPreview,
  buildOverrideRiskWarnings,
  buildResolvedFeaturesForPlan,
  getPlanDisplayName,
  getSubscriptionStatusLabel,
  hasOverrideDiffChanges,
  normalizeFeatureSet,
  validateSupportReason,
} from '../components/ops/operatorEntitlementUi';

const PLAN_OPTIONS = Object.values(PlanIds);
const STATUS_OPTIONS = [
  null,
  SubscriptionStatuses.TRIALING,
  SubscriptionStatuses.ACTIVE,
  SubscriptionStatuses.PAST_DUE,
  SubscriptionStatuses.CANCELED,
];

const SOURCE_LABELS = {
  [EntitlementResolutionSources.BILLING]: 'Billing-backed',
  [EntitlementResolutionSources.MANUAL_OVERRIDE]: 'Manual override active',
  [EntitlementResolutionSources.FALLBACK_INITIALIZED]: 'Fallback initialized',
};

const UPDATED_VIA_LABELS = {
  [EntitlementUpdatedVia.BILLING_WEBHOOK]: 'Billing webhook',
  [EntitlementUpdatedVia.OPERATOR_CONSOLE]: 'Operator console',
  [EntitlementUpdatedVia.OPERATOR_CLEAR_OVERRIDE]: 'Operator clear',
};

const TONE_CLASSES = {
  accent: 'border-lavender-glow/70 bg-lavender-glow/20 text-amethyst-link',
  neutral: 'border-parchment bg-white text-charcoal-ink',
  warning: 'border-[#c77734]/35 bg-[#fff4e8] text-[#7a4215]',
  muted: 'border-parchment bg-parchment/30 text-charcoal-ink/55',
};

const cx = (...classes) => classes.filter(Boolean).join(' ');

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();

  if (typeof value === 'object') {
    const seconds = value.seconds ?? value._seconds;
    const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
    if (Number.isFinite(seconds)) {
      return new Date((seconds * 1000) + Math.floor(nanos / 1000000));
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTimestamp = (value, fallback = 'Not set') => {
  const date = toDate(value);
  if (!date) return fallback;

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDateTimeInputValue = (value) => {
  const date = toDate(value);
  if (!date) return '';

  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return localDate.toISOString().slice(0, 16);
};

const toIsoFromDateTimeInput = (value) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getErrorMessage = (error, fallback) => (
  error?.message || error?.details || fallback
);

const getSourceLabel = (source) => SOURCE_LABELS[source] || 'Free-plan fallback';
const getUpdatedViaLabel = (value) => UPDATED_VIA_LABELS[value] || 'Not recorded';

const getParentLabel = (parent = {}) => (
  parent.email || parent.school_name || parent.uid || 'Unknown parent'
);

const buildDraftFromDetail = (detail) => {
  const effective = detail?.effective_entitlement || {};
  const manualOverride = detail?.manual_override || {};
  const planId = effective.plan_id || PlanIds.FREE;
  const effectiveFeatures = effective.features
    ? normalizeFeatureSet(effective.features)
    : buildResolvedFeaturesForPlan(planId, effective.feature_overrides);

  return {
    plan_id: planId,
    subscription_status: effective.subscription_status ?? null,
    feature_overrides: effectiveFeatures,
    expires_at: manualOverride.is_active
      ? formatDateTimeInputValue(manualOverride.expires_at)
      : '',
    reason: '',
  };
};

const normalizeDetailPayload = (detail) => ({
  ...detail,
  parent: detail?.parent || {},
  effective_entitlement: detail?.effective_entitlement || {},
  billing_state: detail?.billing_state || {},
  manual_override: detail?.manual_override || {},
  usage_summary: detail?.usage_summary || {},
  lockdown_summary: detail?.lockdown_summary || {},
  downgrade_warnings: Array.isArray(detail?.downgrade_warnings)
    ? detail.downgrade_warnings
    : [],
  recent_audit_entries: Array.isArray(detail?.recent_audit_entries)
    ? detail.recent_audit_entries
    : [],
});

const StatusBadge = ({ children, tone = 'muted' }) => (
  <span className={cx(
    'inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-label uppercase tracking-[0.12em]',
    TONE_CLASSES[tone] || TONE_CLASSES.muted
  )}>
    {children}
  </span>
);

const Panel = ({ children, className = '' }) => (
  <section className={cx('rounded-lg border border-parchment bg-white p-4 shadow-sm', className)}>
    {children}
  </section>
);

const SectionLabel = ({ children }) => (
  <p className="font-label text-[11px] uppercase tracking-[0.12em] text-amethyst-link">
    {children}
  </p>
);

const LoadingButtonContent = ({ label, loading }) => (
  <>
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
    <span>{label}</span>
  </>
);

const OpsRouteStatus = ({ title, detail, icon: Icon = ShieldCheck }) => (
  <main className="min-h-screen bg-warm-cream text-charcoal-ink">
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-10">
      <section className="w-full rounded-lg border border-mysteria/15 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-lavender-glow/60 bg-lavender-glow/25">
            <Icon className="h-5 w-5 text-amethyst-link" />
          </div>
          <div>
            <SectionLabel>Operator Console</SectionLabel>
            <h1 className="mt-1 font-display text-3xl text-charcoal-ink">
              {title}
            </h1>
          </div>
        </div>
        {detail ? (
          <p className="mt-4 text-sm leading-6 text-charcoal-ink/70">
            {detail}
          </p>
        ) : null}
      </section>
    </div>
  </main>
);

const StateCard = ({
  label,
  state,
  provider,
  source,
  updatedAt,
  children,
  exists = true,
}) => {
  const planId = state?.plan_id || PlanIds.FREE;
  const subscriptionStatus = state?.subscription_status ?? null;

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel>{label}</SectionLabel>
          <h3 className="mt-2 font-display text-[22px] leading-none text-charcoal-ink">
            {getPlanDisplayName(planId)}
          </h3>
        </div>
        <StatusBadge tone={getSubscriptionStatusDefinition(subscriptionStatus).tone}>
          {getSubscriptionStatusLabel(subscriptionStatus)}
        </StatusBadge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] text-charcoal-ink/65">
        <div>
          <p className="font-label uppercase tracking-[0.12em] text-charcoal-ink/40">Source</p>
          <p className="mt-1 text-charcoal-ink">{source || 'Not recorded'}</p>
        </div>
        <div>
          <p className="font-label uppercase tracking-[0.12em] text-charcoal-ink/40">Provider</p>
          <p className="mt-1 text-charcoal-ink">{provider || 'None'}</p>
        </div>
        <div className="col-span-2">
          <p className="font-label uppercase tracking-[0.12em] text-charcoal-ink/40">Updated</p>
          <p className="mt-1 text-charcoal-ink">{formatTimestamp(updatedAt)}</p>
        </div>
      </div>

      {!exists ? (
        <div className="mt-4 rounded-md border border-[#c77734]/35 bg-[#fff4e8] px-3 py-2 text-[12px] leading-5 text-[#7a4215]">
          No entitlement record exists. The app is resolving a safe Free fallback.
        </div>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}
    </Panel>
  );
};

const FeatureGrid = ({ features = {} }) => (
  <div className="grid gap-2 sm:grid-cols-3">
    {OPS_FEATURE_KEYS.map((featureKey) => {
      const feature = EntitlementFeatureCatalog[featureKey];
      const enabled = Boolean(features[featureKey]);

      return (
        <div
          key={featureKey}
          className={cx(
            'rounded-md border px-3 py-2 text-[12px]',
            enabled
              ? 'border-lavender-glow/70 bg-lavender-glow/15 text-charcoal-ink'
              : 'border-parchment bg-parchment/20 text-charcoal-ink/55'
          )}
        >
          <p className="font-label uppercase tracking-[0.1em]">
            {feature?.shortTitle || feature?.title || featureKey}
          </p>
          <p className="mt-1">{enabled ? 'Enabled' : 'Disabled'}</p>
        </div>
      );
    })}
  </div>
);

const StateCards = ({ detail }) => {
  const effective = detail.effective_entitlement;
  const billingState = detail.billing_state || {};
  const manualOverride = detail.manual_override || {};
  const effectiveFeatures = effective.features
    ? normalizeFeatureSet(effective.features)
    : buildResolvedFeaturesForPlan(effective.plan_id, effective.feature_overrides);
  const billingFeatures = buildResolvedFeaturesForPlan(
    billingState.plan_id,
    billingState.feature_overrides
  );
  const manualFeatures = manualOverride.is_active
    ? buildResolvedFeaturesForPlan(manualOverride.plan_id, manualOverride.feature_overrides)
    : {};

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <StateCard
        label={OPS_STATE_LABELS.effective}
        state={effective}
        provider={effective.billing_provider || null}
        source={getSourceLabel(effective.resolution_source)}
        updatedAt={effective.updated_at}
        exists={effective.exists !== false}
      >
        <FeatureGrid features={effectiveFeatures} />
        <p className="mt-3 text-[12px] text-charcoal-ink/55">
          Updated via {getUpdatedViaLabel(effective.updated_via)}.
        </p>
      </StateCard>

      <StateCard
        label={OPS_STATE_LABELS.billing}
        state={billingState}
        provider={billingState.billing_provider || null}
        source="Provider-backed truth"
        updatedAt={billingState.updated_at}
      >
        <FeatureGrid features={billingFeatures} />
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-charcoal-ink/60">
          <p>Trial: {formatTimestamp(billingState.trial_ends_at, 'None')}</p>
          <p>Period: {formatTimestamp(billingState.current_period_end, 'None')}</p>
        </div>
      </StateCard>

      <StateCard
        label={OPS_STATE_LABELS.manual}
        state={manualOverride.is_active ? manualOverride : { plan_id: effective.plan_id }}
        provider="Operator"
        source={manualOverride.is_active ? 'Active override' : 'Inactive'}
        updatedAt={manualOverride.applied_at}
      >
        {manualOverride.is_active ? (
          <>
            <FeatureGrid features={manualFeatures} />
            <div className="mt-3 space-y-2 text-[12px] leading-5 text-charcoal-ink/65">
              <p>Expires: {formatTimestamp(manualOverride.expires_at, 'No expiration')}</p>
              <p>Applied by: {manualOverride.applied_by_email || manualOverride.applied_by_uid || 'Unknown'}</p>
              <p className="rounded-md border border-parchment bg-warm-cream/55 px-3 py-2 text-charcoal-ink/75">
                {manualOverride.reason || 'No reason stored'}
              </p>
            </div>
          </>
        ) : (
          <p className="text-[13px] leading-5 text-charcoal-ink/55">
            No active manual override. The effective state should follow the billing-backed state or safe fallback.
          </p>
        )}
      </StateCard>
    </div>
  );
};

const WarningList = ({ title, warnings = [], emptyLabel }) => (
  <Panel>
    <div className="flex items-center gap-2">
      <AlertTriangle className={cx('h-4 w-4', warnings.length ? 'text-[#c77734]' : 'text-charcoal-ink/35')} />
      <SectionLabel>{title}</SectionLabel>
    </div>
    <div className="mt-3 space-y-2">
      {warnings.length ? warnings.map((warning) => (
        <div
          key={warning.code || warning.message}
          className="rounded-md border border-[#c77734]/35 bg-[#fff4e8] px-3 py-2 text-[13px] leading-5 text-[#7a4215]"
        >
          {warning.message}
        </div>
      )) : (
        <p className="text-[13px] text-charcoal-ink/55">{emptyLabel}</p>
      )}
    </div>
  </Panel>
);

const UsageAndLockdownPanel = ({ detail, previewWarnings }) => {
  const usage = detail.usage_summary || {};
  const limits = usage.limits || {};
  const lockdown = detail.lockdown_summary || {};

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Panel>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-amethyst-link" />
          <SectionLabel>Usage And Lockdown</SectionLabel>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-parchment bg-warm-cream/35 px-3 py-3">
            <p className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Students</p>
            <p className="mt-1 font-display text-[24px] text-charcoal-ink">
              {usage.students ?? 0}
              <span className="ml-1 text-[13px] font-body text-charcoal-ink/50">
                / {limits.students ?? 'Unlimited'}
              </span>
            </p>
          </div>
          <div className="rounded-md border border-parchment bg-warm-cream/35 px-3 py-3">
            <p className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Active Curriculum</p>
            <p className="mt-1 font-display text-[24px] text-charcoal-ink">
              {usage.curriculum_items ?? 0}
              <span className="ml-1 text-[13px] font-body text-charcoal-ink/50">
                / {limits.curriculum_items ?? 'Unlimited'}
              </span>
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-[12px] text-charcoal-ink/65 sm:grid-cols-3">
          <p>Configured students: {lockdown.configured_students ?? 0}</p>
          <p>Paired devices: {lockdown.paired_devices ?? 0}</p>
          <p>Active devices: {lockdown.active_devices ?? 0}</p>
        </div>
        {lockdown.has_saved_setup ? (
          <div className="mt-3 rounded-md border border-lavender-glow/70 bg-lavender-glow/15 px-3 py-2 text-[12px] text-charcoal-ink/70">
            Saved Lockdown setup exists for this household.
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <WarningList
          title="Current Warnings"
          warnings={detail.downgrade_warnings}
          emptyLabel="No current usage or Lockdown warnings returned."
        />
        <WarningList
          title="Override Preview Warnings"
          warnings={previewWarnings}
          emptyLabel="No preview warnings for the selected override."
        />
      </div>
    </div>
  );
};

const DiffPreview = ({ diffRows }) => (
  <div className="rounded-lg border border-parchment bg-warm-cream/30 p-3">
    <div className="flex items-center justify-between gap-3">
      <SectionLabel>Diff Preview</SectionLabel>
      <StatusBadge tone={hasOverrideDiffChanges(diffRows) ? 'accent' : 'muted'}>
        {hasOverrideDiffChanges(diffRows) ? 'Changes queued' : 'No changes'}
      </StatusBadge>
    </div>
    <div className="mt-3 divide-y divide-parchment">
      {diffRows.map((diffRow) => (
        <div key={diffRow.key} className="grid gap-2 py-3 text-[13px] sm:grid-cols-[120px_minmax(0,1fr)]">
          <div className="flex items-center gap-2">
            {diffRow.changed ? (
              <CheckCircle2 className="h-4 w-4 text-amethyst-link" />
            ) : (
              <XCircle className="h-4 w-4 text-charcoal-ink/25" />
            )}
            <span className="font-label uppercase tracking-[0.1em] text-charcoal-ink/55">
              {diffRow.label}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-charcoal-ink">
            <span className="min-w-0 truncate text-charcoal-ink/55">{diffRow.beforeLabel}</span>
            <ArrowRight className="h-3.5 w-3.5 flex-none text-charcoal-ink/30" />
            <span className="min-w-0 truncate">{diffRow.afterLabel}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const OverrideForm = ({
  detail,
  draft,
  setDraft,
  diffRows,
  onSubmit,
  applyState,
}) => {
  const reasonValidation = validateSupportReason(draft.reason);
  const entitlementExists = detail.effective_entitlement.exists !== false;

  const applyPreset = (planId) => {
    const plan = getEntitlementPlan(planId);
    setDraft((currentDraft) => ({
      ...currentDraft,
      plan_id: planId,
      feature_overrides: normalizeFeatureSet(plan.features),
    }));
  };

  return (
    <Panel>
      <div className="flex flex-col gap-3 border-b border-parchment pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-amethyst-link" />
            <SectionLabel>Manual Override Form</SectionLabel>
          </div>
          <h3 className="mt-2 font-display text-xl text-charcoal-ink">
            Apply override
          </h3>
        </div>
        <StatusBadge tone={entitlementExists ? 'neutral' : 'warning'}>
          {entitlementExists ? 'Record ready' : 'Initialize first'}
        </StatusBadge>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <p className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Quick Presets</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLAN_OPTIONS.map((planId) => (
              <button
                key={planId}
                type="button"
                onClick={() => applyPreset(planId)}
                className={cx(
                  'rounded-md border px-3 py-2 text-[13px] font-ui transition',
                  draft.plan_id === planId
                    ? 'border-amethyst-link bg-amethyst-link text-white'
                    : 'border-parchment bg-white text-charcoal-ink hover:border-lavender-glow'
                )}
              >
                {getEntitlementPlan(planId).displayName}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Plan</span>
            <select
              value={draft.plan_id}
              onChange={(event) => setDraft((currentDraft) => ({
                ...currentDraft,
                plan_id: event.target.value,
              }))}
              className="mt-1 w-full rounded-md border border-parchment bg-white px-3 py-2 text-[14px] text-charcoal-ink outline-none focus:border-amethyst-link"
            >
              {PLAN_OPTIONS.map((planId) => (
                <option key={planId} value={planId}>
                  {getEntitlementPlan(planId).displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Subscription Status</span>
            <select
              value={draft.subscription_status || ''}
              onChange={(event) => setDraft((currentDraft) => ({
                ...currentDraft,
                subscription_status: event.target.value || null,
              }))}
              className="mt-1 w-full rounded-md border border-parchment bg-white px-3 py-2 text-[14px] text-charcoal-ink outline-none focus:border-amethyst-link"
            >
              {STATUS_OPTIONS.map((statusValue) => (
                <option key={statusValue || 'none'} value={statusValue || ''}>
                  {getSubscriptionStatusLabel(statusValue)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Expiration</span>
            <input
              type="datetime-local"
              value={draft.expires_at}
              onChange={(event) => setDraft((currentDraft) => ({
                ...currentDraft,
                expires_at: event.target.value,
              }))}
              className="mt-1 w-full rounded-md border border-parchment bg-white px-3 py-2 text-[14px] text-charcoal-ink outline-none focus:border-amethyst-link"
            />
          </label>
        </div>

        <div>
          <p className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Feature Overrides</p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {OPS_FEATURE_KEYS.map((featureKey) => {
              const feature = EntitlementFeatureCatalog[featureKey];
              const enabled = Boolean(draft.feature_overrides?.[featureKey]);

              return (
                <label
                  key={featureKey}
                  className={cx(
                    'flex min-h-[72px] items-start gap-3 rounded-md border px-3 py-3 text-[13px]',
                    enabled
                      ? 'border-lavender-glow bg-lavender-glow/15'
                      : 'border-parchment bg-white'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setDraft((currentDraft) => ({
                      ...currentDraft,
                      feature_overrides: {
                        ...currentDraft.feature_overrides,
                        [featureKey]: event.target.checked,
                      },
                    }))}
                    className="mt-0.5 h-4 w-4 rounded border-parchment text-amethyst-link focus:ring-amethyst-link"
                  />
                  <span>
                    <span className="block font-ui text-charcoal-ink">
                      {feature?.title || featureKey}
                    </span>
                    <span className="mt-1 block text-[12px] text-charcoal-ink/55">
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Required Support Reason</span>
          <textarea
            value={draft.reason}
            onChange={(event) => setDraft((currentDraft) => ({
              ...currentDraft,
              reason: event.target.value,
            }))}
            rows={3}
            className="mt-1 w-full resize-y rounded-md border border-parchment bg-white px-3 py-2 text-[14px] text-charcoal-ink outline-none focus:border-amethyst-link"
            placeholder="Support ticket, billing sync issue, or temporary self-test note"
          />
          {!reasonValidation.isValid ? (
            <span className="mt-1 block text-[12px] text-[#7a4215]">{reasonValidation.message}</span>
          ) : null}
        </label>

        <DiffPreview diffRows={diffRows} />

        {applyState.error ? (
          <div className="rounded-md border border-[#c77734]/35 bg-[#fff4e8] px-3 py-2 text-[13px] text-[#7a4215]">
            {applyState.error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!entitlementExists || !reasonValidation.isValid || applyState.status === 'submitting'}
          className="inline-flex items-center gap-2 rounded-md bg-amethyst-link px-4 py-2.5 text-[14px] font-ui text-white transition hover:bg-mysteria disabled:cursor-not-allowed disabled:bg-charcoal-ink/25"
        >
          <LoadingButtonContent
            label="Apply Manual Override"
            loading={applyState.status === 'submitting'}
          />
        </button>
      </form>
    </Panel>
  );
};

const InitializeRecordPanel = ({
  detail,
  initReason,
  setInitReason,
  initState,
  onInitialize,
}) => {
  if (detail.effective_entitlement.exists !== false) {
    return null;
  }

  const reasonValidation = validateSupportReason(initReason);

  return (
    <Panel className="border-[#c77734]/40 bg-[#fffaf2]">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-[#c77734]" />
        <div className="min-w-0 flex-1">
          <SectionLabel>Missing Entitlement Record</SectionLabel>
          <h3 className="mt-2 font-display text-xl text-charcoal-ink">
            Initialize safe fallback
          </h3>
          <p className="mt-2 text-[13px] leading-5 text-charcoal-ink/65">
            This creates the server-owned Free fallback record before any manual override can be applied.
          </p>
          <form onSubmit={onInitialize} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label>
              <span className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Required Support Reason</span>
              <input
                value={initReason}
                onChange={(event) => setInitReason(event.target.value)}
                className="mt-1 w-full rounded-md border border-parchment bg-white px-3 py-2 text-[14px] text-charcoal-ink outline-none focus:border-amethyst-link"
                placeholder="Reason for initialization"
              />
            </label>
            <button
              type="submit"
              disabled={!reasonValidation.isValid || initState.status === 'submitting'}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-mysteria px-4 py-2.5 text-[14px] font-ui text-white transition hover:bg-amethyst-link disabled:cursor-not-allowed disabled:bg-charcoal-ink/25"
            >
              <LoadingButtonContent
                label="Initialize Record"
                loading={initState.status === 'submitting'}
              />
            </button>
          </form>
          {initState.error ? (
            <p className="mt-2 text-[12px] text-[#7a4215]">{initState.error}</p>
          ) : null}
        </div>
      </div>
    </Panel>
  );
};

const ClearOverridePanel = ({
  detail,
  clearReason,
  setClearReason,
  clearState,
  onClear,
}) => {
  const manualOverride = detail.manual_override || {};
  const reasonValidation = validateSupportReason(clearReason);

  return (
    <Panel>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-amethyst-link" />
            <SectionLabel>Clear Override</SectionLabel>
          </div>
          <h3 className="mt-2 font-display text-xl text-charcoal-ink">
            Clear Override And Return To Billing State
          </h3>
          <p className="mt-2 text-[13px] leading-5 text-charcoal-ink/60">
            Requires a support reason and only works while a manual override is active.
          </p>
        </div>
        <StatusBadge tone={manualOverride.is_active ? 'warning' : 'muted'}>
          {manualOverride.is_active ? 'Override active' : 'No active override'}
        </StatusBadge>
      </div>

      <form onSubmit={onClear} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <label>
          <span className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Required Support Reason</span>
          <input
            value={clearReason}
            onChange={(event) => setClearReason(event.target.value)}
            className="mt-1 w-full rounded-md border border-parchment bg-white px-3 py-2 text-[14px] text-charcoal-ink outline-none focus:border-amethyst-link"
            placeholder="Reason for clearing the manual override"
          />
          {!reasonValidation.isValid && manualOverride.is_active ? (
            <span className="mt-1 block text-[12px] text-[#7a4215]">{reasonValidation.message}</span>
          ) : null}
        </label>
        <button
          type="submit"
          disabled={!manualOverride.is_active || !reasonValidation.isValid || clearState.status === 'submitting'}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-md border border-[#c77734]/45 bg-[#fff4e8] px-4 py-2.5 text-[14px] font-ui text-[#7a4215] transition hover:border-[#7a4215] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <LoadingButtonContent
            label="Clear Override"
            loading={clearState.status === 'submitting'}
          />
        </button>
      </form>
      {clearState.error ? (
        <p className="mt-2 text-[12px] text-[#7a4215]">{clearState.error}</p>
      ) : null}
    </Panel>
  );
};

const formatAuditEvent = (eventType) => (
  String(eventType || 'audit_event')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
);

const AuditTimeline = ({ entries = [] }) => (
  <Panel>
    <div className="flex items-center gap-2">
      <History className="h-4 w-4 text-amethyst-link" />
      <SectionLabel>Audit Timeline</SectionLabel>
    </div>
    <div className="mt-4 space-y-3">
      {entries.length ? entries.map((entry) => (
        <div key={entry.id} className="rounded-md border border-parchment bg-warm-cream/25 px-3 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-ui text-[14px] text-charcoal-ink">
                {formatAuditEvent(entry.event_type)}
              </p>
              <p className="mt-1 text-[12px] text-charcoal-ink/55">
                {entry.operator_email || entry.operator_uid || 'System'} / {formatTimestamp(entry.created_at)}
              </p>
            </div>
            <StatusBadge tone={entry.operator_uid ? 'accent' : 'muted'}>
              {entry.operator_uid ? 'Operator' : 'System'}
            </StatusBadge>
          </div>
          {entry.reason ? (
            <p className="mt-2 rounded-md border border-parchment bg-white px-3 py-2 text-[12px] leading-5 text-charcoal-ink/70">
              {entry.reason}
            </p>
          ) : null}
          <div className="mt-3 grid gap-2 text-[12px] text-charcoal-ink/60 sm:grid-cols-2">
            <p>Before: {getPlanDisplayName(entry.before?.plan_id)} / {getSubscriptionStatusLabel(entry.before?.subscription_status)}</p>
            <p>After: {getPlanDisplayName(entry.after?.plan_id)} / {getSubscriptionStatusLabel(entry.after?.subscription_status)}</p>
          </div>
        </div>
      )) : (
        <p className="text-[13px] text-charcoal-ink/55">
          No entitlement audit entries returned for this account.
        </p>
      )}
    </div>
  </Panel>
);

const SearchWorkspace = ({
  currentUser,
  onSearch,
  searchQuery,
  setSearchQuery,
  searchState,
  onOpenAccount,
  recentParents,
  session,
}) => (
  <aside className="space-y-4">
    <Panel>
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-amethyst-link" />
        <SectionLabel>Operator Search</SectionLabel>
      </div>
      <form onSubmit={onSearch} className="mt-4 space-y-3">
        <label className="block">
          <span className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Email, UID, or school name</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="mt-1 w-full rounded-md border border-parchment bg-white px-3 py-2.5 text-[14px] text-charcoal-ink outline-none focus:border-amethyst-link"
            placeholder="parent@example.com"
          />
        </label>
        <button
          type="submit"
          disabled={searchState.status === 'searching' || searchQuery.trim().length < 2}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amethyst-link px-4 py-2.5 text-[14px] font-ui text-white transition hover:bg-mysteria disabled:cursor-not-allowed disabled:bg-charcoal-ink/25"
        >
          <LoadingButtonContent
            label="Search Accounts"
            loading={searchState.status === 'searching'}
          />
        </button>
      </form>

      <button
        type="button"
        onClick={() => onOpenAccount(currentUser.uid)}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-parchment bg-white px-4 py-2.5 text-[14px] font-ui text-charcoal-ink transition hover:border-lavender-glow"
      >
        <UserRound className="h-4 w-4" />
        Open my account
      </button>

      {searchState.error ? (
        <div className="mt-3 rounded-md border border-[#c77734]/35 bg-[#fff4e8] px-3 py-2 text-[13px] text-[#7a4215]">
          {searchState.error}
        </div>
      ) : null}

      {searchState.results.length ? (
        <div className="mt-4 space-y-2">
          <p className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/45">Results</p>
          {searchState.results.map((parent) => (
            <button
              key={parent.uid}
              type="button"
              onClick={() => onOpenAccount(parent.uid)}
              className="block w-full rounded-md border border-parchment bg-warm-cream/30 px-3 py-3 text-left transition hover:border-lavender-glow hover:bg-lavender-glow/10"
            >
              <p className="truncate font-ui text-[14px] text-charcoal-ink">{getParentLabel(parent)}</p>
              <p className="mt-1 truncate text-[12px] text-charcoal-ink/50">{parent.uid}</p>
            </button>
          ))}
        </div>
      ) : null}
    </Panel>

    <Panel>
      <SectionLabel>Session</SectionLabel>
      <div className="mt-3 space-y-2 text-[13px] text-charcoal-ink/70">
        <p><span className="font-ui text-charcoal-ink">Role:</span> {session.role === 'admin' ? 'Admin' : 'Support'}</p>
        <p className="truncate"><span className="font-ui text-charcoal-ink">Email:</span> {session.email}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge tone="accent">Stripe Sandbox</StatusBadge>
        <StatusBadge tone="muted">No raw provider config</StatusBadge>
      </div>
    </Panel>

    <Panel>
      <SectionLabel>Recent Accounts</SectionLabel>
      <div className="mt-3 space-y-2">
        {recentParents.length ? recentParents.map((parent) => (
          <button
            key={parent.uid}
            type="button"
            onClick={() => onOpenAccount(parent.uid)}
            className="block w-full rounded-md border border-parchment bg-white px-3 py-2 text-left text-[13px] transition hover:border-lavender-glow"
          >
            <span className="block truncate font-ui text-charcoal-ink">{getParentLabel(parent)}</span>
            <span className="block truncate text-[12px] text-charcoal-ink/45">{parent.uid}</span>
          </button>
        )) : (
          <p className="text-[13px] text-charcoal-ink/55">Opened accounts will appear here.</p>
        )}
      </div>
    </Panel>
  </aside>
);

const AccountDetail = ({
  detailState,
  overrideDraft,
  setOverrideDraft,
  onApplyOverride,
  applyState,
  initReason,
  setInitReason,
  initState,
  onInitialize,
  clearReason,
  setClearReason,
  clearState,
  onClearOverride,
  onRefresh,
}) => {
  if (detailState.status === 'idle') {
    return (
      <Panel className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-amethyst-link" />
          <h2 className="mt-4 font-display text-2xl text-charcoal-ink">
            No account loaded
          </h2>
          <p className="mt-2 max-w-md text-[14px] leading-6 text-charcoal-ink/55">
            Search for a parent account or open your own account to inspect entitlement state.
          </p>
        </div>
      </Panel>
    );
  }

  if (detailState.status === 'loading') {
    return (
      <Panel className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-amethyst-link" />
          <p className="mt-3 text-[14px] text-charcoal-ink/60">Loading entitlement detail...</p>
        </div>
      </Panel>
    );
  }

  if (detailState.status === 'error') {
    return (
      <Panel className="flex min-h-[420px] items-center justify-center border-[#c77734]/40 bg-[#fffaf2]">
        <div className="max-w-lg text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-[#c77734]" />
          <h2 className="mt-3 font-display text-2xl text-charcoal-ink">Account detail unavailable</h2>
          <p className="mt-2 text-[14px] leading-6 text-charcoal-ink/65">{detailState.error}</p>
        </div>
      </Panel>
    );
  }

  const detail = detailState.detail;
  const parent = detail.parent;
  const diffRows = buildOverrideDiffPreview({
    currentState: detail.effective_entitlement,
    currentManualOverride: detail.manual_override,
    draftOverride: {
      ...overrideDraft,
      expires_at: toIsoFromDateTimeInput(overrideDraft.expires_at),
    },
  });
  const previewWarnings = buildOverrideRiskWarnings({
    draftOverride: overrideDraft,
    usageSummary: detail.usage_summary,
    lockdownSummary: detail.lockdown_summary,
  });

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <SectionLabel>Account Detail</SectionLabel>
            <h2 className="mt-2 truncate font-display text-2xl text-charcoal-ink">
              {getParentLabel(parent)}
            </h2>
            <div className="mt-2 grid gap-2 text-[13px] text-charcoal-ink/60 md:grid-cols-3">
              <p className="truncate"><span className="font-ui text-charcoal-ink">UID:</span> {parent.uid}</p>
              <p className="truncate"><span className="font-ui text-charcoal-ink">Email:</span> {parent.email || 'Not set'}</p>
              <p className="truncate"><span className="font-ui text-charcoal-ink">School:</span> {parent.school_name || 'Not set'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-parchment bg-white px-3 py-2 text-[13px] font-ui text-charcoal-ink transition hover:border-lavender-glow"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </Panel>

      <InitializeRecordPanel
        detail={detail}
        initReason={initReason}
        setInitReason={setInitReason}
        initState={initState}
        onInitialize={onInitialize}
      />

      <StateCards detail={detail} />
      <UsageAndLockdownPanel detail={detail} previewWarnings={previewWarnings} />
      <OverrideForm
        detail={detail}
        draft={overrideDraft}
        setDraft={setOverrideDraft}
        diffRows={diffRows}
        onSubmit={onApplyOverride}
        applyState={applyState}
      />
      <ClearOverridePanel
        detail={detail}
        clearReason={clearReason}
        setClearReason={setClearReason}
        clearState={clearState}
        onClear={onClearOverride}
      />
      <AuditTimeline entries={detail.recent_audit_entries} />
    </div>
  );
};

const OpsEntitlements = () => {
  const { currentUser } = useAuth();
  const [sessionState, setSessionState] = useState({
    status: 'checking',
    session: null,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchState, setSearchState] = useState({
    status: 'idle',
    results: [],
    error: '',
  });
  const [detailState, setDetailState] = useState({
    status: 'idle',
    detail: null,
    error: '',
  });
  const [recentParents, setRecentParents] = useState([]);
  const [overrideDraft, setOverrideDraft] = useState(buildDraftFromDetail(null));
  const [applyState, setApplyState] = useState({ status: 'idle', error: '' });
  const [initReason, setInitReason] = useState('');
  const [initState, setInitState] = useState({ status: 'idle', error: '' });
  const [clearReason, setClearReason] = useState('');
  const [clearState, setClearState] = useState({ status: 'idle', error: '' });
  const userId = currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    let isMounted = true;
    setSessionState({ status: 'checking', session: null });

    getTrustedOperatorSession()
      .then((session) => {
        if (isMounted) {
          setSessionState({ status: 'allowed', session });
        }
      })
      .catch(() => {
        if (isMounted) {
          setSessionState({ status: 'denied', session: null });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const applyLoadedDetail = useCallback((rawDetail) => {
    const detail = normalizeDetailPayload(rawDetail);
    setDetailState({ status: 'loaded', detail, error: '' });
    setOverrideDraft(buildDraftFromDetail(detail));
    setApplyState({ status: 'idle', error: '' });
    setInitState({ status: 'idle', error: '' });
    setClearState({ status: 'idle', error: '' });
    setInitReason('');
    setClearReason('');
    setRecentParents((currentParents) => {
      const nextParents = [
        detail.parent,
        ...currentParents.filter((parent) => parent.uid !== detail.parent.uid),
      ].filter((parent) => parent.uid);

      return nextParents.slice(0, 5);
    });
  }, []);

  const loadParentDetail = useCallback(async (parentId) => {
    if (!parentId) return;

    setDetailState({ status: 'loading', detail: null, error: '' });
    try {
      const detail = await getTrustedOperatorEntitlementRecord({ parent_id: parentId });
      applyLoadedDetail(detail);
    } catch (error) {
      setDetailState({
        status: 'error',
        detail: null,
        error: getErrorMessage(error, 'Unable to load entitlement detail.'),
      });
    }
  }, [applyLoadedDetail]);

  const handleSearch = async (event) => {
    event.preventDefault();
    const query = searchQuery.trim();

    if (query.length < 2) {
      setSearchState((currentState) => ({
        ...currentState,
        error: 'Enter at least 2 characters to search parent accounts.',
      }));
      return;
    }

    setSearchState({ status: 'searching', results: [], error: '' });
    try {
      const result = await searchTrustedParentAccounts({ query });
      setSearchState({
        status: 'idle',
        results: Array.isArray(result?.results) ? result.results : [],
        error: '',
      });
    } catch (error) {
      setSearchState({
        status: 'idle',
        results: [],
        error: getErrorMessage(error, 'Unable to search parent accounts.'),
      });
    }
  };

  const currentParentId = detailState.detail?.parent?.uid;

  const handleRefresh = useCallback(() => {
    if (currentParentId) {
      loadParentDetail(currentParentId);
    }
  }, [currentParentId, loadParentDetail]);

  const handleApplyOverride = async (event) => {
    event.preventDefault();
    if (!currentParentId) return;

    const reasonValidation = validateSupportReason(overrideDraft.reason);
    if (!reasonValidation.isValid) {
      setApplyState({ status: 'idle', error: reasonValidation.message });
      return;
    }

    setApplyState({ status: 'submitting', error: '' });
    try {
      const result = await applyTrustedEntitlementOverride({
        parent_id: currentParentId,
        plan_id: overrideDraft.plan_id,
        subscription_status: overrideDraft.subscription_status,
        feature_overrides: normalizeFeatureSet(overrideDraft.feature_overrides),
        expires_at: toIsoFromDateTimeInput(overrideDraft.expires_at),
        reason: reasonValidation.normalizedReason,
      });
      applyLoadedDetail(result);
    } catch (error) {
      setApplyState({
        status: 'idle',
        error: getErrorMessage(error, 'Unable to apply manual override.'),
      });
    }
  };

  const handleInitialize = async (event) => {
    event.preventDefault();
    if (!currentParentId) return;

    const reasonValidation = validateSupportReason(initReason);
    if (!reasonValidation.isValid) {
      setInitState({ status: 'idle', error: reasonValidation.message });
      return;
    }

    setInitState({ status: 'submitting', error: '' });
    try {
      const result = await initializeTrustedEntitlementRecord({
        parent_id: currentParentId,
        reason: reasonValidation.normalizedReason,
      });
      applyLoadedDetail(result);
    } catch (error) {
      setInitState({
        status: 'idle',
        error: getErrorMessage(error, 'Unable to initialize entitlement record.'),
      });
    }
  };

  const handleClearOverride = async (event) => {
    event.preventDefault();
    if (!currentParentId) return;

    const reasonValidation = validateSupportReason(clearReason);
    if (!reasonValidation.isValid) {
      setClearState({ status: 'idle', error: reasonValidation.message });
      return;
    }

    setClearState({ status: 'submitting', error: '' });
    try {
      const result = await clearTrustedEntitlementOverride({
        parent_id: currentParentId,
        reason: reasonValidation.normalizedReason,
      });
      applyLoadedDetail(result);
    } catch (error) {
      setClearState({
        status: 'idle',
        error: getErrorMessage(error, 'Unable to clear manual override.'),
      });
    }
  };

  const headerMeta = useMemo(() => {
    const session = sessionState.session || {};
    return {
      roleLabel: session.role === 'admin' ? 'Admin' : 'Support',
      email: session.email || currentUser?.email || 'Signed-in operator',
    };
  }, [currentUser?.email, sessionState.session]);

  if (sessionState.status === 'checking') {
    return (
      <OpsRouteStatus
        title="Checking operator access"
        detail="Verifying this signed-in account against the operator allowlist."
      />
    );
  }

  if (sessionState.status === 'denied') {
    return (
      <OpsRouteStatus
        title="Operator access required"
        detail="This account is not on the active support operator allowlist."
        icon={AlertTriangle}
      />
    );
  }

  const { session } = sessionState;

  return (
    <main className="min-h-screen bg-warm-cream text-charcoal-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-5 md:px-6 md:py-6">
        <header className="flex flex-col gap-4 border-b border-mysteria/15 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionLabel>Operator Console</SectionLabel>
            <h1 className="mt-2 font-display text-[30px] leading-tight text-charcoal-ink md:text-[34px]">
              Entitlement Console
            </h1>
          </div>
          <div className="grid gap-2 text-[13px] text-charcoal-ink/70 sm:grid-cols-2 lg:min-w-[460px]">
            <div className="rounded-lg border border-parchment bg-white px-3 py-2">
              <p className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/40">Operator</p>
              <p className="mt-1 truncate font-ui text-charcoal-ink">{headerMeta.email}</p>
            </div>
            <div className="rounded-lg border border-parchment bg-white px-3 py-2">
              <p className="font-label text-[11px] uppercase tracking-[0.12em] text-charcoal-ink/40">Access</p>
              <p className="mt-1 font-ui text-charcoal-ink">{headerMeta.roleLabel} / Stripe Sandbox</p>
            </div>
          </div>
        </header>

        <div className="mt-5 grid flex-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <SearchWorkspace
            currentUser={currentUser}
            onSearch={handleSearch}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchState={searchState}
            onOpenAccount={loadParentDetail}
            recentParents={recentParents}
            session={session}
          />
          <AccountDetail
            detailState={detailState}
            overrideDraft={overrideDraft}
            setOverrideDraft={setOverrideDraft}
            onApplyOverride={handleApplyOverride}
            applyState={applyState}
            initReason={initReason}
            setInitReason={setInitReason}
            initState={initState}
            onInitialize={handleInitialize}
            clearReason={clearReason}
            setClearReason={setClearReason}
            clearState={clearState}
            onClearOverride={handleClearOverride}
            onRefresh={handleRefresh}
          />
        </div>
      </div>
    </main>
  );
};

export default OpsEntitlements;
