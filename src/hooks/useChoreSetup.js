import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { Collections } from '../constants/schema';
import { buildParentChoreViewModel } from '../utils/choreParentViewModel';

const mapSnapshotDocs = (snapshot) => snapshot.docs.map((recordDoc) => ({
  id: recordDoc.id,
  ...recordDoc.data(),
}));

export const useChoreSetup = ({
  parentId,
  parentSettings = {},
  students = [],
  enabled = true,
  isLocked = false,
} = {}) => {
  const db = getFirestore(app);
  const [choreSettings, setChoreSettings] = useState(null);
  const [routineTemplates, setRoutineTemplates] = useState([]);
  const [routineCompletions, setRoutineCompletions] = useState([]);
  const [choreDefinitions, setChoreDefinitions] = useState([]);
  const [choreClaims, setChoreClaims] = useState([]);
  const [choreCompletions, setChoreCompletions] = useState([]);
  const [allowancePeriods, setAllowancePeriods] = useState([]);
  const [rewardSettings, setRewardSettings] = useState(null);
  const [pointWallets, setPointWallets] = useState([]);
  const [rewardCatalogItems, setRewardCatalogItems] = useState([]);
  const [rewardRedemptions, setRewardRedemptions] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && parentId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !parentId) {
      setChoreSettings(null);
      setRoutineTemplates([]);
      setRoutineCompletions([]);
      setChoreDefinitions([]);
      setChoreClaims([]);
      setChoreCompletions([]);
      setAllowancePeriods([]);
      setRewardSettings(null);
      setPointWallets([]);
      setRewardCatalogItems([]);
      setRewardRedemptions([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    const pendingKeys = new Set([
      'settings',
      'routines',
      'routineCompletions',
      'definitions',
      'claims',
      'completions',
      'allowancePeriods',
      'rewardSettings',
      'pointWallets',
      'rewardCatalogItems',
      'rewardRedemptions',
    ]);

    const markLoaded = (key) => {
      pendingKeys.delete(key);
      if (pendingKeys.size === 0) {
        setLoading(false);
      }
    };

    const handleError = (nextError) => {
      console.error('Error loading chore setup:', nextError?.code, nextError?.message);
      setError(nextError);
      setLoading(false);
    };

    const listeners = [
      onSnapshot(
        doc(db, Collections.CHORE_SETTINGS, parentId),
        (snapshot) => {
          setChoreSettings(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
          setError(null);
          markLoaded('settings');
        },
        handleError
      ),
      onSnapshot(
        query(collection(db, Collections.ROUTINE_TEMPLATES), where('parent_id', '==', parentId)),
        (snapshot) => {
          setRoutineTemplates(mapSnapshotDocs(snapshot));
          setError(null);
          markLoaded('routines');
        },
        handleError
      ),
      onSnapshot(
        query(collection(db, Collections.ROUTINE_COMPLETIONS), where('parent_id', '==', parentId)),
        (snapshot) => {
          setRoutineCompletions(mapSnapshotDocs(snapshot));
          setError(null);
          markLoaded('routineCompletions');
        },
        handleError
      ),
      onSnapshot(
        query(collection(db, Collections.CHORE_DEFINITIONS), where('parent_id', '==', parentId)),
        (snapshot) => {
          setChoreDefinitions(mapSnapshotDocs(snapshot));
          setError(null);
          markLoaded('definitions');
        },
        handleError
      ),
      onSnapshot(
        query(collection(db, Collections.CHORE_CLAIMS), where('parent_id', '==', parentId)),
        (snapshot) => {
          setChoreClaims(mapSnapshotDocs(snapshot));
          setError(null);
          markLoaded('claims');
        },
        handleError
      ),
      onSnapshot(
        query(collection(db, Collections.CHORE_COMPLETIONS), where('parent_id', '==', parentId)),
        (snapshot) => {
          setChoreCompletions(mapSnapshotDocs(snapshot));
          setError(null);
          markLoaded('completions');
        },
        handleError
      ),
      onSnapshot(
        query(collection(db, Collections.ALLOWANCE_PERIODS), where('parent_id', '==', parentId)),
        (snapshot) => {
          setAllowancePeriods(mapSnapshotDocs(snapshot));
          setError(null);
          markLoaded('allowancePeriods');
        },
        handleError
      ),
      onSnapshot(
        doc(db, Collections.REWARD_SETTINGS, parentId),
        (snapshot) => {
          setRewardSettings(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
          setError(null);
          markLoaded('rewardSettings');
        },
        handleError
      ),
      onSnapshot(
        query(collection(db, Collections.STUDENT_POINT_WALLETS), where('parent_id', '==', parentId)),
        (snapshot) => {
          setPointWallets(mapSnapshotDocs(snapshot));
          setError(null);
          markLoaded('pointWallets');
        },
        handleError
      ),
      onSnapshot(
        query(collection(db, Collections.REWARD_CATALOG_ITEMS), where('parent_id', '==', parentId)),
        (snapshot) => {
          setRewardCatalogItems(mapSnapshotDocs(snapshot));
          setError(null);
          markLoaded('rewardCatalogItems');
        },
        handleError
      ),
      onSnapshot(
        query(collection(db, Collections.REWARD_REDEMPTIONS), where('parent_id', '==', parentId)),
        (snapshot) => {
          setRewardRedemptions(mapSnapshotDocs(snapshot));
          setError(null);
          markLoaded('rewardRedemptions');
        },
        handleError
      ),
    ];

    const loadingTimeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      listeners.forEach((unsubscribe) => unsubscribe());
      clearTimeout(loadingTimeout);
    };
  }, [db, enabled, parentId]);

  const viewModel = useMemo(() => buildParentChoreViewModel({
    students,
    parentSettings,
    choreSettings: choreSettings || {},
    routineTemplates,
    routineCompletions,
    choreDefinitions,
    choreClaims,
    choreCompletions,
    allowancePeriods,
    isLocked,
  }), [
    allowancePeriods,
    choreClaims,
    choreCompletions,
    choreDefinitions,
    choreSettings,
    isLocked,
    parentSettings,
    routineCompletions,
    routineTemplates,
    students,
  ]);

  return {
    choreClaims,
    choreCompletions,
    choreDefinitions,
    choreSettings,
    error,
    loading,
    allowancePeriods,
    pointWallets,
    rewardCatalogItems,
    rewardRedemptions,
    rewardSettings,
    routineCompletions,
    routineTemplates,
    viewModel,
  };
};

export default useChoreSetup;
