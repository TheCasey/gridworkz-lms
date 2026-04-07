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
  getDocs,
  updateDoc,
  deleteDoc,
  limit,
  addDoc,
  serverTimestamp,
  writeBatch,
  setDoc,
  deleteField
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
  Moon,
  Info
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
  const [viewingStudentProgress, setViewingStudentProgress] = useState(null);
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
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

    // Fetch subjects for weekly progress (support both old and new schema)
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

    // Query submissions for Live Pulse and Progress - get ALL current week submissions like Student Portal
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('parent_id', '==', currentUser.uid),
      where('timestamp', '>=', weekStart),
      orderBy('timestamp', 'desc')
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

  const handleViewStudentProgress = async (student) => {
    setViewingStudentProgress(student);
    
    // Fetch this student's submissions
    try {
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('student_id', '==', student.id),
        orderBy('timestamp', 'desc')
      );
      
      const unsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
        const submissionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStudentSubmissions(submissionsData);
      });
      
      // Store unsubscribe function for cleanup
      window.studentProgressUnsubscribe = unsubscribe;
    } catch (error) {
      console.error('Error fetching student submissions:', error);
    }
  };

  const handleCloseStudentProgress = () => {
    setViewingStudentProgress(null);
    setStudentSubmissions([]);
    setSelectedSubmission(null);
    
    // Cleanup subscription
    if (window.studentProgressUnsubscribe) {
      window.studentProgressUnsubscribe();
      window.studentProgressUnsubscribe = null;
    }
  };

  const handleResetBlock = async (submissionId) => {
    if (!window.confirm('Are you sure you want to reset this block? This will delete the submission and the student will need to redo it.')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'submissions', submissionId));
      
      // Also update the student's progress count
      if (viewingStudentProgress) {
        const progressRef = doc(db, 'subjects', selectedSubmission.subject_id, 'progress', viewingStudentProgress.id);
        const progressDoc = await getDoc(progressRef);
        
        if (progressDoc.exists()) {
          const currentCount = progressDoc.data().completed_blocks || 0;
          if (currentCount > 0) {
            await updateDoc(progressRef, {
              completed_blocks: currentCount - 1,
              updated_at: serverTimestamp()
            });
          }
        }
      }
      
      setSelectedSubmission(null);
      alert('Block reset successfully! The student can now redo this block.');
    } catch (error) {
      console.error('Error resetting block:', error);
      alert('Failed to reset block. Please try again.');
    }
  };

  const getStudentProgressForSubject = (subjectId) => {
    const subjectSubmissions = studentSubmissions.filter(s => s.subject_id === subjectId);
    return subjectSubmissions.map(s => s.block_index);
  };

  const isBlockCompletedForStudent = (subjectId, blockIndex) => {
    return getStudentProgressForSubject(subjectId).includes(blockIndex);
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
            const weeklyGoal = getStudentSubjects(student.id)
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

            // Reset student-specific progress in sub-collection
            const studentSubjects = getStudentSubjects(student.id);
            for (const subject of studentSubjects) {
              // Reset legacy completed_blocks field
              const subjectRef = doc(db, 'subjects', subject.id);
              batch.update(subjectRef, {
                completed_blocks: 0,
                updated_at: serverTimestamp()
              });
              
              // Reset student-specific progress only if it exists
              const progressRef = doc(db, 'subjects', subject.id, 'progress', student.id);
              const progressDoc = await getDoc(progressRef);
              
              if (progressDoc.exists()) {
                batch.update(progressRef, {
                  completed_blocks: 0,
                  updated_at: serverTimestamp()
                });
              }
              // If no progress document exists, we don't need to create one for reset
            }

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

  const handleCleanupDeprecatedFields = async () => {
    if (!window.confirm('This will remove deprecated completed_blocks fields from all subjects. This prevents confusion and ensures only per-student tracking is used. Continue?')) {
      return;
    }

    try {
      console.log('Starting cleanup of deprecated fields...');
      
      // Get all subjects for this parent
      const subjectsQuery = query(
        collection(db, 'subjects'),
        where('parent_id', '==', currentUser.uid)
      );
      
      const subjectsSnapshot = await getDocs(subjectsQuery);
      const subjectsData = subjectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`Found ${subjectsData.length} subjects to clean up`);

      const batch = writeBatch(db);
      let cleanedCount = 0;

      for (const subject of subjectsData) {
        const subjectRef = doc(db, 'subjects', subject.id);
        const updates = {};

        // Remove deprecated completed_blocks field if it exists
        if (subject.completed_blocks !== undefined) {
          updates.completed_blocks = deleteField();
          console.log(`Removing completed_blocks field from subject: ${subject.title}`);
          cleanedCount++;
        }

        // Only update if there are changes
        if (Object.keys(updates).length > 0) {
          updates.updated_at = serverTimestamp();
          batch.update(subjectRef, updates);
        }
      }

      if (cleanedCount > 0) {
        await batch.commit();
        console.log(`Successfully cleaned up ${cleanedCount} subjects`);
        alert(`Cleanup completed! Removed deprecated fields from ${cleanedCount} subjects.`);
      } else {
        console.log('No deprecated fields found to clean up');
        alert('No deprecated fields found to clean up.');
      }

    } catch (error) {
      console.error('Cleanup failed:', error);
      alert(`Cleanup failed: ${error.message}`);
    }
  };

  const handleMigrationScript = async () => {
    if (!window.confirm('This will migrate all subjects to the new schema format. This action cannot be undone. Continue?')) {
      return;
    }

    try {
      console.log('Starting migration script...');
      
      // Get all subjects for this parent
      const subjectsQuery = query(
        collection(db, 'subjects'),
        where('parent_id', '==', currentUser.uid)
      );
      
      const subjectsSnapshot = await getDocs(subjectsQuery);
      const subjectsData = subjectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`Found ${subjectsData.length} subjects to migrate`);

      const batch = writeBatch(db);
      let migratedCount = 0;

      for (const subject of subjectsData) {
        const subjectRef = doc(db, 'subjects', subject.id);
        const updates = {};

        // Migrate student_id to student_ids array if needed
        if (subject.student_id && !subject.student_ids) {
          updates.student_ids = [subject.student_id];
          console.log(`Migrating student_id to student_ids for subject: ${subject.title}`);
        }

        // Add completed_blocks: 0 if missing
        if (subject.completed_blocks === undefined || subject.completed_blocks === null) {
          updates.completed_blocks = 0;
          console.log(`Adding completed_blocks: 0 for subject: ${subject.title}`);
        }

        // Ensure is_active: true if missing
        if (subject.is_active === undefined || subject.is_active === null) {
          updates.is_active = true;
          console.log(`Adding is_active: true for subject: ${subject.title}`);
        }

        // Remove deprecated fields
        if (subject.student_name !== undefined) {
          updates.student_name = deleteField();
          console.log(`Removing student_name field for subject: ${subject.title}`);
        }

        if (subject.student_names !== undefined) {
          updates.student_names = deleteField();
          console.log(`Removing student_names field for subject: ${subject.title}`);
        }

        // Only update if there are changes
        if (Object.keys(updates).length > 0) {
          updates.updated_at = serverTimestamp();
          batch.update(subjectRef, updates);
          migratedCount++;
        }
      }

      if (migratedCount > 0) {
        await batch.commit();
        console.log(`Successfully migrated ${migratedCount} subjects`);
        alert(`Migration completed! ${migratedCount} subjects have been updated to the new schema.`);
      } else {
        console.log('No subjects needed migration');
        alert('All subjects are already using the new schema format.');
      }

    } catch (error) {
      console.error('Migration failed:', error);
      alert(`Migration failed: ${error.message}`);
    }
  };

  // Helper function to get weekly progress - matching Student Portal logic
  const getWeeklyProgress = (studentId, subjectId) => {
    // Get current week's start (Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    
    // Query submissions for this student and subject in current week
    const subjectSubmissions = submissions.filter(s => 
      s.student_id === studentId && 
      s.subject_id === subjectId && 
      s.timestamp && 
      s.timestamp.toDate() >= weekStart &&
      s.block_index !== undefined
    );
    
    // Get unique block indices (matching Student Portal logic)
    const blockIndices = subjectSubmissions.map(s => s.block_index).filter(index => index !== undefined);
    const uniqueBlockIndices = [...new Set(blockIndices)]; // Count unique blocks only
    
    const subject = subjects.find(sub => sub.id === subjectId);
    const totalBlocks = subject?.block_count || 10;
    const completedBlocks = uniqueBlockIndices.length;
    
    return {
      completed: completedBlocks,
      total: totalBlocks,
      percentage: Math.round((completedBlocks / totalBlocks) * 100)
    };
  };

  // Real-time weekly progress calculation using onSnapshot listener - matching Student Portal logic
  const getRealTimeWeeklyProgress = (studentId) => {
    const studentSubjects = getStudentSubjects(studentId);
    
    if (studentSubjects.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }
    
    // Get current week's start (Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    
    // Calculate completed blocks by subject (matching Student Portal logic)
    const completedBlocksBySubject = {};
    
    studentSubjects.forEach(subject => {
      const subjectSubmissions = submissions.filter(s => 
        s.student_id === studentId && 
        s.subject_id === subject.id && 
        s.timestamp && 
        s.timestamp.toDate() >= weekStart &&
        s.block_index !== undefined
      );
      
      // Get unique block indices for this subject (matching Student Portal exactly)
      const blockIndices = subjectSubmissions.map(s => s.block_index).filter(index => index !== undefined);
      completedBlocksBySubject[subject.id] = [...new Set(blockIndices)]; // Count unique blocks only
    });
    
    const totalBlocks = studentSubjects.reduce((sum, subject) => sum + (subject.block_count || 10), 0);
    const completedBlocks = Object.values(completedBlocksBySubject).reduce((sum, blocks) => sum + blocks.length, 0);
    
    return {
      completed: completedBlocks,
      total: totalBlocks,
      percentage: totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0
    };
  };

  // Get current week's submissions for consistency
  const getCurrentWeekSubmissions = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    
    return submissions.filter(s => 
      s.timestamp && 
      s.timestamp.toDate() >= weekStart
    );
  };

  // Helper function to get subjects for a specific student (supporting shared subjects)
  const getStudentSubjects = (studentId) => {
    return subjects.filter(subject => {
      // New schema: student_ids array
      if (subject.student_ids && Array.isArray(subject.student_ids)) {
        return subject.student_ids.includes(studentId);
      }
      // Old schema: single student_id
      return subject.student_id === studentId;
    });
  };

  // Helper function to map custom field IDs to labels
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
                  <>
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
                    <button
                      onClick={handleMigrationScript}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors text-sm"
                    >
                      Migrate Schema
                    </button>
                    <button
                      onClick={handleCleanupDeprecatedFields}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors text-sm"
                    >
                      Cleanup Fields
                    </button>
                  </>
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
                        const progress = getRealTimeWeeklyProgress(student.id);
                        if (progress.total === 0) return null;
                        
                        return (
                          <div key={student.id} className="flex items-center justify-between">
                            <span className="text-sm font-medium text-indigo-700">{student.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-indigo-600">
                                {progress.completed}/{progress.total} blocks
                              </span>
                              <span className="text-sm font-semibold text-indigo-800">
                                ({progress.percentage}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent Activity - Current Week */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Recent Activity (This Week)</h4>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {(() => {
                        const currentWeekSubmissions = getCurrentWeekSubmissions();
                        
                        if (currentWeekSubmissions.length === 0) {
                          return (
                            <div className="text-center py-4">
                              <p className="text-sm text-slate-500">No submissions this week</p>
                            </div>
                          );
                        }
                        
                        return currentWeekSubmissions.map((submission) => {
                          // Debug: Log submission structure to see if customFields exists
                          if (submission.subject_name && submission.subject_name.includes('Math')) {
                            console.log('=== MATH SUBMISSION DEBUG ===');
                            console.log('Full submission object:', submission);
                            console.log('Custom field responses:', submission.custom_field_responses);
                            console.log('All keys:', Object.keys(submission));
                          }
                          
                          return (
                            <div 
                            key={submission.id} 
                            className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                            onClick={() => setViewingSummary(submission)}
                          >
                            <div className="w-2 h-2 rounded-full mt-2 bg-green-500" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-slate-900">
                                  <span className="font-medium">{students.find(s => s.id === submission.student_id)?.name || 'Unknown Student'}</span> completed{' '}
                                  <span className="font-medium text-indigo-600">{submission.subject_name}</span>
                                </p>
                                {submission.custom_field_responses && Object.keys(submission.custom_field_responses).length > 0 && (
                                  <div className="flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                                    <Info className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Extra Details</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimestamp(submission.timestamp)}
                              </p>
                              {submission.summary_text && (
                                <div className="mt-2 text-xs text-indigo-600">
                                  Click to view summary
                                </div>
                              )}
                            </div>
                          </div>
                          );
                        });
                      })()}
                    </div>
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
              {/* Debug: Log the viewingSummary structure */}
              {(() => {
                console.log('=== SUMMARY MODAL DEBUG ===');
                console.log('Viewing summary:', viewingSummary);
                console.log('Custom field responses:', viewingSummary.custom_field_responses);
                console.log('All keys:', Object.keys(viewingSummary));
                return null;
              })()}
              
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
              
              {/* Custom Details Section */}
              {viewingSummary.custom_field_responses && Object.keys(viewingSummary.custom_field_responses).length > 0 && (
                <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-3">Custom Details</h4>
                  <div className="space-y-2">
                    {Object.entries(viewingSummary.custom_field_responses).map(([fieldId, value]) => (
                      <div key={fieldId} className="flex flex-col">
                        <span className="font-medium text-xs text-indigo-700 dark:text-indigo-400">
                          {getCustomFieldLabel(fieldId, viewingSummary.subject_id)}:
                        </span>
                        <p className="text-sm text-indigo-900 dark:text-indigo-200">{value}</p>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {viewingStudentProgress.name}'s Progress
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  View and manage individual student progress
                </p>
              </div>
              <button
                onClick={handleCloseStudentProgress}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-auto max-h-[70vh]">
              {(() => {
                const studentSubjects = subjects.filter(subject => {
                  // New schema: student_ids array
                  if (subject.student_ids && Array.isArray(subject.student_ids)) {
                    return subject.student_ids.includes(viewingStudentProgress.id);
                  }
                  // Old schema: single student_id
                  return subject.student_id === viewingStudentProgress.id;
                });

                if (studentSubjects.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No subjects assigned</h3>
                      <p className="text-slate-500 dark:text-slate-400">This student hasn't been assigned any subjects yet.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {studentSubjects.map((subject) => {
                      const completedBlocks = getStudentProgressForSubject(subject.id);
                      const totalBlocks = subject.block_count || 10;
                      const progressPercentage = Math.round((completedBlocks.length / totalBlocks) * 100);

                      return (
                        <div key={subject.id} className="bg-white dark:bg-slate-700 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-600 p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div 
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: subject.color || '#3B82F6' }}
                                />
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                  {subject.title}
                                </h3>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                                <span>Progress: {completedBlocks.length}/{totalBlocks} blocks</span>
                                <span className="font-medium text-indigo-600 dark:text-indigo-400">{progressPercentage}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-3 overflow-hidden mb-4">
                            <div 
                              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500 rounded-full transition-all duration-500"
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>

                          {/* Blocks Grid */}
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Weekly Blocks</p>
                            <div className="flex gap-2 flex-wrap">
                              {Array.from({ length: totalBlocks }, (_, index) => {
                                const isCompleted = isBlockCompletedForStudent(subject.id, index);
                                const submission = studentSubmissions.find(s => 
                                  s.subject_id === subject.id && s.block_index === index
                                );
                                
                                return (
                                  <button
                                    key={index}
                                    onClick={() => isCompleted && setSelectedSubmission(submission)}
                                    disabled={!isCompleted}
                                    className={`w-12 h-12 rounded-lg border-2 font-medium text-sm transition-all ${
                                      isCompleted
                                        ? 'bg-green-100 border-green-300 text-green-700 cursor-pointer hover:bg-green-200'
                                        : 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                                    }`}
                                    title={isCompleted ? 'Click to view details' : 'Not completed'}
                                  >
                                    {isCompleted ? '✓' : index + 1}
                                  </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Block {selectedSubmission.block_index + 1} Details
              </h2>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</h3>
                <p className="text-slate-900 dark:text-white">{selectedSubmission.subject_name}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Completed</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {selectedSubmission.timestamp?.toDate?.() ? 
                    new Date(selectedSubmission.timestamp.toDate()).toLocaleString() : 
                    'Unknown time'
                  }
                </p>
              </div>

              {selectedSubmission.summary_text && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Student Summary</h3>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {selectedSubmission.summary_text}
                    </p>
                  </div>
                </div>
              )}

              {/* Custom Details Section */}
              {selectedSubmission.custom_field_responses && Object.keys(selectedSubmission.custom_field_responses).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Custom Details</h3>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                    <div className="space-y-2">
                      {Object.entries(selectedSubmission.custom_field_responses).map(([fieldId, value]) => (
                        <div key={fieldId} className="flex flex-col">
                          <span className="font-medium text-xs text-indigo-700 dark:text-indigo-400">
                            {getCustomFieldLabel(fieldId, selectedSubmission.subject_id)}:
                          </span>
                          <p className="text-sm text-indigo-900 dark:text-indigo-200">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedSubmission.resources_used && selectedSubmission.resources_used.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Resources Used</h3>
                  <div className="space-y-1">
                    {selectedSubmission.resources_used.map((resourceIndex, index) => {
                      const subject = subjects.find(s => s.id === selectedSubmission.subject_id);
                      const resource = subject?.resources?.[resourceIndex];
                      return resource ? (
                        <div key={index} className="text-sm text-slate-600 dark:text-slate-400">
                          • {resource.name}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => handleResetBlock(selectedSubmission.id)}
                  className="flex-1 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                >
                  Reset Block
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
