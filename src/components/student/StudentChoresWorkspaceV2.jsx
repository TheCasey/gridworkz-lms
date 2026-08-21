import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarRange, Check, ListChecks, Lock, Sparkles } from 'lucide-react';

const getPool = (chore) => chore?.frequency_pool === 'monthly' ? 'monthly' : 'weekly';

const StudentChoresWorkspaceV2 = ({
  workspace,
  loading = false,
  error = null,
  onClaimChore,
  onCompleteChore,
  onCompleteRoutine,
  claimingIds = {},
  completingClaimIds = {},
  completingRoutineIds = {},
}) => {
  const [activeSection, setActiveSection] = useState('daily');
  const [routineChecks, setRoutineChecks] = useState({});
  const [proofNotes, setProofNotes] = useState({});

  useEffect(() => {
    setRoutineChecks((current) => workspace.routines.reduce((next, routine) => {
      next[routine.id] = routine.is_completed_today
        ? (routine.completed_item_ids.length > 0 ? routine.completed_item_ids : routine.checklist_items.map((item) => item.id).filter(Boolean))
        : (current[routine.id] || []);
      return next;
    }, {}));
  }, [workspace.routineDateKey, workspace.routines]);

  useEffect(() => {
    if (!workspace.canUseChorePools && activeSection !== 'daily') {
      setActiveSection('daily');
    }
  }, [activeSection, workspace.canUseChorePools]);

  const availableByPool = useMemo(() => ({
    weekly: workspace.availableChores.filter((chore) => getPool(chore) === 'weekly'),
    monthly: workspace.availableChores.filter((chore) => getPool(chore) === 'monthly'),
  }), [workspace.availableChores]);
  const claimedByPool = useMemo(() => ({
    weekly: workspace.claimedChores.filter((chore) => getPool(chore) === 'weekly'),
    monthly: workspace.claimedChores.filter((chore) => getPool(chore) === 'monthly'),
  }), [workspace.claimedChores]);

  const toggleRoutineItem = (routineId, itemId) => {
    setRoutineChecks((current) => {
      const selected = current[routineId] || [];
      return {
        ...current,
        [routineId]: selected.includes(itemId) ? selected.filter((id) => id !== itemId) : [...selected, itemId],
      };
    });
  };

  const renderChore = (chore, claimed = false) => {
    const claimId = chore.active_claim_id || '';
    return (
      <article key={claimId || chore.id} className={`student-chore-row ${claimed ? 'is-claimed' : ''}`}>
        <div className="student-chore-copy">
          <strong>{chore.title}</strong>
          <span>{chore.effort_label || 'Flexible timing'}{chore.proof_requirement ? ` · ${chore.proof_requirement}` : ''}</span>
          {chore.instructions ? <p>{chore.instructions}</p> : null}
          {claimed ? (
            <textarea
              rows={2}
              value={proofNotes[claimId] || ''}
              onChange={(event) => setProofNotes((current) => ({ ...current, [claimId]: event.target.value }))}
              placeholder="Optional note for your parent"
            />
          ) : null}
        </div>
        <button
          type="button"
          className={`student-button ${claimed ? 'is-success' : ''}`}
          disabled={claimed ? !claimId || completingClaimIds[claimId] : claimingIds[chore.id]}
          onClick={() => claimed
            ? onCompleteChore?.({ claimId, proofNote: proofNotes[claimId] || '' })
            : onClaimChore?.(chore.id)}
        >
          {claimed
            ? (completingClaimIds[claimId] ? 'Sending…' : 'Mark done')
            : (claimingIds[chore.id] ? 'Claiming…' : 'Claim')}
        </button>
      </article>
    );
  };

  const renderPool = (pool) => {
    const available = availableByPool[pool];
    const claimed = claimedByPool[pool];
    return (
      <div className="student-chore-pool">
        <div className="student-chore-progress"><span>{pool === 'weekly' ? 'Weekly' : 'Monthly'} quota remaining</span><strong>{workspace.counts.remaining[pool]}</strong></div>
        <div className="student-section-label"><span>My claimed chores</span></div>
        <div className="student-dense-list">
          {claimed.length > 0 ? claimed.map((chore) => renderChore(chore, true)) : <p className="student-list-empty">No {pool} chores are claimed right now.</p>}
        </div>
        <div className="student-section-label"><span>Available {pool} pool</span></div>
        <div className="student-dense-list">
          {loading && available.length === 0 ? <p className="student-list-empty">Loading chores…</p> : available.length > 0 ? available.map((chore) => renderChore(chore)) : <p className="student-list-empty">No {pool} chores are available right now.</p>}
        </div>
      </div>
    );
  };

  const completedRoutineCount = workspace.routines.filter((routine) => routine.is_completed_today).length;

  return (
    <div className="student-workspace-layout" data-testid="student-chores-workspace">
      <section className="student-workspace-main">
        <header className="student-page-heading"><div><h1>Routines & chores</h1><p>Choose a section, then check off or claim the work you want to do.</p></div></header>

        <div className="student-subtabs" role="tablist" aria-label="Chore sections">
          <button type="button" role="tab" aria-selected={activeSection === 'daily'} className={activeSection === 'daily' ? 'is-active' : ''} onClick={() => setActiveSection('daily')}><ListChecks />Daily routine</button>
          {workspace.canUseChorePools ? <button type="button" role="tab" aria-selected={activeSection === 'weekly'} className={activeSection === 'weekly' ? 'is-active' : ''} onClick={() => setActiveSection('weekly')}><CalendarDays />Weekly chores</button> : null}
          {workspace.canUseChorePools ? <button type="button" role="tab" aria-selected={activeSection === 'monthly'} className={activeSection === 'monthly' ? 'is-active' : ''} onClick={() => setActiveSection('monthly')}><CalendarRange />Monthly chores</button> : null}
        </div>

        {error?.message ? <div className="student-error" role="alert">{error.message}</div> : null}
        {loading && !workspace.canInteract ? <p className="student-list-empty" role="status">Loading routines and chores…</p> : null}
        {workspace.accessState === 'locked' ? <div className="student-empty-state"><Lock /><h2>Chores are locked right now</h2><p>Verify the student session before using the household workspace.</p></div> : null}
        {workspace.accessState === 'all_done' ? <div className="student-success-banner"><Sparkles />You are done for now.</div> : null}

        {workspace.canInteract && activeSection === 'daily' ? (
          <div>
            <div className="student-chore-progress"><span>Routine templates completed today</span><strong>{completedRoutineCount} / {workspace.routines.length}</strong></div>
            {workspace.routines.length > 0 ? workspace.routines.map((routine) => {
              const checked = routineChecks[routine.id] || [];
              const allChecked = routine.checklist_items.length === 0 || routine.checklist_items.every((item) => checked.includes(item.id));
              return (
                <article key={routine.id} className="student-routine-group">
                  <header><div><strong>{routine.title}</strong><span>{routine.checklist_items.length} items</span></div><button type="button" className="student-button is-success" disabled={routine.is_completed_today || !allChecked || completingRoutineIds[routine.id]} onClick={() => onCompleteRoutine?.({ routineTemplateId: routine.id, completedItemIds: checked })}>{routine.is_completed_today ? 'Completed' : completingRoutineIds[routine.id] ? 'Saving…' : 'Complete routine'}</button></header>
                  {routine.checklist_items.map((item) => {
                    const isChecked = checked.includes(item.id);
                    return (
                      <label key={item.id || item.label} className="student-routine-item">
                        <input type="checkbox" checked={isChecked} disabled={routine.is_completed_today} onChange={() => toggleRoutineItem(routine.id, item.id)} />
                        <span className={isChecked ? 'is-checked' : ''}><Check /></span>
                        <strong>{item.label}</strong>
                      </label>
                    );
                  })}
                </article>
              );
            }) : <p className="student-list-empty">No routine templates are assigned right now.</p>}
          </div>
        ) : null}
        {workspace.canInteract && activeSection === 'weekly' ? renderPool('weekly') : null}
        {workspace.canInteract && activeSection === 'monthly' ? renderPool('monthly') : null}
      </section>

      <aside className="student-workspace-rail">
        <div className="student-rail-section"><p className="student-eyebrow">Today&apos;s routine</p><strong className="student-rail-big">{completedRoutineCount} / {workspace.routines.length}</strong><span className="student-muted">templates complete</span></div>
        {workspace.canUseChorePools ? <div className="student-rail-section"><p className="student-eyebrow">Weekly chores</p><div className="student-rail-stat"><span>Remaining</span><strong>{workspace.counts.remaining.weekly}</strong></div><div className="student-rail-stat"><span>Claimed</span><strong>{claimedByPool.weekly.length}</strong></div></div> : null}
        {workspace.canUseChorePools ? <div className="student-rail-section"><p className="student-eyebrow">Monthly chores</p><div className="student-rail-stat"><span>Remaining</span><strong>{workspace.counts.remaining.monthly}</strong></div><div className="student-rail-stat"><span>Claimed</span><strong>{claimedByPool.monthly.length}</strong></div></div> : null}
        {workspace.rewardWallet ? <div className="student-rail-section"><p className="student-eyebrow">Points</p><strong className="student-rail-big">{workspace.rewardWallet.total_points || 0}</strong></div> : null}
      </aside>
    </div>
  );
};

export default StudentChoresWorkspaceV2;
