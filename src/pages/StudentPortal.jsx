import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, limit,
  doc, getDocs, serverTimestamp, setDoc, deleteDoc
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { Check, BookOpen, Lock, X, ExternalLink, Bell } from 'lucide-react';

import { getCurrentWeekRange } from '../utils/weekUtils';
import {
  createTimerConfig, getRemainingTime, saveTimerToStorage,
  loadTimerFromStorage, clearTimerFromStorage, getTimerKey, formatRemainingTime,
  getTimerSessionDocId, hydrateStoredTimer
} from '../utils/timerUtils';

const ALARM_SOUNDS = [
  { file: 'alarm-clock.mp3', label: 'Alarm Clock' },
  { file: 'blblblblb.mp3', label: 'Blblblblb' },
  { file: 'bong-alarm.mp3', label: 'Bong Alarm' },
  { file: 'car-horn.mp3', label: 'Car Horn' },
  { file: 'cartoon-alarm.mp3', label: 'Cartoon Alarm' },
  { file: 'foghorn.mp3', label: 'Foghorn' },
  { file: 'funny-alarm.mp3', label: 'Funny Alarm' },
  { file: 'kids-logo.mp3', label: 'Kids Logo' },
  { file: 'level-complete.mp3', label: 'Level Complete' },
  { file: 'level-up.mp3', label: 'Level Up' },
  { file: 'level-up2.mp3', label: 'Level Up 2' },
  { file: 'malathion.mp3', label: 'Malathion' },
  { file: 'meow.mp3', label: 'Meow' },
  { file: 'party-horn.mp3', label: 'Party Horn' },
  { file: 'rap-jingle.mp3', label: 'Rap Jingle' },
  { file: 'taiwan-EAS.mp3', label: 'Taiwan EAS' },
  { file: 'tripod.mp3', label: 'Tripod' },
  { file: 'war-drums.mp3', label: 'War Drums' },
  { file: 'yaaaas.mp3', label: 'Yaaaas' },
];

const FONT = "'Super Sans VF', system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif";
const C = {
  mysteria: '#1b1938',
  lavender: '#cbb7fb',
  charcoal: '#292827',
  amethyst: '#714cb6',
  cream: '#e9e5dd',
  parchment: '#dcd7d3',
  lavenderTint: '#f0eaff',
};

