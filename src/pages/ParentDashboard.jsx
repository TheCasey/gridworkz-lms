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
  getDoc,
  updateDoc,
  deleteDoc,
  limit,
  addDoc,
  serverTimestamp,
  writeBatch
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
  Eye,
  Trash2,
  Edit,
  X,
  CheckCircle,
  Sun,
  Moon
} from 'lucide-react';
import StudentCard from '../components/StudentCard';
import AddStudentModal from '../components/AddStudentModal';
import DebugInfo from '../components/DebugInfo';
import Curriculum from './Curriculum';
import Reports from './Reports';
import { useTheme } from '../contexts/ThemeContext';
import { testFirebaseConnection, checkEnvironment } from '../utils/firebaseTest';

const ParentDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [viewingSummary, setViewingSummary] = useState(null);
  const [finalizingWeek, setFinalizingWeek] = useState(false);
  
  const db = getFirestore(app);

  // Test Firebase connection on mount
  useEffect(() => {
    checkEnvironment();
    testFirebaseConnection();
  }, []);

  useEffect(() => {
    // Set initial loading state
    setLoading(true);
    
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Query students
    const studentsQuery = query(
      collection(db, 'students'),
      where('parent_id', '==', currentUser.uid),
      orderBy('created_at', 'desc')
    );

    const studentsUnsubscribe = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentsData);
      console.log('Students fetched:', studentsData.length, 'items');
    }, (error) => {
      console.error('Error fetching students:', error);
      console.error('Firebase Error Details:', error.code, error.message);
    });

    // Fetch subjects for weekly progress
    const subjectsQuery = query(
      collection(db, 'subjects'),
      where('parent_id', '==', currentUser.uid),
      where('is_active', '==', true),
      orderBy('title')
    );

    const subjectsUnsubscribe = onSnapshot(subjectsQuery, (snapshot) => {
      const subjectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubjects(subjectsData);
    }, (error) => {
      console.error('Error fetching subjects:', error);
    });

    // Query submissions for Live Pulse
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('parent_id', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const submissionsUnsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
      const submissionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubmissions(submissionsData);
      console.log('Submissions fetched:', submissionsData.length, 'items');
      setLoading(false);
    }, (error) => {
      console.error('Error fetching submissions:', error);
      console.error('Firebase Error Details:', error.code, error.message);
      setLoading(false);
    });

    // Set loading to false after a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

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
      // Generate unique slug
      const baseSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const slug = `${baseSlug}-${nanoid(6)}`;
      
      console.log('=== STUDENT CREATION DEBUG ===');
      console.log('Current user:', currentUser);
      console.log('User UID:', currentUser?.uid);
      console.log('Adding student:', { name, slug, accessPin, parentId: currentUser.uid });
      console.log('Database instance:', db);
      
      const studentDoc = {
        name: name.trim(),
        slug: slug,
        access_pin: accessPin || null,
        parent_id: currentUser.uid,
        is_active: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      console.log('Student document to be created:', studentDoc);

      const docRef = await addDoc(collection(db, 'students'), studentDoc);
      console.log('Student added successfully with ID:', docRef.id);
      console.log('Student slug:', slug);
      console.log('Document path:', docRef.path);

      // Verify the document was created by trying to read it back
      const createdDoc = await getDoc(docRef);
      console.log('Verification - document exists:', createdDoc.exists());
      console.log('Verification - document data:', createdDoc.data());

      setModalOpen(false);
    } catch (error) {
      console.error('=== STUDENT CREATION ERROR ===');
      console.error('Error adding student:', error);
      console.error('Firebase Error Details:', error.code, error.message);
      console.error('Error stack:', error.stack);
      
      // Check for permissions error
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

  const handleLogout = async () => {
    const result = await logout();
    if (!result.success) {
      console.error('Logout failed:', result.error);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (window.confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'students', studentId));
        console.log('Student deleted successfully');
      } catch (error) {
        console.error('Error deleting student:', error);
        alert('Failed to delete student. Please try again.');
      }
    }
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
            const weeklyGoal = subjects
              .filter(s => s.student_id === student.id)
              .reduce((sum, subject) => sum + (subject.block_count || 10), 0);
            
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

  // Helper function to get weekly progress
  const getWeeklyProgress = (studentId, subjectId) => {
    // Get current week's start (Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    
    const weeklySubmissions = submissions.filter(s => 
      s.student_id === studentId && 
      s.subject_id === subjectId && 
      s.timestamp && 
      s.timestamp.toDate() >= weekStart
    );
    
    const subject = subjects.find(sub => sub.id === subjectId);
    const totalBlocks = subject?.block_count || 10;
    const completedBlocks = weeklySubmissions.length;
    
    return {
      completed: completedBlocks,
      total: totalBlocks,
      percentage: Math.round((completedBlocks / totalBlocks) * 100)
    };
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'curriculum', label: 'Curriculum', icon: BookOpen },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  // Helper function to format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    
    const now = new Date();
    const submissionTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = now - submissionTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex h-screen">
        {/* Left Column - Navigation Sidebar */}
        <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">GridWorkz</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Parent Portal</p>
          </div>

          <nav className="flex-1 p-4">
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeNav === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">
              <Heart className="w-4 h-4" />
              Support Project
            </button>
          </div>
        </div>

        {/* Middle Column - Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {activeNav === 'dashboard' ? 'Students' : 
                   activeNav === 'curriculum' ? 'Curriculum' : 
                   activeNav === 'reports' ? 'Reports' : ''}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {activeNav === 'dashboard' ? 'Manage your student accounts and access' : 
                   activeNav === 'curriculum' ? 'Manage subjects and learning resources for your students' : 
                   activeNav === 'reports' ? 'View weekly reports and student progress' : ''}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {activeNav === 'dashboard' && (
                  <button
                    onClick={() => setModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Student
                  </button>
                )}
                {(activeNav === 'dashboard' || activeNav === 'reports') && (
                  <button
                    onClick={handleFinalizeWeek}
                    disabled={finalizingWeek}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {finalizingWeek ? 'Processing Reports...' : 'Finalize Week'}
                  </button>
                )}
                
                {/* Debug button for testing */}
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={() => {
                      console.log('Manual debug triggered');
                      checkEnvironment();
                      testFirebaseConnection();
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    Test Firebase
                  </button>
                )}
                
                {/* Theme Toggle Button */}
                <button
                  onClick={toggleTheme}
                  className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition-colors"
                  title="Toggle theme"
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{currentUser?.email}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
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
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No students yet</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">Add your first student to get started with GridWorkz</p>
                    <button
                      onClick={() => setModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Your First Student
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {students.map((student) => (
                      <StudentCard key={student.id} student={student} onDelete={handleDeleteStudent} />
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

        {/* Right Column - Live Pulse */}
        <div className="w-80 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Live Pulse</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time activity feed</p>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-4">
              {submissions.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No submissions yet</p>
                  <p className="text-xs text-slate-400 mt-1">Student activity will appear here</p>
                </div>
              ) : (
                <>
                  {/* Weekly Progress Summary */}
                  <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <h4 className="text-sm font-semibold text-indigo-900 mb-3">Weekly Progress</h4>
                    <div className="space-y-2">
                      {students.map(student => {
                        const studentSubjects = subjects.filter(s => s.student_id === student.id);
                        if (studentSubjects.length === 0) return null;
                        
                        const totalWeeklyBlocks = studentSubjects.reduce((sum, subject) => sum + (subject.block_count || 10), 0);
                        const completedWeeklyBlocks = studentSubjects.reduce((sum, subject) => {
                          const progress = getWeeklyProgress(student.id, subject.id);
                          return sum + progress.completed;
                        }, 0);
                        const weeklyPercentage = totalWeeklyBlocks > 0 ? Math.round((completedWeeklyBlocks / totalWeeklyBlocks) * 100) : 0;
                        
                        return (
                          <div key={student.id} className="flex items-center justify-between">
                            <span className="text-sm font-medium text-indigo-700">{student.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-indigo-600">
                                {completedWeeklyBlocks}/{totalWeeklyBlocks} blocks
                              </span>
                              <span className="text-sm font-semibold text-indigo-800">
                                ({weeklyPercentage}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Recent Activity</h4>
                    {submissions.slice(0, 5).map((submission) => (
                      <div key={submission.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="w-2 h-2 rounded-full mt-2 bg-green-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900">
                            <span className="font-medium">{students.find(s => s.id === submission.student_id)?.name || 'Unknown Student'}</span> completed{' '}
                            <span className="font-medium text-indigo-600">{submission.subject_name}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(submission.timestamp)}
                          </p>
                          {submission.summary_text && (
                            <button 
                              onClick={() => setViewingSummary(submission)}
                              className="mt-2 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                            >
                              <Eye className="w-3 h-3" />
                              View Summary
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddStudentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAddStudent={handleAddStudent}
        loading={addingStudent}
      />
      
      <DebugInfo 
        students={students}
        submissions={submissions}
        loading={loading}
      />

      {/* Summary Modal */}
      {viewingSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">
                {viewingSummary.subject_name} Summary
              </h2>
              <button
                onClick={() => setViewingSummary(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">{students.find(s => s.id === viewingSummary.student_id)?.name || 'Unknown Student'}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatTimestamp(viewingSummary.timestamp)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {viewingSummary.summary_text}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;
