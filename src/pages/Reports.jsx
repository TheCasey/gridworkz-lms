import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  writeBatch
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { 
  FileText, 
  Download, 
  Calendar,
  Clock,
  User,
  BookOpen,
  Paperclip,
  Plus,
  X,
  CheckCircle,
  Trash2,
  Settings,
  Printer
} from 'lucide-react';

const Reports = () => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [customReport, setCustomReport] = useState(null);
  const [exportingReport, setExportingReport] = useState(null);
  const [finalizingWeek, setFinalizingWeek] = useState(false);
  
  const db = getFirestore(app);

  // Fetch students
  useEffect(() => {
    if (!currentUser) return;

    const studentsQuery = query(
      collection(db, 'students'),
      where('parent_id', '==', currentUser.uid),
      orderBy('name')
    );

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentsData);
    });

    return unsubscribeStudents;
  }, [currentUser, db]);

  // Fetch subjects
  useEffect(() => {
    if (!currentUser) return;

    const subjectsQuery = query(
      collection(db, 'subjects'),
      where('parent_id', '==', currentUser.uid),
      where('is_active', '==', true),
      orderBy('title')
    );

    const unsubscribeSubjects = onSnapshot(subjectsQuery, (snapshot) => {
      const subjectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubjects(subjectsData);
    });

    return unsubscribeSubjects;
  }, [currentUser, db]);

  // Fetch submissions and generate weekly reports
  useEffect(() => {
    if (!currentUser) return;

    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('parent_id', '==', currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
      const submissionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubmissions(submissionsData);
      generateWeeklyReports(submissionsData);
      setLoading(false);
    });

    return unsubscribeSubmissions;
  }, [currentUser, db]);

  // Fetch existing weekly reports
  useEffect(() => {
    if (!currentUser) return;

    const reportsQuery = query(
      collection(db, 'weeklyReports'),
      where('parent_id', '==', currentUser.uid),
      orderBy('week_ending', 'desc')
    );

    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setWeeklyReports(reportsData);
    });

    return unsubscribeReports;
  }, [currentUser, db]);

  const generateWeeklyReports = (submissionsData) => {
    const reports = {};
    
    // Group submissions by student and week
    submissionsData.forEach(submission => {
      if (!submission.timestamp) return;
      
      const timestamp = submission.timestamp.toDate();
      const weekStart = new Date(timestamp);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(timestamp.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnding = new Date(weekStart);
      weekEnding.setDate(weekStart.getDate() + 6);
      weekEnding.setHours(23, 59, 59, 999);
      
      const studentId = submission.student_id;
      const weekKey = `${studentId}-${weekStart.toISOString()}`;
      
      if (!reports[weekKey]) {
        reports[weekKey] = {
          studentId,
          weekStart,
          weekEnding,
          submissions: [],
          totalHours: 0,
          totalBlocks: 0
        };
      }
      
      reports[weekKey].submissions.push(submission);
      reports[weekKey].totalBlocks += 1;
      reports[weekKey].totalHours += (submission.block_duration || 30) / 60;
    });
    
    return Object.values(reports);
  };

  const getWeeklyGoal = (studentId) => {
    const studentSubjects = subjects.filter(s => s.student_id === studentId);
    return studentSubjects.reduce((sum, subject) => sum + (subject.block_count || 10), 0);
  };

  const getWeekRange = (weekStart, weekEnding) => {
    const options = { month: 'short', day: 'numeric' };
    return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnding.toLocaleDateString('en-US', options)}`;
  };

  const handleFinalizeWeek = async () => {
    if (!window.confirm('This will generate weekly reports for all students and reset their progress. Continue?')) {
      return;
    }

    setFinalizingWeek(true);
    
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnding = new Date(weekStart);
      weekEnding.setDate(weekStart.getDate() + 6);
      weekEnding.setHours(23, 59, 59, 999);

      // Process each student individually to avoid one failure stopping others
      const results = await Promise.allSettled(
        students.map(async (student) => {
          try {
            const weeklyGoal = getWeeklyGoal(student.id);
            const weekSubmissions = submissions.filter(s => {
              if (!s.timestamp || s.student_id !== student.id) return false;
              const timestamp = s.timestamp.toDate();
              return timestamp >= weekStart && timestamp <= weekEnding;
            });

            const totalBlocks = weekSubmissions.length;
            const totalHours = weekSubmissions.reduce((sum, s) => sum + (s.block_duration || 30) / 60, 0);
            const summaries = weekSubmissions.map(s => s.summary_text).filter(Boolean);

            // Create atomic batch: report creation + subject reset + submission cleanup
            const batch = writeBatch(db);
            
            // Add weekly report to batch
            const reportRef = doc(collection(db, 'weeklyReports'));
            batch.set(reportRef, {
              student_id: student.id,
              student_name: student.name,
              parent_id: currentUser.uid,
              week_start: weekStart,
              week_ending: weekEnding,
              weekly_goal: weeklyGoal,
              total_blocks: totalBlocks,
              total_hours: Math.round(totalHours * 10) / 10,
              summaries: summaries,
              attachments: [],
              created_at: serverTimestamp()
            });

            // Reset completed blocks for all student subjects in the same batch
            const studentSubjects = subjects.filter(s => s.student_id === student.id);
            studentSubjects.forEach(subject => {
              const subjectRef = doc(db, 'subjects', subject.id);
              batch.update(subjectRef, {
                completed_blocks: 0,
                updated_at: serverTimestamp()
              });
            });

            // Delete current week's submissions to provide clean slate
            weekSubmissions.forEach(submission => {
              const submissionRef = doc(db, 'submissions', submission.id);
              batch.delete(submissionRef);
            });

            // Commit atomic batch - report creation, subject reset, and submission cleanup happen together
            await batch.commit();

            return { success: true, student: student.name, error: null };
          } catch (error) {
            console.error(`Error finalizing week for ${student.name}:`, error);
            return { success: false, student: student.name, error: error.message };
          }
        })
      );

      // Check results and provide appropriate feedback
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      if (successful.length > 0) {
        const successMessage = successful.length === students.length 
          ? 'Weekly reports generated successfully! Student progress has been reset for all students.'
          : `Weekly reports generated for ${successful.length} student(s).`;
        
        alert(successMessage);
      }

      if (failed.length > 0) {
        const failedNames = failed.map(r => r.reason?.student || 'Unknown').join(', ');
        console.error('Failed students:', failed);
        alert(`Warning: Failed to generate reports for: ${failedNames}. Please check these students manually.`);
      }

    } catch (error) {
      console.error('Critical error in finalize week:', error);
      alert('Failed to finalize week. Please try again.');
    } finally {
      setFinalizingWeek(false);
    }
  };

  const handleGenerateCustomReport = () => {
    if (!customStartDate || !customEndDate || selectedStudents.length === 0) {
      alert('Please select date range and at least one student');
      return;
    }

    const startDate = new Date(customStartDate);
    const endDate = new Date(customEndDate);
    endDate.setHours(23, 59, 59, 999);

    const customReports = selectedStudents.map(studentId => {
      const student = students.find(s => s.id === studentId);
      const studentSubmissions = submissions.filter(s => {
        if (!s.timestamp || s.student_id !== studentId) return false;
        const timestamp = s.timestamp.toDate();
        return timestamp >= startDate && timestamp <= endDate;
      });

      const totalBlocks = studentSubmissions.length;
      const totalHours = studentSubmissions.reduce((sum, s) => sum + (s.block_duration || 30) / 60, 0);
      const summaries = studentSubmissions.map(s => s.summary_text).filter(Boolean);
      const weeklyGoal = getWeeklyGoal(studentId);

      return {
        student,
        total_blocks: totalBlocks,
        total_hours: Math.round(totalHours * 10) / 10,
        summaries: summaries,
        weekly_goal: weeklyGoal,
        date_range: { start: startDate, end: endDate }
      };
    });

    setCustomReport(customReports);
    setShowCustomModal(false);
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Are you sure? This will permanently delete this academic record.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'weeklyReports', reportId));
      alert('Report deleted successfully');
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report. Please try again.');
    }
  };

  const handleExportReport = (report) => {
    setExportingReport(report);
    // Open in new window after state updates
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>GridWorkz Report - ${report.student_name}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #3B82F6; padding-bottom: 20px; }
                .logo { font-size: 32px; font-weight: bold; color: #3B82F6; margin-bottom: 10px; }
                .student-info { margin: 20px 0; }
                .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 30px 0; }
                .metric { text-align: center; padding: 20px; border: 1px solid #E5E7EB; border-radius: 8px; }
                .metric-value { font-size: 36px; font-weight: bold; color: #3B82F6; }
                .metric-label { font-size: 14px; color: #6B7280; margin-top: 5px; }
                .summaries { margin-top: 30px; }
                .summary-item { margin: 15px 0; padding: 15px; background: #F9FAFB; border-radius: 8px; }
                .attachments { margin-top: 20px; }
                .attachment-item { margin: 10px 0; padding: 10px; background: #F3F4F6; border-radius: 6px; }
                @media print { 
                  body { 
                    margin: 20px; 
                    background: white !important;
                    color: black !important;
                  } 
                  .no-print { display: none !important; }
                  button { display: none !important; }
                  a[href^="#"] { display: none !important; }
                  * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="logo">GridWorkz</div>
                <h1>Weekly Progress Report</h1>
              </div>
              
              <div class="student-info">
                <h2>${report.student_name}</h2>
                <p><strong>Report Period:</strong> ${getWeekRange(
                  report.week_start?.toDate?.() || report.week_start,
                  report.week_ending?.toDate?.() || report.week_ending
                )}</p>
              </div>
              
              <div class="metrics">
                <div class="metric">
                  <div class="metric-value">${report.total_blocks}</div>
                  <div class="metric-label">Blocks Completed</div>
                  <div>Goal: ${report.weekly_goal}</div>
                </div>
                <div class="metric">
                  <div class="metric-value">${report.total_hours}h</div>
                  <div class="metric-label">Total Hours</div>
                </div>
                <div class="metric">
                  <div class="metric-value">${Math.round((report.total_blocks / report.weekly_goal) * 100)}%</div>
                  <div class="metric-label">Weekly Progress</div>
                </div>
              </div>
              
              ${report.summaries && report.summaries.length > 0 ? `
                <div class="summaries">
                  <h3>Learning Summaries</h3>
                  ${report.summaries.map(summary => `
                    <div class="summary-item">${summary}</div>
                  `).join('')}
                </div>
              ` : ''}
              
              ${report.attachments && report.attachments.length > 0 ? `
                <div class="attachments">
                  <h3>Attachments</h3>
                  ${report.attachments.map(att => `
                    <div class="attachment-item">
                      <strong>${att.name || 'Attachment'}</strong>
                      ${att.url ? `<br><a href="${att.url}">View File</a>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
      setExportingReport(null);
    }, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Weekly Reports</h2>
          <p className="text-sm text-slate-500 mt-1">Track student progress and weekly achievements</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCustomModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            <Settings className="w-4 h-4" />
            Generate Custom Report
          </button>
          <button
            onClick={handleFinalizeWeek}
            disabled={finalizingWeek}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            {finalizingWeek ? 'Processing Reports...' : 'Finalize Week'}
          </button>
        </div>
      </div>

      {weeklyReports.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No weekly reports yet</h3>
          <p className="text-slate-500 mb-6">Generate your first weekly report to see student progress</p>
          <button
            onClick={handleFinalizeWeek}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Generate First Report
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {weeklyReports.map((report) => (
            <div key={report.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">
                    {report.student_name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {getWeekRange(
                      report.week_start?.toDate?.() || report.week_start,
                      report.week_ending?.toDate?.() || report.week_ending
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedReport(report)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleExportReport(report)}
                    className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedReport(report);
                      setShowAttachModal(true);
                    }}
                    className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteReport(report.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Blocks Completed</span>
                    <span className="text-lg font-semibold text-slate-900">
                      {report.total_blocks}/{report.weekly_goal}
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${Math.min((report.total_blocks / report.weekly_goal) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Total Hours</span>
                    <span className="text-lg font-semibold text-slate-900">
                      {report.total_hours}h
                    </span>
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Progress</span>
                    <span className="text-lg font-semibold text-slate-900">
                      {Math.round((report.total_blocks / report.weekly_goal) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {report.summaries && report.summaries.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Weekly Summaries</h4>
                  <div className="space-y-2">
                    {report.summaries.slice(0, 3).map((summary, index) => (
                      <div key={index} className="bg-slate-50 rounded-lg p-3">
                        <p className="text-sm text-slate-700 line-clamp-2">{summary}</p>
                      </div>
                    ))}
                    {report.summaries.length > 3 && (
                      <p className="text-xs text-slate-500">
                        +{report.summaries.length - 3} more summaries
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && !showAttachModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">
                {selectedReport.student_name} - Weekly Report
              </h2>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-600">{selectedReport.total_blocks}</div>
                  <div className="text-sm text-slate-500">Blocks Completed</div>
                  <div className="text-xs text-slate-400 mt-1">Goal: {selectedReport.weekly_goal}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{selectedReport.total_hours}h</div>
                  <div className="text-sm text-slate-500">Total Hours</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-600">
                    {Math.round((selectedReport.total_blocks / selectedReport.weekly_goal) * 100)}%
                  </div>
                  <div className="text-sm text-slate-500">Weekly Progress</div>
                </div>
              </div>

              {selectedReport.summaries && selectedReport.summaries.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">All Summaries</h3>
                  <div className="space-y-3">
                    {selectedReport.summaries.map((summary, index) => (
                      <div key={index} className="bg-slate-50 rounded-lg p-4">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Attachment Modal */}
      {showAttachModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Attach Files</h2>
              <button
                onClick={() => {
                  setShowAttachModal(false);
                  setAttachments([]);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Attach files to {selectedReport.student_name}'s weekly report
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    // File upload logic would go here
                    alert('File upload would be implemented here');
                  }}
                  className="w-full p-4 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 transition-colors"
                >
                  <Paperclip className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Click to upload files</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Report Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Generate Custom Report</h2>
              <button
                onClick={() => {
                  setShowCustomModal(false);
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setSelectedStudents([]);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Students</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {students.map(student => (
                    <label key={student.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents([...selectedStudents, student.id]);
                          } else {
                            setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700">{student.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCustomModal(false);
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setSelectedStudents([]);
                  }}
                  className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateCustomReport}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Report Display */}
      {customReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Custom Report</h2>
              <button
                onClick={() => setCustomReport(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {customReport.map((report, index) => (
                <div key={index} className="mb-8 pb-8 border-b border-slate-200 last:border-b-0">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">{report.student.name}</h3>
                    <p className="text-sm text-slate-500">
                      {report.date_range.start.toLocaleDateString()} - {report.date_range.end.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-lg font-semibold text-slate-900">
                        {report.total_blocks}/{report.weekly_goal}
                      </div>
                      <div className="text-sm text-slate-600">Blocks Completed</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-lg font-semibold text-slate-900">{report.total_hours}h</div>
                      <div className="text-sm text-slate-600">Total Hours</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-lg font-semibold text-slate-900">
                        {Math.round((report.total_blocks / report.weekly_goal) * 100)}%
                      </div>
                      <div className="text-sm text-slate-600">Progress</div>
                    </div>
                  </div>
                  {report.summaries.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">Summaries</h4>
                      <div className="space-y-2">
                        {report.summaries.map((summary, i) => (
                          <div key={i} className="bg-slate-50 rounded-lg p-3">
                            <p className="text-sm text-slate-700">{summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
