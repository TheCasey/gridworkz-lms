import { Gift, Lock, Palette, ShieldCheck, Sparkles, Star } from 'lucide-react';

const getRewardIcon = (reward) => {
  if (reward?.unlock_type === 'avatar') return Sparkles;
  if (reward?.unlock_type === 'badge') return ShieldCheck;
  if (reward?.unlock_type === 'profile_theme') return Palette;
  return Gift;
};

const StudentRewardStoreV2 = ({
  store,
  loading = false,
  error = null,
  onRedeem,
  onCancelRedemption,
  requestingRewardIds = {},
  cancelingRewardIds = {},
}) => (
  <div className="student-workspace-layout" data-testid="student-reward-store">
    <section className="student-workspace-main">
      <header className="student-page-heading"><div><h1>Reward store</h1><p>Spend earned points on family rewards and personal unlocks.</p></div></header>

      {error?.message ? <div className="student-error" role="alert">{error.message}</div> : null}
      {loading && !store.canInteract ? <p className="student-list-empty" role="status">Loading rewards and points…</p> : null}
      {store.accessState === 'locked' ? <div className="student-empty-state"><Lock /><h2>Rewards are locked right now</h2><p>Verify the student session before browsing the reward store.</p></div> : null}

      {store.canInteract ? (
        <>
          <div className="student-section-label"><span>Available rewards</span></div>
          {loading && store.catalog.length === 0 ? <p className="student-list-empty">Loading rewards…</p> : store.catalog.length > 0 ? (
            <div className="student-reward-grid">
              {store.catalog.map((reward) => {
                const Icon = getRewardIcon(reward);
                return (
                  <article key={reward.id} className={`student-reward-card ${reward.is_built_in ? 'is-built-in' : ''}`}>
                    <Icon />
                    <h2>{reward.title}</h2>
                    <p>{reward.description || reward.fulfillment_terms || 'A reward chosen by your family.'}</p>
                    <div className="student-reward-badges">
                      <span>{reward.is_built_in ? 'Instant unlock' : reward.redemption_requires_approval ? 'Approval required' : 'Ready'}</span>
                      {!reward.is_built_in ? <span>{reward.available_quantity} left</span> : null}
                    </div>
                    <footer><strong><Star />{reward.point_cost} pts</strong><button type="button" className="student-button" disabled={!reward.can_redeem || requestingRewardIds[reward.id]} onClick={() => onRedeem?.(reward.id)}>{requestingRewardIds[reward.id] ? 'Requesting…' : 'Redeem'}</button></footer>
                    {!reward.can_redeem && reward.unavailable_reason ? <small>{reward.unavailable_reason}</small> : null}
                  </article>
                );
              })}
            </div>
          ) : <p className="student-list-empty">No rewards are active right now.</p>}

          <div className="student-section-label"><span>My requests</span></div>
          <div className="student-dense-list">
            {store.pendingRedemptions.length > 0 ? store.pendingRedemptions.map((redemption) => (
              <article key={redemption.id} className="student-redemption-row">
                <div><strong>{redemption.title_snapshot}</strong><span>{redemption.point_cost_snapshot} points · {redemption.status.replace('_', ' ')}</span></div>
                <button type="button" className="student-button is-danger" disabled={cancelingRewardIds[redemption.id]} onClick={() => onCancelRedemption?.(redemption.id)}>{cancelingRewardIds[redemption.id] ? 'Canceling…' : 'Cancel'}</button>
              </article>
            )) : <p className="student-list-empty">No open reward requests.</p>}
          </div>

          {store.completedRedemptions.length > 0 || store.refundedRedemptions.length > 0 ? (
            <><div className="student-section-label"><span>Recent activity</span></div><div className="student-dense-list">{[...store.completedRedemptions, ...store.refundedRedemptions].map((redemption) => <article key={redemption.id} className="student-redemption-row"><div><strong>{redemption.title_snapshot}</strong><span>{redemption.status.replace('_', ' ')}</span></div><span className="student-status-chip">{redemption.point_cost_snapshot} pts</span></article>)}</div></>
          ) : null}
        </>
      ) : null}
    </section>

    <aside className="student-workspace-rail">
      <div className="student-rail-section"><p className="student-eyebrow">My balance</p><strong className="student-rail-big student-point-balance"><Star />{store.wallet?.total_points || 0}</strong><span className="student-muted">available points</span></div>
      <div className="student-rail-section"><p className="student-eyebrow">Requests</p><div className="student-rail-stat"><span>Open</span><strong>{store.pendingRedemptions.length}</strong></div><div className="student-rail-stat"><span>Completed</span><strong>{store.completedRedemptions.length}</strong></div></div>
      <div className="student-rail-section"><p className="student-eyebrow">Cosmetics</p><div className="student-rail-stat"><span>Unlocked</span><strong>{store.unlockedBuiltIns.length}</strong></div></div>
    </aside>
  </div>
);

export default StudentRewardStoreV2;