const StudentPortal = () => {
  const { slug } = useParams();
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
  const [completedBlocks, setCompletedBlocks] = useState({});
  const [selectedResources, setSelectedResources] = useState([]);
  const [activeTimers, setActiveTimers] = useState({});
  const [alarmSound, setAlarmSound] = useState(ALARM_SOUNDS[0].file);
  const [customFieldResponses, setCustomFieldResponses] = useState({});
  const submissionLocksRef = useRef({});
  const alarmAudioRef = useRef(null);
  const alarmStopTimerRef = useRef(null);
  const alarmSoundRef = useRef(ALARM_SOUNDS[0].file);
  const alarmPrimedRef = useRef(false);
  const audioContextRef = useRef(null);
  const alarmBufferCacheRef = useRef(new Map());
  const alarmSourceRef = useRef(null);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinLockoutUntil, setPinLockoutUntil] = useState(null);
  const oldSubjectUnsubRef = useRef(null);
  const completionNotifiedRef = useRef({});

  const db = getFirestore(app);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map(subject => [subject.id, subject])), [subjects]);

  const ensureAlarmAudio = () => {
    if (!alarmAudioRef.current) {
      alarmAudioRef.current = new Audio(`/sounds/${alarmSoundRef.current}`);
      alarmAudioRef.current.preload = 'auto';
    }

    const expectedSrc = `${window.location.origin}/sounds/${alarmSoundRef.current}`;
    if (alarmAudioRef.current.src !== expectedSrc) {
      alarmAudioRef.current.src = `/sounds/${alarmSoundRef.current}`;
      alarmPrimedRef.current = false;
    }

    return alarmAudioRef.current;
  };

  const ensureAudioContext = async () => {
    if (typeof window === 'undefined') return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  };

  const ensureAlarmBuffer = async (file = alarmSoundRef.current) => {
    if (alarmBufferCacheRef.current.has(file)) {
      return alarmBufferCacheRef.current.get(file);
    }

    const context = await ensureAudioContext();
    if (!context) return null;

    const response = await fetch(`/sounds/${file}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    alarmBufferCacheRef.current.set(file, audioBuffer);
    return audioBuffer;
  };

  const primeAlarmAudio = async () => {
    const audio = ensureAlarmAudio();
    if (alarmPrimedRef.current) return true;

    try {
      audio.muted = true;
      audio.currentTime = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      await ensureAlarmBuffer();
      alarmPrimedRef.current = true;
      return true;
    } catch (error) {
      audio.muted = false;
      console.warn('Unable to prime alarm audio:', error);
      return false;
    }
  };

  useEffect(() => {
    if (!slug) return;
    const studentQuery = query(collection(db, 'students'), where('slug', '==', slug), limit(1));
    const unsubscribeStudent = onSnapshot(studentQuery, (snapshot) => {
      if (snapshot.empty) { setError('Student not found'); setLoading(false); return; }
      const studentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      setStudent(studentData);

      const subjectsQuery = query(collection(db, 'subjects'),
        where('parent_id', '==', studentData.parent_id), where('is_active', '==', true),
        where('student_ids', 'array-contains', studentData.id), orderBy('title'));
      const unsubscribeSubjects = onSnapshot(subjectsQuery, (snap) => {
        const subjectsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (subjectsData.length === 0) {
          const oldQuery = query(collection(db, 'subjects'),
            where('parent_id', '==', studentData.parent_id), where('student_id', '==', studentData.id),
            where('is_active', '==', true), orderBy('title'));
          const unsubOld = onSnapshot(oldQuery, (oldSnap) => {
            setSubjects(oldSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
          }, () => setLoading(false));
          oldSubjectUnsubRef.current = unsubOld;
        } else {
          setSubjects(subjectsData);
          setLoading(false);
        }
      }, () => setLoading(false));

      const { weekStart } = getCurrentWeekRange();
      const submissionsQuery = query(collection(db, 'submissions'),
        where('student_id', '==', studentData.id), where('timestamp', '>=', weekStart), orderBy('timestamp', 'desc'));
      const unsubscribeSubmissions = onSnapshot(submissionsQuery, (snap) => {
        setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      return () => {
        unsubscribeSubjects();
        unsubscribeSubmissions();
        if (oldSubjectUnsubRef.current) { oldSubjectUnsubRef.current(); oldSubjectUnsubRef.current = null; }
      };
    }, () => { setError('Student not found'); setLoading(false); });
    return unsubscribeStudent;
  }, [slug, db]);

  useEffect(() => {
    if (!student || subjects.length === 0) return;
    const { weekStart } = getCurrentWeekRange();
    const completedBlocksData = {};
    const unsubscribers = subjects.map(subject => {
      const q = query(collection(db, 'submissions'),
        where('student_id', '==', student.id), where('subject_id', '==', subject.id),
        where('timestamp', '>=', weekStart), orderBy('timestamp', 'desc'));
      return onSnapshot(q, (snap) => {
        const indices = snap.docs.map(d => d.data().block_index).filter(i => i !== undefined);
        completedBlocksData[subject.id] = indices;
        setCompletedBlocks(prev => ({ ...prev, ...completedBlocksData }));
      });
    });
    return () => unsubscribers.forEach(u => u());
  }, [student, subjects, db]);

  useEffect(() => {
    if (!student || subjects.length === 0) return;

    const unsubscribers = subjects.map((subject) => {
      const timerRef = doc(db, 'timerSessions', getTimerSessionDocId(student.id, subject.id));

      return onSnapshot(timerRef, async (snapshot) => {
        if (!snapshot.exists()) {
          const key = getTimerKey(student.id, subject.id);
          const stored = loadTimerFromStorage(key);
          const nextBlock = getNextAvailableBlock(subject);

          if (stored && stored.blockIndex === nextBlock) {
            const hydrated = hydrateStoredTimer(stored);

            if (hydrated) {
              try {
                await persistTimer(subject, hydrated, true);
              } catch (migrationError) {
                console.error('Error migrating timer to Firestore:', migrationError);
              }
            }
          }

          clearTimerFromStorage(key);
          setActiveTimers((prev) => {
            if (!prev[subject.id]) return prev;
            const updated = { ...prev };
            delete updated[subject.id];
            return updated;
          });
          delete completionNotifiedRef.current[subject.id];
          return;
        }

        const hydrated = hydrateStoredTimer(snapshot.data());

        setActiveTimers((prev) => {
          const previousTimer = prev[subject.id];
          if (
            previousTimer?.remainingTime > 0 &&
            hydrated?.remainingTime === 0 &&
            !completionNotifiedRef.current[subject.id]
          ) {
            handleTimerComplete(subject.id);
            completionNotifiedRef.current[subject.id] = true;
          }

          return { ...prev, [subject.id]: hydrated };
        });
      });
    });

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [student, subjects, completedBlocks, db]);

  useEffect(() => {
    const interval = setInterval(() => {
      const completedTimers = [];

      setActiveTimers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(subjectId => {
          const timer = updated[subjectId];
          if (timer && timer.isRunning && !timer.pausedAt) {
            const remaining = getRemainingTime(timer.targetEndTime);
            if (remaining > 0) {
              updated[subjectId] = { ...timer, remainingTime: remaining };
            } else {
              updated[subjectId] = {
                ...timer,
                remainingTime: 0,
                isRunning: false,
                pausedAt: null,
                completedAt: timer.completedAt ?? Date.now(),
              };
              completedTimers.push({ subjectId, timer: updated[subjectId] });
            }
          }
        });
        return updated;
      });

      completedTimers.forEach(({ subjectId, timer }) => {
        if (!completionNotifiedRef.current[subjectId]) {
          handleTimerComplete(subjectId);
          completionNotifiedRef.current[subjectId] = true;
        }

        const subject = subjectMap[subjectId];
        if (!subject) return;

        persistTimer(subject, timer).catch((error) => {
          console.error('Error syncing completed timer:', error);
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [subjectMap]);

  useEffect(() => {
    if (!student) return;
    const saved = localStorage.getItem(`alarm_sound_${student.id}`);
    if (saved && ALARM_SOUNDS.some(s => s.file === saved)) {
      setAlarmSound(saved);
      alarmSoundRef.current = saved;
    }
  }, [student?.id]);

  const handleAlarmChange = (file) => {
    setAlarmSound(file);
    alarmSoundRef.current = file;
    if (student) localStorage.setItem(`alarm_sound_${student.id}`, file);
    const audio = ensureAlarmAudio();
    audio.src = `/sounds/${file}`;
    alarmPrimedRef.current = false;
    primeAlarmAudio().catch(() => {});
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const stopAlarm = () => {
    if (alarmStopTimerRef.current) { clearTimeout(alarmStopTimerRef.current); alarmStopTimerRef.current = null; }
    if (alarmSourceRef.current) {
      try { alarmSourceRef.current.stop(); } catch (e) {}
      try { alarmSourceRef.current.disconnect(); } catch (e) {}
      alarmSourceRef.current = null;
    }
    if (alarmAudioRef.current) { alarmAudioRef.current.loop = false; alarmAudioRef.current.pause(); alarmAudioRef.current.currentTime = 0; }
  };

  const playNotificationSound = async () => {
    stopAlarm();

    try {
      const context = await ensureAudioContext();
      const buffer = await ensureAlarmBuffer();

      if (context && buffer) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(context.destination);
        source.start(0);
        alarmSourceRef.current = source;
      } else {
        const audio = ensureAlarmAudio();
        audio.loop = true;
        audio.muted = false;
        audio.currentTime = 0;
        await audio.play();
      }
    } catch (error) {
      console.warn('Alarm playback was blocked:', error);
    }

    alarmStopTimerRef.current = setTimeout(stopAlarm, 20_000);
  };

  const handleTimerComplete = (subjectId) => {
    try { playNotificationSound(); } catch (e) {}
  };

  const buildTimerSessionPayload = (subject, timer, includeCreatedAt = false) => {
    const payload = {
      student_id: student.id,
      parent_id: student.parent_id,
      subject_id: subject.id,
      block_index: timer.blockIndex,
      start_time: timer.startTime,
      duration_ms: timer.durationMs,
      duration_minutes: timer.durationMinutes,
      target_end_time: timer.targetEndTime,
      initial_duration_ms: timer.initialDurationMs,
      remaining_time: timer.remainingTime ?? getRemainingTime(timer.targetEndTime),
      is_running: timer.isRunning,
      paused_at: timer.pausedAt ?? null,
      resumed_at: timer.resumedAt ?? null,
      completed_at: timer.remainingTime === 0 ? (timer.completedAt ?? Date.now()) : null,
      saved_at: Date.now(),
      updated_at: serverTimestamp(),
    };

    if (includeCreatedAt) payload.created_at = serverTimestamp();

    return payload;
  };

  const persistTimer = async (subject, timer, includeCreatedAt = false) => {
    if (!student || !subject || !timer) return;

    await setDoc(
      doc(db, 'timerSessions', getTimerSessionDocId(student.id, subject.id)),
      buildTimerSessionPayload(subject, timer, includeCreatedAt),
      { merge: true }
    );

    saveTimerToStorage(getTimerKey(student.id, subject.id), timer, student.id, subject.id, timer.blockIndex);
  };

  const removeTimer = async (subjectId) => {
    if (!student || !subjectId) return;

    await deleteDoc(doc(db, 'timerSessions', getTimerSessionDocId(student.id, subjectId)));
    clearTimerFromStorage(getTimerKey(student.id, subjectId));
    delete completionNotifiedRef.current[subjectId];
  };

  const getNextAvailableBlock = (subject) => {
    if (!subject) return null;
    const total = subject?.block_count || 10;
    const completed = completedBlocks[subject.id] || [];
    for (let i = 0; i < total; i++) { if (!completed.includes(i)) return i; }
    return null;
  };

  const startTimer = async (subject) => {
    if (!subject) return;
    await primeAlarmAudio();
    const otherRunning = Object.keys(activeTimers).some(id => id !== subject.id);
    if (otherRunning) return;
    const nextBlock = getNextAvailableBlock(subject);
    if (nextBlock === null) { alert('All blocks completed!'); return; }

    const config = {
      ...createTimerConfig(subject?.block_length || 30),
      blockIndex: nextBlock,
      isRunning: true,
      pausedAt: null,
      completedAt: null,
    };

    setActiveTimers(prev => ({ ...prev, [subject.id]: config }));
    delete completionNotifiedRef.current[subject.id];

    try {
      await persistTimer(subject, config, true);
    } catch (err) {
      console.error('Error starting timer:', err);
      setActiveTimers((prev) => {
        const updated = { ...prev };
        delete updated[subject.id];
        return updated;
      });
      setError('Failed to start timer. Please try again.');
    }
  };

  const pauseTimer = async (subject) => {
    const config = {
      ...activeTimers[subject.id],
      isRunning: false,
      pausedAt: Date.now(),
    };
    setActiveTimers(prev => ({ ...prev, [subject.id]: config }));

    try {
      await persistTimer(subject, config);
    } catch (err) {
      console.error('Error pausing timer:', err);
      setError('Failed to pause timer. Please try again.');
    }
  };

  const resumeTimer = async (subject) => {
    const current = activeTimers[subject.id];
    const now = Date.now();
    const config = current.pausedAt
      ? { ...current, isRunning: true, targetEndTime: current.targetEndTime + (now - current.pausedAt), pausedAt: null, resumedAt: now }
      : { ...current, isRunning: true, resumedAt: now };
    setActiveTimers(prev => ({ ...prev, [subject.id]: config }));

    try {
      await persistTimer(subject, config);
    } catch (err) {
      console.error('Error resuming timer:', err);
      setError('Failed to resume timer. Please try again.');
    }
  };

  const resetTimer = async (subject) => {
    setActiveTimers(prev => { const u = { ...prev }; delete u[subject.id]; return u; });

    try {
      await removeTimer(subject.id);
    } catch (err) {
      console.error('Error resetting timer:', err);
      setError('Failed to reset timer. Please try again.');
    }
  };

  const setSubmissionLock = (subjectId, blockIndex) => { submissionLocksRef.current[`${subjectId}_${blockIndex}`] = true; };
  const clearSubmissionLock = (subjectId, blockIndex) => { delete submissionLocksRef.current[`${subjectId}_${blockIndex}`]; };
  const isSubmissionLocked = (subjectId, blockIndex) => submissionLocksRef.current[`${subjectId}_${blockIndex}`] || false;

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinLockoutUntil && Date.now() < pinLockoutUntil) {
      const secsLeft = Math.ceil((pinLockoutUntil - Date.now()) / 1000);
      setError(`Too many attempts. Try again in ${secsLeft} seconds.`);
      return;
    }
    if (student && pin === student.access_pin) {
      setIsAuthenticated(true);
      setError('');
      setPinAttempts(0);
      setPinLockoutUntil(null);
    } else {
      const next = pinAttempts + 1;
      setPinAttempts(next);
      if (next >= 5) {
        setPinLockoutUntil(Date.now() + 30_000);
        setPinAttempts(0);
        setError('Too many incorrect attempts. Locked for 30 seconds.');
      } else {
        setError(`Invalid PIN. ${5 - next} attempt${5 - next !== 1 ? 's' : ''} remaining.`);
      }
    }
  };

  const handleCustomFieldResponse = (fieldId, value) => setCustomFieldResponses(prev => ({ ...prev, [fieldId]: value }));
  const resetCustomFieldResponses = () => setCustomFieldResponses({});

  const handleBlockClick = (subject, blockIndex) => {
    if (!subject || isBlockCompleted(subject, blockIndex)) return;
    const nextBlock = getNextAvailableBlock(subject);
    if (nextBlock === null) { alert('All blocks completed!'); return; }
    if (subject.require_timer) {
      const timer = activeTimers[subject.id];
      if (!timer || timer.remainingTime > 0) { alert('This subject requires the timer to complete before submitting.'); return; }
      if (timer?.remainingTime === 0) {
        setActiveTimers(prev => ({ ...prev, [subject.id]: { ...timer, isFinished: true, isRunning: false } }));
      }
    }
    setSelectedSubject(subject); setSelectedBlockIndex(blockIndex);
    setSummaryText(''); setSelectedResources([]); resetCustomFieldResponses();
  };

  const handleCompleteBlock = (subject) => {
    if (!subject) return;
    const nextBlock = getNextAvailableBlock(subject);
    if (nextBlock === null) { alert('All blocks completed!'); return; }
    if (isSubmissionLocked(subject.id, nextBlock)) { setError('Submission in progress...'); return; }
    setSubmissionLock(subject.id, nextBlock);
    handleBlockClick(subject, nextBlock);
  };

  const submitBlock = async (subject, blockIndex, summary) => {
    setSubmissionLock(subject.id, blockIndex);
    setSubmitting(true);
    try {
      const { weekStart } = getCurrentWeekRange();
      const existing = await getDocs(query(collection(db, 'submissions'),
        where('student_id', '==', student.id), where('subject_id', '==', subject.id),
        where('block_index', '==', blockIndex), where('timestamp', '>=', weekStart), limit(1)));
      if (!existing.empty) {
        setError('Block already completed!');
        clearSubmissionLock(subject.id, blockIndex);
        setSubmitting(false);
        setSelectedSubject(null); setSelectedBlockIndex(null);
        setSummaryText(''); setSelectedResources([]); resetCustomFieldResponses();
        return;
      }
      await addDoc(collection(db, 'submissions'), {
        student_id: student.id, parent_id: student.parent_id,
        subject_name: subject.title, subject_id: subject.id,
        block_index: blockIndex, timestamp: serverTimestamp(),
        summary_text: subject.require_input !== false ? summary : null,
        block_duration: subject.block_length || 30, is_locked: true,
        resources_used: selectedResources, custom_field_responses: customFieldResponses,
        created_at: serverTimestamp()
      });

      await removeTimer(subject.id);
      setActiveTimers(prev => { const u = { ...prev }; delete u[subject.id]; return u; });
      setSelectedSubject(null); setSelectedBlockIndex(null);
      setSummaryText(''); setSelectedResources([]); resetCustomFieldResponses();
      clearSubmissionLock(subject.id, blockIndex);
    } catch (err) {
      console.error('Error submitting block:', err);
      setError('Failed to submit. Please try again.');
      clearSubmissionLock(subject.id, blockIndex);
    } finally {
      setSubmitting(false);
    }
  };

  const isBlockCompleted = useMemo(() => (subject, blockIndex) => completedBlocks[subject.id]?.includes(blockIndex) || false, [completedBlocks]);
  const isSubjectLocked = useMemo(() => (subject) => (completedBlocks[subject.id]?.length || 0) >= (subject?.block_count || 4), [completedBlocks]);
  const getSubjectProgress = useMemo(() => (subject) => completedBlocks[subject.id]?.length || 0, [completedBlocks]);
  const getWeeklyProgress = useMemo(() => () => {
    const total = subjects.reduce((s, sub) => s + (sub?.block_count || 0), 0);
    const completed = subjects.reduce((s, sub) => s + (completedBlocks[sub.id]?.length || 0), 0);
    return total > 0 ? (completed / total) * 100 : 0;
  }, [subjects, completedBlocks]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-7 w-7" style={{ border: '2px solid transparent', borderBottomColor: C.lavender }} />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" style={{ fontFamily: FONT }}>
        <div className="text-center">
          <h2 style={{ fontSize: 24, fontWeight: 540, color: C.charcoal, lineHeight: 1.1 }}>Student Not Found</h2>
          <p className="text-[14px] mt-2" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>Please check your URL and try again.</p>
        </div>
      </div>
    );
  }

  // PIN screen
  if (!isAuthenticated && student.access_pin) {
    return (
      <div style={{
        minHeight: '100vh', background: 'linear-gradient(160deg, #201f45 0%, #1b1938 50%, #14122e 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px 16px', fontFamily: FONT,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '28px', height: '2px', backgroundColor: C.lavender, margin: '0 auto 20px' }} />
          <h1 style={{ fontSize: '48px', fontWeight: 540, lineHeight: 0.96, letterSpacing: '-1.32px', color: 'rgba(255,255,255,0.95)', margin: 0 }}>
            GRIDWORKZ
          </h1>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '12px', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
            Student Portal
          </p>
        </div>
        <div style={{ width: '100%', maxWidth: '360px', backgroundColor: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', padding: '40px' }}>
          <p style={{ fontSize: '20px', fontWeight: 540, lineHeight: 1.25, letterSpacing: '-0.4px', color: C.charcoal, marginBottom: '6px' }}>
            Welcome, {student.name}
          </p>
          <p style={{ fontSize: '14px', color: 'rgba(41,40,39,0.5)', marginBottom: '28px', fontWeight: 460 }}>Enter your PIN to continue</p>
          {error && (
            <div style={{ backgroundColor: '#f5f0ff', border: `1px solid ${C.lavender}`, borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '14px', color: C.charcoal }}>
              {error}
            </div>
          )}
          <form onSubmit={handlePinSubmit}>
            <input
              type="password" maxLength="4" pattern="[0-9]{4}" required
              value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••"
              style={{ width: '100%', padding: '12px', backgroundColor: '#fff', border: `1px solid ${C.parchment}`, borderRadius: '8px', fontSize: '24px', color: C.charcoal, textAlign: 'center', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.3em', marginBottom: '16px', fontFamily: FONT }}
              onFocus={e => e.target.style.borderColor = C.charcoal}
              onBlur={e => e.target.style.borderColor = C.parchment}
            />
            <button type="submit"
              style={{ width: '100%', padding: '12px', backgroundColor: C.cream, color: C.charcoal, border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}
            >
              Enter Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  const totalCompletedBlocks = subjects.reduce((s, sub) => s + (completedBlocks[sub.id]?.length || 0), 0);
  const totalBlocks = subjects.reduce((s, sub) => s + (sub.block_count || 0), 0);
  const weeklyPct = Math.round(getWeeklyProgress());

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: FONT }}>
      {/* Header */}
      <header className="bg-white" style={{ borderBottom: `1px solid ${C.parchment}` }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center h-14">
            <h1 style={{ fontSize: 16, fontWeight: 540, color: C.charcoal }}>My Learning</h1>
            <div className="flex items-center gap-4">
              <span style={{ fontSize: 14, color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>{student.name}</span>
              <div className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(41,40,39,0.35)' }} />
                <select
                  value={alarmSound}
                  onChange={(e) => handleAlarmChange(e.target.value)}
                  style={{
                    fontSize: 13, color: C.charcoal, fontWeight: 460, fontFamily: FONT,
                    border: `1px solid ${C.parchment}`, borderRadius: 6, padding: '3px 6px',
                    backgroundColor: '#fff', cursor: 'pointer', outline: 'none', maxWidth: 140,
                  }}
                >
                  {ALARM_SOUNDS.map(s => (
                    <option key={s.file} value={s.file}>{s.label}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => setIsAuthenticated(false)}
                style={{ fontSize: 13, color: C.amethyst, fontWeight: 460, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT }}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-6">
        {/* Weekly Progress */}
        {subjects.length > 0 && (
          <div className="rounded-2xl p-6 mb-7 bg-white" style={{ border: `1px solid ${C.parchment}` }}>
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontSize: 16, fontWeight: 540, color: C.charcoal }}>Weekly Progress</h2>
              <span style={{ fontSize: 24, fontWeight: 540, color: C.amethyst }}>{weeklyPct}%</span>
            </div>
            <div className="w-full rounded-full h-2.5 overflow-hidden mb-2" style={{ backgroundColor: C.parchment }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${weeklyPct}%`, backgroundColor: C.lavender }} />
            </div>
            <p style={{ fontSize: 13, color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
              {totalCompletedBlocks} of {totalBlocks} blocks completed this week
            </p>
          </div>
        )}

        {subjects.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-10 h-10 mx-auto mb-4" style={{ color: 'rgba(41,40,39,0.2)' }} />
            <h3 style={{ fontSize: 18, fontWeight: 540, color: C.charcoal }} className="mb-2">No subjects available</h3>
            <p style={{ fontSize: 14, color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>Your parent needs to set up your subjects first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {subjects.map((subject) => {
              const progress = getSubjectProgress(subject);
              const locked = isSubjectLocked(subject);
              const completed = progress >= (subject?.block_count || 0);

              return (
                <div key={subject.id} className="rounded-2xl p-6 transition-all bg-white"
                  style={{
                    border: `1px solid ${completed ? C.lavender : C.parchment}`,
                    backgroundColor: completed ? '#f8f5ff' : '#ffffff',
                  }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 style={{ fontSize: 16, fontWeight: 540, color: C.charcoal, lineHeight: 1.2 }} className="mb-1">
                        {subject.title}
                      </h3>
                      <p style={{ fontSize: 13, color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                        {progress} / {subject?.block_count} blocks this week
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ml-3"
                      style={{ backgroundColor: completed ? 'rgba(203,183,251,0.3)' : locked ? C.cream : C.lavenderTint }}>
                      {completed ? <Check className="w-5 h-5" style={{ color: C.amethyst }} />
                        : locked ? <Lock className="w-5 h-5" style={{ color: 'rgba(41,40,39,0.4)' }} />
                        : <BookOpen className="w-5 h-5" style={{ color: C.amethyst }} />}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full rounded-full h-1.5 mb-4 overflow-hidden" style={{ backgroundColor: C.parchment }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.round((progress / (subject?.block_count || 1)) * 100)}%`, backgroundColor: C.lavender }} />
                  </div>

                  <div className="space-y-2.5 mb-4">
                    <div className="flex justify-between text-[13px]">
                      <span style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>Status</span>
                      <span style={{ fontWeight: 460, color: completed ? C.amethyst : locked ? 'rgba(41,40,39,0.3)' : 'rgba(41,40,39,0.7)' }}>
                        {completed ? 'Complete' : locked ? 'Locked' : 'In Progress'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>Block Length</span>
                      <span style={{ color: C.charcoal, fontWeight: 460 }}>{subject?.block_length || 30} min</span>
                    </div>
                  </div>

                  {/* Resources */}
                  {subject.resources && subject.resources.length > 0 && (
                    <div className="mb-4 pt-3" style={{ borderTop: `1px solid ${C.parchment}` }}>
                      <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Resources</p>
                      <div className="space-y-1.5">
                        {subject.resources.map((r, i) => (
                          r.url ? (
                            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[12px] transition-colors"
                              style={{ color: C.amethyst, fontWeight: 460, textDecoration: 'none' }}>
                              <ExternalLink className="w-3 h-3" />{r.name}
                            </a>
                          ) : (
                            <div key={i} className="flex items-center gap-1.5 text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                              <BookOpen className="w-3 h-3" />{r.name}
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Blocks grid */}
                  <div className="pt-3 mb-4" style={{ borderTop: `1px solid ${C.parchment}` }}>
                    <p className="text-[11px] uppercase tracking-wider mb-2.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Weekly Blocks</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {Array.from({ length: subject?.block_count || 10 }, (_, i) => {
                        const blockCompleted = isBlockCompleted(subject, i);
                        const timer = activeTimers[subject.id];
                        const isWorkingOn = timer && timer.blockIndex === i && timer.isRunning && timer.remainingTime > 0;
                        const hasObjective = !!(subject.block_objectives?.[i]?.student_overrides?.[student?.id]?.instruction || subject.block_objectives?.[i]?.instruction);
                        return (
                          <button key={i}
                            onClick={() => handleBlockClick(subject, i)}
                            disabled={blockCompleted || isSubjectLocked(subject) || isSubmissionLocked(subject.id, i)}
                            className={`w-10 h-10 rounded-lg text-[12px] transition-all relative ${isWorkingOn ? 'animate-pulse' : ''}`}
                            title={hasObjective ? 'Guided block — has specific instructions' : undefined}
                            style={{
                              backgroundColor: blockCompleted ? C.lavenderTint : isSubjectLocked(subject) ? C.cream : isWorkingOn ? 'rgba(203,183,251,0.2)' : '#ffffff',
                              border: `1px solid ${blockCompleted ? C.lavender : isWorkingOn ? C.lavender : hasObjective ? `${C.lavender}99` : C.parchment}`,
                              color: blockCompleted ? C.amethyst : isSubjectLocked(subject) ? 'rgba(41,40,39,0.3)' : isWorkingOn ? C.amethyst : 'rgba(41,40,39,0.5)',
                              cursor: blockCompleted || isSubjectLocked(subject) ? 'not-allowed' : 'pointer',
                              fontWeight: 460,
                            }}
                          >
                            {blockCompleted ? '✓' : i + 1}
                            {hasObjective && !blockCompleted && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                                style={{ backgroundColor: C.amethyst }} />
                            )}
                            {isWorkingOn && (
                              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-ping"
                                style={{ backgroundColor: C.lavender }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {locked && <p className="text-[12px] mt-2" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>All blocks completed this week!</p>}
                  </div>

                  {/* Timer controls */}
                  <div className="pt-3" style={{ borderTop: `1px solid ${C.parchment}` }}>
                    <div className="rounded-lg p-4" style={{ backgroundColor: '#faf9f8' }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] uppercase tracking-wider" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Timer</p>
                        {activeTimers[subject.id] && (
                          <span className="text-[11px]" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>Block {activeTimers[subject.id].blockIndex + 1}</span>
                        )}
                      </div>
                      <div className="text-center mb-3">
                        {activeTimers[subject.id] ? (
                          <div className={`text-[28px] font-mono ${activeTimers[subject.id].remainingTime === 0 ? 'animate-pulse' : ''}`}
                            style={{ fontWeight: 540, color: activeTimers[subject.id].remainingTime === 0 ? C.amethyst : C.charcoal }}>
                            {formatRemainingTime(activeTimers[subject.id].remainingTime)}
                          </div>
                        ) : (
                          <div className="text-[22px] font-mono" style={{ fontWeight: 540, color: 'rgba(41,40,39,0.2)' }}>--:--</div>
                        )}
                        {activeTimers[subject.id]?.remainingTime === 0 && (
                          <p className="text-[12px] mt-1" style={{ color: C.amethyst, fontWeight: 460 }}>Time's up — ready to submit?</p>
                        )}
                        {subject.require_timer && activeTimers[subject.id]?.remainingTime > 0 && (
                          <p className="text-[11px] uppercase tracking-wider mt-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Timer required</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {!activeTimers[subject.id] ? (
                          <button onClick={() => startTimer(subject)} disabled={locked || Object.keys(activeTimers).some(id => id !== subject.id)}
                            className="flex-1 px-3 py-2 rounded-lg text-[13px] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            style={{ backgroundColor: C.cream, color: C.charcoal, fontWeight: 700, fontFamily: FONT }}
                            onMouseEnter={e => { if (!locked) e.currentTarget.style.backgroundColor = C.parchment; }}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}>
                            Start Timer
                          </button>
                        ) : activeTimers[subject.id].remainingTime > 0 ? (
                          <>
                            {activeTimers[subject.id].isRunning ? (
                              <button onClick={() => pauseTimer(subject)}
                                className="flex-1 px-3 py-2 rounded-lg text-[13px] transition-colors"
                                style={{ backgroundColor: C.cream, color: C.charcoal, fontWeight: 700, fontFamily: FONT }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}>
                                Pause
                              </button>
                            ) : (
                              <button onClick={() => resumeTimer(subject)}
                                className="flex-1 px-3 py-2 rounded-lg text-[13px] transition-colors"
                                style={{ backgroundColor: C.charcoal, color: '#fff', fontWeight: 700, fontFamily: FONT }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}>
                                Resume
                              </button>
                            )}
                            <button onClick={() => resetTimer(subject)}
                              className="px-3 py-2 rounded-lg text-[13px] transition-colors"
                              style={{ backgroundColor: C.cream, color: 'rgba(41,40,39,0.6)', fontWeight: 700, fontFamily: FONT }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}>
                              Reset
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleCompleteBlock(subject)}
                              disabled={submitting || isSubmissionLocked(subject.id, activeTimers[subject.id]?.blockIndex)}
                              className="flex-1 px-3 py-2 rounded-lg text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 animate-pulse"
                              style={{ backgroundColor: C.charcoal, color: '#fff', fontWeight: 700, fontFamily: FONT }}
                              onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#3a3937'; }}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}>
                              {submitting ? <><div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.5)', borderTopColor: '#fff' }} /> Submitting...</> : 'Complete Block'}
                            </button>
                            <button onClick={() => resetTimer(subject)}
                              className="px-3 py-2 rounded-lg text-[13px] transition-colors"
                              style={{ backgroundColor: C.cream, color: 'rgba(41,40,39,0.6)', fontWeight: 700, fontFamily: FONT }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}>
                              Reset
                            </button>
                          </>
                        )}

                        {!subject.require_timer && (!activeTimers[subject.id] || activeTimers[subject.id].remainingTime > 0) && !locked && (
                          <button onClick={() => handleCompleteBlock(subject)}
                            disabled={submitting || isSubmissionLocked(subject.id, getNextAvailableBlock(subject))}
                            className="flex-1 px-3 py-2 rounded-lg text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                            style={{ backgroundColor: C.charcoal, color: '#fff', fontWeight: 700, fontFamily: FONT }}
                            onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#3a3937'; }}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}>
                            {submitting ? <><div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.5)', borderTopColor: '#fff' }} /> Submitting...</> : 'Complete Next Block'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Summary Submission Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4" style={{ border: `1px solid ${C.parchment}` }}>
            <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${C.parchment}` }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 540, color: C.charcoal, lineHeight: 1.2 }}>{selectedSubject.title}</h2>
                <p className="text-[13px] mt-0.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>Block {selectedBlockIndex + 1}</p>
              </div>
              <button onClick={() => { setSelectedSubject(null); setSelectedBlockIndex(null); setSummaryText(''); setSelectedResources([]); resetCustomFieldResponses(); clearSubmissionLock(selectedSubject?.id, selectedBlockIndex); }}
                style={{ color: 'rgba(41,40,39,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); submitBlock(selectedSubject, selectedBlockIndex, summaryText); }}
              className="p-6 space-y-5" autoComplete="off">

              {/* Objective instruction banner — student override takes priority over shared */}
              {(() => {
                const blockObj = selectedSubject.block_objectives?.[selectedBlockIndex];
                const effectiveInstruction = blockObj?.student_overrides?.[student?.id]?.instruction || blockObj?.instruction || null;
                return effectiveInstruction ? (
                  <div className="rounded-lg p-3" style={{ backgroundColor: `${C.lavender}26`, borderLeft: `3px solid ${C.lavender}` }}>
                    <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: C.amethyst, fontWeight: 700 }}>This block requires:</p>
                    <p className="text-[14px]" style={{ color: C.charcoal, fontWeight: 460 }}>{effectiveInstruction}</p>
                  </div>
                ) : null;
              })()}

              {/* Resources */}
              {selectedSubject.resources?.length > 0 && (
                <div>
                  <label className="block text-[11px] uppercase tracking-wider mb-2.5" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 700 }}>Resources Used</label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-lg p-2" style={{ border: `1px solid ${C.parchment}` }}>
                    {selectedSubject.resources.map((r, i) => (
                      <label key={i} className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded transition-colors"
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = C.cream}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <input type="checkbox" checked={selectedResources.includes(i)}
                          onChange={(e) => setSelectedResources(e.target.checked ? [...selectedResources, i] : selectedResources.filter(idx => idx !== i))}
                          className="w-4 h-4 accent-amethyst-link" />
                        <span className="text-[13px]" style={{ color: C.charcoal, fontWeight: 460 }}>{r.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Fields — student override → block-level → subject-level */}
              {(() => {
                const blockObj = selectedSubject.block_objectives?.[selectedBlockIndex];
                const studentOverride = blockObj?.student_overrides?.[student?.id];
                const activeFields =
                  (studentOverride?.custom_fields?.length > 0 ? studentOverride.custom_fields : null) ||
                  (blockObj?.custom_fields?.length > 0 ? blockObj.custom_fields : null) ||
                  selectedSubject.custom_fields || [];
                return activeFields.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-[11px] uppercase tracking-wider" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 700 }}>Additional Requirements</p>
                  {activeFields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-[13px] mb-1.5" style={{ color: 'rgba(41,40,39,0.7)', fontWeight: 460 }}>
                        {field.label}{field.required && <span style={{ color: C.amethyst }} className="ml-1">*</span>}
                      </label>
                      <input
                        type={field.type === 'file' ? 'text' : field.type}
                        value={customFieldResponses[field.id] || ''}
                        onChange={(e) => handleCustomFieldResponse(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        className="w-full px-3 py-2.5 rounded-lg text-[14px] focus:outline-none transition-colors bg-white"
                        style={{ border: `1px solid ${C.parchment}`, color: C.charcoal, fontWeight: 460, fontFamily: FONT }}
                        onFocus={e => e.target.style.borderColor = C.charcoal}
                        onBlur={e => e.target.style.borderColor = C.parchment}
                      />
                    </div>
                  ))}
                </div>
                ) : null;
              })()}

              {/* Summary */}
              {selectedSubject.require_input !== false ? (
                <div>
                  <label className="block text-[13px] mb-1.5" style={{ color: 'rgba(41,40,39,0.7)', fontWeight: 460 }}>
                    What did you accomplish in this {selectedSubject?.block_length || 30}-minute block?
                  </label>
                  <textarea id="summary" required rows={4}
                    value={summaryText} onChange={(e) => setSummaryText(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-[14px] focus:outline-none transition-colors resize-none"
                    style={{ border: `1px solid ${C.parchment}`, color: C.charcoal, fontWeight: 460, fontFamily: FONT }}
                    placeholder="Describe what you accomplished (at least 2-3 sentences)..."
                    onFocus={e => e.target.style.borderColor = C.charcoal}
                    onBlur={e => e.target.style.borderColor = C.parchment}
                    autoComplete="off" />
                  <div className="mt-1.5 flex justify-between">
                    <p className="text-[12px]" style={{ color: summaryText.length >= 150 ? C.amethyst : 'rgba(41,40,39,0.3)', fontWeight: 460 }}>
                      {summaryText.length}/150 minimum
                    </p>
                    {summaryText.length > 0 && summaryText.length < 150 && (
                      <p className="text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>Please add more detail</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-[14px]" style={{ color: 'rgba(41,40,39,0.6)', fontWeight: 460 }}>
                    Completing 1 block of {selectedSubject.title} ({selectedSubject?.block_length || 30} min)
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>No summary required</p>
                </div>
              )}

              <div className="flex gap-3">
                <button type="button"
                  onClick={() => { setSelectedSubject(null); setSelectedBlockIndex(null); setSummaryText(''); setSelectedResources([]); clearSubmissionLock(selectedSubject?.id, selectedBlockIndex); }}
                  className="flex-1 px-4 py-2.5 rounded-lg text-[14px] transition-colors"
                  style={{ backgroundColor: C.cream, color: C.charcoal, fontWeight: 700, fontFamily: FONT }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}>
                  Cancel
                </button>
                <button type="submit"
                  disabled={submitting || (selectedSubject.require_input !== false && summaryText.length < 150)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-[14px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: C.charcoal, color: '#fff', fontWeight: 700, fontFamily: FONT }}
                  onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#3a3937'; }}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}>
                  {submitting ? 'Submitting...' : 'Finish Block'}
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
