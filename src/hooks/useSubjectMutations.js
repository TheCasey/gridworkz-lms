import { useCallback, useMemo } from 'react';
import {
  deleteDoc,
  doc,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { createTrustedSubject } from '../firebase/trustedOperations';
import { buildEntitlementUsageSummary } from '../utils/entitlementUtils';

export const useSubjectMutations = ({
  canAddCurriculumItem = true,
  currentUser = null,
  curriculumLimitCheck = null,
  planName = 'Free',
} = {}) => {
  const db = getFirestore(app);

  const subjectLimitMessage = useMemo(() => buildEntitlementUsageSummary({
    limitCheck: curriculumLimitCheck,
    nounSingular: 'active subject',
    nounPlural: 'active subjects',
    planName,
  }), [curriculumLimitCheck, planName]);

  const limitAlertMessage = useMemo(() => (
    `${subjectLimitMessage} ${curriculumLimitCheck?.upgradeCopy || ''} You can still edit, archive, or delete existing subjects, and inactive records do not count toward this cap.`
  ), [curriculumLimitCheck?.upgradeCopy, subjectLimitMessage]);

  const saveSubject = useCallback(async ({ editingSubject = null, subjectData }) => {
    if (!currentUser) return false;

    if (!editingSubject && !canAddCurriculumItem) {
      alert(limitAlertMessage);
      return false;
    }

    try {
      if (editingSubject) {
        await updateDoc(doc(db, 'subjects', editingSubject.id), subjectData);
      } else {
        const { parent_id, updated_at, ...createPayload } = subjectData;
        await createTrustedSubject(createPayload);
      }

      return true;
    } catch (error) {
      console.error('Error saving subject:', error);

      if (error.code === 'functions/resource-exhausted') {
        alert(limitAlertMessage);
      } else {
        alert('Failed to save subject. Please try again.');
      }

      return false;
    }
  }, [canAddCurriculumItem, currentUser, db, limitAlertMessage]);

  const deleteSubject = useCallback(async (subjectId) => {
    if (!window.confirm('Are you sure you want to delete this subject?')) {
      return false;
    }

    try {
      await deleteDoc(doc(db, 'subjects', subjectId));
      return true;
    } catch (error) {
      console.error('Error deleting subject:', error);
      alert('Failed to delete subject.');
      return false;
    }
  }, [db]);

  const archiveSubject = useCallback(async (subjectId) => {
    try {
      await updateDoc(doc(db, 'subjects', subjectId), {
        is_active: false,
        updated_at: serverTimestamp(),
      });
      return true;
    } catch (error) {
      console.error('Error archiving subject:', error);
      alert('Failed to archive subject.');
      return false;
    }
  }, [db]);

  return {
    archiveSubject,
    deleteSubject,
    saveSubject,
  };
};

export default useSubjectMutations;
