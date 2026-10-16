import { formatReportDate, reportEvidenceText, reportHasRequiredResponse } from '../../utils/reportPresentation';

const provenance = (value) => ({ parent_correction: 'Parent correction', student: 'Student submission', legacy_student: 'Legacy student evidence', legacy_parent: 'Legacy parent record (actor unknown)' }[value] || 'No completion recorded');
const watermark = (value) => typeof value === 'object' && value !== null ? value.school_state_revision ?? 'Not recorded' : value ?? 'Not recorded';

function Evidence({ item, timeZone }) {
  return <div className="border-l-2 border-lavender-glow pl-3 py-2 my-2 min-w-0">
    <p className="text-xs">{item.blockNumber ? `Block ${item.blockNumber} · ` : ''}{item.manual ? 'Legacy parent record (actor not recorded)' : 'Student evidence'} · {formatReportDate(item.date, timeZone)} · {item.minutes === null ? 'Duration not recorded' : `${item.minutes} recorded minutes`}</p>
    {item.id && <p className="text-xs opacity-70 break-all">Evidence ref: {item.id}</p>}
    <p className="text-sm whitespace-pre-wrap break-words mt-2">{item.text || 'No written response'}</p>
    {Object.entries(item.responses).map(([key, value]) => <p key={key} className="text-sm whitespace-pre-wrap break-words mt-1">{key}: {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}</p>)}
    {item.resources.length > 0 && <p className="text-xs break-words mt-2">Resources used: {item.resources.map(reportEvidenceText).join('; ')}</p>}
  </div>;
}

// Structured screen presentation uses exactly the model handed to the print renderer.
export default function ReportSnapshotDetails({ report, children }) {
  const date = (value) => formatReportDate(value, report.timeZone);
  const missingEventIds = report.correctionIds.filter((id) => !report.corrections.some((event) => event.id === id));
  return <div className="space-y-4 min-w-0 text-sm" data-report-version={report.version || 'live'}>
    {report.countsRequireReview && <p className="text-xs">Original recorded totals (require review)</p>}
    <div className="flex flex-wrap gap-x-6 gap-y-2 py-2" role="group" aria-label="Weekly completion totals">
      <p><strong>{report.assigned}</strong> assigned</p><p><strong>{report.completed}</strong> completed</p><p><strong>{report.incomplete}</strong> incomplete</p>
    </div>
    {report.countsRequireReview && <p role="status" className="p-3 bg-lavender-glow/20 rounded">Completion counts require review. Original numerical totals are retained as historical evidence; no corrected total is claimed.</p>}
    <p className="text-xs opacity-75">{report.timeLabel}. Parent corrections add no time.</p>
    {(report.publishedRevision != null || report.correctionWatermark != null) && <p className="text-xs opacity-65">Published revision: {report.publishedRevision ?? 'Not recorded'} · Correction watermark: {watermark(report.correctionWatermark)}</p>}
    <section aria-label="Assigned work">
      <h3 className="font-label mb-2">Assigned work</h3>
      {report.blocks.length > 0 ? <ul className="divide-y divide-current/10">{report.blocks.map((block) => <li key={block.id} className="py-2 min-w-0">
        <p className="text-xs opacity-70 break-words">{block.subjectTitle}</p>
        <p className="break-words"><strong>{block.title}</strong>{block.number ? ` · Block ${block.number}` : ''} · {block.completed ? 'Completed' : 'Incomplete'}</p>
        <p className="text-xs opacity-70">{provenance(block.provenance)}{block.provenance === 'parent_correction' ? ' · Timer and response requirements bypassed; no evidence or minutes added' : ''}</p>
        {block.completed && !reportHasRequiredResponse(block) && <p className="text-xs mt-1 text-amber-600">Required response missing</p>}
      </li>)}</ul> : report.subjects.length > 0 ? report.subjects.map((subject) => <p key={subject.id} className="py-1 break-words">{subject.title} · {subject.completed}/{subject.assigned} completed</p>) : <p className="opacity-70">No assigned work recorded.</p>}
    </section>
    <section aria-label="Report corrections and notes">
      <h3 className="font-label mb-2">Corrections &amp; parent notes</h3>
      {report.notes.map((note, index) => <p key={index} className="text-sm whitespace-pre-wrap break-words mb-2">Parent note (recorded snapshot): {note}</p>)}
      {report.corrections.length ? report.corrections.map((event) => <div key={event.id} className="border-l-2 border-lavender-glow pl-3 py-2 my-2">
        <p>Parent correction: {event.before} → {event.after}</p><p className="whitespace-pre-wrap break-words">Reason: {event.reason || 'Not recorded'}</p>
        {event.note && <p className="whitespace-pre-wrap break-words">Parent note: {event.note}</p>}
        <p className="text-xs opacity-70">Parent {event.actor || 'Not recorded'} · {date(event.date)}</p><p className="text-xs break-all opacity-70">Correction ref: {event.id}</p>
      </div>) : <p className="text-xs opacity-70">No correction details recorded in this version.</p>}
      {missingEventIds.map((id) => <p key={id} className="text-xs break-all mt-1">Linked correction ref: {id} (details not recorded in this snapshot)</p>)}
      {report.overlays.map((item) => <p key={item.id} className="text-xs py-1">Corrected block {(item.block_index ?? 0) + 1}: {item.status} · Parent correction, revision {item.revision}</p>)}
      {children}
    </section>
    <section aria-label="Original evidence">
      <h3 className="font-label mb-2">Original evidence</h3>
      <p className="text-xs opacity-70 mb-2">Student responses remain visible after work is reopened. Parent reasons and notes appear separately above.</p>
      {report.subjects.map((subject) => <details key={subject.id} className="py-2 border-t border-current/10">
        <summary className="cursor-pointer break-words">{subject.title} · Original responses ({subject.evidence.length})</summary>
        {subject.evidence.length ? subject.evidence.map((item, index) => <Evidence key={item.id || index} item={item} timeZone={report.timeZone} />) : <p className="text-xs py-2 opacity-70">No written evidence recorded.</p>}
      </details>)}
      {report.blocks.filter((block) => !report.subjects.some((subject) => subject.id === block.subjectId && subject.evidence.length) && block.evidence.length).map((block) => <details key={block.id} className="py-2 border-t border-current/10">
        <summary className="cursor-pointer break-words">{block.title} · Original responses ({block.evidence.length})</summary>{block.evidence.map((item, index) => <Evidence key={item.id || index} item={item} timeZone={report.timeZone} />)}
      </details>)}
      {report.blocks.some((block) => block.evidenceIds.length) && <details className="py-2"><summary className="cursor-pointer">Evidence references</summary>{report.blocks.map((block) => block.evidenceIds.length ? <p key={block.id} className="text-xs break-all py-1">{block.title}: {block.evidenceIds.join(', ')}</p> : null)}</details>}
      {report.attachments.length > 0 && <p className="text-xs break-words">Evidence references: {report.attachments.map(reportEvidenceText).join('; ')}</p>}
    </section>
  </div>;
}
