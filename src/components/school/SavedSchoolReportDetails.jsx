import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import useParentSchoolState from '../../hooks/useParentSchoolState';
import SchoolBlockDetails from './SchoolBlockDetails';

export default function SavedSchoolReportDetails({ original, amendments, student, parentId, parentSettings, subjects, submissions, onClose, onPrint }) {
  const [versionId, setVersionId] = useState(original.id);
  const versions = amendments.filter((item) => item.original_report_id === original.id).sort((a, b) => a.report_version - b.report_version);
  const amendment = versions.find((item) => item.id === versionId);
  const selected = amendment ? { ...amendment.snapshot, report_version: amendment.report_version } : original;
  const weekRange = useMemo(() => ({ weekStart: original.week_start?.toDate?.() || new Date(original.week_start),
    weekEnd: original.week_end?.toDate?.() || original.week_ending?.toDate?.() || new Date(original.week_end || original.week_ending) }), [original]);
  const students = useMemo(() => [student || { id: original.student_id, parent_id: parentId }], [student, original.student_id, parentId]);
  const school = useParentSchoolState({ parentId, students, subjects, submissions, weekConfig: parentSettings, weekRange, weekKey: original.week_key });
  return <div className="fixed inset-0 z-[80] bg-black/50 p-3 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Official report details">
    <div className="bg-white text-charcoal-ink rounded-xl w-full max-w-3xl max-h-[92vh] overflow-auto p-4 md:p-6">
      <div className="flex justify-between items-start gap-3"><h2 className="font-display text-lg">{original.student_name} · Official report</h2><button type="button" onClick={onClose} aria-label="Close report details" className="p-2"><X className="w-5 h-5" /></button></div>
      <p className="text-xs mt-2">Original saved snapshot: {original.total_blocks}/{original.weekly_goal} blocks · {original.total_hours ?? 0} recorded hours. This original remains unchanged.</p>
      <label className="block text-sm mt-4">Report version<select className="block p-2 mt-1 border border-parchment rounded w-full" value={versionId} onChange={(event) => setVersionId(event.target.value)}>
        <option value={original.id}>Original saved report · Version 1</option>
        {versions.map((item) => <option key={item.id} value={item.id}>Amendment · Version {item.report_version}</option>)}
      </select></label>
      {selected.completion_counts_require_review ? <p className="p-3 mt-3 bg-warm-cream text-sm" role="status">Completion counts require review. This subjects-only report cannot reliably attribute corrected blocks. Original numerical totals are retained as historical evidence; no corrected total is claimed.</p>
        : <p className="text-sm mt-3">Selected version: {selected.total_blocks}/{selected.weekly_goal} completed blocks · {selected.total_hours ?? 0} recorded hours</p>}
      {amendment && <p className="text-xs mt-2">Amendment by parent {amendment.actor_id} · {amendment.recorded_at?.toDate?.().toLocaleString() || 'Server time recorded'} · {amendment.correction_event_ids.length} linked correction event(s)</p>}
      <div className="space-y-3 mt-3">{Object.entries(selected.subjects_data || {}).map(([id, item]) => <details key={id}><summary className="cursor-pointer text-sm">{item.subjectTitle} · Original responses</summary>{(item.summaries || []).map((summary, index) => <p key={index} className="text-xs whitespace-pre-wrap p-2">Block {summary.blockNumber || '?'}: {summary.text}</p>)}</details>)}</div>
      {Object.entries(selected.block_completion_overrides || {}).map(([id, item]) => <p key={id} className="text-xs mt-2">Corrected block {(item.block_index ?? 0) + 1}: {item.status} · Parent correction, revision {item.revision}</p>)}
      <button type="button" className="rounded bg-amethyst-link text-white px-3 py-2 text-sm mt-4" onClick={() => onPrint(selected)}>Print selected version</button>
      {school.loading && <p role="status" className="text-sm mt-3">Loading current correction history…</p>}
      {school.error && <p role="alert" className="text-sm mt-3">Unable to load current status: {school.error.message}</p>}
      <SchoolBlockDetails schoolWeek={school.byStudentId[original.student_id]} onReload={school.reload} disabled={school.loading || Boolean(school.error)} />
    </div>
  </div>;
}
