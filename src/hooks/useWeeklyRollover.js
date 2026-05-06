import { useEffect, useState } from 'react';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { formatWeekRange, getCurrentWeekRange } from '../utils/weekUtils';
import { getWeekKey } from '../utils/reportUtils';

export const useWeeklyRollover = ({
  createWeeklyRecordsForRange,
  currentUser = null,
  enabled = true,
  loading = false,
  parentSettings = {},
  settingsReady = false,
  weekConfig,
} = {}) => {
  const db = getFirestore(app);
  const [rolloverStatus, setRolloverStatus] = useState({ running: false, message: '' });

  useEffect(() => {
    if (
      !enabled
      || !currentUser
      || !settingsReady
      || loading
      || rolloverStatus.running
    ) {
      return undefined;
    }

    const currentWeek = getCurrentWeekRange(new Date(), weekConfig);
    const previousWeek = getCurrentWeekRange(new Date(currentWeek.weekStart.getTime() - 1), weekConfig);
    const previousWeekKey = getWeekKey(previousWeek.weekStart);

    if (parentSettings.last_rollover_week_key === previousWeekKey) {
      return undefined;
    }

    let cancelled = false;

    const runRollover = async () => {
      setRolloverStatus({
        running: true,
        message: `Archiving ${formatWeekRange(previousWeek.weekStart, previousWeek.weekEnd)}...`,
      });

      try {
        const createdCount = await createWeeklyRecordsForRange({
          weekStart: previousWeek.weekStart,
          weekEnd: previousWeek.weekEnd,
          source: 'automatic',
        });

        await setDoc(doc(db, 'parents', currentUser.uid), {
          last_rollover_week_key: previousWeekKey,
          last_rollover_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        }, { merge: true });

        if (!cancelled) {
          setRolloverStatus({
            running: false,
            message: createdCount > 0
              ? `Archived ${createdCount} official report${createdCount === 1 ? '' : 's'} for ${formatWeekRange(previousWeek.weekStart, previousWeek.weekEnd)}.`
              : `Weekly reset processed for ${formatWeekRange(previousWeek.weekStart, previousWeek.weekEnd)}.`,
          });
        }
      } catch (error) {
        console.error('Error processing weekly rollover:', error);

        if (!cancelled) {
          setRolloverStatus({
            running: false,
            message: 'Weekly rollover could not be completed. Please refresh and try again.',
          });
        }
      }
    };

    runRollover();

    return () => {
      cancelled = true;
    };
  }, [
    createWeeklyRecordsForRange,
    currentUser,
    db,
    enabled,
    loading,
    parentSettings.last_rollover_week_key,
    rolloverStatus.running,
    settingsReady,
    weekConfig,
  ]);

  return {
    rolloverStatus,
  };
};

export default useWeeklyRollover;
