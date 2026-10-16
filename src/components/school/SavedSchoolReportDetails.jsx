import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import useParentSchoolState from '../../hooks/useParentSchoolState';
import { buildSavedReportPresentation, formatReportDate } from '../../utils/reportPresentation';
import ReportSnapshotDetails from './ReportSnapshotDetails';
import SchoolBlockDetails from './SchoolBlockDetails';

export default function SavedSchoolReportDetails({ original, amendments, initialVersionId, student, parentId, parentSettings, subjects, submissions, onClose, onPrint }) {
  const [versionId, setVersionId] = useState(initialVersionId || original.id);
  const dialog = useRef(null);
  useEffect(() => {
    const priorFocus = document.activeElement;
    dialog.current?.querySelector('button')?.focus();
    return () => priorFocus?.focus?.();
  }, []);
  const versions = amendments.filter((item) => item.original_report_id === original.id).sort((a, b) => a.report_version - b.report_version);
  const amendment = versions.find((item) => item.id === versionId);
  const presentation = buildSavedReportPresentation({ original, amendment, timeZone: parentSettings.timezone });
  const originalPresentation = buildSavedReportPresentation({ original, timeZone: parentSettings.timezone });
  const weekRange = useMemo(() => ({ weekStart: original.week_start?.toDate?.() || new Date(original.week_start),
    weekEnd: original.week_end?.toDate?.() || original.week_ending?.toDate?.() || new Date(original.week_end || original.week_ending) }), [original]);
  const students = useMemo(() => [student || { id: original.student_id, parent_id: parentId }], [student, original.student_id, parentId]);
  const school = useParentSchoolState({ parentId, students, subjects, submissions, weekConfig: parentSettings, weekRange, weekKey: original.week_key });
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const elements = Array.from(dialog.current.querySelectorAll('button,select,input,textarea,summary,[tabindex="0"]')).filter((element) => !element.disabled);
    const first = elements[0]; const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div ref={dialog} onKeyDown={onKeyDown} className="fixed inset-0 z-[80] bg-black/50 p-3 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Official report details">
    <div className="bg-white text-charcoal-ink rounded-xl w-full max-w-3xl max-h-[92vh] overflow-auto p-4 md:p-6">
      <div className="flex justify-between items-start gap-3"><h2 className="font-display text-lg break-words min-w-0">{original.student_name} · Official report</h2><button type="button" onClick={onClose} aria-label="Close report details" className="p-2 flex-shrink-0"><X className="w-5 h-5" /></button></div>
      <p className="text-xs mt-2">{formatReportDate(presentation.weekStart, presentation.timeZone, true)} – {formatReportDate(presentation.weekEnd, presentation.timeZone, true)}</p>
      <p className="text-xs mt-2">Original saved snapshot: {originalPresentation.completed}/{originalPresentation.assigned} blocks · {originalPresentation.timeLabel}. This original remains unchanged.</p>
      <label className="block text-sm mt-4">Report version<select className="block p-2 mt-1 border border-parchment rounded w-full" value={versionId} onChange={(event) => setVersionId(event.target.value)}>
        <option value={original.id}>Original saved report · Version 1</option>
        {versions.map((item) => <option key={item.id} value={item.id}>Amendment · Version {item.report_version}</option>)}
      </select></label>
      <p className="text-sm mt-3">{presentation.versionLabel} · {formatReportDate(presentation.versionDate, presentation.timeZone)}</p>
      {amendment && <p className="text-xs mt-2">Amendment by parent {amendment.actor_id || 'Not recorded'} · {formatReportDate(amendment.recorded_at, presentation.timeZone)} · {(amendment.correction_event_ids || []).length} linked correction event(s)</p>}
      <div className="mt-4"><ReportSnapshotDetails report={presentation} /></div>
      <button type="button" className="rounded bg-amethyst-link text-white px-3 py-2 text-sm mt-4" onClick={() => onPrint({ original, amendment })}>Print selected version</button>
      <div className="border-t border-parchment mt-6 pt-4">
        <h3 className="font-label text-sm">Review current status &amp; add a correction</h3>
        <p className="text-xs mt-1">This editor shows the latest status for this saved week. A new correction creates another amendment; the version above stays unchanged.</p>
        {school.loading && <p role="status" className="text-sm mt-3">Loading current correction history…</p>}
        {school.error && <p role="alert" className="text-sm mt-3">Unable to load current status: {school.error.message}</p>}
        <SchoolBlockDetails schoolWeek={school.byStudentId[original.student_id]} onReload={school.reload} disabled={school.loading || Boolean(school.error)} />
      </div>
    </div>
  </div>;
}
