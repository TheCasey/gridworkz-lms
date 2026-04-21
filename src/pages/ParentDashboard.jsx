import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  getDocs,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { nanoid } from 'nanoid';
import {
  Home,
  BookOpen,
  FileText,
  Heart,
  Plus,
  Activity,
  Users,
  Clock,
  X,
  Info,
  Check,
  Download,
  Calendar
} from 'lucide-react';
import StudentCard from '../components/StudentCard';
import AddStudentModal from '../components/AddStudentModal';
import Curriculum from './Curriculum';
import Reports from './Reports';
import {
  getCurrentWeekRange,
  getWeekRangeByOffset,
  formatWeekRange,
  getWeekLabel,
  getWeekPickerOptions,
  isTimestampInWeek
} from '../utils/weekUtils';

const FONT = "'Super Sans VF', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

const labelCls = 'block text-[11px] uppercase tracking-wider mb-1.5' + ' ' + 'font-label';
const inputCls = 'w-full px-3 py-2.5 rounded-lg focus:outline-none text-[14px] transition-colors bg-white';

const ParentDashboard = () => {
  const { currentUser, logout } = useAuth();
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [viewingStudentProgress, setViewingStudentProgress] = useState(null);
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [viewingSummary, setViewingSummary] = useState(null);
  const [manualCompleteBlock, setManualCompleteBlock] = useState(null);
  const [parentNote, setParentNote] = useState('');
  const [showManualConfirm, setShowManualConfirm] = useState(false);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const studentProgressUnsubRef = useRef(null);

  const db = getFirestore(app);

  useEffect(() => {
    setLoading(true);

    if (!currentUser) {
      setLoading(false);
      return;
    }

    const studentsQuery = query(
      collection(db, 'students'),
      where('parent_id', '==', currentUser.uid),
      orderBy('created_at', 'desc')
    );

    const studentsUnsubscribe = onSnapshot(studentsQuery, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Error fetching students:', error.code, error.message);
    });

    const subjectsQuery = query(
      collection(db, 'subjects'),
      where('parent_id', '==', currentUser.uid),
      where('is_active', '==', true),
      orderBy('title')
    );

    const subjectsUnsubscribe = onSnapshot(subjectsQuery, (snapshot) => {
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Error fetching subjects:', error);
    });

    const { weekStart } = getCurrentWeekRange();

    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('parent_id', '==', currentUser.uid),
      where('timestamp', '>=', weekStart),
      orderBy('timestamp', 'desc')
    );

    const submissionsUnsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching submissions:', error.code, error.message);
      setLoading(false);
    });

    const loadingTimeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      studentsUnsubscribe();
      subjectsUnsubscribe();
      submissionsUnsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, [currentUser, db]);

  const handleAddStudent = async ({ name, accessPin }) => {
    setAddingStudent(true);
    try {
      const baseSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const slug = `${baseSlug}-${nanoid(6)}`;

      const studentDoc = {
        name: name.trim(),
        slug,
        access_pin: accessPin || null,
        parent_id: currentUser.uid,
        is_active: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      await addDoc(collection(db, 'students'), studentDoc);
      setModalOpen(false);
    } catch (error) {
      console.error('Error adding student:', error.code, error.message);
      if (error.code === 'permission-denied') {
        alert('Permission denied. Please check Firestore security rules.');
      } else if (error.code === 'unavailable') {
        alert('Firestore unavailable. Check your internet connection.');
      } else {
        alert(`Failed to add student: ${error.message}`);
      }
    } finally {
      setAddingStudent(false);
    }
  };

  const handleViewStudentProgress = (student) => {
    setViewingStudentProgress(student);
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('student_id', '==', student.id),
      orderBy('timestamp', 'desc')
    );
    studentProgressUnsubRef.current = onSnapshot(submissionsQuery, (snapshot) => {
      setStudentSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Error fetching student submissions:', error);
    });
  };

  const handleCloseStudentProgress = () => {
    setViewingStudentProgress(null);
    setStudentSubmissions([]);
    setSelectedSubmission(null);
    if (studentProgressUnsubRef.current) {
      studentProgressUnsubRef.current();
      studentProgressUnsubRef.current = null;
    }
  };

  const handleResetBlock = async (submissionId) => {
    if (!window.confirm('Are you sure you want to reset this block? This will delete the submission and the student will need to redo it.')) return;
    try {
      await deleteDoc(doc(db, 'submissions', submissionId));
      setSelectedSubmission(null);
      alert('Block reset successfully! The student can now redo this block.');
    } catch (error) {
      console.error('Error resetting block:', error);
      alert('Failed to reset block. Please try again.');
    }
  };

  const handleManualComplete = (subject, blockIndex) => {
    setManualCompleteBlock({ subject, blockIndex });
    setParentNote('');
    setShowManualConfirm(true);
  };

  const confirmManualComplete = async () => {
    if (!manualCompleteBlock) return;
    try {
      await addDoc(collection(db, 'submissions'), {
        student_id: viewingStudentProgress.id,
        subject_id: manualCompleteBlock.subject.id,
        subject_name: manualCompleteBlock.subject.title,
        block_index: manualCompleteBlock.blockIndex,
        status: 'parent_completed',
        summary_text: parentNote || 'Parent-led session',
        timestamp: serverTimestamp(),
        manual_override: true,
        parent_id: currentUser.uid
      });
      setShowManualConfirm(false);
      setManualCompleteBlock(null);
      setParentNote('');
      alert('Block marked as completed successfully!');
    } catch (error) {
      console.error('Error marking block complete:', error);
      alert('Failed to mark block complete. Please try again.');
    }
  };

  const cancelManualComplete = () => {
    setShowManualConfirm(false);
    setManualCompleteBlock(null);
    setParentNote('');
  };

  const getStudentProgressForSubject = (subjectId) => {
    const weekSubmissions = getWeekSubmissions(selectedWeekOffset);
    return weekSubmissions
      .filter(s => s.student_id === viewingStudentProgress?.id && s.subject_id === subjectId)
      .map(s => s.block_index);
  };

  const isBlockCompletedForStudent = (subjectId, blockIndex) => {
    return getStudentProgressForSubject(subjectId).includes(blockIndex);
  };

  const handleLogout = async () => {
    const result = await logout();
    if (!result.success) console.error('Logout failed:', result.error);
  };

  const handleDeleteStudent = async (studentId) => {
    if (window.confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'students', studentId));
      } catch (error) {
        console.error('Error deleting student:', error);
        alert('Failed to delete student. Please try again.');
      }
    }
  };


  const getWeeklyProgress = (studentId, subjectId, weekOffset = 0) => {
    const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset);
    const subjectSubmissions = submissions.filter(s =>
      s.student_id === studentId &&
      s.subject_id === subjectId &&
      s.timestamp &&
      isTimestampInWeek(s.timestamp, weekStart, weekEnd) &&
      s.block_index !== undefined
    );
    const uniqueBlockIndices = [...new Set(subjectSubmissions.map(s => s.block_index).filter(i => i !== undefined))];
    const subject = subjects.find(sub => sub.id === subjectId);
    const totalBlocks = subject?.block_count || 10;
    return {
      completed: uniqueBlockIndices.length,
      total: totalBlocks,
      percentage: Math.round((uniqueBlockIndices.length / totalBlocks) * 100)
    };
  };

  const getRealTimeWeeklyProgress = (studentId, weekOffset = 0) => {
    const studentSubjects = getStudentSubjects(studentId);
    if (studentSubjects.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset);
    const completedBlocksBySubject = {};
    studentSubjects.forEach(subject => {
      const subs = submissions.filter(s =>
        s.student_id === studentId &&
        s.subject_id === subject.id &&
        s.timestamp &&
        isTimestampInWeek(s.timestamp, weekStart, weekEnd) &&
        s.block_index !== undefined
      );
      completedBlocksBySubject[subject.id] = [...new Set(subs.map(s => s.block_index).filter(i => i !== undefined))];
    });
    const totalBlocks = studentSubjects.reduce((sum, s) => sum + (s.block_count || 10), 0);
    const completedBlocks = Object.values(completedBlocksBySubject).reduce((sum, blocks) => sum + blocks.length, 0);
    return {
      completed: completedBlocks,
      total: totalBlocks,
      percentage: totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0
    };
  };

  const getWeekSubmissions = (weekOffset = 0) => {
    const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset);
    return submissions.filter(s => s.timestamp && isTimestampInWeek(s.timestamp, weekStart, weekEnd));
  };

  const handleDownloadWeeklyReport = async (weekOffset = 0) => {
    setIsGeneratingReport(true);
    try {
      const { weekStart, weekEnd } = getWeekRangeByOffset(weekOffset);
      const weekLabel = getWeekLabel(weekOffset);
      const weekRangeText = formatWeekRange(weekStart, weekEnd);
      let reportContent = `GridWorkz Weekly Report\nWeek: ${weekRangeText}\nGenerated: ${new Date().toLocaleString()}\n\n`;

      if (weekOffset < 0) {
        // Past week: query live submissions directly (submissions are permanent records)
        const pastSubsSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('parent_id', '==', currentUser.uid),
          where('timestamp', '>=', weekStart),
          where('timestamp', '<=', weekEnd),
          orderBy('timestamp', 'desc')
        ));

        const pastSubs = pastSubsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (pastSubs.length === 0) {
          reportContent += 'No activity recorded for this week.\n';
        } else {
          for (const student of students) {
            const studentSubs = pastSubs.filter(s => s.student_id === student.id);
            if (studentSubs.length === 0) continue;
            const studentSubjects = getStudentSubjects(student.id);
            const totalBlocks = studentSubs.length;
            reportContent += `═══════════════════════════════════════\nStudent: ${student.name}\nBlocks Completed: ${totalBlocks}\n\n`;
            for (const subject of studentSubjects) {
              const subSubs = studentSubs.filter(s => s.subject_id === subject.id);
              if (subSubs.length === 0) continue;
              reportContent += `📚 ${subject.title}\n   Blocks Completed: ${subSubs.length}\n`;
              subSubs.forEach(s => {
                const t = s.timestamp.toDate();
                reportContent += `   • Block ${(s.block_index ?? 0) + 1} - ${t.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n`;
                if (s.summary_text) reportContent += `     Summary: ${s.summary_text}\n`;
              });
              reportContent += `\n`;
            }
          }
        }
      } else {
        // Current week: use live submissions state
        for (const student of students) {
          const studentProgress = getRealTimeWeeklyProgress(student.id, weekOffset);
          const studentSubjects = getStudentSubjects(student.id);
          reportContent += `═══════════════════════════════════════\nStudent: ${student.name}\nOverall Progress: ${studentProgress.completed}/${studentProgress.total} blocks (${studentProgress.percentage}%)\n\n`;
          for (const subject of studentSubjects) {
            const subjectProgress = getWeeklyProgress(student.id, subject.id, weekOffset);
            const weekSubs = getWeekSubmissions(weekOffset).filter(s => s.student_id === student.id && s.subject_id === subject.id);
            reportContent += `📚 ${subject.title}\n   Progress: ${subjectProgress.completed}/${subjectProgress.total} blocks (${subjectProgress.percentage}%)\n`;
            if (weekSubs.length > 0) {
              reportContent += `   Block Completions:\n`;
              weekSubs.forEach(submission => {
                const t = submission.timestamp.toDate();
                reportContent += `   • Block ${submission.block_index + 1} - ${t.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n`;
                if (submission.summary_text) reportContent += `     Summary: ${submission.summary_text}\n`;
              });
            }
            reportContent += `\n`;
          }
        }
      }

      const blob = new Blob([reportContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GridWorkz-Weekly-Report-${weekLabel.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating weekly report:', error);
      alert('Failed to generate weekly report. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const getStudentSubjects = (studentId) => {
    return subjects.filter(subject => {
      if (subject.student_ids && Array.isArray(subject.student_ids)) return subject.student_ids.includes(studentId);
      return subject.student_id === studentId;
    });
  };

  const getCustomFieldLabel = (fieldId, subjectId) => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject || !subject.custom_fields) return fieldId;
    const field = subject.custom_fields.find(f => f.id === fieldId);
    return field ? field.label : fieldId;
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'curriculum', label: 'Curriculum', icon: BookOpen },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    const now = new Date();
    const t = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMins = Math.floor((now - t) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const C = {
    mysteria: '#1b1938',
    lavender: '#cbb7fb',
    charcoal: '#292827',
    amethyst: '#714cb6',
    cream: '#e9e5dd',
    parchment: '#dcd7d3',
    lavenderTint: '#f0eaff',
  };

  return (
    <div className="min-h-screen" style={{ fontFamily: FONT, backgroundColor: '#f5f3ef' }}>
      <div className="flex h-screen">

        {/* Sidebar — dark Mysteria purple */}
        <div className="w-64 flex flex-col flex-shrink-0" style={{ backgroundColor: C.mysteria }}>
          <div className="px-6 pt-7 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-6 h-[3px] rounded-full mb-3" style={{ backgroundColor: C.lavender }} />
            <h1 style={{ fontSize: 20, fontWeight: 540, lineHeight: 0.96, letterSpacing: '-0.4px', color: '#ffffff' }}>
              GRIDWORKZ
            </h1>
            <p className="text-[12px] mt-1.5" style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 460 }}>Parent Portal</p>
          </div>

          <nav className="flex-1 p-3">
            <div className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = activeNav === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                    style={{
                      backgroundColor: isActive ? 'rgba(203,183,251,0.15)' : 'transparent',
                      color: isActive ? C.lavender : 'rgba(255,255,255,0.5)',
                      fontWeight: isActive ? 540 : 460,
                      fontSize: 14,
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700 }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
            >
              <Heart className="w-4 h-4" />
              Support Project
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="px-8 py-4 flex-shrink-0" style={{ backgroundColor: '#ffffff', borderBottom: `1px solid ${C.parchment}` }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 540, lineHeight: 0.96, letterSpacing: '-0.4px', color: C.charcoal }}>
                  {activeNav === 'dashboard' ? 'Students' : activeNav === 'curriculum' ? 'Curriculum' : 'Reports'}
                </h2>
                <p className="text-[13px] mt-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                  {activeNav === 'dashboard' ? 'Manage your student accounts and access' :
                   activeNav === 'curriculum' ? 'Manage subjects and learning resources' :
                   'View weekly reports and student progress'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {activeNav === 'dashboard' && (
                  <button
                    onClick={() => setModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                    style={{ backgroundColor: C.charcoal, color: '#fff', fontSize: 13, fontWeight: 700 }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}
                  >
                    <Plus className="w-4 h-4" />
                    Add Student
                  </button>
                )}

                {(activeNav === 'dashboard' || activeNav === 'reports') && (
                  <>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" style={{ color: 'rgba(41,40,39,0.4)' }} />
                      <select
                        value={selectedWeekOffset}
                        onChange={(e) => setSelectedWeekOffset(parseInt(e.target.value))}
                        className="px-3 py-2 rounded-lg text-[13px] focus:outline-none"
                        style={{ border: `1px solid ${C.parchment}`, backgroundColor: '#fff', color: C.charcoal, fontWeight: 460 }}
                      >
                        {getWeekPickerOptions().map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label} ({option.displayText})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => handleDownloadWeeklyReport(selectedWeekOffset)}
                      disabled={isGeneratingReport}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: C.cream, color: C.charcoal, fontSize: 13, fontWeight: 700 }}
                      onMouseEnter={e => { if (!isGeneratingReport) e.currentTarget.style.backgroundColor = C.parchment; }}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}
                    >
                      <Download className="w-4 h-4" />
                      {isGeneratingReport ? 'Generating...' : 'Download Report'}
                    </button>

                    {selectedWeekOffset < 0 && (
                      <button
                        onClick={() => setActiveNav('reports')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                        style={{ backgroundColor: C.charcoal, color: '#fff', fontSize: 13, fontWeight: 700 }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}
                      >
                        <FileText className="w-4 h-4" />
                        View Reports
                      </button>
                    )}
                  </>
                )}


                <div className="flex items-center gap-3 pl-3" style={{ borderLeft: `1px solid ${C.parchment}` }}>
                  <span className="text-[13px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>{currentUser?.email}</span>
                  <button
                    onClick={handleLogout}
                    className="text-[13px] hover:underline"
                    style={{ color: C.amethyst, fontWeight: 460 }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-auto">
            {activeNav === 'dashboard' ? (
              <div className="p-8">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8" style={{ borderBottom: `2px solid ${C.lavender}`, border: `2px solid transparent`, borderBottomColor: C.lavender }} />
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#f0eaff' }}>
                      <Users className="w-7 h-7" style={{ color: C.amethyst }} />
                    </div>
                    <h3 className="text-[17px] mb-2" style={{ fontWeight: 540, color: C.charcoal }}>No students yet</h3>
                    <p className="text-[14px] mb-6" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>Add your first student to get started with GridWorkz</p>
                    <button
                      onClick={() => setModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors"
                      style={{ backgroundColor: C.charcoal, color: '#fff', fontSize: 14, fontWeight: 700 }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}
                    >
                      <Plus className="w-4 h-4" />
                      Add Your First Student
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {students.map((student) => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        onDelete={handleDeleteStudent}
                        onViewProgress={handleViewStudentProgress}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : activeNav === 'curriculum' ? (
              <Curriculum />
            ) : activeNav === 'reports' ? (
              <Reports />
            ) : null}
          </main>
        </div>

        {/* Live Pulse */}
        <div className="w-80 flex flex-col flex-shrink-0" style={{ backgroundColor: '#ffffff', borderLeft: `1px solid ${C.parchment}` }}>
          <div className="px-6 pt-6 pb-5" style={{ borderBottom: `1px solid ${C.parchment}` }}>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4" style={{ color: C.amethyst }} />
              <h3 style={{ fontSize: 15, fontWeight: 540, color: C.charcoal }}>Live Pulse</h3>
            </div>
            <p className="text-[12px]" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>Real-time activity feed</p>
          </div>

          <div className="flex-1 overflow-auto p-5">
            {submissions.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#f0eaff' }}>
                  <Activity className="w-5 h-5" style={{ color: 'rgba(113,76,182,0.5)' }} />
                </div>
                <p className="text-[13px]" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>No submissions yet</p>
                <p className="text-[12px] mt-1" style={{ color: 'rgba(41,40,39,0.3)', fontWeight: 460 }}>Student activity will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Weekly Progress Summary */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(240,234,255,0.5)', border: `1px solid rgba(203,183,251,0.4)` }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 style={{ fontSize: 13, fontWeight: 540, color: C.charcoal }}>Weekly Progress</h4>
                    <span className="text-[11px] uppercase tracking-wider" style={{ color: C.amethyst, fontWeight: 700 }}>
                      {getWeekLabel(selectedWeekOffset)}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {students.map(student => {
                      const progress = getRealTimeWeeklyProgress(student.id, selectedWeekOffset);
                      if (progress.total === 0) return null;
                      return (
                        <div key={student.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[13px]" style={{ color: C.charcoal, fontWeight: 460 }}>{student.name}</span>
                            <span className="text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 700 }}>
                              {progress.completed}/{progress.total}
                            </span>
                          </div>
                          <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: C.parchment }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${progress.percentage}%`, backgroundColor: C.lavender }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Activity Feed */}
                <div>
                  <h4 className="text-[11px] uppercase tracking-wider mb-3" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                    Activity — {getWeekLabel(selectedWeekOffset)}
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {(() => {
                      const weekSubmissions = getWeekSubmissions(selectedWeekOffset);
                      if (weekSubmissions.length === 0) {
                        return (
                          <p className="text-[13px] text-center py-4" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                            No submissions {selectedWeekOffset === 0 ? 'this week' : 'for selected week'}
                          </p>
                        );
                      }
                      return weekSubmissions.map((submission) => (
                        <div
                          key={submission.id}
                          className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                          style={{ backgroundColor: C.cream }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}
                          onClick={() => setViewingSummary(submission)}
                        >
                          <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: C.lavender }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px]" style={{ color: C.charcoal, fontWeight: 460 }}>
                              <span style={{ fontWeight: 540 }}>{students.find(s => s.id === submission.student_id)?.name || 'Unknown'}</span>
                              {' '}completed{' '}
                              <span style={{ color: C.amethyst }}>{submission.subject_name}</span>
                            </p>
                            {submission.custom_field_responses && Object.keys(submission.custom_field_responses).length > 0 && (
                              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f0eaff' }}>
                                <Info className="w-3 h-3" style={{ color: C.amethyst }} />
                                <span className="text-[10px]" style={{ color: C.amethyst, fontWeight: 700 }}>Extra Details</span>
                              </div>
                            )}
                            <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                              <Clock className="w-3 h-3" />
                              {formatTimestamp(submission.timestamp)}
                            </p>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Student Modal */}
      <AddStudentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAddStudent={handleAddStudent}
        loading={addingStudent}
      />


      {/* Summary Modal */}
      {viewingSummary && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 border border-parchment">
            <div className="flex items-center justify-between p-6 border-b border-parchment">
              <h2 style={{ fontSize: 17, fontWeight: 540, color: '#292827' }}>
                {viewingSummary.subject_name} Summary
              </h2>
              <button onClick={() => setViewingSummary(null)} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[13px] font-body text-charcoal-ink/60">
                  <span style={{ fontWeight: 540, color: '#292827' }}>
                    {students.find(s => s.id === viewingSummary.student_id)?.name || 'Unknown Student'}
                  </span>
                </p>
                <p className="text-[12px] font-body text-charcoal-ink/40 mt-0.5">
                  {formatTimestamp(viewingSummary.timestamp)}
                </p>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: C.cream }}>
                <p className="text-[14px] whitespace-pre-wrap" style={{ color: C.charcoal, fontWeight: 460 }}>
                  {viewingSummary.summary_text}
                </p>
              </div>
              {viewingSummary.custom_field_responses && Object.keys(viewingSummary.custom_field_responses).length > 0 && (
                <div className="bg-[#f0eaff]/50 rounded-xl p-4 border border-lavender-glow/40">
                  <h4 style={{ fontSize: 12, fontWeight: 700 }} className="uppercase tracking-wider text-amethyst-link mb-3">Custom Details</h4>
                  <div className="space-y-2">
                    {Object.entries(viewingSummary.custom_field_responses).map(([fieldId, value]) => (
                      <div key={fieldId}>
                        <span className="text-[11px] font-label uppercase tracking-wider text-amethyst-link/70">
                          {getCustomFieldLabel(fieldId, viewingSummary.subject_id)}
                        </span>
                        <p className="text-[14px] font-body text-charcoal-ink mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Student Progress Modal */}
      {viewingStudentProgress && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden border border-parchment">
            <div className="flex items-center justify-between p-6 border-b border-parchment">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 540, color: '#292827' }}>
                  {viewingStudentProgress.name}'s Progress
                </h2>
                <p className="text-[13px] font-body text-charcoal-ink/40 mt-0.5">View and manage individual student progress</p>
              </div>
              <button onClick={handleCloseStudentProgress} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
              {/* Week Selector */}
              <div className="mb-6 p-4 bg-[#f0eaff]/40 rounded-xl border border-lavender-glow/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-label uppercase tracking-wider text-amethyst-link mb-1">Viewing Progress For</p>
                    <p className="text-[13px] font-body text-charcoal-ink">
                      {formatWeekRange(...Object.values(getWeekRangeByOffset(selectedWeekOffset)))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amethyst-link/60" />
                    <select
                      value={selectedWeekOffset}
                      onChange={(e) => setSelectedWeekOffset(parseInt(e.target.value))}
                      className="px-3 py-1.5 text-[13px] font-body border border-parchment rounded-lg bg-white text-charcoal-ink focus:outline-none focus:border-charcoal-ink"
                    >
                      {getWeekPickerOptions().slice(-8).map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {(() => {
                const studentSubjects = subjects.filter(subject => {
                  if (subject.student_ids && Array.isArray(subject.student_ids)) return subject.student_ids.includes(viewingStudentProgress.id);
                  return subject.student_id === viewingStudentProgress.id;
                });

                if (studentSubjects.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 bg-[#f0eaff] rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-7 h-7 text-amethyst-link/50" />
                      </div>
                      <h3 className="text-[16px] font-display text-charcoal-ink mb-2">No subjects assigned</h3>
                      <p className="text-[14px] font-body text-charcoal-ink/40">This student hasn't been assigned any subjects yet.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-5">
                    {studentSubjects.map((subject) => {
                      const progress = getWeeklyProgress(viewingStudentProgress.id, subject.id, selectedWeekOffset);

                      return (
                        <div key={subject.id} className="bg-white rounded-2xl border border-parchment p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color || '#cbb7fb' }} />
                                <h3 style={{ fontSize: 16, fontWeight: 540, color: '#292827' }}>{subject.title}</h3>
                              </div>
                              <div className="flex items-center gap-3 text-[13px] font-body text-charcoal-ink/50">
                                <span>Progress: {progress.completed}/{progress.total} blocks</span>
                                <span className="text-amethyst-link font-label">{progress.percentage}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full rounded-full h-2 overflow-hidden mb-5" style={{ backgroundColor: C.parchment }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${progress.percentage}%`, backgroundColor: C.lavender }}
                            />
                          </div>

                          {/* Blocks Grid */}
                          <div>
                            <p className="text-[11px] font-label uppercase tracking-wider text-charcoal-ink/40 mb-3">
                              {getWeekLabel(selectedWeekOffset)} Blocks
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              {Array.from({ length: progress.total }, (_, index) => {
                                const isCompleted = isBlockCompletedForStudent(subject.id, index);
                                const weekSubmissions = getWeekSubmissions(selectedWeekOffset);
                                const submission = weekSubmissions.find(s =>
                                  s.student_id === viewingStudentProgress.id &&
                                  s.subject_id === subject.id &&
                                  s.block_index === index
                                );

                                return (
                                  <div key={index} className="flex items-center gap-1">
                                    <button
                                      onClick={() => isCompleted && setSelectedSubmission(submission)}
                                      disabled={!isCompleted}
                                      className="w-11 h-11 rounded-lg font-label text-[13px] transition-all"
                                      style={{
                                        backgroundColor: isCompleted ? '#f0eaff' : '#ffffff',
                                        border: `1px solid ${isCompleted ? C.lavender : C.parchment}`,
                                        color: isCompleted ? C.amethyst : 'rgba(41,40,39,0.3)',
                                        cursor: isCompleted ? 'pointer' : 'not-allowed',
                                      }}
                                      title={isCompleted ? 'Click to view details' : 'Not completed'}
                                    >
                                      {isCompleted ? '✓' : index + 1}
                                    </button>

                                    {!isCompleted && (
                                      <button
                                        onClick={() => handleManualComplete(subject, index)}
                                        className="w-8 h-11 rounded-lg transition-all flex items-center justify-center"
                                        style={{ backgroundColor: C.cream, border: `1px solid ${C.parchment}`, color: 'rgba(41,40,39,0.4)' }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0eaff'; e.currentTarget.style.borderColor = C.lavender; e.currentTarget.style.color = C.amethyst; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.cream; e.currentTarget.style.borderColor = C.parchment; e.currentTarget.style.color = 'rgba(41,40,39,0.4)'; }}
                                        title="Mark as complete (Parent-led session)"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Submission Details Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 border border-parchment">
            <div className="flex items-center justify-between p-6 border-b border-parchment">
              <h2 style={{ fontSize: 17, fontWeight: 540, color: '#292827' }}>
                Block {selectedSubmission.block_index + 1} Details
              </h2>
              <button onClick={() => setSelectedSubmission(null)} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className={labelCls}>Subject</p>
                <p className="text-[15px] font-body text-charcoal-ink">{selectedSubmission.subject_name}</p>
              </div>

              <div>
                <p className={labelCls}>Completed</p>
                <p className="text-[14px] font-body text-charcoal-ink/60">
                  {selectedSubmission.timestamp?.toDate?.()
                    ? new Date(selectedSubmission.timestamp.toDate()).toLocaleString()
                    : 'Unknown time'}
                </p>
              </div>

              {selectedSubmission.summary_text && (
                <div>
                  <p className={labelCls}>Student Summary</p>
                  <div className="bg-warm-cream rounded-xl p-4">
                    <p className="text-[14px] font-body text-charcoal-ink whitespace-pre-wrap">
                      {selectedSubmission.summary_text}
                    </p>
                  </div>
                </div>
              )}

              {selectedSubmission.custom_field_responses && Object.keys(selectedSubmission.custom_field_responses).length > 0 && (
                <div>
                  <p className={labelCls}>Custom Details</p>
                  <div className="bg-[#f0eaff]/50 rounded-xl p-4 border border-lavender-glow/40">
                    <div className="space-y-2">
                      {Object.entries(selectedSubmission.custom_field_responses).map(([fieldId, value]) => (
                        <div key={fieldId}>
                          <span className="text-[11px] font-label uppercase tracking-wider text-amethyst-link/70">
                            {getCustomFieldLabel(fieldId, selectedSubmission.subject_id)}
                          </span>
                          <p className="text-[14px] font-body text-charcoal-ink mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedSubmission.resources_used && selectedSubmission.resources_used.length > 0 && (
                <div>
                  <p className={labelCls}>Resources Used</p>
                  <div className="space-y-1">
                    {selectedSubmission.resources_used.map((resourceIndex, index) => {
                      const subject = subjects.find(s => s.id === selectedSubmission.subject_id);
                      const resource = subject?.resources?.[resourceIndex];
                      return resource ? (
                        <p key={index} className="text-[14px] font-body text-charcoal-ink/60">• {resource.name}</p>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg transition-colors"
                  style={{ backgroundColor: C.cream, color: C.charcoal, fontSize: 14, fontWeight: 700 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}
                >
                  Close
                </button>
                <button
                  onClick={() => handleResetBlock(selectedSubmission.id)}
                  className="flex-1 px-4 py-2.5 text-white bg-red-500 hover:bg-red-600 rounded-lg font-label text-[14px] transition-colors"
                >
                  Reset Block
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Complete Modal */}
      {showManualConfirm && manualCompleteBlock && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 border border-parchment">
            <div className="flex items-center justify-between p-6 border-b border-parchment">
              <h2 style={{ fontSize: 17, fontWeight: 540, color: '#292827' }}>
                Mark Block {manualCompleteBlock.blockIndex + 1} Complete
              </h2>
              <button onClick={cancelManualComplete} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[14px] font-body text-charcoal-ink">
                  <span style={{ fontWeight: 540 }}>{manualCompleteBlock.subject.title}</span> — Block {manualCompleteBlock.blockIndex + 1}
                </p>
                <p className="text-[12px] font-body text-charcoal-ink/40 mt-0.5">
                  Parent-led completion (no timer required)
                </p>
              </div>

              <div>
                <label className={labelCls}>Quick Note <span className="normal-case font-body">(optional)</span></label>
                <textarea
                  value={parentNote}
                  onChange={(e) => setParentNote(e.target.value)}
                  placeholder="e.g., Parent-led session, Reviewed material together, etc."
                  className="w-full px-3 py-2.5 rounded-lg focus:outline-none text-[14px] resize-none transition-colors"
                  style={{ border: '1px solid #dcd7d3', color: '#292827', fontWeight: 460 }}
                  onFocus={e => e.target.style.borderColor = '#292827'}
                  onBlur={e => e.target.style.borderColor = '#dcd7d3'}
                  rows={3}
                />
              </div>

              <p className="text-[13px] font-body text-charcoal-ink/50">
                This will create a submission marked as "parent_completed" and bypass the timer requirement.
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={cancelManualComplete}
                  className="flex-1 px-4 py-2.5 rounded-lg transition-colors"
                  style={{ backgroundColor: C.cream, color: C.charcoal, fontSize: 14, fontWeight: 700 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmManualComplete}
                  className="flex-1 px-4 py-2.5 rounded-lg transition-colors"
                  style={{ backgroundColor: C.charcoal, color: '#fff', fontSize: 14, fontWeight: 700 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}
                >
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ParentDashboard;
