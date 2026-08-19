import {
  Ban,
  CheckCircle2,
  Gift,
  Lock,
  Palette,
  ShieldCheck,
  Sparkles,
  Stars,
} from 'lucide-react';

const DEFAULT_COLORS = Object.freeze({
  charcoal: '#292827',
  amethyst: '#714cb6',
  cream: '#e9e5dd',
  parchment: '#dcd7d3',
  lavender: '#cbb7fb',
});

const SectionCard = ({ children, style = {}, ...props }) => (
  <section
    className="rounded-2xl p-6 bg-white"
    style={{ border: `1px solid ${DEFAULT_COLORS.parchment}`, ...style }}
    {...props}
  >
    {children}
  </section>
);

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  const resolved = new Date(value);
  if (Number.isNaN(resolved.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(resolved);
};

const getRewardIcon = (reward) => {
  if (reward?.unlock_type === 'avatar') {
    return Sparkles;
  }

  if (reward?.unlock_type === 'badge') {
    return ShieldCheck;
  }

  if (reward?.unlock_type === 'profile_theme') {
    return Palette;
  }

  return Gift;
};

const getVisibleMessage = (accessState) => {
  if (accessState === 'locked') {
    return {
      icon: Lock,
      title: 'Rewards are locked right now',
      detail: 'Verify the student session before browsing the reward store.',
    };
  }

  if (accessState === 'empty') {
    return {
      icon: Gift,
      title: 'No rewards are ready yet',
      detail: 'Parent-created rewards and placeholder unlocks will show up here when they are available.',
    };
  }

  return null;
};

const RewardCard = ({
  reward,
  pending = false,
  onRedeem,
  colors,
}) => {
  const Icon = getRewardIcon(reward);

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: `${colors.lavender}28`, color: colors.amethyst }}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h4 style={{ fontSize: 16, fontWeight: 540, color: colors.charcoal, lineHeight: 1.2 }}>
                {reward.title}
              </h4>
              <p className="mt-0.5 text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                {reward.point_cost} points
              </p>
            </div>
          </div>
          {!!reward.description && (
            <p className="mt-3 text-[13px]" style={{ color: 'rgba(41,40,39,0.72)', fontWeight: 460, lineHeight: 1.5 }}>
              {reward.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider"
              style={{
                backgroundColor: reward.is_built_in ? `${colors.lavender}26` : '#fff',
                border: `1px solid ${reward.is_built_in ? `${colors.lavender}88` : colors.parchment}`,
                color: reward.is_built_in ? colors.amethyst : 'rgba(41,40,39,0.58)',
                fontWeight: 700,
              }}
            >
              {reward.is_built_in ? 'Instant Unlock' : reward.redemption_requires_approval ? 'Needs approval' : 'Ready for fulfillment'}
            </span>
            {!reward.is_built_in ? (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider"
                style={{
                  backgroundColor: '#fff',
                  border: `1px solid ${colors.parchment}`,
                  color: 'rgba(41,40,39,0.58)',
                  fontWeight: 700,
                }}
              >
                {reward.available_quantity} left
              </span>
            ) : null}
          </div>
          {!!reward.fulfillment_terms && (
            <p className="mt-3 text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460, lineHeight: 1.5 }}>
              {reward.fulfillment_terms}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRedeem?.(reward.id)}
          disabled={!reward.can_redeem || pending}
          className="px-3 py-2 rounded-lg text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: colors.charcoal, color: '#fff', fontWeight: 700 }}
        >
          {pending ? 'Saving...' : 'Redeem'}
        </button>
      </div>

      {!reward.can_redeem && reward.unavailable_reason ? (
        <p className="mt-3 text-[12px]" style={{ color: colors.amethyst, fontWeight: 540 }}>
          {reward.unavailable_reason}
        </p>
      ) : null}
    </div>
  );
};

const RedemptionCard = ({
  redemption,
  pending = false,
  onCancel,
  colors,
}) => {
  const isOpen = redemption.status === 'requested' || redemption.status === 'approved';
  const tone = redemption.status === 'fulfilled'
    ? colors.amethyst
    : redemption.status === 'rejected' || redemption.status === 'canceled'
      ? 'rgba(41,40,39,0.5)'
      : colors.charcoal;

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 style={{ fontSize: 16, fontWeight: 540, color: colors.charcoal, lineHeight: 1.2 }}>
              {redemption.title_snapshot}
            </h4>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider"
              style={{ backgroundColor: '#fff', border: `1px solid ${colors.parchment}`, color: tone, fontWeight: 700 }}
            >
              {redemption.status.replace('_', ' ')}
            </span>
          </div>
          <p className="mt-2 text-[13px]" style={{ color: 'rgba(41,40,39,0.68)', fontWeight: 460 }}>
            {redemption.point_cost_snapshot} points
          </p>
          {!!redemption.fulfillment_terms_snapshot && (
            <p className="mt-2 text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
              {redemption.fulfillment_terms_snapshot}
            </p>
          )}
          <p className="mt-2 text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
            Requested {formatDateTime(redemption.requested_at) || 'just now'}
          </p>
        </div>

        {isOpen ? (
          <button
            type="button"
            onClick={() => onCancel?.(redemption.id)}
            disabled={pending}
            className="px-3 py-2 rounded-lg text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: '#fff', border: `1px solid ${colors.parchment}`, color: colors.charcoal, fontWeight: 700 }}
          >
            {pending ? 'Saving...' : 'Cancel'}
          </button>
        ) : null}
      </div>
    </div>
  );
};

const StudentRewardStore = ({
  store,
  loading = false,
  error = null,
  onRedeem,
  onCancelRedemption,
  requestingRewardIds = {},
  cancelingRewardIds = {},
  colors = DEFAULT_COLORS,
}) => {
  const visibleMessage = getVisibleMessage(store.accessState);

  return (
    <div className="space-y-7" data-testid="student-reward-store">
      <SectionCard>
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
              Own Path
            </p>
            <h2 style={{ fontSize: 24, fontWeight: 540, color: colors.charcoal, lineHeight: 1.05 }}>
              Rewards
            </h2>
            <p className="mt-2 max-w-2xl text-[14px]" style={{ color: 'rgba(41,40,39,0.68)', fontWeight: 460, lineHeight: 1.55 }}>
              Spend points on parent-created rewards or unlock placeholder avatars, badges, and profile themes.
            </p>
          </div>

          <div className="grid gap-3 md:min-w-[320px] grid-cols-2 md:grid-cols-3">
            <div className="rounded-xl p-4" style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                Points
              </p>
              <p style={{ fontSize: 24, fontWeight: 540, color: colors.charcoal }}>
                {store.wallet?.total_points || 0}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                Open requests
              </p>
              <p style={{ fontSize: 24, fontWeight: 540, color: colors.charcoal }}>
                {store.pendingRedemptions.length}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                Unlocked
              </p>
              <p style={{ fontSize: 24, fontWeight: 540, color: colors.charcoal }}>
                {store.unlockedBuiltIns.length}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {error?.message ? (
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: '#fbf8ff', border: `1px solid ${colors.lavender}` }}
        >
          <p style={{ fontSize: 14, color: colors.charcoal, fontWeight: 540 }}>{error.message}</p>
        </div>
      ) : null}

      {visibleMessage ? (
        <SectionCard>
          <div className="flex items-start gap-3">
            <visibleMessage.icon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: colors.amethyst }} />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 540, color: colors.charcoal }}>
                {visibleMessage.title}
              </h3>
              <p className="mt-1 text-[14px]" style={{ color: 'rgba(41,40,39,0.6)', fontWeight: 460, lineHeight: 1.5 }}>
                {visibleMessage.detail}
              </p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {store.canInteract ? (
        <>
          <SectionCard>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                  Store
                </p>
                <h3 style={{ fontSize: 18, fontWeight: 540, color: colors.charcoal }}>
                  Available rewards
                </h3>
              </div>
              <span className="text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                {store.availableRewards.length} ready now
              </span>
            </div>

            {loading && store.catalog.length === 0 ? (
              <p className="text-[14px]" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
                Loading rewards...
              </p>
            ) : store.catalog.length === 0 ? (
              <div className="rounded-xl p-4" style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}>
                <p style={{ fontSize: 14, color: colors.charcoal, fontWeight: 540 }}>No rewards are active right now.</p>
                <p className="mt-1 text-[13px]" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
                  Check back after your parent adds new catalog items.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {store.catalog.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    pending={Boolean(requestingRewardIds[reward.id])}
                    onRedeem={onRedeem}
                    colors={colors}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                  Waiting
                </p>
                <h3 style={{ fontSize: 18, fontWeight: 540, color: colors.charcoal }}>
                  My requests
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                <Stars className="w-3.5 h-3.5" />
                {store.pendingRedemptions.length} open
              </span>
            </div>

            {store.pendingRedemptions.length === 0 ? (
              <div className="rounded-xl p-4" style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}>
                <p style={{ fontSize: 14, color: colors.charcoal, fontWeight: 540 }}>No open reward requests.</p>
                <p className="mt-1 text-[13px]" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
                  Parent-created rewards will stay here until they are fulfilled, rejected, or canceled.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {store.pendingRedemptions.map((redemption) => (
                  <RedemptionCard
                    key={redemption.id}
                    redemption={redemption}
                    pending={Boolean(cancelingRewardIds[redemption.id])}
                    onCancel={onCancelRedemption}
                    colors={colors}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {(store.completedRedemptions.length > 0 || store.refundedRedemptions.length > 0) ? (
            <SectionCard>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                    History
                  </p>
                  <h3 style={{ fontSize: 18, fontWeight: 540, color: colors.charcoal }}>
                    Recent reward activity
                  </h3>
                </div>
              </div>

              <div className="space-y-4">
                {store.completedRedemptions.map((redemption) => (
                  <div
                    key={redemption.id}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: colors.amethyst }} />
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 540, color: colors.charcoal }}>
                          {redemption.title_snapshot}
                        </h4>
                        <p className="mt-1 text-[12px]" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
                          Fulfilled {formatDateTime(redemption.fulfilled_at) || 'recently'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {store.refundedRedemptions.map((redemption) => (
                  <div
                    key={redemption.id}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}
                  >
                    <div className="flex items-start gap-3">
                      <Ban className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'rgba(41,40,39,0.58)' }} />
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 540, color: colors.charcoal }}>
                          {redemption.title_snapshot}
                        </h4>
                        <p className="mt-1 text-[12px]" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
                          {redemption.status === 'rejected' ? 'Rejected' : 'Canceled'} and points restored.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default StudentRewardStore;
