import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Calendar, Archive, Trash2, Printer, ChevronDown, ChevronRight, Filter, RotateCcw } from 'lucide-react';
import useStudents from '../hooks/useStudents';
import useSubjects from '../hooks/useSubjects';
import useWeeklyActivity from '../hooks/useWeeklyActivity';
import useWeeklyReportRecords from '../hooks/useWeeklyReportRecords';
import {
  getWeekRangeByOffset,
  formatWeekRange,
  getWeekLabel,
  getWeekPickerOptions,
  getWeekConfig,
} from '../utils/weekUtils';
import {
  getSchoolYearLabel,
  getSchoolYearMetadataForDate,
  getSchoolYearOptionsFromReports,
} from '../utils/schoolSettingsUtils';
import { buildStudentWeeklySnapshot } from '../utils/reportUtils';

const C = {
  mysteria: '#1b1938',
  lavender: '#cbb7fb',
  charcoal: '#292827',
  amethyst: '#714cb6',
  cream: '#e9e5dd',
  parchment: '#dcd7d3',
  lavenderTint: '#f0eaff',
};

// ---------------------------------------------------------------------------
// Print template — called with computed week data, opens browser print dialog
// ---------------------------------------------------------------------------
const printWeekReport = (students, weekStart, weekEnd, studentDataMap) => {
  const weekRangeText = formatWeekRange(weekStart, weekEnd);
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const studentSections = students.map(student => {
    const data = studentDataMap[student.id];
    if (!data) return '';
    const pct = data.goalBlocks > 0 ? Math.round((data.totalBlocks / data.goalBlocks) * 100) : 0;
    const hours = Math.round(data.totalMinutes / 60 * 10) / 10;

    const subjectSections = data.subjectData.map(({ subject, blocks, completedCount, totalCount, totalMinutes: subMins }) => {
      const blockEntries = blocks.map(b => {
        const date = b.timestamp?.toDate?.() || new Date(b.timestamp);
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const duration = b.block_duration || 30;
        return `
          <div class="block-entry">
            <div class="block-entry-header">
              <span class="block-label">Block ${(b.block_index ?? 0) + 1}</span>
              <span class="block-meta">${dateStr} at ${timeStr} &bull; ${duration} min</span>
            </div>
            ${b.summary_text ? `<p class="block-summary">${b.summary_text}</p>` : ''}
            ${b.manual_override ? `<p class="block-note">Parent-led session</p>` : ''}
          </div>`;
      }).join('');

      return `
        <div class="subject-section">
          <div class="subject-header">
            <span class="subject-dot" style="background:${subject.color || '#cbb7fb'}"></span>
            <span class="subject-title">${subject.title}</span>
            <span class="subject-stats">${completedCount}/${totalCount} blocks &bull; ${Math.round(subMins / 60 * 10) / 10}h</span>
          </div>
          ${completedCount === 0
            ? '<p class="no-entries">No blocks completed this week</p>'
            : blockEntries}
        </div>`;
    }).join('');

    return `
      <div class="student-section">
        <div class="student-header">
          <div class="student-initial">${student.name.charAt(0).toUpperCase()}</div>
          <div>
            <h2 class="student-name">${student.name}</h2>
            <p class="student-sub">${data.totalBlocks} of ${data.goalBlocks} blocks completed</p>
          </div>
          <div class="student-pct">${pct}%</div>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${Math.min(pct, 100)}%"></div>
        </div>
        <div class="metrics">
          <div class="metric"><div class="metric-value">${data.totalBlocks}</div><div class="metric-label">Blocks Completed</div></div>
          <div class="metric"><div class="metric-value">${data.goalBlocks}</div><div class="metric-label">Weekly Goal</div></div>
          <div class="metric"><div class="metric-value">${hours}h</div><div class="metric-label">Time Spent</div></div>
          <div class="metric"><div class="metric-value">${pct}%</div><div class="metric-label">Progress</div></div>
        </div>
        <div class="subjects">${subjectSections}</div>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GridWorkz — Weekly Report — ${weekRangeText}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #292827; background: #fff; padding: 48px; font-size: 13px; line-height: 1.6; }
    .report-header { text-align: center; margin-bottom: 48px; padding-bottom: 24px; border-bottom: 2px solid #292827; }
    .report-logo { font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #714cb6; margin-bottom: 8px; }
    .report-title { font-size: 26px; font-weight: bold; color: #292827; margin-bottom: 6px; }
    .report-week { font-size: 15px; color: #714cb6; margin-bottom: 4px; }
    .report-generated { font-size: 11px; color: #9a9591; }
    .student-section { margin-bottom: 48px; padding-bottom: 40px; border-bottom: 1px solid #dcd7d3; }
    .student-section:last-child { border-bottom: none; margin-bottom: 0; }
    .student-header { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
    .student-initial { width: 44px; height: 44px; border-radius: 50%; background: #f0eaff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: #714cb6; flex-shrink: 0; font-family: Arial, sans-serif; }
    .student-name { font-size: 20px; font-weight: bold; color: #292827; font-family: Arial, sans-serif; }
    .student-sub { font-size: 12px; color: #9a9591; font-family: Arial, sans-serif; }
    .student-pct { margin-left: auto; font-size: 28px; font-weight: bold; color: #714cb6; font-family: Arial, sans-serif; }
    .progress-bar-wrap { height: 6px; background: #dcd7d3; border-radius: 3px; margin-bottom: 20px; overflow: hidden; }
    .progress-bar-fill { height: 100%; background: #cbb7fb; border-radius: 3px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .metric { background: #f8f6ff; border: 1px solid #e4dcff; border-radius: 8px; padding: 14px; text-align: center; }
    .metric-value { font-size: 22px; font-weight: bold; color: #714cb6; font-family: Arial, sans-serif; }
    .metric-label { font-size: 11px; color: #9a9591; margin-top: 3px; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; }
    .subjects { }
    .subject-section { margin-bottom: 20px; }
    .subject-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e9e5dd; font-family: Arial, sans-serif; }
    .subject-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .subject-title { font-size: 14px; font-weight: bold; color: #292827; }
    .subject-stats { margin-left: auto; font-size: 11px; color: #9a9591; }
    .block-entry { margin-bottom: 8px; padding: 10px 14px; background: #faf9f8; border-left: 3px solid #cbb7fb; border-radius: 0 6px 6px 0; }
    .block-entry-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; font-family: Arial, sans-serif; }
    .block-label { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #714cb6; }
    .block-meta { font-size: 11px; color: #9a9591; }
    .block-summary { font-size: 13px; color: #504e4d; line-height: 1.5; }
    .block-note { font-size: 11px; color: #9a9591; font-style: italic; }
    .no-entries { font-size: 12px; color: #b0aba7; font-style: italic; padding: 4px 0; }
    @media print {
      body { padding: 24px; }
      .student-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="report-logo">GridWorkz LMS</div>
    <div class="report-title">Weekly Progress Report</div>
    <div class="report-week">${weekRangeText}</div>
    <div class="report-generated">Generated ${generatedDate}</div>
  </div>
  ${studentSections}
</body>
</html>`;

  const pw = window.open('', '_blank');
  if (pw) {
    pw.document.write(html);
    pw.document.close();
    setTimeout(() => pw.print(), 400);
  }
};

// ---------------------------------------------------------------------------
// Subject row — collapsible block entries
// ---------------------------------------------------------------------------
const SubjectRow = ({ subjectDatum }) => {
  const { subject, blocks, completedCount, totalCount, totalMinutes } = subjectDatum;
  const [open, setOpen] = useState(false);
  const hours = Math.round(totalMinutes / 60 * 10) / 10;
  const pct = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.parchment}` }}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ backgroundColor: completedCount > 0 ? `${C.lavenderTint}` : '#faf9f8' }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        onClick={() => blocks.length > 0 && setOpen(o => !o)}
      >
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color || C.lavender }} />
        <span className="text-[14px] flex-1 min-w-0 truncate" style={{ color: C.charcoal, fontWeight: 540 }}>{subject.title}</span>
        <span className="text-[12px] flex-shrink-0" style={{ color: 'rgba(41,40,39,0.45)', fontWeight: 460 }}>
          {completedCount}/{totalCount} blocks
          {totalMinutes > 0 && <> &bull; {hours}h</>}
        </span>
        <div className="w-16 rounded-full h-1.5 overflow-hidden flex-shrink-0 mx-2" style={{ backgroundColor: C.parchment }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: C.lavender }} />
        </div>
        {blocks.length > 0
          ? open
            ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(41,40,39,0.3)' }} />
            : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(41,40,39,0.3)' }} />
          : <div className="w-3.5" />}
      </button>

      {open && blocks.length > 0 && (
        <div className="divide-y" style={{ borderTop: `1px solid ${C.parchment}` }}>
          {blocks.map((b, i) => {
            const date = b.timestamp?.toDate?.() || new Date(b.timestamp);
            const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={b.id || i} className="px-4 py-3 bg-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-label" style={{ color: C.amethyst }}>
                    Block {(b.block_index ?? i) + 1}
                  </span>
                  {b.manual_override && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: C.cream, color: 'rgba(41,40,39,0.5)', fontWeight: 700 }}>
                      Parent-led
                    </span>
                  )}
                  <span className="ml-auto text-[11px]" style={{ color: 'rgba(41,40,39,0.35)', fontWeight: 460 }}>
                    {dateStr} at {timeStr} &bull; {b.block_duration || 30} min
                  </span>
                </div>
                {b.summary_text
                  ? <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(41,40,39,0.65)', fontWeight: 460 }}>{b.summary_text}</p>
                  : <p className="text-[12px] italic" style={{ color: 'rgba(41,40,39,0.3)', fontWeight: 460 }}>No summary written</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const Reports = ({ parentSettings = {} }) => {
  const { currentUser } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showRecords, setShowRecords] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('all');
  const [selectedQuarter, setSelectedQuarter] = useState('all');
  const weekConfig = useMemo(() => getWeekConfig(parentSettings), [
    parentSettings.week_reset_day,
    parentSettings.week_reset_hour,
    parentSettings.week_reset_minute,
  ]);
  const { students, loading: studentsLoading } = useStudents({
    parentId: currentUser?.uid,
    enabled: Boolean(currentUser),
    sortField: 'name',
    sortDirection: 'asc',
  });
  const { subjects, loading: subjectsLoading } = useSubjects({
    parentId: currentUser?.uid,
    enabled: Boolean(currentUser),
    activeOnly: true,
    sortField: 'title',
    sortDirection: 'asc',
  });
  const {
    submissions,
    loading: submissionsLoading,
  } = useWeeklyActivity({
    currentUser,
    parentId: currentUser?.uid,
    enabled: Boolean(currentUser),
    students,
    subjects,
    weekConfig,
  });
  const {
    deleteWeeklyReportRecord,
    loading: weeklyReportsLoading,
    saveWeeklyRecordSnapshot,
    savingRecord,
    weeklyReports,
  } = useWeeklyReportRecords({
    currentUser,
    parentSettings,
    students,
    subjects,
    enabled: Boolean(currentUser),
  });
  const loading = studentsLoading || subjectsLoading || submissionsLoading || weeklyReportsLoading;

  // Derive selected week range
  const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset, weekConfig);

  const studentDataMap = Object.fromEntries(students.map(student => [
    student.id,
    buildStudentWeeklySnapshot({ student, subjects, submissions, weekStart, weekEnd }),
  ]));
  const weekHasData = Object.values(studentDataMap).some(d => d.totalBlocks > 0);

  // Save a non-destructive official record snapshot
  const handleSaveRecord = async () => {
    if (!window.confirm('Save an official record snapshot for this week? This does not affect any student data.')) return;

    const saved = await saveWeeklyRecordSnapshot({
      submissions,
      weekStart,
      weekEnd,
      source: 'manual',
    });

    if (saved) {
      setShowRecords(true);
      alert('Official record saved.');
    } else {
      alert('Failed to save record. Please try again.');
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Permanently delete this official record?')) return;

    const deleted = await deleteWeeklyReportRecord(id);
    if (!deleted) {
      alert('Failed to delete record.');
    }
  };

  // Print saved weeklyReport doc (legacy / official records section)
  const handlePrintRecord = (report) => {
    const ws = report.week_start?.toDate?.() || new Date(report.week_start);
    const we = report.week_ending?.toDate?.() || new Date(report.week_ending);
    const weekRangeText = formatWeekRange(ws, we);
    const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const subjectsHtml = report.subjects_data
      ? Object.values(report.subjects_data).map(sd => `
          <div class="subject-section">
            <div class="subject-header">
              <span class="subject-title">${sd.subjectTitle}</span>
              <span class="subject-stats">${sd.totalBlocks} blocks</span>
            </div>
            ${sd.summaries?.length > 0
              ? sd.summaries.map(s => `<div class="block-entry"><span class="block-label">Block ${s.blockNumber || '?'}</span><p class="block-summary">${s.text}</p></div>`).join('')
              : '<p class="no-entries">No summaries recorded</p>'}
          </div>`).join('')
      : '';

    const pct = report.weekly_goal > 0 ? Math.round((report.total_blocks / report.weekly_goal) * 100) : 0;
    const html = buildPrintHtml(weekRangeText, generatedDate, [{
      name: report.student_name,
      initial: report.student_name?.charAt(0) || '?',
      totalBlocks: report.total_blocks,
      goalBlocks: report.weekly_goal,
      hours: report.total_hours || 0,
      pct,
      subjectsHtml,
    }]);

    const pw = window.open('', '_blank');
    if (pw) { pw.document.write(html); pw.document.close(); setTimeout(() => pw.print(), 400); }
  };

  const toggleSelection = (value, setSelectedValues) => {
    setSelectedValues(current => (
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value]
    ));
  };

  const normalizedWeeklyReports = useMemo(() => (
    weeklyReports.map(report => {
      if (report.school_year_label && report.school_quarter_label) return report;
      const weekDate = report.week_end?.toDate?.() || report.week_ending?.toDate?.() || new Date(report.week_end || report.week_ending);
      const schoolYear = getSchoolYearMetadataForDate(weekDate, parentSettings);
      return {
        ...report,
        school_year_label: report.school_year_label || schoolYear?.schoolYearLabel || '',
        school_quarter: report.school_quarter ?? schoolYear?.quarter?.index ?? null,
        school_quarter_label: report.school_quarter_label || schoolYear?.quarter?.label || '',
      };
    })
  ), [weeklyReports, parentSettings]);

  const schoolYearOptions = useMemo(() => {
    const options = getSchoolYearOptionsFromReports(normalizedWeeklyReports);
    if (parentSettings.school_year_start && parentSettings.school_year_end) {
      const currentLabel = getSchoolYearLabel(
        new Date(`${parentSettings.school_year_start}T00:00:00`),
        new Date(`${parentSettings.school_year_end}T00:00:00`)
      );
      if (!options.includes(currentLabel)) options.unshift(currentLabel);
    }
    return options;
  }, [normalizedWeeklyReports, parentSettings.school_year_end, parentSettings.school_year_start]);

  const filteredWeeklyReports = useMemo(() => (
    normalizedWeeklyReports.filter(report => {
      if (selectedStudentIds.length > 0 && !selectedStudentIds.includes(report.student_id)) return false;
      if (selectedSubjectIds.length > 0) {
        const reportSubjectIds = report.subject_ids || Object.keys(report.subjects_data || {});
        if (!selectedSubjectIds.some(subjectId => reportSubjectIds.includes(subjectId))) return false;
      }
      if (selectedSchoolYear !== 'all' && report.school_year_label !== selectedSchoolYear) return false;
      if (selectedQuarter !== 'all' && Number(report.school_quarter) !== Number(selectedQuarter)) return false;
      return true;
    })
  ), [normalizedWeeklyReports, selectedQuarter, selectedSchoolYear, selectedStudentIds, selectedSubjectIds]);

  const handleResetFilters = () => {
    setSelectedStudentIds([]);
    setSelectedSubjectIds([]);
    setSelectedSchoolYear('all');
    setSelectedQuarter('all');
  };

  const handlePrintFilteredRecords = () => {
    if (filteredWeeklyReports.length === 0) return;
    const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const activeFilters = [
      selectedStudentIds.length > 0 ? `${selectedStudentIds.length} student${selectedStudentIds.length === 1 ? '' : 's'}` : null,
      selectedSubjectIds.length > 0 ? `${selectedSubjectIds.length} subject${selectedSubjectIds.length === 1 ? '' : 's'}` : null,
      selectedSchoolYear !== 'all' ? selectedSchoolYear : null,
      selectedQuarter !== 'all' ? `Q${selectedQuarter}` : null,
    ].filter(Boolean).join(' • ') || 'All official records';

    const studentRows = filteredWeeklyReports.map(report => {
      const pct = report.weekly_goal > 0 ? Math.round((report.total_blocks / report.weekly_goal) * 100) : 0;
      const subjectsHtml = report.subjects_data
        ? Object.values(report.subjects_data)
          .filter(subjectDatum => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(subjectDatum.subjectId))
          .map(subjectDatum => `
            <div class="subject-section">
              <div class="subject-header">
                <span class="subject-title">${subjectDatum.subjectTitle}</span>
                <span class="subject-stats">${subjectDatum.totalBlocks} blocks</span>
              </div>
              ${subjectDatum.summaries?.length > 0
                ? subjectDatum.summaries.map(summary => `<div class="block-entry"><span class="block-label">Block ${summary.blockNumber || '?'}</span><p class="block-summary">${summary.text}</p></div>`).join('')
                : '<p class="no-entries">No summaries recorded</p>'}
            </div>`).join('')
        : '';

      return {
        name: `${report.student_name} ${report.school_quarter_label ? `(${report.school_quarter_label})` : ''}`.trim(),
        initial: report.student_name?.charAt(0) || '?',
        totalBlocks: report.total_blocks,
        goalBlocks: report.weekly_goal,
        hours: report.total_hours || 0,
        pct,
        subjectsHtml,
      };
    });

    const html = buildPrintHtml(activeFilters, generatedDate, studentRows, 'Custom Report');
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 400);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2" style={{ borderColor: C.lavender }} />
      </div>
    );
  }

  const weekPickerOptions = getWeekPickerOptions(weekConfig);
  const weekRangeDisplay = formatWeekRange(weekStart, weekEnd);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-[26px] font-display text-charcoal-ink" style={{ lineHeight: 1.1, letterSpacing: '-0.5px' }}>Reports</h2>
          <p className="text-[14px] text-charcoal-ink/50 font-body mt-1">Live view of student activity by week</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Week picker */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: 'rgba(41,40,39,0.4)' }} />
            <select
              value={weekOffset}
              onChange={e => setWeekOffset(parseInt(e.target.value))}
              className="px-3 py-2 rounded-lg text-[13px] focus:outline-none"
              style={{ border: `1px solid ${C.parchment}`, backgroundColor: '#fff', color: C.charcoal, fontWeight: 460 }}
            >
              {weekPickerOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.displayText})
                </option>
              ))}
            </select>
          </div>

          {/* Print live week */}
          <button
            onClick={() => printWeekReport(students, weekStart, weekEnd, studentDataMap)}
            disabled={!weekHasData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-label text-[14px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: C.cream, color: C.charcoal }}
            onMouseEnter={e => { if (weekHasData) e.currentTarget.style.backgroundColor = C.parchment; }}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>

          {/* Save official record */}
          <button
            onClick={handleSaveRecord}
            disabled={savingRecord || !weekHasData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-label text-[14px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: C.charcoal, color: '#ffffff' }}
            onMouseEnter={e => { if (!savingRecord && weekHasData) e.currentTarget.style.backgroundColor = '#3a3937'; }}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}
          >
            <Archive className="w-4 h-4" />
            {savingRecord ? 'Saving…' : 'Save Record'}
          </button>
        </div>
      </div>

      {/* Week label */}
      <p className="text-[12px] uppercase tracking-wider mb-6" style={{ color: C.amethyst, fontWeight: 700 }}>
        {getWeekLabel(weekOffset)} — {weekRangeDisplay}
      </p>

      <div className="mb-8 bg-white rounded-2xl p-6" style={{ border: `1px solid ${C.parchment}` }}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Filter className="w-4 h-4" style={{ color: C.amethyst }} />
              <h3 className="text-[17px] font-display text-charcoal-ink">Custom Report Builder</h3>
            </div>
            <p className="text-[13px] font-body text-charcoal-ink/45">
              Filter official records by student, subject, school year, quarter, or any combination.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors"
              style={{ backgroundColor: C.cream, color: C.charcoal, fontWeight: 700 }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={handlePrintFilteredRecords}
              disabled={filteredWeeklyReports.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: C.charcoal, color: '#fff', fontWeight: 700 }}
            >
              <Printer className="w-4 h-4" />
              Print Filtered
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl p-4" style={{ backgroundColor: `${C.lavenderTint}65` }}>
            <p className="text-[11px] uppercase tracking-wider font-label mb-3" style={{ color: C.amethyst }}>Students</p>
            <div className="flex flex-wrap gap-2">
              {students.map(student => (
                <button
                  key={student.id}
                  onClick={() => toggleSelection(student.id, setSelectedStudentIds)}
                  className="px-3 py-1.5 rounded-full text-[12px] transition-colors"
                  style={{
                    backgroundColor: selectedStudentIds.includes(student.id) ? C.charcoal : '#fff',
                    color: selectedStudentIds.includes(student.id) ? '#fff' : C.charcoal,
                    border: `1px solid ${selectedStudentIds.includes(student.id) ? C.charcoal : C.parchment}`,
                    fontWeight: 700,
                  }}
                >
                  {student.name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: `${C.lavenderTint}65` }}>
            <p className="text-[11px] uppercase tracking-wider font-label mb-3" style={{ color: C.amethyst }}>Subjects</p>
            <div className="flex flex-wrap gap-2">
              {subjects.map(subject => (
                <button
                  key={subject.id}
                  onClick={() => toggleSelection(subject.id, setSelectedSubjectIds)}
                  className="px-3 py-1.5 rounded-full text-[12px] transition-colors"
                  style={{
                    backgroundColor: selectedSubjectIds.includes(subject.id) ? C.charcoal : '#fff',
                    color: selectedSubjectIds.includes(subject.id) ? '#fff' : C.charcoal,
                    border: `1px solid ${selectedSubjectIds.includes(subject.id) ? C.charcoal : C.parchment}`,
                    fontWeight: 700,
                  }}
                >
                  {subject.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5" style={{ color: 'rgba(41,40,39,0.4)' }}>School Year</label>
            <select
              value={selectedSchoolYear}
              onChange={event => setSelectedSchoolYear(event.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] focus:outline-none"
              style={{ border: `1px solid ${C.parchment}`, backgroundColor: '#fff', color: C.charcoal, fontWeight: 460 }}
            >
              <option value="all">All school years</option>
              {schoolYearOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5" style={{ color: 'rgba(41,40,39,0.4)' }}>Quarter</label>
            <select
              value={selectedQuarter}
              onChange={event => setSelectedQuarter(event.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] focus:outline-none"
              style={{ border: `1px solid ${C.parchment}`, backgroundColor: '#fff', color: C.charcoal, fontWeight: 460 }}
            >
              <option value="all">All quarters</option>
              <option value="1">Q1</option>
              <option value="2">Q2</option>
              <option value="3">Q3</option>
              <option value="4">Q4</option>
            </select>
          </div>
        </div>

        <p className="text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.5)' }}>
          {filteredWeeklyReports.length} official record{filteredWeeklyReports.length === 1 ? '' : 's'} match the current filters.
        </p>
      </div>

      {/* Per-student live report cards */}
      {students.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-charcoal-ink/20 mx-auto mb-4" />
          <p className="text-[15px] font-display text-charcoal-ink mb-1">No students yet</p>
          <p className="text-[13px] text-charcoal-ink/40 font-body">Add students from the dashboard to see their reports here.</p>
        </div>
      ) : (
        <div className="space-y-6 mb-10">
          {students.map(student => {
            const data = studentDataMap[student.id];
            if (!data) return null;
            const pct = data.goalBlocks > 0 ? Math.round((data.totalBlocks / data.goalBlocks) * 100) : 0;
            const hours = Math.round(data.totalMinutes / 60 * 10) / 10;

            return (
              <div key={student.id} className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${C.parchment}` }}>
                {/* Student header */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: C.lavenderTint }}>
                    <span className="text-[17px] font-display" style={{ color: C.amethyst }}>
                      {student.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[17px] font-display text-charcoal-ink" style={{ lineHeight: 1.2 }}>{student.name}</h3>
                    <p className="text-[13px] font-body mt-0.5" style={{ color: 'rgba(41,40,39,0.45)' }}>
                      {data.totalBlocks} of {data.goalBlocks} blocks completed this week
                    </p>
                  </div>
                  {/* Metrics pills */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {[
                      { label: 'Blocks', value: `${data.totalBlocks}/${data.goalBlocks}` },
                      { label: 'Hours', value: `${hours}h` },
                      { label: 'Progress', value: `${pct}%` },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center rounded-lg px-4 py-2.5" style={{ backgroundColor: `${C.lavenderTint}80` }}>
                        <div className="text-[16px] font-display text-amethyst-link">{value}</div>
                        <div className="text-[11px] text-charcoal-ink/40 font-body">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full rounded-full h-1.5 mb-5 overflow-hidden" style={{ backgroundColor: C.parchment }}>
                  <div className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: C.lavender }} />
                </div>

                {/* Subject rows */}
                {data.subjectData.length === 0 ? (
                  <p className="text-[13px] text-charcoal-ink/30 italic font-body text-center py-4">
                    No subjects assigned to this student.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] font-label uppercase tracking-wider mb-2" style={{ color: 'rgba(41,40,39,0.4)' }}>
                      Subjects — click to expand block details
                    </p>
                    {data.subjectData.map(sd => (
                      <SubjectRow key={sd.subject.id} subjectDatum={sd} />
                    ))}
                  </div>
                )}

                {data.totalBlocks === 0 && (
                  <p className="text-center text-[13px] font-body mt-4" style={{ color: 'rgba(41,40,39,0.3)' }}>
                    No blocks completed {weekOffset === 0 ? 'this week yet' : 'during this week'}.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Official Records section */}
      <div>
        <button
          className="flex items-center gap-2 mb-4"
          onClick={() => setShowRecords(r => !r)}
        >
          {showRecords
            ? <ChevronDown className="w-4 h-4" style={{ color: 'rgba(41,40,39,0.4)' }} />
            : <ChevronRight className="w-4 h-4" style={{ color: 'rgba(41,40,39,0.4)' }} />}
          <span className="text-[12px] uppercase tracking-wider font-label" style={{ color: 'rgba(41,40,39,0.5)' }}>
            Official Records ({filteredWeeklyReports.length}/{normalizedWeeklyReports.length})
          </span>
        </button>

        {showRecords && (
          filteredWeeklyReports.length === 0 ? (
            <p className="text-[13px] text-charcoal-ink/30 italic font-body pl-6">
              No official records match the current filters.
            </p>
          ) : (
            <div className="space-y-2 pl-6">
              {filteredWeeklyReports.map(report => {
                const ws = report.week_start?.toDate?.() || new Date(report.week_start);
                const we = report.week_ending?.toDate?.() || new Date(report.week_ending);
                return (
                  <div key={report.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white"
                    style={{ border: `1px solid ${C.parchment}` }}>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: C.lavender }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[14px] font-display text-charcoal-ink">{report.student_name}</span>
                      <span className="text-[12px] font-body ml-2" style={{ color: 'rgba(41,40,39,0.4)' }}>
                        {formatWeekRange(ws, we)}
                      </span>
                      {report.school_quarter_label && (
                        <span className="text-[11px] font-body ml-2" style={{ color: C.amethyst }}>
                          {report.school_quarter_label}{report.school_year_label ? ` • ${report.school_year_label}` : ''}
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] font-body" style={{ color: 'rgba(41,40,39,0.4)' }}>
                      {report.total_blocks}/{report.weekly_goal} blocks
                    </span>
                    <button onClick={() => handlePrintRecord(report)}
                      className="p-1.5 transition-colors" style={{ color: 'rgba(41,40,39,0.3)' }}
                      onMouseEnter={e => e.currentTarget.style.color = C.amethyst}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(41,40,39,0.3)'}
                      title="Print">
                      <Printer className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteRecord(report.id)}
                      className="p-1.5 transition-colors" style={{ color: 'rgba(41,40,39,0.3)' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(41,40,39,0.3)'}
                      title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
};

// Shared print HTML builder used by handlePrintRecord
function buildPrintHtml(weekRangeText, generatedDate, studentRows, reportTitle = 'Weekly Progress Report') {
  const sections = studentRows.map(r => `
    <div class="student-section">
      <div class="student-header">
        <div class="student-initial">${r.initial}</div>
        <div><h2 class="student-name">${r.name}</h2><p class="student-sub">${r.totalBlocks} of ${r.goalBlocks} blocks completed</p></div>
        <div class="student-pct">${r.pct}%</div>
      </div>
      <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${Math.min(r.pct, 100)}%"></div></div>
      <div class="metrics">
        <div class="metric"><div class="metric-value">${r.totalBlocks}</div><div class="metric-label">Blocks Completed</div></div>
        <div class="metric"><div class="metric-value">${r.goalBlocks}</div><div class="metric-label">Weekly Goal</div></div>
        <div class="metric"><div class="metric-value">${r.hours}h</div><div class="metric-label">Time Spent</div></div>
        <div class="metric"><div class="metric-value">${r.pct}%</div><div class="metric-label">Progress</div></div>
      </div>
      <div class="subjects">${r.subjectsHtml}</div>
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>GridWorkz — ${weekRangeText}</title><style>
    *{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,'Times New Roman',serif;color:#292827;background:#fff;padding:48px;font-size:13px;line-height:1.6}
    .report-header{text-align:center;margin-bottom:48px;padding-bottom:24px;border-bottom:2px solid #292827}
    .report-logo{font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#714cb6;margin-bottom:8px}
    .report-title{font-size:26px;font-weight:bold;color:#292827;margin-bottom:6px}
    .report-week{font-size:15px;color:#714cb6;margin-bottom:4px}
    .report-generated{font-size:11px;color:#9a9591}
    .student-section{margin-bottom:48px;padding-bottom:40px;border-bottom:1px solid #dcd7d3}
    .student-section:last-child{border-bottom:none;margin-bottom:0}
    .student-header{display:flex;align-items:center;gap:14px;margin-bottom:12px}
    .student-initial{width:44px;height:44px;border-radius:50%;background:#f0eaff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:bold;color:#714cb6;flex-shrink:0;font-family:Arial,sans-serif}
    .student-name{font-size:20px;font-weight:bold;color:#292827;font-family:Arial,sans-serif}
    .student-sub{font-size:12px;color:#9a9591;font-family:Arial,sans-serif}
    .student-pct{margin-left:auto;font-size:28px;font-weight:bold;color:#714cb6;font-family:Arial,sans-serif}
    .progress-bar-wrap{height:6px;background:#dcd7d3;border-radius:3px;margin-bottom:20px;overflow:hidden}
    .progress-bar-fill{height:100%;background:#cbb7fb;border-radius:3px}
    .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}
    .metric{background:#f8f6ff;border:1px solid #e4dcff;border-radius:8px;padding:14px;text-align:center}
    .metric-value{font-size:22px;font-weight:bold;color:#714cb6;font-family:Arial,sans-serif}
    .metric-label{font-size:11px;color:#9a9591;margin-top:3px;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px}
    .subject-section{margin-bottom:20px}
    .subject-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e9e5dd;font-family:Arial,sans-serif}
    .subject-title{font-size:14px;font-weight:bold;color:#292827}
    .subject-stats{margin-left:auto;font-size:11px;color:#9a9591}
    .block-entry{margin-bottom:8px;padding:10px 14px;background:#faf9f8;border-left:3px solid #cbb7fb;border-radius:0 6px 6px 0}
    .block-label{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:#714cb6;margin-right:8px;font-family:Arial,sans-serif}
    .block-summary{font-size:13px;color:#504e4d;line-height:1.5;margin-top:4px}
    .no-entries{font-size:12px;color:#b0aba7;font-style:italic;padding:4px 0}
    @media print{body{padding:24px}.student-section{page-break-inside:avoid}}
  </style></head><body>
  <div class="report-header">
    <div class="report-logo">GridWorkz LMS</div>
    <div class="report-title">${reportTitle}</div>
    <div class="report-week">${weekRangeText}</div>
    <div class="report-generated">Generated ${generatedDate}</div>
  </div>
  ${sections}
  </body></html>`;
}

export default Reports;
