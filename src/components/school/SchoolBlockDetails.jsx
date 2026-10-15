import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { correctTrustedSchoolBlock } from '../../firebase/trustedOperations';
import { readParentSchoolCorrectionRequest, retainParentSchoolCorrectionRequest, clearParentSchoolCorrectionRequest } from '../../utils/parentSchoolCorrectionRequests';
import { schoolTimestampMillis } from '../../utils/parentSchoolStateUtils';

const dateText = (value) => value ? new Date(schoolTimestampMillis(value)).toLocaleString() : 'Not recorded';
const knownFailure = (error) => ['aborted', 'invalid-argument', 'permission-denied', 'unauthenticated', 'failed-precondition', 'not-found', 'already-exists'].includes(String(error?.code || '').replace(/^functions\//, ''));
const provenanceText = (value) => ({ parent_correction: 'Parent correction', legacy_parent: 'Legacy parent record (actor unknown)', legacy_student: 'Legacy student evidence', student: 'Student submission' }[value] || 'No completion recorded');

// Shared by Students, Weekly Plan, and Reports. Corrections never edit evidence.
export default function SchoolBlockDetails({ schoolWeek, onReload, disabled = false }) {
  const [selectedId, setSelectedId] = useState('');
  const [baseline, setBaseline] = useState(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(null);
  const planId = schoolWeek?.plan?.id || '';
  useEffect(() => {
    const retained = readParentSchoolCorrectionRequest(planId);
    pending.current = retained;
    setBaseline(retained ? { revision: retained.expected_revision, status: retained.new_status === 'completed' ? 'incomplete' : 'completed', newStatus: retained.new_status } : null);
    setSelectedId(retained?.weekly_block_id || ''); setReason(retained?.reason || ''); setNote(retained?.note || '');
    setMessage(retained ? 'A correction has an uncertain result. Retry its exact request to check whether it was saved.' : '');
    setConflict(false); setUncertain(Boolean(retained));
  }, [planId]);
  const entry = schoolWeek?.entries.find((item) => item.block.id === selectedId);
  if (!schoolWeek) return null;
  const staleSelection = Boolean(entry && baseline && !uncertain && (entry.state.revision !== baseline.revision || entry.state.status !== baseline.status));
  const select = (id) => { if (uncertain || busy) return; setSelectedId(id);
    const selected = schoolWeek.entries.find((item) => item.block.id === id);
    setBaseline(selected ? { revision: selected.state.revision, status: selected.state.status, newStatus: selected.state.status === 'completed' ? 'incomplete' : 'completed' } : null);
    setReason(''); setNote(''); setMessage(''); setConflict(false); };
  const save = async () => {
    if ((!entry && !pending.current) || disabled || busy || conflict || staleSelection) return;
    const payload = pending.current || { student_id: schoolWeek.plan.student_id, week_key: schoolWeek.plan.week_key,
      weekly_block_id: entry.block.id, expected_revision: baseline.revision,
      new_status: baseline.newStatus, reason: reason.trim(), note: note.trim(), idempotency_key: nanoid() };
    if (!payload.reason) return;
    pending.current = payload;
    retainParentSchoolCorrectionRequest(planId, payload);
    setBusy(true); setMessage('');
    try {
      const response = await correctTrustedSchoolBlock(payload);
      setBaseline({ revision: response.revision, status: response.status, newStatus: response.status === 'completed' ? 'incomplete' : 'completed' });
      clearParentSchoolCorrectionRequest(planId);
      pending.current = null; setUncertain(false); setReason(''); setNote('');
      setMessage(payload.new_status === 'completed' ? 'Parent correction saved. No student response or time was invented.' : 'Work reopened. Original evidence and history are preserved. Timers remain stopped.');
    } catch (error) {
      const isConflict = String(error?.code || '').endsWith('aborted');
      if (knownFailure(error)) { clearParentSchoolCorrectionRequest(planId); pending.current = null; setUncertain(false); }
      else setUncertain(true);
      setConflict(isConflict);
      setMessage(isConflict ? 'This block changed on another device. Reload and review the current status before correcting it.'
        : knownFailure(error) ? error.message : 'The result is uncertain. Retry this exact correction to safely check whether it was saved.');
    } finally { setBusy(false); }
  };
  return (
    <section className="rounded-xl border border-parchment bg-white p-4 text-charcoal-ink mt-4" aria-label="School block details and corrections">
      <h3 className="font-display text-[15px]">Block details &amp; parent corrections</h3>
      <p className="text-xs mt-1 text-charcoal-ink/60">{schoolWeek.plan?.status === 'archived' ? 'Archived work stays archived. A correction adds a report amendment.' : 'Parent changes record a reason, actor, and server time. Undo preserves student work.'}</p>
      {schoolWeek.preview && <p className="text-xs mt-2">Legacy assignment preview. The first trusted completion read or correction freezes this week.</p>}
      {schoolWeek.reviewRequired && <p role="status" className="text-sm mt-2">Historical assignment requires review. Use the original saved report; no block identity was inferred.</p>}
      {!schoolWeek.entries.length && !schoolWeek.reviewRequired && <p className="text-sm mt-2">No assigned school blocks for this week.</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        {schoolWeek.entries.map(({ block, state }) => <button type="button" key={block.id} disabled={busy || uncertain}
          aria-pressed={selectedId === block.id} onClick={() => select(block.id)}
          className={`border rounded-lg px-3 py-2 text-xs text-left min-h-[44px] ${selectedId === block.id ? 'border-amethyst-link bg-lavender-glow/30' : 'border-parchment'}`}>
          {block.title || block.legacy_subject_title || 'School block'} · {(block.legacy_block_index ?? 0) + 1} · {state.status === 'completed' ? 'Complete' : 'Incomplete'}
        </button>)}
      </div>
      {!entry && uncertain && <div className="mt-3"><p role="status" className="text-xs">{message}</p><button type="button" onClick={save} disabled={busy || disabled} className="underline text-sm py-2">Retry exact correction</button></div>}
      {entry && <div className="mt-4 space-y-3 text-sm">
        <p><strong>{entry.block.title || 'School block'}</strong> · {entry.state.status} · Revision {entry.state.revision}</p>
        <p className="text-xs">{provenanceText(entry.state.provenance)} · Actor: {entry.state.actor_id || 'Not recorded'} · {dateText(entry.state.updated_at || entry.state.completed_at)}</p>
        {entry.block.instruction && <p className="whitespace-pre-wrap">{entry.block.instruction}</p>}
        <details><summary className="cursor-pointer py-2">Original evidence ({entry.evidence.length})</summary>
          {entry.evidence.map((item) => <div key={item.id} className="border-l-2 border-lavender-glow p-3 my-2">
            <p className="text-xs">{item.manual_override ? 'Legacy parent record' : 'Student evidence'} · {dateText(item.timestamp)} · {item.block_duration == null ? 'Duration not recorded' : `${item.block_duration} recorded minutes`}</p>
            <p className="whitespace-pre-wrap">{item.summary_text || 'No written response'}</p>
            {item.custom_field_responses && Object.entries(item.custom_field_responses).map(([key, value]) => <p key={key}>{key}: {String(value)}</p>)}
          </div>)}
        </details>
        <details><summary className="cursor-pointer py-2">Correction history ({entry.events.length}) and state history ({entry.history.length})</summary>
          {entry.events.map((event) => <div key={event.id} className="border-l-2 border-lavender-glow p-3 my-2"><p>{event.prior_status} → {event.new_status}</p><p>{event.reason}</p>{event.note && <p className="whitespace-pre-wrap">{event.note}</p>}<p className="text-xs">Parent {event.actor_id} · {dateText(event.recorded_at)}</p></div>)}
          {entry.history.map((item) => <p className="text-xs py-1" key={item.id}>Revision {item.revision} · {item.status} · {provenanceText(item.provenance)} · {dateText(item.recorded_at)}</p>)}
        </details>
        <label className="block text-xs">Reason (required)<input value={reason} maxLength={500} disabled={busy || uncertain || conflict || staleSelection || disabled} onChange={(event) => setReason(event.target.value)} className="block w-full rounded border border-parchment p-2 mt-1" /></label>
        <label className="block text-xs">Parent note (optional)<textarea value={note} maxLength={5000} disabled={busy || uncertain || conflict || staleSelection || disabled} onChange={(event) => setNote(event.target.value)} className="block w-full rounded border border-parchment p-2 mt-1" /></label>
        {baseline?.status !== 'completed' && <p className="text-xs">Marking complete is a parent correction. It bypasses timer/response requirements without adding student evidence or minutes.</p>}
        <button type="button" onClick={save} disabled={busy || conflict || staleSelection || disabled || (!uncertain && !reason.trim())} className="rounded-lg bg-amethyst-link text-white px-4 py-2 disabled:opacity-40">
          {busy ? 'Saving…' : uncertain ? 'Retry exact correction' : baseline?.status === 'completed' ? 'Undo completion — reopen work' : 'Mark complete as parent correction'}
        </button>
        {(conflict || staleSelection) && <button type="button" className="ml-2 underline text-xs py-2" onClick={() => { setConflict(false); setBaseline({ revision: entry.state.revision, status: entry.state.status, newStatus: entry.state.status === 'completed' ? 'incomplete' : 'completed' }); setMessage('Review the refreshed status and enter a reason to continue.'); setReason(''); setNote(''); onReload?.(); }}>Reload and review</button>}
        {staleSelection && <p role="status" className="text-xs">This block changed while you were reviewing it. Reload and review before applying a correction.</p>}
        {message && <p role="status" className="text-xs whitespace-pre-wrap">{message}</p>}
      </div>}
    </section>
  );
}
