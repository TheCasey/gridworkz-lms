import baseSeedling from '../../assets/routine-cosmetics/baseSeedling.svg';
import stargazerAvatar from '../../assets/routine-cosmetics/stargazerAvatar.svg';
import cometBadge from '../../assets/routine-cosmetics/cometBadge.svg';
import twilightTheme from '../../assets/routine-cosmetics/twilightTheme.svg';
import { resolveCosmeticPreviewId } from '../../utils/routineViewModel';

const art = { builtin_avatar_seedling: baseSeedling, builtin_avatar_stargazer: stargazerAvatar, builtin_badge_comet: cometBadge, builtin_theme_twilight: twilightTheme };
export const CosmeticArt = ({ id, title, className = '' }) => <img className={className} src={art[resolveCosmeticPreviewId(id)] || baseSeedling} alt={title || 'Seedling compatibility preview'} width="160" height="160" />;

export default function RoutineCosmetics({ controller, studentName }) {
  const { routineRewards: rewards, loading, error, cosmeticPending, unlockCosmetic, selectCosmetics, refresh } = controller;
  const selected = rewards?.cosmetics?.selected_cosmetic_ids || {};
  const owned = rewards?.cosmetics?.owned_cosmetic_ids || [];
  const catalog = rewards?.catalog || [];
  const unknown = owned.filter((id) => !catalog.some((item) => item.id === resolveCosmeticPreviewId(id)));
  const pending = loading || Object.keys(cosmeticPending).length > 0;
  const selectedAvatar = catalog.find((item) => item.id === resolveCosmeticPreviewId(selected.avatar));
  const equip = async (item) => {
    const compatibleSelections = Object.fromEntries(Object.entries(selected).filter(([, id]) => catalog.some((entry) => entry.id === id)));
    try { await selectCosmetics({ ...compatibleSelections, [item.unlock_type]: item.id }); } catch { /* Shared controller displays trusted failure. */ }
  };
  const unlock = async (id) => { try { await unlockCosmetic(id); } catch { /* Keep failed action available to retry. */ } };
  return <div className="student-workspace-layout" data-testid="student-routine-cosmetics">
    <section className="student-workspace-main">
      <header className="student-page-heading"><div><h1>My Avatar</h1><p>Use your daily routine points to make this space yours.</p></div></header>
      {loading ? <p role="status" className="student-list-empty">Loading your saved cosmetics…</p> : null}
      {error ? <div role="alert" className="student-list-empty"><p>{error.message}</p><button className="student-button" onClick={refresh} disabled={pending}>Retry loading</button><p>Retry an unlock or equip with its button below.</p></div> : null}
      {!loading && !rewards ? <div className="student-empty-state"><h2>Cosmetics are unavailable right now</h2><p>Your daily checklists still work when routine rewards are disabled by your household’s access settings.</p></div> : null}
      {rewards ? <>
        <div className="student-cosmetic-preview p-6 rounded-2xl mb-5 flex flex-wrap items-center gap-6" style={{ background: selected.profile_theme === 'builtin_theme_twilight' ? '#eeeaf8' : '#fff9ef', border: '1px solid #cbb7fb' }} data-testid="equipped-cosmetics">
          <CosmeticArt id={selected.avatar || 'builtin_avatar_seedling'} title={selectedAvatar?.title || 'Seedling compatibility preview'} className="w-32 h-32" />
          <div><h2 className="font-display text-xl">{studentName}</h2><p>{selectedAvatar?.title || (selected.avatar ? 'Historic avatar · Seedling preview' : 'Seedling')}</p>{selected.badge ? <CosmeticArt id={selected.badge} title="Selected badge" className="w-14 h-14 mt-2" /> : null}<p className="text-sm mt-2">{selected.profile_theme === 'builtin_theme_twilight' ? 'Twilight theme equipped' : 'Classic theme'}</p></div>
        </div>
        <div className="flex flex-wrap gap-3 mb-5">{['badge', 'profile_theme'].filter((slot) => selected[slot]).map((slot) => <button key={slot} className="student-button student-routine-action" disabled={pending} onClick={() => equip({ id: '', unlock_type: slot })}>{slot === 'badge' ? 'Remove badge' : 'Use classic theme'}</button>)}</div>
        <p className="student-section-label">Built-in cosmetics · {rewards.wallet?.total_points || 0} points available</p>
        <div className="grid gap-4 sm:grid-cols-2">{catalog.map((item) => {
          const isOwned = owned.some((id) => resolveCosmeticPreviewId(id) === item.id);
          const canEquip = owned.includes(item.id);
          const isEquipped = resolveCosmeticPreviewId(selected[item.unlock_type]) === item.id;
          return <article className="student-cosmetic-card p-5 rounded-2xl" key={item.id} data-testid={`cosmetic-${item.id}`}>
            <CosmeticArt id={item.id} title={item.title} className="w-28 h-28 mx-auto" /><h3 className="font-display text-lg mt-3">{item.title}</h3><p className="text-sm mt-1">{item.description}</p><p className="text-sm mt-3">{isOwned ? 'Owned' : `${item.point_cost} points`}</p>
            {isOwned ? <button type="button" className="student-button student-routine-action mt-3" disabled={pending || isEquipped || !canEquip} onClick={() => equip(item)}>{isEquipped ? `${item.title} equipped` : canEquip ? `Equip ${item.title}` : `Historic ${item.title} owned`}</button> : <button type="button" className="student-button student-routine-action mt-3" disabled={pending || (rewards.wallet?.total_points || 0) < item.point_cost} onClick={() => unlock(item.id)}>Unlock {item.title}</button>}
            {isOwned && !canEquip ? <p className="text-sm mt-2">Your historic unlock is preserved with matching artwork. This earlier identifier remains in your collection.</p> : null}
            {!isOwned && (rewards.wallet?.total_points || 0) < item.point_cost ? <p className="text-sm mt-2">{item.point_cost - (rewards.wallet?.total_points || 0)} more points to unlock</p> : null}
          </article>;
        })}</div>
        {unknown.length ? <section className="mt-6"><h2 className="font-display text-lg">Historic cosmetics</h2><p className="text-sm mt-2">These unlocks remain yours. Items from earlier catalogs use a Seedling compatibility preview until their original artwork is supported.</p><ul className="grid gap-3 sm:grid-cols-2 mt-3">{unknown.map((id) => <li className="rounded-xl border border-parchment p-4" key={id}><CosmeticArt id={id} className="w-16 h-16" /><p className="break-all mt-2">{id}</p><p className="text-sm">Preserved historic unlock</p></li>)}</ul></section> : null}
      </> : null}
    </section>
    <aside className="student-workspace-rail"><div className="student-rail-section"><p className="student-eyebrow">Daily routine points</p><strong className="student-rail-title">{rewards?.wallet?.total_points || 0} points</strong><p className="student-rail-copy">Complete all populated periods to earn once a day. Your saved choices follow you on another device.</p></div></aside>
  </div>;
}
