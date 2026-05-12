import { useEffect, useState } from 'react';
import { collection, getFirestore, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';

export const useSubjects = ({
  parentId,
  enabled = true,
  activeOnly = false,
  sortField = 'title',
  sortDirection = 'asc',
} = {}) => {
  const db = getFirestore(app);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && parentId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !parentId) {
      setSubjects([]);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const constraints = [where('parent_id', '==', parentId)];
    if (activeOnly) {
      constraints.push(where('is_active', '==', true));
    }
    constraints.push(orderBy(sortField, sortDirection));

    const subjectsQuery = query(collection(db, 'subjects'), ...constraints);
    const unsubscribe = onSnapshot(subjectsQuery, (snapshot) => {
      setSubjects(snapshot.docs.map((subjectDoc) => ({ id: subjectDoc.id, ...subjectDoc.data() })));
      setError(null);
      setLoading(false);
    }, (nextError) => {
      console.error('Error fetching subjects:', nextError.code, nextError.message);
      setError(nextError);
      setLoading(false);
    });

    const loadingTimeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, [activeOnly, db, enabled, parentId, sortDirection, sortField]);

  return {
    subjects,
    loading,
    error,
  };
};

export default useSubjects;
