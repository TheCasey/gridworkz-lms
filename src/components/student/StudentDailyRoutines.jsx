import { useState } from 'react';
import { buildFrozenRoutineCards } from '../../utils/routineViewModel';

export default function StudentDailyRoutines({ controller }) {
  const { choreState, routineRewards: rewards, loading, error, completeRoutine, completingRoutineIds, refresh } = controller;
  const routines = buildFrozenRoutineCards(choreState);
  const [checked, setChecked] = useState({});
  const day = choreState?.routine_day ? { ...rewards?.day, ...choreState.routine_day } : rewards?.day;
  const save = async (routine) => {
    try { await completeRoutine({ routineTemplateId: routine.id, completedItemIds: routine.checklist_items.map((item) => item.id), dateKey: day?.date_key }); }
    catch { /* The controller retains the trusted error and the same action can retry. */ }
  };
  return <div className="student-workspace-layout" data-testid="student-daily-routines">
    <section className="student-workspace-main">
      <header className="student-page-heading"><div><h1>Daily Routines</h1><p>Small steps for a good day.{day ? ` ${day.date_key} · ${day.timezone}` : ''}</p></div></header>
      {loading ? <p className="student-list-empty" role="status">Loading your saved day…</p> : null}
      {error ? <div className="student-list-empty" role="alert"><p>{error.message}</p><button className="student-button" disabled={loading} onClick={refresh}>Retry loading</button><p>For a failed completion, retry Complete routine below.</p></div> : null}
      {choreState?.access?.can_use_daily_routines === false ? <div className="student-empty-state"><h2>Daily Routines are disabled</h2><p>Your household’s access settings have disabled this workspace.</p></div> : null}
      {!loading && !routines.length && choreState?.access?.can_use_daily_routines ? <div className="student-empty-state"><h2>No routines for today</h2><p>Your parent can set up Morning, Afternoon, and Evening checklists. An empty day earns no points.</p></div> : null}
      <div className="space-y-4">{routines.map((routine) => {
        const key = `${day?.snapshot_id || day?.date_key || ''}:${routine.id}`;
        const chosen = checked[key] || [];
        const allChecked = routine.checklist_items.length > 0 && routine.checklist_items.every((item) => chosen.includes(item.id));
        return <article className="student-routine-card p-5 rounded-2xl" key={key} data-testid={`routine-${routine.id}`}>
          <h2 className="font-display text-lg">{routine.title}</h2><p className="text-sm mt-1">{routine.complete ? 'Complete for this saved day' : 'Check every item, then complete this routine.'}</p>
          <div className="mt-4 space-y-3">{routine.checklist_items.map((item) => <label key={item.id} className="flex items-center gap-3 min-h-[44px]"><input type="checkbox" className="w-5 h-5 accent-amethyst-link" checked={routine.complete || chosen.includes(item.id)} disabled={routine.complete || loading || !!completingRoutineIds[routine.id]} onChange={(event) => setChecked((current) => ({ ...current, [key]: event.target.checked ? [...chosen, item.id] : chosen.filter((id) => id !== item.id) }))} /><span>{item.label}</span></label>)}</div>
          <button className="student-button student-routine-action mt-4" type="button" disabled={routine.complete || !allChecked || loading || !!completingRoutineIds[routine.id]} onClick={() => save(routine)}>{routine.complete ? 'Completed' : completingRoutineIds[routine.id] ? 'Saving…' : 'Complete routine'}</button>
        </article>;
      })}</div>
    </section>
    <aside className="student-workspace-rail"><div className="student-rail-section"><p className="student-eyebrow">Your day</p><strong className="student-rail-title">{routines.filter((routine) => routine.complete).length} / {routines.length} periods complete</strong><p className="student-rail-copy">Today’s checklist stays the same after you begin. Parent edits appear on the next day.</p></div>
      <div className="student-rail-section" aria-live="polite" data-testid="routine-day-award"><p className="student-eyebrow">Daily award</p><strong className="student-rail-title">{rewards?.wallet?.total_points || 0} points</strong><p className="student-rail-copy">{!rewards ? 'Routine rewards are unavailable. You can still complete your checklists.' : rewards.award_entry_id ? 'Today’s award is saved. Each day earns only once.' : !day?.routine_points_enabled ? 'Daily points are turned off for this saved day.' : day.complete ? 'All routines complete.' : `Complete every populated period to earn ${day.routine_day_points} points once today.`}</p></div>
    </aside>
  </div>;
}
