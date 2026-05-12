import { useCallback, useMemo, useState } from 'react';
import { deleteDoc, doc, getFirestore } from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { createTrustedStudent } from '../firebase/trustedOperations';
import { buildEntitlementUsageSummary } from '../utils/entitlementUtils';

export const useStudentMutations = ({
  canAddStudent = true,
  currentUser = null,
  planName = 'Free',
  studentLimitCheck = null,
} = {}) => {
  const db = getFirestore(app);
  const [addingStudent, setAddingStudent] = useState(false);

  const studentLimitMessage = useMemo(() => buildEntitlementUsageSummary({
    limitCheck: studentLimitCheck,
    nounSingular: 'student',
    planName,
  }), [planName, studentLimitCheck]);

  const addStudent = useCallback(async ({ name, accessPin }) => {
    if (!currentUser) return false;

    if (!canAddStudent) {
      alert(
        `${studentLimitMessage} ${studentLimitCheck?.upgradeCopy || ''} You can still delete existing students to get back under this cap.`
      );
      return false;
    }

    setAddingStudent(true);
    try {
      await createTrustedStudent({
        name: name.trim(),
        accessPin: accessPin || null,
      });
      return true;
    } catch (error) {
      console.error('Error adding student:', error.code, error.message);
      if (error.code === 'functions/resource-exhausted') {
        alert(
          `${studentLimitMessage} ${studentLimitCheck?.upgradeCopy || ''} You can still delete existing students to get back under this cap.`
        );
      } else if (error.code === 'functions/unauthenticated') {
        alert('Your session expired. Sign in again and retry.');
      } else if (error.code === 'unavailable' || error.code === 'functions/unavailable') {
        alert('Firestore unavailable. Check your internet connection.');
      } else {
        alert(`Failed to add student: ${error.message}`);
      }
      return false;
    } finally {
      setAddingStudent(false);
    }
  }, [canAddStudent, currentUser, studentLimitCheck?.upgradeCopy, studentLimitMessage]);

  const deleteStudent = useCallback(async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      return false;
    }

    try {
      await deleteDoc(doc(db, 'students', studentId));
      return true;
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Failed to delete student. Please try again.');
      return false;
    }
  }, [db]);

  return {
    addStudent,
    addingStudent,
    deleteStudent,
  };
};

export default useStudentMutations;
