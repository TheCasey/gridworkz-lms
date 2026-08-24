import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, limit,
  doc, getDocs, serverTimestamp, setDoc, deleteDoc
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import {
  BookOpen,
  Check,
  Coins,
  ExternalLink,
  Gift,
  ListChecks,
  Lock,
  LogOut,
  Star,
  UserRound,
  X,
} from 'lucide-react';

import { getCurrentWeekRange, getWeekConfig } from '../utils/weekUtils';
import {
  createTimerConfig, getRemainingTime, saveTimerToStorage,
  loadTimerFromStorage, clearTimerFromStorage, getTimerKey, formatRemainingTime,
  getTimerSessionDocId, hydrateStoredTimer
} from '../utils/timerUtils';
import useStudentAccessPolicy, { StudentAccessPolicyReasonCodes } from '../hooks/useStudentAccessPolicy';
import useStudentPortalWeeklyPlan from '../hooks/useStudentPortalWeeklyPlan';
import {
  getLockdownStateGuidance,
  getRequestAccessGuidance,
} from '../../extensions/chrome-lockdown-poc/guidance.js';
import {
  buildPublishedWeeklyPlanWorkLauncherContract,
  buildWorkLauncherTimerSessionPayload,
} from '../utils/workLauncherUtils';
import { buildPublishedWeeklyPlanPortalWorkItems } from '../utils/weeklyPlanUtils';
import {
  buildPortalTimerBlockContext,
  partitionPortalTimers,
} from '../utils/studentTimerSessionUtils';
import useStudentChores from '../hooks/useStudentChores';
import StudentAvatarWorkspace from '../components/student/StudentAvatarWorkspace';
import StudentChoresWorkspaceV2 from '../components/student/StudentChoresWorkspaceV2';
import StudentPortalPinGate from '../components/student/StudentPortalPinGate';
import StudentRewardStoreV2 from '../components/student/StudentRewardStoreV2';
import StudentSchoolWorkspace from '../components/student/StudentSchoolWorkspace';

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

const getPortalSubjectTitle = (subject) => subject?.portal_display_title || subject?.title || 'Untitled Block';
const getSubmissionSubjectName = (subject) => subject?.legacy_subject_title || subject?.title || '';
const TIMER_LIFECYCLE_FIELDS = [
  'blockIndex',
  'isRunning',
  'startTime',
  'durationMs',
  'durationMinutes',
  'initialDurationMs',
  'targetEndTime',
  'pausedAt',
  'resumedAt',
  'completedAt',
];

const hasSameTimerLifecycle = (currentTimer, nextTimer) => (
  Boolean(currentTimer)
  && Boolean(nextTimer)
  && TIMER_LIFECYCLE_FIELDS.every((field) => currentTimer[field] === nextTimer[field])
);

const incrementPortalDiagnostic = (key) => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  const diagnostics = window.__ownPathStudentPortalDiagnostics || {};
  diagnostics[key] = (diagnostics[key] || 0) + 1;
  window.__ownPathStudentPortalDiagnostics = diagnostics;
};

