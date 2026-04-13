import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  limit,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { Check, Clock, BookOpen, Lock, X, ExternalLink, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getCurrentWeekRange, isTimestampInWeek } from '../utils/weekUtils';

const StudentPortal = () => {
  const { slug } = useParams();
  const { isDark, toggleTheme } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [student, setStudent] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(null);
  const [summaryText, setSummaryText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completedBlocks, setCompletedBlocks] = useState({}); // { subjectId: [blockIndices] }
  const [viewingSummary, setViewingSummary] = useState(null); // For viewing submission summary
  const [selectedResources, setSelectedResources] = useState([]);
  const [activeTimers, setActiveTimers] = useState({}); // { subjectId: { timeLeft, isRunning, totalSeconds, workingOnBlockIndex } }
  const [notificationSound, setNotificationSound] = useState(null);
  const [customFieldResponses, setCustomFieldResponses] = useState({}); // { fieldId: value } // For resource attribution
  
  const db = getFirestore(app);

  useEffect(() => {
    if (!slug) return;

    console.log('StudentPortal: Looking for slug:', slug);

    // Get student info by slug
    const studentQuery = query(
      collection(db, 'students'),
      where('slug', '==', slug),
      limit(1)
    );

    console.log('StudentPortal: Created query for student lookup');

    const unsubscribeStudent = onSnapshot(studentQuery, (snapshot) => {
      console.log('StudentPortal: Query snapshot received, empty:', snapshot.empty);
      console.log('StudentPortal: Snapshot docs count:', snapshot.docs.length);
      
      if (snapshot.empty) {
        console.error('StudentPortal: No student found with slug:', slug);
        setError('Student not found');
        setLoading(false);
        return;
      }

      const studentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      console.log('StudentPortal: Found student:', studentData);
      setStudent(studentData);

      // Get subjects for this specific student (support both old and new schema)
      const subjectsQuery = query(
        collection(db, 'subjects'),
        where('parent_id', '==', studentData.parent_id),
        where('is_active', '==', true),
        where('student_ids', 'array-contains', studentData.id),
        orderBy('title')
      );

      const unsubscribeSubjects = onSnapshot(subjectsQuery, (snapshot) => {
        const subjectsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        if (subjectsData.length === 0) {
          // Try old schema for backward compatibility
          const oldSubjectsQuery = query(
            collection(db, 'subjects'),
            where('parent_id', '==', studentData.parent_id),
            where('student_id', '==', studentData.id),
            where('is_active', '==', true),
            orderBy('title')
          );

          const unsubscribeOldSubjects = onSnapshot(oldSubjectsQuery, (oldSnapshot) => {
            const oldSubjectsData = oldSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setSubjects(oldSubjectsData);
            setLoading(false);
          }, (error) => {
            console.error('Error fetching old schema subjects:', error);
            setLoading(false);
          });
          
          // Store the old unsubscribe function to be called later
          window.tempOldUnsubscribe = unsubscribeOldSubjects;
        } else {
          setSubjects(subjectsData);
          setLoading(false);
        }
      }, (error) => {
        console.error('Error fetching subjects:', error);
        setLoading(false);
      });

      // Get current week's submissions for this student
      const { weekStart } = getCurrentWeekRange();
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('student_id', '==', studentData.id),
        where('timestamp', '>=', weekStart),
        orderBy('timestamp', 'desc')
      );

      const unsubscribeSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
        const submissionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSubmissions(submissionsData);
      }, (error) => {
        console.error('Error fetching submissions:', error);
      });

      return () => {
        unsubscribeSubjects();
        unsubscribeSubmissions();
        if (window.tempOldUnsubscribe) {
          window.tempOldUnsubscribe();
          window.tempOldUnsubscribe = null;
        }
      };
    }, (error) => {
      console.error('StudentPortal: Error fetching student:', error);
      console.error('StudentPortal: Error code:', error.code);
      console.error('StudentPortal: Error message:', error.message);
      setError('Student not found');
      setLoading(false);
    });

    return unsubscribeStudent;
  }, [slug, db]);

  // Load completed blocks from submissions using calendar-based week logic
  useEffect(() => {
    if (!student || subjects.length === 0) return;

    // Get current week's start (Monday 00:00 to Sunday 23:59)
    const { weekStart } = getCurrentWeekRange();
    const completedBlocksData = {};

    const unsubscribers = subjects.map(subject => {
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('student_id', '==', student.id),
        where('subject_id', '==', subject.id),
        where('timestamp', '>=', weekStart),
        orderBy('timestamp', 'desc')
      );

      return onSnapshot(submissionsQuery, (snapshot) => {
        const blockIndices = snapshot.docs.map(doc => {
          const data = doc.data();
          return data.block_index;
        }).filter(index => index !== undefined);

        completedBlocksData[subject.id] = blockIndices;
        setCompletedBlocks(prev => ({ ...prev, ...completedBlocksData }));
      });
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [student, subjects, db]);

  // Timer countdown effect
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTimers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(subjectId => {
          if (updated[subjectId].isRunning && updated[subjectId].timeLeft > 0) {
            updated[subjectId] = {
              ...updated[subjectId],
              timeLeft: updated[subjectId].timeLeft - 1
            };
            // Save updated state to localStorage
            saveTimerToStorage(subjectId, updated[subjectId]);
          } else if (updated[subjectId].isRunning && updated[subjectId].timeLeft === 0) {
            // Timer completed
            updated[subjectId] = { ...updated[subjectId], isRunning: false };
            saveTimerToStorage(subjectId, updated[subjectId]);
            handleTimerComplete(subjectId);
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Load timers from localStorage on component mount and when subjects change
  useEffect(() => {
    if (!student || !subjects.length) return;
    
    const loadedTimers = {};
    
    subjects.forEach(subject => {
      const storedTimer = loadTimerFromStorage(subject.id);
      if (storedTimer) {
        // Only load if it's for the same block index that's still available
        const nextAvailableBlock = getNextAvailableBlock(subject);
        if (storedTimer.workingOnBlockIndex === nextAvailableBlock) {
          loadedTimers[subject.id] = storedTimer;
        } else {
          // Clear outdated timer
          clearTimerFromStorage(subject.id);
        }
      }
    });
    
    if (Object.keys(loadedTimers).length > 0) {
      setActiveTimers(loadedTimers);
    }
  }, [student, subjects, completedBlocks]);

  // Initialize notification sound
  useEffect(() => {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    setNotificationSound({ audioContext });
    
    return () => {
      if (audioContext) audioContext.close();
    };
  }, []);

  const playNotificationSound = () => {
    if (notificationSound) {
      const { audioContext } = notificationSound;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
    }
  };

  const handleTimerComplete = (subjectId) => {
    const subject = subjects.find(s => s.id === subjectId);
    
    if (!subject) {
      console.error('Subject not found for timer completion:', subjectId);
      return;
    }
    
    // Play completion sound once with error handling
    try {
      playNotificationSound();
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
    
    // Timer is now completed, update state to show Complete Block button
    // The timer state is already set to isRunning: false in the countdown effect
    // No automatic modal popup - user must click Complete Block button
  };

  const getNextAvailableBlock = (subject) => {
    if (!subject) return null;
    const totalBlocks = subject?.block_count || 10;
    const completed = completedBlocks[subject.id] || [];
    
    for (let i = 0; i < totalBlocks; i++) {
      if (!completed.includes(i)) {
        return i;
      }
    }
    return null; // All blocks completed
  };

  const startTimer = (subject) => {
    if (!subject) {
      console.error('Invalid subject provided to startTimer');
      return;
    }
    
    const nextAvailableBlock = getNextAvailableBlock(subject);
    
    if (nextAvailableBlock === null) {
      alert('Subject Complete! All blocks for this subject are already finished.');
      return;
    }
    
    // Try to load existing timer from localStorage first
    const storedTimer = loadTimerFromStorage(subject.id);
    let timerData;
    
    if (storedTimer && storedTimer.workingOnBlockIndex === nextAvailableBlock) {
      // Resume existing timer
      timerData = {
        timeLeft: storedTimer.timeLeft,
        isRunning: true,
        totalSeconds: storedTimer.totalSeconds,
        workingOnBlockIndex: storedTimer.workingOnBlockIndex,
        timestamp: Date.now()
      };
    } else {
      // Start new timer
      const totalSeconds = (subject?.block_length || 30) * 60;
      timerData = {
        timeLeft: totalSeconds,
        isRunning: true,
        totalSeconds,
        workingOnBlockIndex: nextAvailableBlock,
        timestamp: Date.now()
      };
    }
    
    setActiveTimers(prev => ({
      ...prev,
      [subject.id]: timerData
    }));
    
    saveTimerToStorage(subject.id, timerData);
  };

  const pauseTimer = (subject) => {
    const timerData = {
      ...activeTimers[subject.id],
      isRunning: false,
      timestamp: Date.now()
    };
    
    setActiveTimers(prev => ({
      ...prev,
      [subject.id]: timerData
    }));
    
    saveTimerToStorage(subject.id, timerData);
  };

  const resumeTimer = (subject) => {
    const timerData = {
      ...activeTimers[subject.id],
      isRunning: true,
      timestamp: Date.now()
    };
    
    setActiveTimers(prev => ({
      ...prev,
      [subject.id]: timerData
    }));
    
    saveTimerToStorage(subject.id, timerData);
  };

  const handleCompleteBlock = (subject) => {
    if (!subject) {
      console.error('Invalid subject provided to handleCompleteBlock');
      return;
    }
    
    const nextAvailableBlock = getNextAvailableBlock(subject);
    
    if (nextAvailableBlock === null) {
      alert('Subject Complete! All blocks for this subject are already finished.');
      return;
    }
    
    // Open submission modal for the next available block
    handleBlockClick(subject, nextAvailableBlock);
  };

  const resetTimer = (subject) => {
    setActiveTimers(prev => {
      const updated = { ...prev };
      delete updated[subject.id];
      return updated;
    });
    
    clearTimerFromStorage(subject.id);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // localStorage helpers for timer persistence
  const saveTimerToStorage = (subjectId, timerData) => {
    try {
      const key = `timer_${student?.id}_${subjectId}`;
      localStorage.setItem(key, JSON.stringify(timerData));
    } catch (error) {
      console.error('Error saving timer to localStorage:', error);
    }
  };

  const loadTimerFromStorage = (subjectId) => {
    try {
      const key = `timer_${student?.id}_${subjectId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        // Check if the timer is still valid (not too old)
        const timestamp = data.timestamp;
        const now = Date.now();
        // If timer is older than 24 hours, discard it
        if (now - timestamp < 24 * 60 * 60 * 1000) {
          return data;
        }
      }
    } catch (error) {
      console.error('Error loading timer from localStorage:', error);
    }
    return null;
  };

  const clearTimerFromStorage = (subjectId) => {
    try {
      const key = `timer_${student?.id}_${subjectId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing timer from localStorage:', error);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (student && (!student.access_pin || pin === student.access_pin)) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid PIN. Please try again.');
    }
  };

  const handleCustomFieldResponse = (fieldId, value) => {
    setCustomFieldResponses(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const resetCustomFieldResponses = () => {
    setCustomFieldResponses({});
  };

  const handleBlockClick = (subject, blockIndex) => {
    if (!subject) {
      console.error('Invalid subject provided to handleBlockClick');
      return;
    }
    
    if (isBlockCompleted(subject, blockIndex)) return;
    
    // Check if all blocks are already completed
    const nextAvailableBlock = getNextAvailableBlock(subject);
    if (nextAvailableBlock === null) {
      alert('Subject Complete! All blocks for this subject are already finished.');
      return;
    }
    
    // Check if timer is required for this subject
    if (subject.require_timer) {
      // Check if there's an active timer that hasn't completed
      const timer = activeTimers[subject.id];
      if (!timer || timer.timeLeft > 0) {
        alert('This subject requires the timer to be completed before submitting blocks.');
        return;
      }
    }
    
    setSelectedSubject(subject);
    setSelectedBlockIndex(blockIndex);
    setSummaryText('');
    setSelectedResources([]); // Reset resource selection
    resetCustomFieldResponses(); // Reset custom field responses
  };

  const submitBlock = async (subject, blockIndex, summary) => {
    setSubmitting(true);
    
    try {
      // Check for ghost submission - prevent duplicate submissions for same block in current week
      const { weekStart } = getCurrentWeekRange();
      const existingSubmissionQuery = query(
        collection(db, 'submissions'),
        where('student_id', '==', student.id),
        where('subject_id', '==', subject.id),
        where('block_index', '==', blockIndex),
        where('timestamp', '>=', weekStart),
        limit(1)
      );
      
      const existingSnapshot = await getDocs(existingSubmissionQuery);
      if (!existingSnapshot.empty) {
        setError('This block has already been completed this week. Progress is calculated automatically based on weekly submissions.');
        setSubmitting(false);
        return;
      }

      // Create submission document
      await addDoc(collection(db, 'submissions'), {
        student_id: student.id,
        parent_id: student.parent_id,
        subject_name: subject.title,
        subject_id: subject.id,
        block_index: blockIndex,
        timestamp: serverTimestamp(),
        summary_text: subject.require_input !== false ? summary : null,
        block_duration: subject.block_length || 30,
        is_locked: true,
        resources_used: selectedResources,
        custom_field_responses: customFieldResponses,
        created_at: serverTimestamp()
      });

      // Progress is now calculated dynamically based on weekly submissions
      // No need to update completed_blocks field anymore

      // Reset timer for next session after successful submission
      const totalSeconds = (subject?.block_length || 30) * 60;
      const nextAvailableBlock = getNextAvailableBlock(subject);
      
      if (nextAvailableBlock !== null) {
        // Reset timer for the next block
        const timerData = {
          timeLeft: totalSeconds,
          isRunning: false,
          totalSeconds,
          workingOnBlockIndex: nextAvailableBlock,
          timestamp: Date.now()
        };
        
        setActiveTimers(prev => ({
          ...prev,
          [subject.id]: timerData
        }));
        
        saveTimerToStorage(subject.id, timerData);
      } else {
        // All blocks completed, clear timer
        setActiveTimers(prev => {
          const updated = { ...prev };
          delete updated[subject.id];
          return updated;
        });
        
        clearTimerFromStorage(subject.id);
      }

      setSelectedSubject(null);
      setSelectedBlockIndex(null);
      setSummaryText('');
      setSelectedResources([]);
      resetCustomFieldResponses();
    } catch (error) {
      console.error('Error submitting block:', error);
      setError('Failed to submit block. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isBlockCompleted = useMemo(() => (subject, blockIndex) => {
    return completedBlocks[subject.id]?.includes(blockIndex) || false;
  }, [completedBlocks]);

  const isSubjectLocked = useMemo(() => (subject) => {
    const totalBlocks = subject?.block_count || 4;
    const completedCount = completedBlocks[subject.id]?.length || 0;
    return completedCount >= totalBlocks;
  }, [completedBlocks]);

  const getSubjectProgress = useMemo(() => (subject) => {
    return completedBlocks[subject.id]?.length || 0;
  }, [completedBlocks]);

  const getWeeklyProgress = useMemo(() => () => {
    const totalBlocks = subjects.reduce((sum, subject) => sum + (subject?.block_count || 0), 0);
    const completedCount = subjects.reduce((sum, subject) => sum + (completedBlocks[subject.id]?.length || 0), 0);
    return totalBlocks > 0 ? (completedCount / totalBlocks) * 100 : 0;
  }, [subjects, completedBlocks]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Student Not Found</h2>
          <p className="text-slate-600">Please check your URL and try again.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && student.access_pin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
              Student Portal
            </h2>
            <p className="mt-2 text-center text-sm text-slate-600">
              Enter your PIN to access your learning dashboard
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handlePinSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-slate-700">
                Access PIN
              </label>
              <input
                id="pin"
                name="pin"
                type="password"
                maxLength="4"
                pattern="[0-9]{4}"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-slate-300 placeholder-slate-500 text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center text-2xl"
                placeholder="••••"
              />
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Enter Portal
              </button>
            </div>
          </form>

          <div className="text-center text-xs text-slate-500">
            <p>Student: {student.name}</p>
            <p className="mt-1">Ask your parent for your 4-digit PIN</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">My Learning</h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition-colors"
                title="Toggle theme"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-400">{student.name}</span>
              <button
                onClick={() => setIsAuthenticated(false)}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Weekly Progress Bar */}
          {subjects.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Overall Weekly Progress</h2>
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {Math.round(getWeeklyProgress())}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${getWeeklyProgress()}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {subjects.reduce((sum, subject) => sum + (completedBlocks[subject.id]?.length || 0), 0)} of {subjects.reduce((sum, subject) => sum + (subject.block_count || 0), 0)} blocks completed this week
              </div>
            </div>
          )}

          {subjects.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No subjects available</h3>
              <p className="text-slate-500 dark:text-slate-400">Your parent needs to set up your subjects first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map((subject) => {
                const progress = getSubjectProgress(subject);
                const isLocked = isSubjectLocked(subject);
                const isCompleted = progress >= (subject?.block_count || 0);

                return (
                  <div
                    key={subject.id}
                    className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border ${
                      isCompleted 
                        ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600'
                    } p-6 transition-all`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                          {subject.title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {progress} / {subject?.block_count} blocks this week
                        </p>
                      </div>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isCompleted 
                          ? 'bg-green-100 dark:bg-green-900/30' 
                          : isLocked 
                            ? 'bg-slate-100 dark:bg-slate-700'
                            : 'bg-indigo-100 dark:bg-indigo-900/30'
                      }`}>
                        {isCompleted ? (
                          <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                        ) : isLocked ? (
                          <Lock className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Status</span>
                        <span className={`font-medium ${
                          isCompleted 
                            ? 'text-green-600 dark:text-green-400' 
                            : isLocked 
                              ? 'text-slate-500 dark:text-slate-400'
                              : 'text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {isCompleted ? 'Done' : isLocked ? 'Locked' : 'Available'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Block Length</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {subject?.block_length || 30} mins
                        </span>
                      </div>

                      {subject.require_input && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          Summary required
                        </div>
                      )}

                      {subject.resources && subject.resources.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <p className="text-xs font-medium text-slate-700 mb-2">Resources</p>
                          <div className="space-y-1">
                            {subject.resources.map((resource, index) => (
                              resource.url ? (
                                <a
                                  key={index}
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {resource.name}
                                </a>
                              ) : (
                                <div
                                  key={index}
                                  className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400"
                                >
                                  <BookOpen className="w-3 h-3" />
                                  {resource.name}
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Grid of Blocks */}
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-sm font-medium text-slate-700 mb-3">Weekly Blocks</p>
                        <div className="flex gap-2 flex-wrap">
                          {Array.from({ length: subject?.block_count || 10 }, (_, index) => {
                            const isCompleted = isBlockCompleted(subject, index);
                            const timer = activeTimers[subject.id];
                            const isWorkingOn = timer && timer.workingOnBlockIndex === index && timer.timeLeft > 0;
                            
                            return (
                              <button
                                key={index}
                                onClick={() => handleBlockClick(subject, index)}
                                disabled={isCompleted || isSubjectLocked(subject)}
                                className={`w-12 h-12 rounded-lg border-2 font-medium text-sm transition-all relative ${
                                  isCompleted
                                    ? 'bg-green-100 border-green-300 text-green-700 cursor-not-allowed'
                                    : isSubjectLocked(subject)
                                      ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                                      : isWorkingOn
                                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700 animate-pulse'
                                        : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'
                                }`}
                              >
                                {isCompleted ? '✓' : index + 1}
                                {isWorkingOn && (
                                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full animate-ping" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {isSubjectLocked(subject) && (
                          <p className="text-xs text-slate-500 mt-2">All blocks completed this week!</p>
                        )}
                      </div>
                      
                      {/* Timer Control Section */}
                      <div className="pt-3 border-t border-slate-100">
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Timer Control</h4>
                            {activeTimers[subject.id] && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Block {activeTimers[subject.id].workingOnBlockIndex + 1}
                              </span>
                            )}
                          </div>
                          
                          {/* Timer Display */}
                          <div className="text-center mb-4">
                            {activeTimers[subject.id] ? (
                              <div className={`text-3xl font-bold font-mono ${
                                activeTimers[subject.id].timeLeft === 0
                                  ? 'text-green-600 dark:text-green-400 animate-pulse'
                                  : subject.require_timer 
                                    ? 'text-orange-600 dark:text-orange-400' 
                                    : 'text-indigo-600 dark:text-indigo-400'
                              }`}>
                                {formatTime(activeTimers[subject.id].timeLeft)}
                              </div>
                            ) : (
                              <div className="text-2xl font-medium text-slate-400 dark:text-slate-500">
                                --:--
                              </div>
                            )}
                            {activeTimers[subject.id]?.timeLeft === 0 ? (
                              <div className="text-sm text-green-600 dark:text-green-400 mt-1 font-medium">
                                ⏰ Time's Up! Ready to submit?
                              </div>
                            ) : subject.require_timer ? (
                              <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                                ⏱ Mandatory Timer Required
                              </div>
                            ) : null}
                          </div>
                          
                          {/* Control Buttons */}
                          <div className="flex gap-2">
                            {!activeTimers[subject.id] ? (
                              <button
                                onClick={() => startTimer(subject)}
                                disabled={isSubjectLocked(subject)}
                                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                              >
                                Start Timer
                              </button>
                            ) : (
                              <>
                                {activeTimers[subject.id].timeLeft > 0 ? (
                                  // Timer is still running - show Pause/Resume and Reset
                                  <>
                                    {activeTimers[subject.id].isRunning ? (
                                      <button
                                        onClick={() => pauseTimer(subject)}
                                        className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                                      >
                                        Pause
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => resumeTimer(subject)}
                                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                                      >
                                        Resume
                                      </button>
                                    )}
                                    <button
                                      onClick={() => resetTimer(subject)}
                                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                                    >
                                      Reset
                                    </button>
                                  </>
                                ) : (
                                  // Timer completed - show Complete Block button
                                  <>
                                    <button
                                      onClick={() => handleCompleteBlock(subject)}
                                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors animate-pulse"
                                    >
                                      Complete Block
                                    </button>
                                    <button
                                      onClick={() => resetTimer(subject)}
                                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                                    >
                                      Reset
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                            
                            {/* Only show Complete Next Block if timer is not required OR no active timer */}
                            {!subject.require_timer && (!activeTimers[subject.id] || activeTimers[subject.id].timeLeft > 0) && !isSubjectLocked(subject) && (
                              <button
                                onClick={() => handleCompleteBlock(subject)}
                                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                              >
                                Complete Next Block
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Summary Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {selectedSubject.title} - Block {selectedBlockIndex + 1}
              </h2>
              <button
                onClick={() => {
                  setSelectedSubject(null);
                  setSelectedBlockIndex(null);
                  setSummaryText('');
                  setSelectedResources([]);
                  resetCustomFieldResponses();
                }}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (selectedSubject.require_input !== false) {
                submitBlock(selectedSubject, selectedBlockIndex, summaryText);
              } else {
                submitBlock(selectedSubject, selectedBlockIndex, '');
              }
            }} className="p-6 space-y-4" autoComplete="off">
              {/* Resource Attribution */}
              {selectedSubject.resources && selectedSubject.resources.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Which resources did you use for this block?
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto dark:bg-slate-700">
                    {selectedSubject.resources.map((resource, index) => (
                      <label key={index} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedResources.includes(index)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedResources([...selectedResources, index]);
                            } else {
                              setSelectedResources(selectedResources.filter(i => i !== index));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-600 rounded focus:ring-indigo-500 focus:ring-2 dark:bg-slate-700"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {resource.name}
                          {resource.url && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">(online)</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Fields */}
              {selectedSubject.custom_fields && selectedSubject.custom_fields.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Additional Requirements
                  </h3>
                  {selectedSubject.custom_fields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {field.type === 'text' && (
                        <input
                          type="text"
                          value={customFieldResponses[field.id] || ''}
                          onChange={(e) => handleCustomFieldResponse(field.id, e.target.value)}
                          placeholder={field.placeholder}
                          required={field.required}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      )}
                      {field.type === 'number' && (
                        <input
                          type="number"
                          value={customFieldResponses[field.id] || ''}
                          onChange={(e) => handleCustomFieldResponse(field.id, e.target.value)}
                          placeholder={field.placeholder}
                          required={field.required}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      )}
                      {field.type === 'file' && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          <p>File upload coming soon! For now, please describe your file:</p>
                          <input
                            type="text"
                            value={customFieldResponses[field.id] || ''}
                            onChange={(e) => handleCustomFieldResponse(field.id, e.target.value)}
                            placeholder={`Describe your ${field.placeholder || 'file'}`}
                            required={field.required}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedSubject.require_input !== false ? (
                <div>
                  <label htmlFor="summary" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    You're completing 1 block of {selectedSubject.title} ({selectedSubject?.block_length || 30} minutes). What did you accomplish?
                  </label>
                  <textarea
                    id="summary"
                    required
                    rows={4}
                    value={summaryText}
                    onChange={(e) => setSummaryText(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Describe what you accomplished in this block (at least 2-3 sentences)..."
                    autoComplete="off"
                  />
                  <div className="mt-2 flex justify-between">
                    <p className={`text-xs ${
                      summaryText.length >= 150 ? 'text-green-600' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {summaryText.length}/150 characters minimum
                    </p>
                    {summaryText.length > 0 && summaryText.length < 150 && (
                      <p className="text-xs text-amber-600">
                        Please add more detail (at least 2-3 sentences)
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-600">
                    Completing 1 block of {selectedSubject.title} ({selectedSubject?.block_length || 30} minutes)
                  </p>
                  <p className="text-xs text-slate-500 mt-2">No summary required for this subject</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubject(null);
                    setSelectedBlockIndex(null);
                    setSummaryText('');
                    setSelectedResources([]);
                  }}
                  className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (selectedSubject.require_input !== false && summaryText.length < 150)}
                  className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Finish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPortal;
