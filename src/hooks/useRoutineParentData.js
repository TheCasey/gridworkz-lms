import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';

// Owner-scoped reads only. No legacy allowance synchronization or reward writes.
export default function useRoutineParentData(parentId, history = false) {
  const scope = `${parentId || ''}:${history}`;
  const [state, setState] = useState({ data: {}, loading: true, error: null });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setState({ scope, data: {}, loading: true, error: null });
    if (!parentId) return;
    try {
      const db = getFirestore(app);
      const names = history
        ? ['routineTemplates', 'routineCompletions', 'allowancePeriods', 'rewardRedemptions', 'choreDefinitions', 'choreClaims', 'choreCompletions', 'rewardCatalogItems', 'pointLedgerEntries', 'studentPointWallets', 'householdHistoryEvents']
        : ['routineTemplates'];
      const pairs = await Promise.all(names.map(async (name) => {
        const result = await getDocs(query(collection(db, name), where('parent_id', '==', parentId)));
        return [name, result.docs.map((record) => ({ ...record.data(), id: record.id }))];
      }));
      const settings = history ? null : await getDoc(doc(db, 'rewardSettings', parentId));
      if (request === generation.current) setState({ scope, data: { ...Object.fromEntries(pairs), settings: settings?.exists() ? settings.data() : {} }, loading: false, error: null });
    } catch (error) {
      if (request === generation.current) setState({ scope, data: {}, loading: false, error });
    }
  }, [parentId, history, scope]);
  useEffect(() => { refresh(); return () => { generation.current += 1; }; }, [refresh]);
  return state.scope === scope ? { ...state, refresh } : { data: {}, loading: true, error: null, refresh };
}