const StudentPortal = () => {
  const { slug } = useParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [student, setStudent] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(null);
  const [expandedSubjectId, setExpandedSubjectId] = useState(null);
  const [expandedBlockIndex, setExpandedBlockIndex] = useState(null);
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
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinLockoutUntil, setPinLockoutUntil] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState('school');
  const completionNotifiedRef = useRef({});
  const previousTimersRef = useRef({});
  const timerRemovalInFlightRef = useRef({});
  const timerRemovalPromisesRef = useRef({});

  const db = getFirestore(app);
  const rawSubjectMap = useMemo(() => Object.fromEntries(subjects.map(subject => [subject.id, subject])), [subjects]);
  const weekConfig = useMemo(() => getWeekConfig(student || {}), [
    student?.week_reset_day,
    student?.week_reset_hour,
    student?.week_reset_minute,
  ]);
  const {
    weekIdentity,
    weeklyPlan: publishedWeeklyPlan,
    loading: publishedWeeklyPlanLoading,
  } = useStudentPortalWeeklyPlan({
    student,
    enabled: Boolean(student?.id && student?.parent_id),
  });
  const timerValidationWorkItems = useMemo(() => (
    publishedWeeklyPlan
      ? buildPublishedWeeklyPlanPortalWorkItems({
        weeklyPlan: publishedWeeklyPlan,
        subjectsById: rawSubjectMap,
      })
      : []
  ), [publishedWeeklyPlan, rawSubjectMap]);
  const timerBlockContext = useMemo(() => buildPortalTimerBlockContext({
    hasPublishedWeeklyPlan: Boolean(publishedWeeklyPlan),
    publishedWorkItems: timerValidationWorkItems,
    subjects,
  }), [publishedWeeklyPlan, subjects, timerValidationWorkItems]);
  const timerPartition = useMemo(() => partitionPortalTimers({
    activeTimers,
    blockContext: timerBlockContext,
    completedBlocks,
    weeklyPlanId: publishedWeeklyPlan?.id || '',
    weekKey: weekIdentity?.weekKey || '',
    weekStart: weekIdentity?.weekStart || null,
  }), [
    activeTimers,
    completedBlocks,
    publishedWeeklyPlan?.id,
    timerBlockContext,
    weekIdentity?.weekKey,
    weekIdentity?.weekStart,
  ]);
  const currentActiveTimers = timerPartition.currentTimers;
  const staleTimerSubjectIds = Object.keys(timerPartition.staleTimers);
  const staleTimerSubjectIdsKey = staleTimerSubjectIds.sort().join('|');
  const activeTimerSessions = useMemo(() => (
    Object.entries(currentActiveTimers).map(([subjectId, timer]) => ({
      id: `${subjectId}_${timer?.blockIndex ?? 0}`,
      subject_id: subjectId,
      block_index: timer?.blockIndex ?? 0,
      is_running: Boolean(timer?.isRunning),
      status: timer?.isRunning ? 'active' : 'paused',
      remaining_time: Number(timer?.remainingTime || 0),
      saved_at: timer?.savedAt ?? Date.now(),
      updated_at: timer?.updatedAt ?? null,
      weekly_plan_id: timer?.weeklyPlanId ?? timer?.weekly_plan_id ?? '',
      week_key: timer?.weekKey ?? timer?.week_key ?? '',
      block_id: timer?.blockId ?? timer?.block_id ?? '',
    })).filter((timerSession) => Boolean(timerSession.subject_id))
  ), [currentActiveTimers]);
  const workLauncherContract = useMemo(() => buildPublishedWeeklyPlanWorkLauncherContract({
    studentRecord: student,
    weeklyPlan: publishedWeeklyPlan,
    subjectsById: rawSubjectMap,
    timerSessions: activeTimerSessions,
    completedBlocks,
    entitlementActive: true,
    referenceDate: new Date(),
  }), [activeTimerSessions, completedBlocks, publishedWeeklyPlan, rawSubjectMap, student]);
  const hasPublishedWeeklyPlan = workLauncherContract.has_published_weekly_plan;
  const publishedWorkItems = workLauncherContract.blocks;
  const portalSubjects = workLauncherContract.bridge_subjects.length > 0
    ? workLauncherContract.bridge_subjects
    : subjects;
  const portalSubjectIds = useMemo(
    () => portalSubjects.map((subject) => subject.id).filter(Boolean),
    [portalSubjects]
  );
  const portalSubjectIdsKey = portalSubjectIds.join('|');
  const subjectMap = useMemo(
    () => Object.fromEntries(portalSubjects.map(subject => [subject.id, subject])),
    [portalSubjects]
  );
  const { portalAccess, getNextAvailableBlock, getSubjectPolicy, getWorkItemPolicy } = useStudentAccessPolicy({
    student,
    subjects: portalSubjects,
    completedBlocks,
    activeTimers: currentActiveTimers,
    submissionLocksRef,
  });
  const currentPolicyPreview = workLauncherContract.policy_preview;
  const currentWorkGuidance = useMemo(() => {
    const baseGuidance = getLockdownStateGuidance({
      stateKey: currentPolicyPreview?.policy_state_metadata?.state,
      policy: currentPolicyPreview?.policy,
      syncState: {},
    });

    if (baseGuidance.stateKey === 'active_block') {
      return {
        ...baseGuidance,
        label: 'Active block',
        title: 'Current work is ready',
        copy: 'You have an active block ready in the portal. Start or continue here and use the approved resources below.',
        next_step: 'Open the current block or return to the subject list.',
      };
    }

    return baseGuidance;
  }, [currentPolicyPreview]);
  const currentAllowedResources = workLauncherContract.allowed_resources;
  const requestAccessGuidance = useMemo(() => getRequestAccessGuidance(), []);
  const getSoundUrl = (file) => `${import.meta.env.BASE_URL}sounds/${file}`;
  const portalLoading = loading || (Boolean(student?.id && student?.parent_id) && publishedWeeklyPlanLoading);
  const studentChores = useStudentChores({
    student,
    slug,
    pin,
    isAuthenticated,
    enabled: Boolean(student?.id),
  });
  const subjectMapRef = useRef(subjectMap);
  const getNextAvailableBlockRef = useRef(getNextAvailableBlock);

  useEffect(() => {
    subjectMapRef.current = subjectMap;
    getNextAvailableBlockRef.current = getNextAvailableBlock;
  }, [getNextAvailableBlock, subjectMap]);

  useEffect(() => {
    if (
      activeWorkspace === 'chores'
      && !studentChores.loading
      && !studentChores.isResolvingAccess
      && !studentChores.canShowTab
    ) {
      setActiveWorkspace('school');
    }
    if (
      activeWorkspace === 'rewards'
      && !studentChores.loading
      && !studentChores.isResolvingAccess
      && !studentChores.canShowRewardTab
    ) {
      setActiveWorkspace('school');
    }
  }, [
    activeWorkspace,
    studentChores.canShowRewardTab,
    studentChores.canShowTab,
    studentChores.isResolvingAccess,
    studentChores.loading,
  ]);

  const ensureAlarmAudio = () => {
    if (!alarmAudioRef.current) {
      alarmAudioRef.current = new Audio(getSoundUrl(alarmSoundRef.current));
      alarmAudioRef.current.preload = 'auto';
    }

    const expectedSrc = new URL(getSoundUrl(alarmSoundRef.current), window.location.href).href;
    if (alarmAudioRef.current.src !== expectedSrc) {
      alarmAudioRef.current.src = getSoundUrl(alarmSoundRef.current);
      alarmPrimedRef.current = false;
    }

    return alarmAudioRef.current;
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
    let unsubscribeSubjects = () => {};
    let unsubscribeLegacySubjects = () => {};
    let unsubscribeSubmissions = () => {};
    const cleanupStudentListeners = () => {
      unsubscribeSubjects();
      unsubscribeLegacySubjects();
      unsubscribeSubmissions();
      unsubscribeSubjects = () => {};
      unsubscribeLegacySubjects = () => {};
      unsubscribeSubmissions = () => {};
    };
    const studentQuery = query(collection(db, 'students'), where('slug', '==', slug), limit(1));
    const unsubscribeStudent = onSnapshot(studentQuery, (snapshot) => {
      if (snapshot.empty) { setError('Student not found'); setLoading(false); return; }
      cleanupStudentListeners();
      const studentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      setStudent(studentData);

      const subjectsQuery = query(collection(db, 'subjects'),
        where('parent_id', '==', studentData.parent_id), where('is_active', '==', true),
        where('student_ids', 'array-contains', studentData.id), orderBy('title'));
      unsubscribeSubjects = onSnapshot(subjectsQuery, (snap) => {
        const subjectsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (subjectsData.length === 0) {
          unsubscribeLegacySubjects();
          const oldQuery = query(collection(db, 'subjects'),
            where('parent_id', '==', studentData.parent_id), where('student_id', '==', studentData.id),
            where('is_active', '==', true), orderBy('title'));
          unsubscribeLegacySubjects = onSnapshot(oldQuery, (oldSnap) => {
            setSubjects(oldSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
          }, () => setLoading(false));
        } else {
          unsubscribeLegacySubjects();
          unsubscribeLegacySubjects = () => {};
          setSubjects(subjectsData);
          setLoading(false);
        }
      }, () => setLoading(false));

      const { weekStart } = getCurrentWeekRange(new Date(), studentData);
      const submissionsQuery = query(collection(db, 'submissions'),
        where('student_id', '==', studentData.id), where('timestamp', '>=', weekStart), orderBy('timestamp', 'desc'));
      unsubscribeSubmissions = onSnapshot(submissionsQuery, (snap) => {
        const nextCompletedBlocks = {};
        snap.docs.forEach((submissionDoc) => {
          const submission = submissionDoc.data();
          if (!submission.subject_id || !Number.isInteger(submission.block_index)) return;
          if (!nextCompletedBlocks[submission.subject_id]) {
            nextCompletedBlocks[submission.subject_id] = [];
          }
          nextCompletedBlocks[submission.subject_id].push(submission.block_index);
        });
        setCompletedBlocks(nextCompletedBlocks);
      });
    }, () => { setError('Student not found'); setLoading(false); });
    return () => {
      unsubscribeStudent();
      cleanupStudentListeners();
    };
  }, [slug, db]);

  useEffect(() => {
    if (!student?.id) return undefined;
    if (!portalSubjectIdsKey) {
      setActiveTimers((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }

    incrementPortalDiagnostic('timerListenerEffectRuns');
    const unsubscribers = portalSubjectIds.map((subjectId) => {
      incrementPortalDiagnostic('timerSubscriptions');
      const timerRef = doc(db, 'timerSessions', getTimerSessionDocId(student.id, subjectId));

      return onSnapshot(timerRef, async (snapshot) => {
        incrementPortalDiagnostic('timerSnapshots');
        if (timerRemovalInFlightRef.current[subjectId] && snapshot.exists()) {
          return;
        }

        if (!snapshot.exists()) {
          if (timerRemovalInFlightRef.current[subjectId]) {
            clearTimerFromStorage(getTimerKey(student.id, subjectId));
            setActiveTimers((prev) => {
              if (!prev[subjectId]) return prev;
              const updated = { ...prev };
              delete updated[subjectId];
              return updated;
            });
            delete timerRemovalInFlightRef.current[subjectId];
            delete previousTimersRef.current[subjectId];
            delete completionNotifiedRef.current[subjectId];
            return;
          }

          const key = getTimerKey(student.id, subjectId);
          const stored = loadTimerFromStorage(key);
          const currentSubject = subjectMapRef.current[subjectId];
          const nextBlock = currentSubject
            ? getNextAvailableBlockRef.current(currentSubject)
            : null;

          if (currentSubject && stored && stored.blockIndex === nextBlock) {
            const hydrated = hydrateStoredTimer(stored);

            if (hydrated) {
              try {
                await persistTimer(currentSubject, hydrated, true);
              } catch (migrationError) {
                console.error('Error migrating timer to Firestore:', migrationError);
              }
            }
          }

          clearTimerFromStorage(key);
          setActiveTimers((prev) => {
            if (!prev[subjectId]) return prev;
            const updated = { ...prev };
            delete updated[subjectId];
            return updated;
          });
          delete timerRemovalInFlightRef.current[subjectId];
          delete previousTimersRef.current[subjectId];
          delete completionNotifiedRef.current[subjectId];
          return;
        }

        const hydrated = hydrateStoredTimer(snapshot.data());

        setActiveTimers((prev) => (
          hasSameTimerLifecycle(prev[subjectId], hydrated)
            ? prev
            : { ...prev, [subjectId]: hydrated }
        ));
      });
    });

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [db, portalSubjectIdsKey, student?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTimers(prev => {
        let updated = prev;
        Object.keys(prev).forEach(subjectId => {
          const timer = prev[subjectId];
          if (timer && timer.isRunning && !timer.pausedAt) {
            const remaining = getRemainingTime(timer.targetEndTime);
            if (remaining === 0) {
              if (updated === prev) updated = { ...prev };
              updated[subjectId] = {
                ...timer,
                remainingTime: 0,
                isRunning: false,
                pausedAt: null,
                completedAt: timer.completedAt ?? Date.now(),
              };
            }
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Object.entries(currentActiveTimers).forEach(([subjectId, timer]) => {
      const previousTimer = previousTimersRef.current[subjectId];

      if (
        previousTimer?.remainingTime > 0 &&
        timer?.remainingTime === 0 &&
        !completionNotifiedRef.current[subjectId]
      ) {
        const subject = subjectMap[subjectId];
        if (subject) {
          persistTimer(subject, timer).catch((error) => {
            console.error('Error syncing completed timer:', error);
          });
        }
        playNotificationSound().catch((error) => {
          console.warn('Alarm playback failed:', error);
        });
        completionNotifiedRef.current[subjectId] = true;
      }
    });

    Object.keys(previousTimersRef.current).forEach((subjectId) => {
      if (!currentActiveTimers[subjectId]) {
        delete previousTimersRef.current[subjectId];
      }
    });

    previousTimersRef.current = Object.fromEntries(
      Object.entries(currentActiveTimers).map(([subjectId, timer]) => [subjectId, { ...timer }])
    );
  }, [currentActiveTimers, subjectMap]);

  useEffect(() => {
    if (!student) return;
    const saved = localStorage.getItem(`alarm_sound_${student.id}`);
    if (saved && ALARM_SOUNDS.some(s => s.file === saved)) {
      setAlarmSound(saved);
      alarmSoundRef.current = saved;
    }
  }, [student?.id]);

  const handleAlarmChange = async (file) => {
    setAlarmSound(file);
    alarmSoundRef.current = file;
    if (student) localStorage.setItem(`alarm_sound_${student.id}`, file);
    const audio = ensureAlarmAudio();
    audio.src = getSoundUrl(file);
    alarmPrimedRef.current = false;

    try {
      await primeAlarmAudio();
    } catch (error) {
      console.warn('Unable to prime selected alarm sound:', error);
    }

    const previewAudio = new Audio(getSoundUrl(file));
    previewAudio.currentTime = 0;
    previewAudio.play().catch((error) => {
      console.warn('Alarm preview was blocked:', error);
    });
  };

  const stopAlarm = () => {
    if (alarmStopTimerRef.current) { clearTimeout(alarmStopTimerRef.current); alarmStopTimerRef.current = null; }
    if (alarmAudioRef.current) { alarmAudioRef.current.loop = false; alarmAudioRef.current.pause(); alarmAudioRef.current.currentTime = 0; }
  };

  const playNotificationSound = async () => {
    stopAlarm();

    try {
      const audio = ensureAlarmAudio();
      audio.loop = true;
      audio.muted = false;
      audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      console.warn('Alarm playback was blocked:', error);
    }

    alarmStopTimerRef.current = setTimeout(stopAlarm, 20_000);
  };

  const getLauncherWorkItemForSubject = (subject, blockIndex) => {
    if (hasPublishedWeeklyPlan) {
      return publishedWorkItems.find((workItem) => (
        workItem?.legacySubjectId === subject?.id
        && workItem?.compatibilityBlockIndex === blockIndex
      )) || null;
    }

    return {
      id: `${subject?.id || 'subject'}_block_${blockIndex}`,
      title: subject?.portal_display_title || subject?.title || 'Untitled Block',
      legacySubjectId: subject?.id || '',
      legacySubjectTitle: subject?.title || '',
      compatibilityBlockIndex: blockIndex,
      plannedDurationMinutes: subject?.block_length || 30,
      requireTimer: Boolean(subject?.require_timer),
      requireInput: subject?.require_input !== false,
      resources: Array.isArray(subject?.resources) ? subject.resources : [],
      customFields: Array.isArray(subject?.custom_fields) ? subject.custom_fields : [],
      instruction: subject?.block_objectives?.[blockIndex]?.instruction || null,
      color: subject?.color || '',
      compatibilitySubject: subject,
      source_kind: 'legacy_subject_bridge',
    };
  };

  const buildTimerSessionPayload = (subject, timer, includeCreatedAt = false) => {
    const launcherWorkItem = getLauncherWorkItemForSubject(subject, timer.blockIndex);
    const payload = buildWorkLauncherTimerSessionPayload({
      studentRecord: student,
      weeklyPlan: publishedWeeklyPlan,
      weekKey: weekIdentity?.weekKey || '',
      workItem: launcherWorkItem || {
        id: `${subject?.id || 'subject'}_block_${timer.blockIndex}`,
        legacySubjectId: subject?.id || '',
        legacySubjectTitle: subject?.title || '',
        compatibilityBlockIndex: timer.blockIndex,
        compatibilitySubject: subject,
      },
      timer,
    }) || {};

    payload.remaining_time = timer.remainingTime ?? getRemainingTime(timer.targetEndTime);
    payload.updated_at = serverTimestamp();
    if (includeCreatedAt) {
      payload.created_at = serverTimestamp();
    }

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
    if (timerRemovalPromisesRef.current[subjectId]) {
      await timerRemovalPromisesRef.current[subjectId];
      return;
    }

    timerRemovalInFlightRef.current[subjectId] = true;
    clearTimerFromStorage(getTimerKey(student.id, subjectId));
    delete previousTimersRef.current[subjectId];
    delete completionNotifiedRef.current[subjectId];

    const removalPromise = deleteDoc(doc(db, 'timerSessions', getTimerSessionDocId(student.id, subjectId)));
    timerRemovalPromisesRef.current[subjectId] = removalPromise;

    try {
      await removalPromise;
    } catch (error) {
      delete timerRemovalInFlightRef.current[subjectId];
      throw error;
    } finally {
      if (timerRemovalPromisesRef.current[subjectId] === removalPromise) {
        delete timerRemovalPromisesRef.current[subjectId];
      }
    }
  };

  const startTimer = async (subject, preferredBlockIndex = null) => {
    if (!subject) return;

    if (timerRemovalPromisesRef.current[subject.id]) {
      try {
        await timerRemovalPromisesRef.current[subject.id];
      } catch (cleanupError) {
        console.error('Error clearing previous timer:', cleanupError);
        setError('The previous timer could not be cleared. Please try again.');
        return;
      }
    }

    const subjectPolicy = getSubjectPolicy(subject, { blockIndex: preferredBlockIndex });
    const timerStartPolicy = subjectPolicy.canStartTimer;
    if (!timerStartPolicy.allowed) {
      if (
        timerStartPolicy.blockedReason?.code === StudentAccessPolicyReasonCodes.NO_AVAILABLE_BLOCKS
        || timerStartPolicy.blockedReason?.code === StudentAccessPolicyReasonCodes.SUBJECT_COMPLETE
      ) {
        alert('All blocks completed!');
      } else if (timerStartPolicy.blockedReason?.message) {
        setError(timerStartPolicy.blockedReason.message);
      }
      return;
    }

    await primeAlarmAudio();
    const candidateBlock = timerStartPolicy.meta?.candidateBlockIndex;

    const config = {
      ...createTimerConfig(subject?.block_length || 30),
      blockIndex: candidateBlock,
      isRunning: true,
      pausedAt: null,
      completedAt: null,
    };

    setActiveTimers(prev => ({ ...prev, [subject.id]: config }));
    setExpandedSubjectId(subject.id);
    setExpandedBlockIndex(candidateBlock);
    delete completionNotifiedRef.current[subject.id];
    delete timerRemovalInFlightRef.current[subject.id];

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
    const current = currentActiveTimers[subject.id];
    const config = {
      ...current,
      remainingTime: current?.isRunning && !current?.pausedAt
        ? getRemainingTime(current.targetEndTime)
        : current?.remainingTime,
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
    const current = currentActiveTimers[subject.id];
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
    stopAlarm();
    setActiveTimers(prev => { const u = { ...prev }; delete u[subject.id]; return u; });

    try {
      await removeTimer(subject.id);
    } catch (err) {
      console.error('Error resetting timer:', err);
      setError('Failed to reset timer. Please try again.');
    }
  };

  useEffect(() => {
    if (!student?.id || !staleTimerSubjectIdsKey) return;

    staleTimerSubjectIds.forEach((subjectId) => {
      if (timerRemovalInFlightRef.current[subjectId]) return;

      setActiveTimers((prev) => {
        if (!prev[subjectId]) return prev;
        const updated = { ...prev };
        delete updated[subjectId];
        return updated;
      });

      removeTimer(subjectId).catch((cleanupError) => {
        console.warn('Unable to delete stale timer session:', cleanupError);
      });
    });
  }, [staleTimerSubjectIdsKey, student?.id]);

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
  const handleSignOut = () => {
    setIsAuthenticated(false);
    setPin('');
    setActiveWorkspace('school');
    setError('');
  };

  const closeSubmissionModal = () => {
    clearSubmissionLock(selectedSubject?.id, selectedBlockIndex);
    setSelectedSubject(null);
    setSelectedBlockIndex(null);
    setSummaryText('');
    setSelectedResources([]);
    resetCustomFieldResponses();
  };

  useEffect(() => {
    if (activeWorkspace !== 'school' && selectedSubject) {
      closeSubmissionModal();
    }
  }, [activeWorkspace, selectedSubject]);

  const getBlockObjective = (subject, blockIndex) => {
    if (!subject || blockIndex === null || blockIndex === undefined) return null;
    return subject.block_objectives?.[blockIndex] || null;
  };

  const getEffectiveInstruction = (subject, blockIndex) => {
    const blockObj = getBlockObjective(subject, blockIndex);
    return blockObj?.student_overrides?.[student?.id]?.instruction || blockObj?.instruction || null;
  };

  const getEffectiveCustomFields = (subject, blockIndex) => {
    const blockObj = getBlockObjective(subject, blockIndex);
    const studentOverride = blockObj?.student_overrides?.[student?.id];
    return (
      (studentOverride?.custom_fields?.length > 0 ? studentOverride.custom_fields : null) ||
      (blockObj?.custom_fields?.length > 0 ? blockObj.custom_fields : null) ||
      subject?.custom_fields ||
      []
    );
  };

  const handleSubjectToggle = (subjectId) => {
    setExpandedSubjectId((currentSubjectId) => {
      if (currentSubjectId === subjectId) {
        setExpandedBlockIndex(null);
        return null;
      }

      setExpandedBlockIndex(null);
      return subjectId;
    });
    setError('');
  };

  const handleBlockSelect = (subject, blockIndex) => {
    const subjectPolicy = getSubjectPolicy(subject, { blockIndex });
    if (!subject || isBlockCompleted(subject, blockIndex) || !subjectPolicy.subjectAvailability.allowed) return;
    setExpandedSubjectId(subject.id);
    setExpandedBlockIndex(blockIndex);
    setError('');
  };

  const handleWorkItemSelect = (workItem) => {
    const compatibilitySubject = workItem?.compatibilitySubject;
    const compatibilityBlockIndex = workItem?.compatibilityBlockIndex;
    const workItemPolicy = getWorkItemPolicy(workItem);

    if (
      !compatibilitySubject
      || compatibilityBlockIndex === null
      || compatibilityBlockIndex === undefined
      || isBlockCompleted(compatibilitySubject, compatibilityBlockIndex)
      || !workItemPolicy.subjectAvailability.allowed
    ) {
      return;
    }

    setExpandedSubjectId(compatibilitySubject.id);
    setExpandedBlockIndex(compatibilityBlockIndex);
    setError('');
  };

  const openCompletionModal = (subject, blockIndex) => {
    if (!subject || blockIndex === null || blockIndex === undefined) return;
    const subjectPolicy = getSubjectPolicy(subject, { blockIndex });
    if (!subjectPolicy.canSubmitBlock.allowed) {
      setError(subjectPolicy.canSubmitBlock.blockedReason?.message || 'Unable to submit this block right now.');
      return;
    }
    if (subject.require_timer) {
      const timer = currentActiveTimers[subject.id];
      setActiveTimers(prev => ({ ...prev, [subject.id]: { ...timer, isFinished: true, isRunning: false } }));
    }

    setSubmissionLock(subject.id, blockIndex);
    setSelectedSubject(subject);
    setSelectedBlockIndex(blockIndex);
    setSummaryText('');
    setSelectedResources([]);
    resetCustomFieldResponses();
  };

  const handleCompleteBlock = (subject) => {
    if (!subject) return;
    stopAlarm();
    const timerBlock = currentActiveTimers[subject.id]?.blockIndex;
    const selectedBlock = expandedSubjectId === subject.id ? expandedBlockIndex : null;
    const targetBlock = timerBlock ?? selectedBlock ?? getNextAvailableBlock(subject);
    const subjectPolicy = getSubjectPolicy(subject, { blockIndex: targetBlock });
    if (!subjectPolicy.canSubmitBlock.allowed) {
      if (subjectPolicy.canSubmitBlock.blockedReason?.code === StudentAccessPolicyReasonCodes.SUBJECT_COMPLETE) {
        alert('All blocks completed!');
      } else if (subjectPolicy.canSubmitBlock.blockedReason?.message) {
        setError(subjectPolicy.canSubmitBlock.blockedReason.message);
      }
      return;
    }
    openCompletionModal(subject, targetBlock);
  };

  const handleCompleteWorkItem = (workItem) => {
    const compatibilitySubject = workItem?.compatibilitySubject;
    const compatibilityBlockIndex = workItem?.compatibilityBlockIndex;
    const activeSubjectTimer = compatibilitySubject ? currentActiveTimers[compatibilitySubject.id] : null;

    if (!compatibilitySubject || compatibilityBlockIndex === null || compatibilityBlockIndex === undefined) {
      return;
    }

    if (activeSubjectTimer && activeSubjectTimer.blockIndex !== compatibilityBlockIndex) {
      setError(`Timer is currently active for Block ${activeSubjectTimer.blockIndex + 1}. Finish or reset that timer first.`);
      return;
    }

    stopAlarm();

    const workItemPolicy = getWorkItemPolicy(workItem);

    if (!workItemPolicy.canSubmitBlock.allowed) {
      if (workItemPolicy.canSubmitBlock.blockedReason?.code === StudentAccessPolicyReasonCodes.SUBJECT_COMPLETE) {
        alert('All blocks completed!');
      } else if (workItemPolicy.canSubmitBlock.blockedReason?.message) {
        setError(workItemPolicy.canSubmitBlock.blockedReason.message);
      }
      return;
    }

    openCompletionModal(compatibilitySubject, compatibilityBlockIndex);
  };

  const submitBlock = async (subject, blockIndex, summary) => {
    stopAlarm();
    const subjectPolicy = getSubjectPolicy(subject, { blockIndex, ignoreSubmissionLock: true });
    if (!subjectPolicy.canSubmitBlock.allowed) {
      setError(subjectPolicy.canSubmitBlock.blockedReason?.message || 'Unable to submit this block right now.');
      clearSubmissionLock(subject.id, blockIndex);
      return;
    }
    setSubmissionLock(subject.id, blockIndex);
    setSubmitting(true);
    try {
      const { weekStart } = getCurrentWeekRange(new Date(), weekConfig);
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
        subject_name: getSubmissionSubjectName(subject), subject_id: subject.id,
        block_index: blockIndex, timestamp: serverTimestamp(),
        summary_text: subject.require_input !== false ? summary : null,
        block_duration: subject.block_length || 30, is_locked: true,
        resources_used: selectedResources, custom_field_responses: customFieldResponses,
        created_at: serverTimestamp()
      });

      try {
        await removeTimer(subject.id);
      } catch (timerCleanupError) {
        console.warn('Block was submitted, but the remote timer could not be cleared:', timerCleanupError);
      }
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
  const getSubjectProgress = useMemo(() => (subject) => completedBlocks[subject.id]?.length || 0, [completedBlocks]);
  const totalCompletedBlocks = useMemo(() => (
    hasPublishedWeeklyPlan
      ? publishedWorkItems.reduce((count, workItem) => (
        count + (isBlockCompleted(workItem.compatibilitySubject, workItem.compatibilityBlockIndex) ? 1 : 0)
      ), 0)
      : subjects.reduce((count, subject) => count + (completedBlocks[subject.id]?.length || 0), 0)
  ), [completedBlocks, hasPublishedWeeklyPlan, isBlockCompleted, publishedWorkItems, subjects]);
  const totalBlocks = useMemo(() => (
    hasPublishedWeeklyPlan
      ? publishedWorkItems.length
      : subjects.reduce((count, subject) => count + (subject.block_count || 0), 0)
  ), [hasPublishedWeeklyPlan, publishedWorkItems, subjects]);
  const weeklyPct = totalBlocks > 0 ? Math.round((totalCompletedBlocks / totalBlocks) * 100) : 0;

  if (portalLoading) {
    return (
      <div className="student-portal-v2 student-portal-loading">
        <div className="student-loading-spinner" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="student-portal-v2 student-portal-loading" style={{ fontFamily: FONT }}>
        <div className="student-empty-state">
          <h2>Student not found</h2>
          <p>Please check your link and try again.</p>
        </div>
      </div>
    );
  }

  // PIN screen
  if (!isAuthenticated && student.access_pin) {
    return (
      <StudentPortalPinGate
        studentName={student.name}
        pin={pin}
        error={error}
        onPinChange={setPin}
        onSubmit={handlePinSubmit}
      />
    );
  }

  return (
    <div className="student-portal-v2" style={{ fontFamily: FONT }}>
      <header className="student-portal-topbar">
        <div className="student-portal-brand"><span>OwnPath</span><strong>Student Portal</strong></div>
        <div className="student-portal-topbar-spacer" />
        {studentChores.canShowRewardTab && studentChores.rewardStore.wallet ? <div className="student-portal-points"><Star />{studentChores.rewardStore.wallet.total_points || 0} pts</div> : null}
        <label className="sr-only" htmlFor="student-alarm-sound">Timer alarm sound</label>
        <select id="student-alarm-sound" className="student-alarm-select" value={alarmSound} onChange={(event) => handleAlarmChange(event.target.value)}>
          {ALARM_SOUNDS.map((sound) => <option key={sound.file} value={sound.file}>{sound.label}</option>)}
        </select>
        <button type="button" className="student-profile-control" onClick={() => setActiveWorkspace('profile')}><span className="student-mini-avatar" /><span className="student-profile-name">{student.name}</span><UserRound /></button>
        {student.access_pin ? <button type="button" className="student-button is-icon" onClick={handleSignOut} aria-label="Sign out"><LogOut /></button> : null}
      </header>

      <nav className="student-portal-nav" aria-label="Student workspaces" data-testid="student-portal-workspaces">
        <button type="button" className={activeWorkspace === 'school' ? 'is-active' : ''} onClick={() => setActiveWorkspace('school')}><BookOpen />School</button>
        {studentChores.canShowTab ? <button type="button" className={activeWorkspace === 'chores' ? 'is-active' : ''} onClick={() => setActiveWorkspace('chores')} data-testid="student-portal-chores-tab"><ListChecks />Chores{studentChores.workspace.claimedChores.length > 0 ? <span className="student-nav-badge">{studentChores.workspace.claimedChores.length}</span> : null}</button> : null}
        <button type="button" className={activeWorkspace === 'allowance' ? 'is-active' : ''} onClick={() => setActiveWorkspace('allowance')}><Coins />Allowance</button>
        {studentChores.canShowRewardTab ? <button type="button" className={activeWorkspace === 'rewards' ? 'is-active' : ''} onClick={() => setActiveWorkspace('rewards')} data-testid="student-portal-rewards-tab"><Gift />Rewards</button> : null}
        <button type="button" className={activeWorkspace === 'profile' ? 'is-active' : ''} onClick={() => setActiveWorkspace('profile')}><UserRound />My Avatar</button>
      </nav>

      <main className="student-portal-content">

        {activeWorkspace === 'school' ? (
          <StudentSchoolWorkspace
            student={student}
            hasPublishedWeeklyPlan={hasPublishedWeeklyPlan}
            publishedWorkItems={publishedWorkItems}
            subjects={subjects}
            portalAccess={portalAccess}
            totalCompletedBlocks={totalCompletedBlocks}
            totalBlocks={totalBlocks}
            weeklyPct={weeklyPct}
            error={error}
            activeTimers={currentActiveTimers}
            expandedSubjectId={expandedSubjectId}
            expandedBlockIndex={expandedBlockIndex}
            submitting={submitting}
            currentWorkGuidance={currentWorkGuidance}
            isBlockCompleted={isBlockCompleted}
            isSubmissionLocked={isSubmissionLocked}
            getSubjectPolicy={getSubjectPolicy}
            getWorkItemPolicy={getWorkItemPolicy}
            getEffectiveInstruction={getEffectiveInstruction}
            getEffectiveCustomFields={getEffectiveCustomFields}
            onToggleSubject={handleSubjectToggle}
            onSelectBlock={handleBlockSelect}
            onSelectWorkItem={handleWorkItemSelect}
            onStartTimer={startTimer}
            onPauseTimer={pauseTimer}
            onResumeTimer={resumeTimer}
            onResetTimer={resetTimer}
            onCompleteSubject={handleCompleteBlock}
            onCompleteWorkItem={handleCompleteWorkItem}
          />
        ) : activeWorkspace === 'chores' ? (
          <StudentChoresWorkspaceV2
            workspace={studentChores.workspace}
            loading={studentChores.loading || studentChores.isResolvingAccess}
            error={studentChores.error}
            onClaimChore={studentChores.claimChore}
            onCompleteChore={studentChores.completeChore}
            onCompleteRoutine={studentChores.completeRoutine}
            claimingIds={studentChores.claimingIds}
            completingClaimIds={studentChores.completingClaimIds}
            completingRoutineIds={studentChores.completingRoutineIds}
          />
        ) : activeWorkspace === 'rewards' ? (
          <StudentRewardStoreV2
            store={studentChores.rewardStore}
            loading={studentChores.loading || studentChores.isResolvingAccess}
            error={studentChores.error}
            onRedeem={studentChores.requestRewardRedemption}
            onCancelRedemption={studentChores.cancelRewardRedemption}
            requestingRewardIds={studentChores.requestingRewardIds}
            cancelingRewardIds={studentChores.cancelingRewardIds}
          />
        ) : activeWorkspace === 'allowance' ? (
          <div className="student-workspace-layout">
            <section className="student-workspace-main">
              <header className="student-page-heading"><div><h1>Allowance</h1><p>Your weekly earnings workspace</p></div><span className="student-status-chip">Coming soon</span></header>
              <div className="student-coming-soon"><div><Coins /><h1>Allowance is coming soon</h1><p>Your parent is finishing the rules for base allowance, chore bounties, adjustments, and payouts.</p></div></div>
            </section>
            <aside className="student-workspace-rail">
              <div className="student-rail-section"><p className="student-eyebrow">Planned here</p><strong className="student-rail-title">Weekly earnings</strong><p className="student-rail-copy">See completed allowance chores, extra bounties, adjustments, and payout status in one place.</p></div>
            </aside>
          </div>
        ) : activeWorkspace === 'profile' ? (
          <StudentAvatarWorkspace />
        ) : (
          <>
        {/* Weekly Progress */}
        {totalBlocks > 0 && (
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

        {hasPublishedWeeklyPlan && (
          <div className="rounded-2xl p-4 mb-7" style={{ backgroundColor: '#fbf8ff', border: `1px solid ${C.lavender}` }}>
            <p style={{ fontSize: 14, color: C.charcoal, fontWeight: 540 }}>This week is running from a published plan.</p>
            <p className="mt-1" style={{ fontSize: 13, color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
              Timers, submissions, and completion checks still use your existing subject records behind the scenes.
            </p>
          </div>
        )}

        <div className="rounded-2xl p-6 mb-7 bg-white" style={{ border: `1px solid ${C.parchment}` }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                Current work
              </p>
              <h2 style={{ fontSize: 18, fontWeight: 540, color: C.charcoal, lineHeight: 1.15 }}>
                {currentWorkGuidance.title}
              </h2>
            </div>
            <span className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full" style={{ backgroundColor: `${C.lavender}26`, color: C.amethyst, fontWeight: 700 }}>
              {currentWorkGuidance.label}
            </span>
          </div>
          <p className="mt-3" style={{ fontSize: 14, color: 'rgba(41,40,39,0.72)', fontWeight: 460, lineHeight: 1.5 }}>
            {currentWorkGuidance.copy}
          </p>
          <p className="mt-2" style={{ fontSize: 12, color: 'rgba(41,40,39,0.5)', fontWeight: 460, lineHeight: 1.45 }}>
            {currentWorkGuidance.next_step}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] px-2 py-1 rounded-full" style={{ backgroundColor: `${C.lavender}26`, color: C.amethyst, fontWeight: 700 }}>
              {workLauncherContract.source_kind === 'published_weekly_plan' ? 'Published plan' : 'Legacy bridge'}
            </span>
            {workLauncherContract.active_work_session && (
              <span className="text-[11px] px-2 py-1 rounded-full" style={{ backgroundColor: `${C.cream}cc`, color: C.charcoal, fontWeight: 700 }}>
                Active block
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="rounded-xl p-3" style={{ backgroundColor: '#faf9f8', border: `1px solid ${C.parchment}` }}>
              <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Allowed websites</p>
              {currentAllowedResources.allowedOrigins.length > 0 ? (
                <ul className="space-y-1">
                  {currentAllowedResources.allowedOrigins.slice(0, 4).map((origin) => (
                    <li key={origin} className="text-[12px]" style={{ color: C.charcoal, fontWeight: 460 }}>{origin}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>No website origins are currently surfaced.</p>
              )}
            </div>

            <div className="rounded-xl p-3" style={{ backgroundColor: '#faf9f8', border: `1px solid ${C.parchment}` }}>
              <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Approved creators</p>
              {currentAllowedResources.allowedCreators.length > 0 ? (
                <ul className="space-y-1">
                  {currentAllowedResources.allowedCreators.slice(0, 4).map((creator) => (
                    <li key={creator.channel_id} className="text-[12px]" style={{ color: C.charcoal, fontWeight: 460 }}>
                      {creator.title || creator.channel_id}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>No approved creators are currently surfaced.</p>
              )}
            </div>

            <div className="rounded-xl p-3" style={{ backgroundColor: '#faf9f8', border: `1px solid ${C.parchment}` }}>
              <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Own Path resources</p>
              {currentAllowedResources.allowedSystemResources.length > 0 ? (
                <ul className="space-y-1">
                  {currentAllowedResources.allowedSystemResources.slice(0, 4).map((resource, index) => (
                    <li key={`${resource.name || resource.origin || resource.url || index}`} className="text-[12px]" style={{ color: C.charcoal, fontWeight: 460 }}>
                      {resource.name || resource.origin || resource.url || resource.page}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>No system resources are currently surfaced.</p>
              )}
            </div>
          </div>

          <p className="mt-4 text-[12px]" style={{ color: 'rgba(41,40,39,0.58)', fontWeight: 460, lineHeight: 1.45 }}>
            {requestAccessGuidance.copy}
          </p>
        </div>

        {!portalAccess.canViewSubjects.allowed || (hasPublishedWeeklyPlan ? publishedWorkItems.length === 0 : subjects.length === 0) ? (
          <div className="text-center py-16">
            <BookOpen className="w-10 h-10 mx-auto mb-4" style={{ color: 'rgba(41,40,39,0.2)' }} />
            <h3 style={{ fontSize: 18, fontWeight: 540, color: C.charcoal }} className="mb-2">
              {hasPublishedWeeklyPlan ? 'No blocks available' : 'No subjects available'}
            </h3>
            <p style={{ fontSize: 14, color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
              {portalAccess.canViewSubjects.allowed
                ? (
                  hasPublishedWeeklyPlan
                    ? 'This published week does not contain any live blocks yet.'
                    : 'Your parent needs to set up your subjects first.'
                )
                : (portalAccess.canViewSubjects.blockedReason?.message || 'Subject access is currently unavailable.')}
            </p>
          </div>
        ) : (
          hasPublishedWeeklyPlan ? (
            <div className="space-y-5">
              {publishedWorkItems.map((workItem, index) => {
                const subject = workItem.compatibilitySubject;
                const timer = currentActiveTimers[subject.id];
                const launchState = workItem.launch_state || {};
                const blockCompleted = Boolean(launchState.completed || isBlockCompleted(subject, workItem.compatibilityBlockIndex));
                const blockUnavailable = Boolean(launchState.unavailable);
                const workItemPolicy = getWorkItemPolicy(workItem);
                const timerCompletionPolicy = timer && timer.blockIndex === workItem.compatibilityBlockIndex
                  ? getWorkItemPolicy(workItem, { blockIndex: timer.blockIndex })
                  : null;
                const blockLocked = !blockCompleted && (blockUnavailable || !workItemPolicy.subjectAvailability.allowed);
                const timerMatchesBlock = timer && timer.blockIndex === workItem.compatibilityBlockIndex;
                const timerOnOtherBlock = timer && timer.blockIndex !== workItem.compatibilityBlockIndex;
                const statusLabel = blockCompleted
                  ? 'Complete'
                  : blockUnavailable
                    ? 'Unavailable'
                  : launchState.can_resume
                    ? 'Timer paused'
                  : timerMatchesBlock && timer.remainingTime === 0
                    ? 'Ready to submit'
                    : timerMatchesBlock && timer.isRunning
                      ? 'Timer active'
                    : timerMatchesBlock
                        ? 'Timer paused'
                        : timerOnOtherBlock
                          ? `Timer on Block ${timer.blockIndex + 1}`
                          : 'Ready';
                const statusColor = blockCompleted
                  ? C.amethyst
                  : blockUnavailable
                    ? 'rgba(41,40,39,0.35)'
                  : timerMatchesBlock
                    ? C.charcoal
                  : blockLocked
                    ? 'rgba(41,40,39,0.35)'
                    : 'rgba(41,40,39,0.7)';

                return (
                  <div key={workItem.id} className="rounded-2xl p-6 bg-white"
                    style={{
                      border: `1px solid ${blockCompleted ? C.lavender : C.parchment}`,
                      backgroundColor: blockCompleted ? '#f8f5ff' : '#ffffff',
                    }}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                          {workItem.legacySubjectTitle} • Block {workItem.compatibilityBlockIndex + 1}
                        </p>
                        <h3 style={{ fontSize: 18, fontWeight: 540, color: C.charcoal, lineHeight: 1.2 }} className="mb-1">
                          {getPortalSubjectTitle(subject)}
                        </h3>
                        <p style={{ fontSize: 13, color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                          Queue item {index + 1} of {publishedWorkItems.length}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: blockCompleted ? 'rgba(203,183,251,0.3)' : blockLocked ? C.cream : C.lavenderTint }}>
                        {blockCompleted ? <Check className="w-5 h-5" style={{ color: C.amethyst }} />
                          : blockLocked ? <Lock className="w-5 h-5" style={{ color: 'rgba(41,40,39,0.4)' }} />
                          : <BookOpen className="w-5 h-5" style={{ color: C.amethyst }} />}
                      </div>
                    </div>

                    <div className="space-y-2.5 mb-4">
                      <div className="flex justify-between text-[13px]">
                        <span style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>Status</span>
                        <span style={{ fontWeight: 460, color: statusColor }}>{statusLabel}</span>
                      </div>
                      <div className="flex justify-between text-[13px]">
                        <span style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>Planned Time</span>
                        <span style={{ color: C.charcoal, fontWeight: 460 }}>{workItem.plannedDurationMinutes} min</span>
                      </div>
                    </div>

                    {workItem.instruction && (
                      <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: `${C.lavender}1f`, borderLeft: `3px solid ${C.lavender}` }}>
                        <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: C.amethyst, fontWeight: 700 }}>Goals</p>
                        <p className="text-[14px]" style={{ color: C.charcoal, fontWeight: 460 }}>{workItem.instruction}</p>
                      </div>
                    )}

                    {workItem.resources.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Resources</p>
                        <div className="space-y-1.5">
                          {workItem.resources.map((resource, resourceIndex) => (
                            resource.url ? (
                              <a key={resourceIndex} href={resource.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[12px]"
                                style={{ color: C.amethyst, fontWeight: 460, textDecoration: 'none' }}>
                                <ExternalLink className="w-3 h-3" />{resource.name}
                              </a>
                            ) : (
                              <div key={resourceIndex} className="flex items-center gap-1.5 text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                                <BookOpen className="w-3 h-3" />{resource.name}
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}

                    {workItem.customFields.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Completion Requirements</p>
                        <p className="text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                          This block will ask for {workItem.customFields.length} response{workItem.customFields.length === 1 ? '' : 's'} when you submit it.
                        </p>
                      </div>
                    )}

                    {timerOnOtherBlock && (
                      <p className="text-[12px] mb-4" style={{ color: C.amethyst, fontWeight: 460 }}>
                        Timer is currently active for Block {timer.blockIndex + 1}. Finish or reset that timer before switching blocks.
                      </p>
                    )}

                    {blockLocked && (
                      <p className="text-[12px] mb-4" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                        {launchState.blocked_reason === 'completed'
                          ? 'This block is already complete.'
                          : workItemPolicy.subjectAvailability.blockedReason?.message || 'This block is unavailable right now.'}
                      </p>
                    )}

                    <div className="rounded-lg p-4" style={{ backgroundColor: '#faf9f8' }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] uppercase tracking-wider" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Timer</p>
                        <span className="text-[11px]" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                          Block {workItem.compatibilityBlockIndex + 1}
                        </span>
                      </div>
                      <div className="text-center mb-3">
                        {timerMatchesBlock ? (
                          <div className={`text-[28px] font-mono ${timer.remainingTime === 0 ? 'animate-pulse' : ''}`}
                            style={{ fontWeight: 540, color: timer.remainingTime === 0 ? C.amethyst : C.charcoal }}>
                            {formatRemainingTime(timer.remainingTime)}
                          </div>
                        ) : (
                          <div className="text-[22px] font-mono" style={{ fontWeight: 540, color: 'rgba(41,40,39,0.2)' }}>--:--</div>
                        )}
                        {timerMatchesBlock && timer?.remainingTime === 0 && (
                          <p className="text-[12px] mt-1" style={{ color: C.amethyst, fontWeight: 460 }}>Time's up — ready to submit?</p>
                        )}
                        {workItem.requireTimer && timerMatchesBlock && timer?.remainingTime > 0 && (
                          <p className="text-[11px] uppercase tracking-wider mt-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Timer required</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {!timerMatchesBlock ? (
                          <>
                            <button
                              onClick={() => {
                                handleWorkItemSelect(workItem);
                                startTimer(subject, workItem.compatibilityBlockIndex);
                              }}
                              disabled={timerOnOtherBlock || !launchState.can_start}
                              className="flex-1 px-3 py-2 rounded-lg text-[13px] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              style={{ backgroundColor: C.cream, color: C.charcoal, fontWeight: 700, fontFamily: FONT }}
                              onMouseEnter={e => { if (!timerOnOtherBlock && launchState.can_start) e.currentTarget.style.backgroundColor = C.parchment; }}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}>
                              Start Timer
                            </button>
                            {!workItem.requireTimer && !blockCompleted && (
                              <button
                                onClick={() => {
                                  handleWorkItemSelect(workItem);
                                  handleCompleteWorkItem(workItem);
                                }}
                                disabled={timerOnOtherBlock || submitting || !workItemPolicy.canSubmitBlock.allowed}
                                className="flex-1 px-3 py-2 rounded-lg text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                                style={{ backgroundColor: C.charcoal, color: '#fff', fontWeight: 700, fontFamily: FONT }}
                                onMouseEnter={e => { if (!timerOnOtherBlock && !submitting && workItemPolicy.canSubmitBlock.allowed) e.currentTarget.style.backgroundColor = '#3a3937'; }}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}>
                                {submitting ? <><div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.5)', borderTopColor: '#fff' }} /> Submitting...</> : 'Complete Block'}
                              </button>
                            )}
                          </>
                        ) : timer.remainingTime > 0 ? (
                          <>
                            {timer.isRunning ? (
                              <button onClick={() => pauseTimer(subject)}
                                className="flex-1 px-3 py-2 rounded-lg text-[13px] transition-colors"
                                style={{ backgroundColor: C.cream, color: C.charcoal, fontWeight: 700, fontFamily: FONT }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}>
                                Pause
                              </button>
                            ) : (
                              <button onClick={() => resumeTimer(subject)}
                                disabled={!launchState.can_resume}
                                className="flex-1 px-3 py-2 rounded-lg text-[13px] transition-colors"
                                style={{ backgroundColor: C.charcoal, color: '#fff', fontWeight: 700, fontFamily: FONT }}
                                onMouseEnter={e => { if (launchState.can_resume) e.currentTarget.style.backgroundColor = '#3a3937'; }}
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
                            <button
                              onClick={() => {
                                handleWorkItemSelect(workItem);
                                handleCompleteWorkItem(workItem);
                              }}
                              disabled={submitting || isSubmissionLocked(subject.id, timer?.blockIndex) || !timerCompletionPolicy?.canSubmitBlock.allowed}
                              className="flex-1 px-3 py-2 rounded-lg text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 animate-pulse"
                              style={{ backgroundColor: C.charcoal, color: '#fff', fontWeight: 700, fontFamily: FONT }}
                              onMouseEnter={e => { if (!submitting && timerCompletionPolicy?.canSubmitBlock.allowed) e.currentTarget.style.backgroundColor = '#3a3937'; }}
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
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {subjects.map((subject) => {
                const progress = getSubjectProgress(subject);
                const timer = currentActiveTimers[subject.id];
                const selectedBlockForSubject = expandedSubjectId === subject.id ? expandedBlockIndex : null;
                const subjectPolicy = getSubjectPolicy(subject, { blockIndex: selectedBlockForSubject });
                const subjectAvailability = subjectPolicy.subjectAvailability;
                const locked = !subjectAvailability.allowed;
                const completed = subjectAvailability.status === 'completed';
                const timerCompletionPolicy = timer ? getSubjectPolicy(subject, { blockIndex: timer.blockIndex }) : null;
                const selectedBlockObjective = selectedBlockForSubject !== null ? getBlockObjective(subject, selectedBlockForSubject) : null;
                const selectedBlockInstruction = selectedBlockForSubject !== null ? getEffectiveInstruction(subject, selectedBlockForSubject) : null;
                const selectedBlockFields = selectedBlockForSubject !== null ? getEffectiveCustomFields(subject, selectedBlockForSubject) : [];
                const selectionMatchesTimer = timer && timer.blockIndex === selectedBlockForSubject;
                const hasSelectedDetails = selectedBlockForSubject !== null && !isBlockCompleted(subject, selectedBlockForSubject);

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

                    {/* Blocks grid */}
                    <div className="pt-3" style={{ borderTop: `1px solid ${C.parchment}` }}>
                      <p className="text-[11px] uppercase tracking-wider mb-2.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Weekly Blocks</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {Array.from({ length: subject?.block_count || 10 }, (_, i) => {
                          const blockCompleted = isBlockCompleted(subject, i);
                          const blockPolicy = getSubjectPolicy(subject, { blockIndex: i });
                          const isWorkingOn = timer && timer.blockIndex === i && timer.isRunning && timer.remainingTime > 0;
                          const hasObjective = !!(subject.block_objectives?.[i]?.student_overrides?.[student?.id]?.instruction || subject.block_objectives?.[i]?.instruction);
                          const isSelected = selectedBlockForSubject === i;
                          return (
                            <button key={i}
                              onClick={() => handleBlockSelect(subject, i)}
                              disabled={blockCompleted || !blockPolicy.subjectAvailability.allowed || isSubmissionLocked(subject.id, i) || (!!timer && timer.blockIndex !== i)}
                              className={`w-10 h-10 rounded-lg text-[12px] transition-all relative ${isWorkingOn ? 'animate-pulse' : ''}`}
                              title={hasObjective ? 'Guided block — has specific instructions' : undefined}
                              style={{
                                backgroundColor: blockCompleted ? C.lavenderTint : isSelected ? `${C.lavender}26` : !blockPolicy.subjectAvailability.allowed ? C.cream : isWorkingOn ? 'rgba(203,183,251,0.2)' : '#ffffff',
                                border: `1px solid ${blockCompleted ? C.lavender : isSelected ? C.amethyst : isWorkingOn ? C.lavender : hasObjective ? `${C.lavender}99` : C.parchment}`,
                                color: blockCompleted ? C.amethyst : !blockPolicy.subjectAvailability.allowed ? 'rgba(41,40,39,0.3)' : isSelected || isWorkingOn ? C.amethyst : 'rgba(41,40,39,0.5)',
                                cursor: blockCompleted || !blockPolicy.subjectAvailability.allowed || (!!timer && timer.blockIndex !== i) ? 'not-allowed' : 'pointer',
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
                      {locked && (
                        <p className="text-[12px] mt-2" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                          {subjectAvailability.blockedReason?.message || 'All blocks completed this week!'}
                        </p>
                      )}
                    </div>

                    {hasSelectedDetails && (
                      <div className="pt-4 mt-4 space-y-4" style={{ borderTop: `1px solid ${C.parchment}` }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] uppercase tracking-wider" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Selected Block</p>
                            <p className="text-[14px]" style={{ color: C.charcoal, fontWeight: 540 }}>Block {selectedBlockForSubject + 1}</p>
                          </div>
                          {selectedBlockObjective && (
                            <span className="text-[11px] px-2 py-1 rounded-full" style={{ backgroundColor: `${C.lavender}26`, color: C.amethyst, fontWeight: 700 }}>
                              Guided
                            </span>
                          )}
                        </div>

                        {selectedBlockInstruction && (
                          <div className="rounded-lg p-3" style={{ backgroundColor: `${C.lavender}1f`, borderLeft: `3px solid ${C.lavender}` }}>
                            <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: C.amethyst, fontWeight: 700 }}>Goals</p>
                            <p className="text-[14px]" style={{ color: C.charcoal, fontWeight: 460 }}>{selectedBlockInstruction}</p>
                          </div>
                        )}

                        {subject.resources?.length > 0 && (
                          <div>
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

                        {selectedBlockFields.length > 0 && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Completion Requirements</p>
                            <p className="text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                              This block will ask for {selectedBlockFields.length} response{selectedBlockFields.length === 1 ? '' : 's'} when you submit it.
                            </p>
                          </div>
                        )}

                        {!!timer && !selectionMatchesTimer && (
                          <p className="text-[12px]" style={{ color: C.amethyst, fontWeight: 460 }}>
                            Timer is currently active for Block {timer.blockIndex + 1}. Finish or reset that timer to switch blocks.
                          </p>
                        )}

                        <div className="rounded-lg p-4" style={{ backgroundColor: '#faf9f8' }}>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[11px] uppercase tracking-wider" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Timer</p>
                            {timer && (
                              <span className="text-[11px]" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>Block {timer.blockIndex + 1}</span>
                            )}
                          </div>
                          <div className="text-center mb-3">
                            {timer ? (
                              <div className={`text-[28px] font-mono ${timer.remainingTime === 0 ? 'animate-pulse' : ''}`}
                                style={{ fontWeight: 540, color: timer.remainingTime === 0 ? C.amethyst : C.charcoal }}>
                                {formatRemainingTime(timer.remainingTime)}
                              </div>
                            ) : (
                              <div className="text-[22px] font-mono" style={{ fontWeight: 540, color: 'rgba(41,40,39,0.2)' }}>--:--</div>
                            )}
                            {timer?.remainingTime === 0 && (
                              <p className="text-[12px] mt-1" style={{ color: C.amethyst, fontWeight: 460 }}>Time's up — ready to submit?</p>
                            )}
                            {subject.require_timer && timer?.remainingTime > 0 && (
                              <p className="text-[11px] uppercase tracking-wider mt-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>Timer required</p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            {!timer ? (
                              <button onClick={() => startTimer(subject, selectedBlockForSubject)} disabled={!subjectPolicy.canStartTimer.allowed}
                                className="flex-1 px-3 py-2 rounded-lg text-[13px] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                style={{ backgroundColor: C.cream, color: C.charcoal, fontWeight: 700, fontFamily: FONT }}
                                onMouseEnter={e => { if (subjectPolicy.canStartTimer.allowed) e.currentTarget.style.backgroundColor = C.parchment; }}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}>
                                Start Timer
                              </button>
                            ) : timer.remainingTime > 0 ? (
                              <>
                                {timer.isRunning ? (
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
                                  disabled={submitting || isSubmissionLocked(subject.id, timer?.blockIndex) || !timerCompletionPolicy?.canSubmitBlock.allowed}
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

                            {!subject.require_timer && !timer && !locked && (
                              <button onClick={() => handleCompleteBlock(subject)}
                                disabled={submitting || !subjectPolicy.canSubmitBlock.allowed}
                                className="flex-1 px-3 py-2 rounded-lg text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                                style={{ backgroundColor: C.charcoal, color: '#fff', fontWeight: 700, fontFamily: FONT }}
                                onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#3a3937'; }}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}>
                                {submitting ? <><div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.5)', borderTopColor: '#fff' }} /> Submitting...</> : `Complete Block ${selectedBlockForSubject + 1}`}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
          </>
        )}
      </main>

      <nav className="student-portal-mobile-nav" aria-label="Student workspaces">
        <button type="button" className={activeWorkspace === 'school' ? 'is-active' : ''} onClick={() => setActiveWorkspace('school')}><BookOpen /><span>School</span></button>
        {studentChores.canShowTab ? <button type="button" className={activeWorkspace === 'chores' ? 'is-active' : ''} onClick={() => setActiveWorkspace('chores')}><ListChecks /><span>Chores</span></button> : null}
        <button type="button" className={activeWorkspace === 'allowance' ? 'is-active' : ''} onClick={() => setActiveWorkspace('allowance')}><Coins /><span>Allowance</span></button>
        {studentChores.canShowRewardTab ? <button type="button" className={activeWorkspace === 'rewards' ? 'is-active' : ''} onClick={() => setActiveWorkspace('rewards')}><Gift /><span>Rewards</span></button> : null}
        <button type="button" className={activeWorkspace === 'profile' ? 'is-active' : ''} onClick={() => setActiveWorkspace('profile')}><UserRound /><span>Avatar</span></button>
      </nav>

      {/* Summary Submission Modal */}
      {activeWorkspace === 'school' && selectedSubject && (
        <div className="student-submission-backdrop">
          <div className="student-submission-modal">
            <div className="student-submission-header">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 540, color: C.charcoal, lineHeight: 1.2 }}>{getPortalSubjectTitle(selectedSubject)}</h2>
                <p className="text-[13px] mt-0.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>Block {selectedBlockIndex + 1}</p>
              </div>
              <button onClick={closeSubmissionModal}
                style={{ color: 'rgba(41,40,39,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); submitBlock(selectedSubject, selectedBlockIndex, summaryText); }}
              className="student-submission-form space-y-5" autoComplete="off">

              {/* Objective instruction banner — student override takes priority over shared */}
              {(() => {
                const effectiveInstruction = getEffectiveInstruction(selectedSubject, selectedBlockIndex);
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
                const activeFields = getEffectiveCustomFields(selectedSubject, selectedBlockIndex);
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
                    Completing 1 block of {getPortalSubjectTitle(selectedSubject)} ({selectedSubject?.block_length || 30} min)
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>No summary required</p>
                </div>
              )}

              <div className="flex gap-3">
                <button type="button"
                  onClick={closeSubmissionModal}
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
