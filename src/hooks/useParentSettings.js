import { useCallback, useEffect, useState } from 'react';
import {
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import {
  buildDefaultParentProfile,
  buildSettingsFormState,
  mergeParentSettings,
} from '../utils/schoolSettingsUtils';

export const useParentSettings = ({
  currentUser = null,
  enabled = true,
  students = [],
} = {}) => {
  const db = getFirestore(app);
  const [parentSettings, setParentSettings] = useState(buildSettingsFormState(mergeParentSettings()));
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !currentUser) {
      setParentSettings(buildSettingsFormState(mergeParentSettings()));
      setSettingsReady(false);
      setError(null);
      return undefined;
    }

    const parentRef = doc(db, 'parents', currentUser.uid);

    return onSnapshot(parentRef, async (snapshot) => {
      if (!snapshot.exists()) {
        try {
          await setDoc(parentRef, {
            ...buildDefaultParentProfile(currentUser),
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          }, { merge: true });
        } catch (createError) {
          console.error('Error creating parent profile:', createError);
        }
        return;
      }

      setParentSettings(buildSettingsFormState(mergeParentSettings(snapshot.data(), currentUser)));
      setSettingsReady(true);
      setError(null);
    }, (nextError) => {
      console.error('Error loading parent settings:', nextError);
      setError(nextError);
      setSettingsReady(true);
    });
  }, [currentUser, db, enabled]);

  const saveSettings = useCallback(async (nextSettings) => {
    if (!currentUser) return false;

    if (
      nextSettings.school_year_start &&
      nextSettings.school_year_end &&
      nextSettings.school_year_end < nextSettings.school_year_start
    ) {
      alert('School year end date must be after the start date.');
      return false;
    }

    setSettingsSaving(true);
    try {
      const { reset_time, ...settingsWithoutDisplayTime } = nextSettings;
      const payload = mergeParentSettings({
        ...settingsWithoutDisplayTime,
        uid: currentUser.uid,
        email: currentUser.email || '',
      }, currentUser);

      await setDoc(doc(db, 'parents', currentUser.uid), {
        ...payload,
        week_start_day: payload.week_reset_day,
        updated_at: serverTimestamp(),
      }, { merge: true });

      if (students.length > 0) {
        const batch = writeBatch(db);
        students.forEach((student) => {
          batch.set(doc(db, 'students', student.id), {
            week_reset_day: payload.week_reset_day,
            week_reset_hour: payload.week_reset_hour,
            week_reset_minute: payload.week_reset_minute,
            timezone: payload.timezone,
            updated_at: serverTimestamp(),
          }, { merge: true });
        });
        await batch.commit();
      }

      return true;
    } catch (saveError) {
      console.error('Error saving settings:', saveError);
      alert('Failed to save settings. Please try again.');
      return false;
    } finally {
      setSettingsSaving(false);
    }
  }, [currentUser, db, students]);

  return {
    error,
    parentSettings,
    saveSettings,
    settingsReady,
    settingsSaving,
  };
};

export default useParentSettings;
