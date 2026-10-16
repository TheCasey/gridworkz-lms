import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import useRoutineParentData from '../../hooks/useRoutineParentData';
import { getEditableRoutinePeriod, selectParentRoutineTemplates } from '../../utils/routineViewModel';
import { normalizeRoutineTemplateDraft } from '../../utils/choreParentViewModel';
import { settleTrustedHouseholdHistory, upsertTrustedRoutineRewardSettings, upsertTrustedRoutineTemplate } from '../../firebase/trustedOperations';

const periods = ['morning', 'afternoon', 'evening'];
const titleCase = (value) => value[0].toUpperCase() + value.slice(1);
const input = 'op-input w-full';
const allowanceEarned = (record) => record.calculated_earned_amount === undefined
  ? Number(record.adjusted_earned_amount || 0)
  : Math.max(0, Number(record.calculated_earned_amount) + Number(record.parent_adjustment_amount || 0));
const allowanceRemaining = (record) => Math.max(0, allowanceEarned(record) - Number(record.paid_amount || 0));
const savedDateLabel = (value) => {
  if (!value) return '';
  const date = value?.toDate?.() || new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

export default function DailyRoutinesRoute({ history = false }) {
  const { currentUser, students = [], entitlementSummary } = useOutletContext();
  const { data, loading, error, refresh } = useRoutineParentData(currentUser?.uid, history);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [draftsByStudent, setDraftsByStudent] = useState({});
  const dirtyPeriods = useRef(new Set());
  const settingsDirty = useRef(false);
  const [points, setPoints] = useState(10);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const idempotency = useRef({});
  const studentId = students.some((student) => student.id === selectedStudent) ? selectedStudent : students[0]?.id;
  const draftScope = `${currentUser?.uid || ''}:${studentId || ''}`;
  const drafts = draftsByStudent[draftScope] || {};
  const canEditRewards = entitlementSummary?.featureAccessList?.find((feature) => feature.key === 'can_use_routine_rewards')?.isEnabled;
  const canEdit = entitlementSummary?.featureAccessList?.find((feature) => feature.key === 'can_use_daily_routines')?.isEnabled;
  useEffect(() => { settingsDirty.current = false; setPoints(10); setEnabled(true); }, [currentUser?.uid]);
  useEffect(() => {
    if (loading || settingsDirty.current) return;
    setPoints(data.settings?.routine_day_points ?? 10);
    setEnabled(data.settings?.routine_points_enabled !== false);
  }, [data.settings, loading]);
  useEffect(() => {
    if (loading) return;
    const templates = selectParentRoutineTemplates(data.routineTemplates || [], studentId);
    const saved = Object.fromEntries(periods.map((period) => [period, templates.filter((template) => getEditableRoutinePeriod(template) === period).flatMap((template) => template.checklist_items || []).map((item) => item.label).join('\n')]));
    setDraftsByStudent((current) => ({ ...current, [draftScope]: Object.fromEntries(periods.map((period) => [period, dirtyPeriods.current.has(`${draftScope}:${period}`) ? current[draftScope]?.[period] || '' : saved[period]])) }));
  }, [studentId, data.routineTemplates, loading, draftScope]);
  const run = async (key, operation, success) => {
    setBusy(key); setActionError(''); setNotice('');
    try { await operation(); setNotice(success); await refresh(); }
    catch (nextError) { setActionError(nextError?.details?.message || nextError.message || 'Unable to save. Try again.'); }
    finally { setBusy(''); }
  };
  const savePeriod = (period) => {
    const matching = (data.routineTemplates || []).filter((template) => template.routine_period === period && template.student_ids?.length === 1 && template.student_ids[0] === studentId);
    const existing = matching.find((template) => template.is_active !== false) || matching[0];
    const items = (drafts[period] || '').split('\n').map((label) => label.trim()).filter(Boolean).map((label, index) => ({ id: existing?.checklist_items?.[index]?.id || `item_${index + 1}`, label }));
    return run(period, async () => { await upsertTrustedRoutineTemplate(normalizeRoutineTemplateDraft({ id: existing?.id || `routine_${studentId}_${period}`, title: `${titleCase(period)} Routine`, routine_period: period, student_ids: [studentId], checklist_items: items, is_active: true })); dirtyPeriods.current.delete(`${draftScope}:${period}`); }, `${titleCase(period)} saved. A day already started keeps its saved checklist.`);
  };
  const settle = (type, record, action) => {
    const key = `${type}:${record.id}:${action}`;
    idempotency.current[key] ||= crypto.randomUUID();
    return run(key, () => settleTrustedHouseholdHistory({ obligation_type: type, obligation_id: record.id, action, idempotency_key: idempotency.current[key] }), 'Settlement saved in Household History.');
  };
  const rewardTitle = (record) => record.title_snapshot || record.reward_title_snapshot || data.rewardCatalogItems?.find((item) => item.id === record.reward_catalog_item_id)?.title || record.id;
  const studentName = (record) => students.find((student) => student.id === record.student_id)?.name || 'Former student';
  return <div className="op-page font-body space-y-6" data-testid={history ? 'household-history' : 'parent-daily-routines'}>
    <div className="op-chores-section"><h2 className="text-xl font-display">{history ? 'Household History' : 'Daily Routines'}</h2><p className="op-subtle mt-2">{history ? 'Private saved household records. Existing obligations can be settled here, including after a plan change.' : 'Set up a simple checklist for each student. Today’s checklist and daily award are saved on first use; edits apply to the next day.'}</p><Link className="op-button op-button-secondary mt-4" to={history ? '/dashboard/chores/daily-routines' : '/dashboard/chores/household-history'}>{history ? 'Daily Routines' : 'Household History'}</Link></div>
    {loading ? <p role="status">Loading {history ? 'history' : 'routines'}…</p> : null}
    {error || actionError ? <div role="alert" className="op-panel-muted p-4"><p>{actionError || error.message}</p><button className="op-button mt-3" disabled={!!busy} onClick={refresh}>Retry loading</button><p className="op-subtle mt-2">For a failed save or settlement, retry the same action below.</p></div> : null}
    {notice ? <p role="status" className="op-panel-muted p-4">{notice}</p> : null}
    {!loading && !error && !history ? <>
      {!students.length ? <div className="op-chores-section"><h3>Add a student to begin</h3><p className="op-subtle mt-2">Daily Routines and built-in cosmetics are included on Free.</p><Link className="op-button mt-4" to="/dashboard/students">Open Students</Link></div> : <section className="op-chores-section">
        <label className="block mb-2" htmlFor="routine-student">Student</label><select id="routine-student" className={input} value={studentId || ''} disabled={!!busy} onChange={(event) => { setSelectedStudent(event.target.value); setNotice(''); }}>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select>
        {!canEdit ? <p className="op-subtle mt-3">Routine editing is disabled by this household’s access settings.</p> : null}
        <div className="grid gap-5 lg:grid-cols-3 mt-5">{periods.map((period) => <form key={period} onSubmit={(event) => { event.preventDefault(); savePeriod(period); }}>
          <label className="block font-display mb-2" htmlFor={`routine-${period}`}>{titleCase(period)}</label><textarea id={`routine-${period}`} className={`${input} min-h-[160px]`} value={drafts[period] || ''} disabled={!canEdit || !!busy} placeholder="One routine item per line" onChange={(event) => { const value = event.target.value; dirtyPeriods.current.add(`${draftScope}:${period}`); setDraftsByStudent((current) => ({ ...current, [draftScope]: { ...current[draftScope], [period]: value } })); }} />
          <p className="op-subtle text-sm mt-2">One item per line. An empty period has no tasks.</p><button className="op-button mt-3" disabled={!canEdit || !!busy}>{busy === period ? 'Saving…' : `Save ${titleCase(period)}`}</button>
        </form>)}</div>
        {selectParentRoutineTemplates(data.routineTemplates || [], studentId).filter((template) => !getEditableRoutinePeriod(template)).map((template) => <div key={template.id} className="op-panel-muted p-4 mt-4"><h3>{template.title || 'Historic routine'}</h3><p className="op-subtle text-sm mt-2">This saved routine keeps its own checklist alongside Morning, Afternoon, and Evening.</p><ul className="mt-2">{(template.checklist_items || []).map((item) => <li key={item.id}>{item.label}</li>)}</ul></div>)}
      </section>}
      <form className="op-chores-section" onSubmit={(event) => { event.preventDefault(); run('settings', async () => { await upsertTrustedRoutineRewardSettings({ routine_day_points: Number(points), routine_points_enabled: enabled }); settingsDirty.current = false; }, 'Daily award settings saved for the next day.'); }}>
        <h3 className="font-display text-lg">Daily award</h3>{!canEditRewards ? <p className="op-subtle mt-2">Routine reward settings are disabled by this household’s access settings. Daily checklists remain available.</p> : null}<p className="op-subtle mt-2">Earn once when every populated period is complete. An empty day earns no points.</p><label className="flex gap-3 items-center my-4"><input type="checkbox" checked={enabled} disabled={!canEditRewards || !!busy} onChange={(event) => { settingsDirty.current = true; setEnabled(event.target.checked); }} />Enable routine points</label><label className="block mb-2" htmlFor="routine-day-points">Daily points</label><input id="routine-day-points" className={`${input} max-w-[220px]`} type="number" min="0" max="1000000" step="1" required value={points} disabled={!canEditRewards || !!busy} onChange={(event) => { settingsDirty.current = true; setPoints(event.target.value); }} /><button className="op-button mt-4" disabled={!canEditRewards || !!busy}>Save routine settings</button>
      </form>
    </> : null}
    {!loading && !error && history ? <>
      {Object.entries(data).filter(([name]) => name !== 'settings').every(([, records]) => !records?.length) ? <div className="op-chores-section"><h3>No household history yet</h3><p className="op-subtle mt-2">Saved chores, allowance, point entries, rewards, and settlements will remain here. Start with Daily Routines for today’s checklist.</p></div> : null}
      {(data.allowancePeriods || []).length ? <section className="op-chores-section"><h3 className="font-display text-lg">Saved allowance</h3>{data.allowancePeriods.map((record) => <article className="op-panel-muted p-4 mt-3" key={record.id}><h4>{studentName(record)} · {savedDateLabel(record.period_start || record.week_start) || record.id}</h4><p className="op-subtle">Earned ${allowanceEarned(record).toFixed(2)} · Paid ${(Number(record.paid_amount) || 0).toFixed(2)} · Remaining ${allowanceRemaining(record).toFixed(2)}</p>{allowanceRemaining(record) > 0 ? <button className="op-button mt-3" disabled={!!busy} onClick={() => settle('allowance', record, 'acknowledge_payment')}>Acknowledge payment</button> : <p>Settled</p>}</article>)}</section> : null}
      {(data.rewardRedemptions || []).length ? <section className="op-chores-section"><h3 className="font-display text-lg">Saved reward requests</h3>{data.rewardRedemptions.map((record) => <article className="op-panel-muted p-4 mt-3" key={record.id}><h4>{rewardTitle(record)}</h4><p className="op-subtle">{studentName(record)} · {record.status} · {record.point_cost_snapshot ?? 0} points</p>{['requested', 'approved'].includes(record.status) ? <div className="flex flex-wrap gap-3 mt-3"><button className="op-button" disabled={!!busy} onClick={() => settle('redemption', record, 'fulfill')}>Mark fulfilled</button><button className="op-button op-button-secondary" disabled={!!busy} onClick={() => settle('redemption', record, 'cancel_refund')}>Cancel and refund</button></div> : null}</article>)}</section> : null}
      {Object.entries(data).filter(([name]) => !['settings', 'allowancePeriods', 'rewardRedemptions'].includes(name)).map(([name, records]) => records.length ? <section key={name} className="op-chores-section"><h3 className="font-display text-lg">{{ routineTemplates: 'Saved routine templates', routineCompletions: 'Routine completion history', choreDefinitions: 'Saved chores', choreClaims: 'Chore claims', choreCompletions: 'Chore completion history', rewardCatalogItems: 'Saved reward catalog', pointLedgerEntries: 'Point history', studentPointWallets: 'Preserved wallets', householdHistoryEvents: 'Settlement history' }[name]}</h3><ul className="mt-3 space-y-3">{records.map((record) => <li key={record.id} className="op-panel-muted p-3"><p>{record.title || record.title_snapshot || record.description || record.action || record.source_type || data.choreDefinitions?.find((item) => item.id === record.chore_definition_id)?.title || data.routineTemplates?.find((item) => item.id === record.routine_template_id)?.title || record.id}</p><p className="op-subtle text-sm">{record.student_id ? `${studentName(record)} · ` : ''}{record.status || record.new_status || ''}{record.total_points !== undefined ? `${record.total_points} points` : ''}{record.delta_points !== undefined ? ` · ${record.delta_points} points` : ''}{record.created_at || record.completed_at ? ` · ${savedDateLabel(record.created_at || record.completed_at)}` : ''}{record.actor_id ? ` · Recorded by ${record.actor_id === currentUser?.uid ? 'you' : 'the parent'}` : ''}</p></li>)}</ul></section> : null)}
    </> : null}
  </div>;
}
