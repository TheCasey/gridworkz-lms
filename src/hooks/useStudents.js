import { useEffect, useState } from 'react';
import { collection, getFirestore, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';

export const useStudents = ({
  parentId,
  enabled = true,
  sortField = 'created_at',
  sortDirection = 'desc',
} = {}) => {
  const db = getFirestore(app);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && parentId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !parentId) {
      setStudents([]);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const studentsQuery = query(
      collection(db, 'students'),
      where('parent_id', '==', parentId),
      orderBy(sortField, sortDirection)
    );

    const unsubscribe = onSnapshot(studentsQuery, (snapshot) => {
      setStudents(snapshot.docs.map((studentDoc) => ({ id: studentDoc.id, ...studentDoc.data() })));
      setError(null);
      setLoading(false);
    }, (nextError) => {
      console.error('Error fetching students:', nextError.code, nextError.message);
      setError(nextError);
      setLoading(false);
    });

    const loadingTimeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, [db, enabled, parentId, sortDirection, sortField]);

  return {
    students,
    loading,
    error,
  };
};

export default useStudents;
