import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Calendar, Archive, Trash2, Printer, RotateCcw } from 'lucide-react';
import useStudents from '../hooks/useStudents';
import useSubjects from '../hooks/useSubjects';
import useWeeklyActivity from '../hooks/useWeeklyActivity';
import SchoolBlockDetails from '../components/school/SchoolBlockDetails';
import SavedSchoolReportDetails from '../components/school/SavedSchoolReportDetails';
import ReportSnapshotDetails from '../components/school/ReportSnapshotDetails';
import { buildLiveReportPresentation, buildSavedReportPresentation, formatReportDate, openReportPrintWindow } from '../utils/reportPresentation';
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
} from '../utils/reportUtils';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const Reports = ({ parentSettings = {} }) => {
  const { currentUser } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showRecords, setShowRecords] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordVersions, setRecordVersions] = useState({});
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('all');
  const [selectedQuarter, setSelectedQuarter] = useState('all');
  const weekConfig = useMemo(() => getWeekConfig(parentSettings), [
    parentSettings.week_reset_day,
    parentSettings.week_reset_hour,
    parentSettings.week_reset_minute,
    parentSettings.timezone,
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
    schoolWeeksByStudentId,
    reloadSchoolState,
    error: schoolError,
    loading: submissionsLoading,
  } = useWeeklyActivity({
    currentUser,
    parentId: currentUser?.uid,
    enabled: Boolean(currentUser),
    students,
    subjects,
    weekConfig,
    weekOffset,
  });
  const {
    deleteWeeklyReportRecord,
    error: reportRecordError,
    loading: weeklyReportsLoading,
    saveWeeklyRecordSnapshot,
    savingRecord,
    weeklyReports,
    reportAmendments,
  } = useWeeklyReportRecords({
    currentUser,
    parentSettings,
    students,
    subjects,
    enabled: Boolean(currentUser),
  });
  // Derive selected week range
  const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset, weekConfig);
  const loading = studentsLoading || subjectsLoading || submissionsLoading || weeklyReportsLoading;

  const studentDataMap = useMemo(() => (
    Object.fromEntries(students.map((student) => [
      student.id,
      schoolWeeksByStudentId[student.id] && !schoolWeeksByStudentId[student.id].reviewRequired ? buildStudentWeeklySnapshot({
        student,
        subjects,
        submissions,
        weekStart,
        weekEnd,
        weeklyPlan: schoolWeeksByStudentId[student.id]?.plan || null,
        completionStates: schoolWeeksByStudentId[student.id]?.completionStates || [],
        publicationBridge: schoolWeeksByStudentId[student.id]?.publicationBridge || null,
      }) : null,
    ]))
  ), [students, subjects, submissions, weekStart, weekEnd, schoolWeeksByStudentId]);
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
      alert('Official record saved. Existing originals stay unchanged; later corrections appear as amendments.');
    } else {
      alert('The record could not be saved. Review the error shown on Reports, then reload the official records before retrying.');
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Permanently delete this official record?')) return;

    const deleted = await deleteWeeklyReportRecord(id);
    if (!deleted) {
      alert('Failed to delete record.');
    }
  };

  const handlePrintRecord = (selection) => {
    const original = selection.original || selection._original || selection;
    const amendment = selection.amendment || selection._amendment || null;
    openReportPrintWindow({ reports: [buildSavedReportPresentation({ original, amendment, timeZone: parentSettings.timezone })],
      timeZone: parentSettings.timezone, title: 'Weekly Progress Report' });
  };

  const toggleSelection = (value, setSelectedValues) => {
    setSelectedValues(current => (
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value]
    ));
  };

  const selectedReportVersion = (report) => {
    const amendment = reportAmendments.find((item) => item.original_report_id === report.id && item.id === recordVersions[report.id]);
    return amendment ? { ...amendment.snapshot, id: report.id, report_version: amendment.report_version, _original: report, _amendment: amendment } : report;
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
    if (!filteredWeeklyReports.length) return;
    openReportPrintWindow({ reports: filteredWeeklyReports.map((original) => {
      const selected = selectedReportVersion(original);
      return buildSavedReportPresentation({ original, amendment: selected._amendment || null, timeZone: parentSettings.timezone });
    }), timeZone: parentSettings.timezone, title: 'Official Weekly Reports',
      context: 'Selected original and amendment versions · Each record retains its complete weekly snapshot' });
  };

  const liveReports = students.filter((student) => !selectedStudentIds.length || selectedStudentIds.includes(student.id))
    .map((student) => ({ student, snapshot: studentDataMap[student.id] }))
    .filter(({ snapshot }) => snapshot && (!selectedSubjectIds.length || snapshot.subjectData.some((item) => selectedSubjectIds.includes(item.subject.id))))
    .map(({ student, snapshot }) => buildLiveReportPresentation({ student, snapshot, weekStart, weekEnd,
      schoolWeek: schoolWeeksByStudentId[student.id], timeZone: parentSettings.timezone }));

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
            onClick={() => openReportPrintWindow({ reports: liveReports, timeZone: parentSettings.timezone, context: 'Live weekly view · Complete weekly snapshots for matching students' })}
            disabled={!liveReports.length}
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

        <div className="p-4 md:p-6 space-y-6">
          {Object.values(schoolWeeksByStudentId).some((week) => week.reviewRequired) && <p role="status" className="p-3 text-sm">Historical assignments require review. Open the original official report; completion totals were not inferred from today’s curriculum.</p>}
          {reportRecordError && <p role="alert" className="p-3 text-sm">Official records could not be loaded or saved: {reportRecordError.message}. Existing originals are preserved.</p>}
          {schoolError && <p role="alert" className="p-3 text-sm">Unable to load trusted school status: {schoolError.message}</p>}
          <div className="space-y-5">
            {students.length === 0 ? <div className="op-proto-empty"><FileText className="w-10 h-10 text-[#cbb7fb]" /><p className="mt-4 text-white">No students yet</p></div>
              : liveReports.length === 0 ? <p className="text-sm text-white/60">No weekly snapshots match these student and subject filters.</p>
              : liveReports.map((report) => {
                const readiness = readinessByStudentId[report.studentId];
                return <section key={report.studentId} className="op-report-student-section">
                  <div className="op-report-student-head">
                    <div className="op-student-avatar">{report.studentName.charAt(0).toUpperCase()}</div>
                    <div className="op-report-student-meta min-w-0">
                      <h2 className="op-report-student-name break-words">{report.studentName}</h2>
                      <p className="op-report-student-sub">{formatReportDate(report.weekStart, report.timeZone, true)} – {formatReportDate(report.weekEnd, report.timeZone, true)} · Live weekly view</p>
                    </div>
                  </div>
                  <div className="p-4 md:p-5 text-white/90">
                    {readiness?.missingRequiredDetailCount > 0 && <p role="status" className="text-xs text-amber-200 mb-3">{readiness.missingRequiredDetailCount} completed required-response block(s) missing required detail.</p>}
                    <ReportSnapshotDetails report={report}>
                      <SchoolBlockDetails schoolWeek={schoolWeeksByStudentId[report.studentId]} onReload={reloadSchoolState} disabled={submissionsLoading || Boolean(schoolError)} />
                    </ReportSnapshotDetails>
                  </div>
                </section>;
              })}
          </div>

          <section className="border-t border-white/15 pt-5" aria-label="Official records">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-label text-white">Official records</h2><p className="text-xs text-white/60 mt-1">{filteredWeeklyReports.length} matching records · School year and quarter apply to saved records. Student and subject filters select complete weekly snapshots.</p></div>
              <div className="flex gap-2"><button onClick={() => setShowRecords((current) => !current)} className="op-proto-btn">{showRecords ? 'Hide records' : 'Show records'}</button>
                <button onClick={handlePrintFilteredRecords} disabled={!filteredWeeklyReports.length} className="op-proto-btn disabled:opacity-40"><Printer className="w-3.5 h-3.5" />Print filtered</button></div>
            </div>
            <p className="text-xs text-white/60 mt-3">Saving files an unchanged original snapshot. Later parent corrections create explicit amendment versions.</p>
            {showRecords && <div className="space-y-3 mt-4">{filteredWeeklyReports.length === 0 ? <p className="text-sm text-white/60">No official records match the current filters.</p>
              : filteredWeeklyReports.map((report) => {
                const selectedVersion = selectedReportVersion(report);
                const versions = reportAmendments.filter((item) => item.original_report_id === report.id).sort((a, b) => a.report_version - b.report_version);
                const presentation = buildSavedReportPresentation({ original: report, amendment: selectedVersion._amendment || null, timeZone: parentSettings.timezone });
                return <article key={report.id} aria-label={`Official record for ${report.student_name}`} className="border border-white/15 p-4 flex flex-wrap items-start gap-4 text-white/90">
                  <div className="flex-1 min-w-0"><h3 className="font-label break-words">{report.student_name}</h3>
                    <p className="text-xs opacity-65 mt-1">{formatReportDate(presentation.weekStart, presentation.timeZone, true)} – {formatReportDate(presentation.weekEnd, presentation.timeZone, true)}</p>
                    <p className="text-xs mt-2">{presentation.assigned} assigned · {presentation.completed} completed · {presentation.incomplete} incomplete</p>
                    <p className="text-xs opacity-65 mt-1">{presentation.timeLabel}</p>
                    {report.school_quarter_label && <p className="text-xs opacity-65 mt-1">{report.school_quarter_label} · {report.school_year_label}</p>}
                    <label className="block mt-3 text-xs">Report version<select className="block w-full max-w-sm bg-[#292744] text-white p-2 mt-1 border border-white/20" value={recordVersions[report.id] || report.id} onChange={(event) => setRecordVersions((previous) => ({ ...previous, [report.id]: event.target.value }))}>
                      <option value={report.id}>Original · Version 1</option>{versions.map((item) => <option key={item.id} value={item.id}>Amendment · Version {item.report_version}</option>)}
                    </select></label>
                    <p className="text-xs mt-2 opacity-70">{presentation.versionLabel} · {formatReportDate(presentation.versionDate, presentation.timeZone)}</p>
                    {presentation.countsRequireReview && <p className="text-xs mt-1 text-amber-200">Completion counts require review; original totals retained.</p>}
                    <button type="button" className="text-xs underline mt-3 min-h-[36px]" onClick={() => setSelectedRecord(report)}>Details &amp; corrections</button>
                  </div>
                  <button onClick={() => handlePrintRecord(selectedVersion)} className="op-proto-btn" title="Print"><Printer className="w-3.5 h-3.5" />Print selected version</button>
                  <button onClick={() => handleDeleteRecord(report.id)} disabled={versions.length > 0} className="op-proto-icon-btn disabled:opacity-30" title={versions.length ? 'Original retained with its amendments' : 'Delete'}><Trash2 className="w-3.5 h-3.5" /></button>
                </article>;
              })}</div>}
          </section>
        </div>
      </div>
      {selectedRecord && <SavedSchoolReportDetails key={selectedRecord.id} original={selectedRecord} amendments={reportAmendments} initialVersionId={recordVersions[selectedRecord.id]}
        student={students.find((student) => student.id === selectedRecord.student_id)} parentId={currentUser.uid} parentSettings={parentSettings}
        subjects={subjects} submissions={submissions} onClose={() => setSelectedRecord(null)} onPrint={handlePrintRecord} />}
    </div>
  );
};

export default Reports;
