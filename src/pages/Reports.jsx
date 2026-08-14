import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, FileText, Calendar, Archive, Trash2, Printer, ChevronDown, ChevronRight, Filter, RotateCcw } from 'lucide-react';
import useStudents from '../hooks/useStudents';
import useSubjects from '../hooks/useSubjects';
import useWeeklyActivity from '../hooks/useWeeklyActivity';
import useWeeklyPlansForWeek from '../hooks/useWeeklyPlansForWeek';
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
import {
  buildStudentWeeklySnapshot,
  buildWeeklyReportReadinessSummary,
  canSaveWeeklyReportSnapshot,
  escapeReportHtml,
} from '../utils/reportUtils';

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
  const escapedWeekRangeText = escapeReportHtml(weekRangeText);
  const escapedGeneratedDate = escapeReportHtml(generatedDate);

  const studentSections = students.map(student => {
    const data = studentDataMap[student.id];
    if (!data) return '';
    const pct = data.goalBlocks > 0 ? Math.round((data.totalBlocks / data.goalBlocks) * 100) : 0;
    const hours = Math.round(data.totalMinutes / 60 * 10) / 10;
    const studentInitial = escapeReportHtml(student.name?.charAt(0).toUpperCase() || '?');
    const studentName = escapeReportHtml(student.name);

    const subjectSections = data.subjectData.map(({ subject, blocks, completedCount, totalCount, totalMinutes: subMins }) => {
      const blockEntries = blocks.map(b => {
        const date = b.timestamp?.toDate?.() || new Date(b.timestamp);
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const duration = b.block_duration || 30;
        const blockNumber = escapeReportHtml((b.block_index ?? 0) + 1);
        const escapedDateStr = escapeReportHtml(dateStr);
        const escapedTimeStr = escapeReportHtml(timeStr);
        const escapedDuration = escapeReportHtml(duration);
        return `
          <div class="block-entry">
            <div class="block-entry-header">
              <span class="block-label">Block ${blockNumber}</span>
              <span class="block-meta">${escapedDateStr} at ${escapedTimeStr} &bull; ${escapedDuration} min</span>
            </div>
            ${b.summary_text ? `<p class="block-summary">${escapeReportHtml(b.summary_text)}</p>` : ''}
            ${b.manual_override ? `<p class="block-note">Parent-led session</p>` : ''}
          </div>`;
      }).join('');

      return `
        <div class="subject-section">
          <div class="subject-header">
            <span class="subject-dot" style="background:${escapeReportHtml(subject.color || '#cbb7fb')}"></span>
            <span class="subject-title">${escapeReportHtml(subject.title)}</span>
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
          <div class="student-initial">${studentInitial}</div>
          <div>
            <h2 class="student-name">${studentName}</h2>
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
  <title>Own Path — Weekly Report — ${escapedWeekRangeText}</title>
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
    <div class="report-logo">Own Path LMS</div>
    <div class="report-title">Weekly Progress Report</div>
    <div class="report-week">${escapedWeekRangeText}</div>
    <div class="report-generated">Generated ${escapedGeneratedDate}</div>
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
    <div className="overflow-hidden border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)]">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ backgroundColor: completedCount > 0 ? 'rgba(203,183,251,0.1)' : 'rgba(238,234,248,0.03)' }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        onClick={() => blocks.length > 0 && setOpen(o => !o)}
      >
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color || C.lavender }} />
        <span className="text-[14px] flex-1 min-w-0 truncate" style={{ color: 'rgba(250,249,255,0.92)', fontWeight: 540 }}>{subject.title}</span>
        <span className="text-[12px] flex-shrink-0" style={{ color: 'rgba(238,234,248,0.5)', fontWeight: 460 }}>
          {completedCount}/{totalCount} blocks
          {totalMinutes > 0 && <> &bull; {hours}h</>}
        </span>
        <div className="w-16 h-1.5 overflow-hidden flex-shrink-0 mx-2" style={{ backgroundColor: 'rgba(238,234,248,0.16)' }}>
          <div className="h-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: C.lavender }} />
        </div>
        {blocks.length > 0
          ? open
            ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(238,234,248,0.42)' }} />
            : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(238,234,248,0.42)' }} />
          : <div className="w-3.5" />}
      </button>

      {open && blocks.length > 0 && (
        <div className="divide-y divide-[rgba(238,234,248,0.1)]" style={{ borderTop: '1px solid rgba(238,234,248,0.12)' }}>
          {blocks.map((b, i) => {
            const date = b.timestamp?.toDate?.() || new Date(b.timestamp);
            const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={b.id || i} className="px-4 py-3 bg-[#202034]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-label" style={{ color: C.amethyst }}>
                    Block {(b.block_index ?? i) + 1}
                  </span>
                  {b.manual_override && (
                    <span className="text-[10px] px-1.5 py-0.5" style={{ backgroundColor: 'rgba(238,234,248,0.08)', color: 'rgba(238,234,248,0.58)', fontWeight: 700 }}>
                      Parent-led
                    </span>
                  )}
                  <span className="ml-auto text-[11px]" style={{ color: 'rgba(238,234,248,0.42)', fontWeight: 460 }}>
                    {dateStr} at {timeStr} &bull; {b.block_duration || 30} min
                  </span>
                </div>
                {b.summary_text
                  ? <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(238,234,248,0.68)', fontWeight: 460 }}>{b.summary_text}</p>
                  : <p className="text-[12px] italic" style={{ color: 'rgba(238,234,248,0.34)', fontWeight: 460 }}>No summary written</p>}
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
  // Derive selected week range
  const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset, weekConfig);
  const {
    weeklyPlansByStudentId,
    loading: weeklyPlansLoading,
  } = useWeeklyPlansForWeek({
    currentUser,
    students,
    weekStart,
    enabled: Boolean(currentUser),
  });
  const loading = studentsLoading || subjectsLoading || submissionsLoading || weeklyReportsLoading || weeklyPlansLoading;

  const studentDataMap = useMemo(() => (
    Object.fromEntries(students.map((student) => [
      student.id,
      buildStudentWeeklySnapshot({
        student,
        subjects,
        submissions,
        weekStart,
        weekEnd,
        weeklyPlan: weeklyPlansByStudentId[student.id] || null,
      }),
    ]))
  ), [students, subjects, submissions, weekStart, weekEnd, weeklyPlansByStudentId]);
  const weekHasReportableData = useMemo(
    () => Object.values(studentDataMap).some(canSaveWeeklyReportSnapshot),
    [studentDataMap]
  );
  const readinessByStudentId = useMemo(() => (
    Object.fromEntries(students.map((student) => [
      student.id,
      buildWeeklyReportReadinessSummary(studentDataMap[student.id]),
    ]))
  ), [studentDataMap, students]);
  const readinessTotals = useMemo(() => (
    Object.values(readinessByStudentId).reduce((totals, readiness) => ({
      checkedStudentCount: totals.checkedStudentCount + (readiness.checked ? 1 : 0),
      incompleteBlockCount: totals.incompleteBlockCount + readiness.incompleteBlockCount,
      missingRequiredDetailCount: totals.missingRequiredDetailCount + readiness.missingRequiredDetailCount,
    }), {
      checkedStudentCount: 0,
      incompleteBlockCount: 0,
      missingRequiredDetailCount: 0,
    })
  ), [readinessByStudentId]);
  const hasReadinessWarnings = readinessTotals.incompleteBlockCount > 0
    || readinessTotals.missingRequiredDetailCount > 0;

  // Save a non-destructive official record snapshot
  const handleSaveRecord = async () => {
    const readinessCopy = hasReadinessWarnings
      ? `\n\nReview note: ${readinessTotals.incompleteBlockCount} assigned block${readinessTotals.incompleteBlockCount === 1 ? '' : 's'} incomplete and ${readinessTotals.missingRequiredDetailCount} completed required-response block${readinessTotals.missingRequiredDetailCount === 1 ? '' : 's'} missing written detail.`
      : '';

    if (!window.confirm(`Save an official record snapshot for this week? This does not affect any student data.${readinessCopy}`)) return;

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
              <span class="subject-title">${escapeReportHtml(sd.subjectTitle)}</span>
              <span class="subject-stats">${escapeReportHtml(sd.totalBlocks)} blocks</span>
            </div>
            ${sd.summaries?.length > 0
              ? sd.summaries.map(s => `<div class="block-entry"><span class="block-label">Block ${escapeReportHtml(s.blockNumber || '?')}</span><p class="block-summary">${escapeReportHtml(s.text)}</p></div>`).join('')
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
  const reportTotals = useMemo(() => (
    Object.values(studentDataMap).reduce((totals, data) => {
      if (!data) return totals;

      return {
        completedBlocks: totals.completedBlocks + (data.totalBlocks || 0),
        goalBlocks: totals.goalBlocks + (data.goalBlocks || 0),
        hours: totals.hours + (data.totalMinutes || 0),
        subjects: totals.subjects + (data.subjectData?.length || 0),
      };
    }, {
      completedBlocks: 0,
      goalBlocks: 0,
      hours: 0,
      subjects: 0,
    })
  ), [studentDataMap]);

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
                <span class="subject-title">${escapeReportHtml(subjectDatum.subjectTitle)}</span>
                <span class="subject-stats">${escapeReportHtml(subjectDatum.totalBlocks)} blocks</span>
              </div>
              ${subjectDatum.summaries?.length > 0
                ? subjectDatum.summaries.map(summary => `<div class="block-entry"><span class="block-label">Block ${escapeReportHtml(summary.blockNumber || '?')}</span><p class="block-summary">${escapeReportHtml(summary.text)}</p></div>`).join('')
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
      <div className="op-page">
        <div className="op-proto-shell flex min-h-[360px] items-center justify-center">
          <div className="h-7 w-7 animate-spin border-2 border-transparent border-b-[#cbb7fb]" />
        </div>
      </div>
    );
  }

  const weekPickerOptions = getWeekPickerOptions(weekConfig);
  const weekRangeDisplay = formatWeekRange(weekStart, weekEnd);

  return (
    <div className="op-page">
      <div className="op-proto-shell op-report-shell">
        <div className="op-proto-topbar">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-label text-white">Reports</p>
            <p className="mt-1 truncate text-[10px] text-[rgba(238,234,248,0.42)]">
              {getWeekLabel(weekOffset)} · {weekRangeDisplay}
            </p>
          </div>
          <button
            onClick={() => printWeekReport(students, weekStart, weekEnd, studentDataMap)}
            disabled={!weekHasReportableData}
            className="op-proto-btn disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-3.5 h-3.5" />
            Print report
          </button>
          <button
            onClick={handleSaveRecord}
            disabled={savingRecord || !weekHasReportableData}
            className="op-proto-btn op-proto-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Archive className="w-3.5 h-3.5" />
            {savingRecord ? 'Saving...' : 'Save record'}
          </button>
        </div>

        <div className="op-report-toolbar">
          <div className="op-report-filter">
            <span>Week</span>
            <select
              value={weekOffset}
              onChange={e => setWeekOffset(parseInt(e.target.value))}
              className="op-report-select op-report-select-wide"
            >
              {weekPickerOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.displayText})
                </option>
              ))}
            </select>
          </div>
          <div className="op-report-filter">
            <span>School year</span>
            <select
              value={selectedSchoolYear}
              onChange={event => setSelectedSchoolYear(event.target.value)}
              className="op-report-select"
            >
              <option value="all">All school years</option>
              {schoolYearOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="op-report-filter">
            <span>Quarter</span>
            <select
              value={selectedQuarter}
              onChange={event => setSelectedQuarter(event.target.value)}
              className="op-report-select"
            >
              <option value="all">All quarters</option>
              <option value="1">Q1</option>
              <option value="2">Q2</option>
              <option value="3">Q3</option>
              <option value="4">Q4</option>
            </select>
          </div>
          <div className="op-report-filter op-report-filter-grow">
            <span>Student</span>
            <div className="op-report-chip-row">
              {students.map(student => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => toggleSelection(student.id, setSelectedStudentIds)}
                  className={`op-report-chip ${selectedStudentIds.includes(student.id) ? 'is-active' : ''}`}
                >
                  {student.name}
                </button>
              ))}
            </div>
          </div>
          <div className="op-report-filter op-report-filter-grow">
            <span>Subject</span>
            <div className="op-report-chip-row">
              {subjects.map(subject => (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => toggleSelection(subject.id, setSelectedSubjectIds)}
                  className={`op-report-chip ${selectedSubjectIds.includes(subject.id) ? 'is-active' : ''}`}
                >
                  {subject.title}
                </button>
              ))}
            </div>
          </div>
          <div className="op-report-toolbar-actions">
            <span className="op-report-status">
              <Calendar className="h-3 w-3" />
              <b>{filteredWeeklyReports.length}</b> records
            </span>
            <button
              onClick={handleResetFilters}
              className="op-proto-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={handlePrintFilteredRecords}
              disabled={filteredWeeklyReports.length === 0}
              className="op-proto-btn disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="w-3.5 h-3.5" />
              Print filtered
            </button>
          </div>
        </div>

        <div className="op-report-body">
          <div className="op-report-area">
            {readinessTotals.checkedStudentCount > 0 ? (
              <section className={`op-weekly-banner ${hasReadinessWarnings ? 'is-modified' : ''}`}>
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {hasReadinessWarnings
                    ? `${readinessTotals.incompleteBlockCount} incomplete and ${readinessTotals.missingRequiredDetailCount} missing required detail across published snapshots.`
                    : 'Published weekly-plan snapshots for this week have no readiness warnings.'}
                </span>
              </section>
            ) : null}

            <section className="op-report-summary-grid">
              <div className="op-report-summary-card accent">
                <div className="value">{reportTotals.completedBlocks}/{reportTotals.goalBlocks}</div>
                <div className="label">Blocks</div>
              </div>
              <div className="op-report-summary-card good">
                <div className="value">{Math.round((reportTotals.hours / 60) * 10) / 10}h</div>
                <div className="label">Logged time</div>
              </div>
              <div className="op-report-summary-card">
                <div className="value">{students.length}</div>
                <div className="label">Students</div>
              </div>
              <div className="op-report-summary-card">
                <div className="value">{reportTotals.subjects}</div>
                <div className="label">Subject rows</div>
              </div>
              <div className={`op-report-summary-card ${hasReadinessWarnings ? 'warn' : 'good'}`}>
                <div className="value">{hasReadinessWarnings ? 'Review' : 'Ready'}</div>
                <div className="label">Record state</div>
              </div>
            </section>

            <div className="op-report-content-wrap">
              <div className="op-report-list">
                {students.length === 0 ? (
                  <div className="op-proto-empty">
                    <FileText className="w-10 h-10 text-[#cbb7fb]" />
                    <p className="mt-4 text-[16px] font-label text-white">No students yet</p>
                    <p className="mt-2 text-[11px] text-[rgba(238,234,248,0.48)]">Add students from the dashboard to see reports here.</p>
                  </div>
                ) : students.map(student => {
                  const data = studentDataMap[student.id];
                  if (!data) return null;
                  const pct = data.goalBlocks > 0 ? Math.round((data.totalBlocks / data.goalBlocks) * 100) : 0;
                  const hours = Math.round(data.totalMinutes / 60 * 10) / 10;
                  const readiness = readinessByStudentId[student.id];
                  const studentNeedsReview = readiness?.needsReview;

                  return (
                    <section key={student.id} className="op-report-student-section">
                      <div className="op-report-student-head">
                        <div className="op-student-avatar">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="op-report-student-meta">
                          <p className="op-report-student-name">
                            {student.name}
                            {readiness?.checked ? (
                              <span className={`op-report-chip is-static ${studentNeedsReview ? 'is-warn' : 'is-good'}`}>
                                {studentNeedsReview ? 'Review' : 'Ready'}
                              </span>
                            ) : null}
                          </p>
                          <p className="op-report-student-sub">
                            {data.totalBlocks} of {data.goalBlocks} blocks · {hours}h · {pct}% progress
                          </p>
                        </div>
                        <div className="op-report-student-stats">
                          <div><strong>{data.totalBlocks}/{data.goalBlocks}</strong><span>blocks</span></div>
                          <div><strong>{hours}h</strong><span>hours</span></div>
                          <div><strong>{pct}%</strong><span>progress</span></div>
                        </div>
                      </div>
                      {readiness?.checked && studentNeedsReview ? (
                        <div className="op-weekly-banner is-modified mx-3 my-2">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>
                            {readiness.incompleteBlockCount} assigned block{readiness.incompleteBlockCount === 1 ? '' : 's'} incomplete
                            {readiness.missingRequiredDetailCount > 0
                              ? `; ${readiness.missingRequiredDetailCount} completed required-response block${readiness.missingRequiredDetailCount === 1 ? '' : 's'} missing written detail.`
                              : '.'}
                          </span>
                        </div>
                      ) : null}
                      <div className="op-report-section-body">
                        {data.subjectData.length === 0 ? (
                          <p className="px-4 py-4 text-[11px] italic text-[rgba(238,234,248,0.42)]">
                            No subjects assigned to this student.
                          </p>
                        ) : data.subjectData.map(sd => (
                          <SubjectRow key={sd.subject.id} subjectDatum={sd} />
                        ))}
                        {data.totalBlocks === 0 ? (
                          <p className="px-4 py-3 text-[11px] text-[rgba(238,234,248,0.38)]">
                            No blocks completed {weekOffset === 0 ? 'this week yet' : 'during this week'}.
                          </p>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="op-report-summary-panel">
            <div className="op-report-side-head">
              <span>Compliance</span>
              <button
                type="button"
                className="op-proto-icon-btn"
                onClick={() => setShowRecords((current) => !current)}
                title="Toggle official records"
              >
                {showRecords ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="op-report-side-body">
              <div className={`op-report-side-box ${hasReadinessWarnings ? 'warn' : 'good'}`}>
                <p className="text-[11px] font-label text-white">
                  {hasReadinessWarnings ? 'Review before filing' : 'Ready to file'}
                </p>
                <p className="mt-2 text-[10px] leading-4 text-[rgba(238,234,248,0.5)]">
                  Saving creates an official snapshot and does not change student data.
                </p>
              </div>
              <div className="op-report-panel-list">
                <div><strong>{readinessTotals.checkedStudentCount}</strong><span>checked students</span></div>
                <div><strong>{readinessTotals.incompleteBlockCount}</strong><span>incomplete blocks</span></div>
                <div><strong>{readinessTotals.missingRequiredDetailCount}</strong><span>missing detail</span></div>
                <div><strong>{filteredWeeklyReports.length}/{normalizedWeeklyReports.length}</strong><span>filtered records</span></div>
              </div>
              <div className="op-report-side-box">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-label text-white">Official records</p>
                  <Filter className="h-3.5 w-3.5 text-[rgba(238,234,248,0.42)]" />
                </div>
                <p className="mt-2 text-[10px] leading-4 text-[rgba(238,234,248,0.48)]">
                  {filteredWeeklyReports.length} official record{filteredWeeklyReports.length === 1 ? '' : 's'} match current filters.
                </p>
              </div>
              {showRecords ? (
                <div className="op-report-record-list">
                  {filteredWeeklyReports.length === 0 ? (
                    <p className="px-2 py-2 text-[10px] italic text-[rgba(238,234,248,0.38)]">
                      No official records match the current filters.
                    </p>
                  ) : filteredWeeklyReports.map(report => {
                    const ws = report.week_start?.toDate?.() || new Date(report.week_start);
                    const we = report.week_ending?.toDate?.() || new Date(report.week_ending);

                    return (
                      <div key={report.id} className="op-report-record-row">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-label text-white">{report.student_name}</p>
                          <p className="mt-1 truncate text-[9px] text-[rgba(238,234,248,0.42)]">
                            {formatWeekRange(ws, we)}
                          </p>
                          {report.school_quarter_label ? (
                            <p className="mt-1 truncate text-[9px] text-[#b8adff]">
                              {report.school_quarter_label}{report.school_year_label ? ` · ${report.school_year_label}` : ''}
                            </p>
                          ) : null}
                        </div>
                        <span className="text-[10px] text-[rgba(238,234,248,0.52)]">
                          {report.total_blocks}/{report.weekly_goal}
                        </span>
                        <button onClick={() => handlePrintRecord(report)} className="op-proto-icon-btn" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteRecord(report.id)} className="op-proto-icon-btn" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="op-report-side-actions">
              <button onClick={() => setShowRecords((current) => !current)} className="op-proto-btn">
                {showRecords ? 'Hide records' : 'Show records'}
              </button>
              <button
                onClick={handlePrintFilteredRecords}
                disabled={filteredWeeklyReports.length === 0}
                className="op-proto-btn disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Print filtered
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

// Shared print HTML builder used by handlePrintRecord
function buildPrintHtml(weekRangeText, generatedDate, studentRows, reportTitle = 'Weekly Progress Report') {
  const escapedWeekRangeText = escapeReportHtml(weekRangeText);
  const escapedGeneratedDate = escapeReportHtml(generatedDate);
  const escapedReportTitle = escapeReportHtml(reportTitle);
  const sections = studentRows.map(r => {
    const pct = Number(r.pct);
    const displayPct = Number.isFinite(pct) ? Math.round(pct) : 0;
    const progressPct = Math.min(Math.max(displayPct, 0), 100);
    const totalBlocks = escapeReportHtml(r.totalBlocks ?? 0);
    const goalBlocks = escapeReportHtml(r.goalBlocks ?? 0);
    const hours = escapeReportHtml(r.hours ?? 0);

    return `
    <div class="student-section">
      <div class="student-header">
        <div class="student-initial">${escapeReportHtml(r.initial || '?')}</div>
        <div><h2 class="student-name">${escapeReportHtml(r.name)}</h2><p class="student-sub">${totalBlocks} of ${goalBlocks} blocks completed</p></div>
        <div class="student-pct">${displayPct}%</div>
      </div>
      <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${progressPct}%"></div></div>
      <div class="metrics">
        <div class="metric"><div class="metric-value">${totalBlocks}</div><div class="metric-label">Blocks Completed</div></div>
        <div class="metric"><div class="metric-value">${goalBlocks}</div><div class="metric-label">Weekly Goal</div></div>
        <div class="metric"><div class="metric-value">${hours}h</div><div class="metric-label">Time Spent</div></div>
        <div class="metric"><div class="metric-value">${displayPct}%</div><div class="metric-label">Progress</div></div>
      </div>
      <div class="subjects">${r.subjectsHtml || ''}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Own Path — ${escapedWeekRangeText}</title><style>
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
    <div class="report-logo">Own Path LMS</div>
    <div class="report-title">${escapedReportTitle}</div>
    <div class="report-week">${escapedWeekRangeText}</div>
    <div class="report-generated">Generated ${escapedGeneratedDate}</div>
  </div>
  ${sections}
  </body></html>`;
}

export default Reports;
