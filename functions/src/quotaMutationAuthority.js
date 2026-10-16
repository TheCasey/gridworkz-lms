// Every operation that can increase quota usage takes the same household lock.
// Counts come from actual records, never the advisory entitlement usage snapshot.
export const isQuotaActiveSubject = (subject = {}) => (
  subject.is_active !== false && subject.is_archived !== true && subject.archived !== true
  && subject.status !== 'archived' && subject.archived_at == null
);

export const createQuotaMutationService = ({ db, FieldValue, HttpsError, resolveEntitlementRecord }) => {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const validId = (value) => typeof value === 'string' && value.trim() === value && value.length > 0 && !value.includes('/');

  const mutate = async ({ parentId, kind, record, subjectId = null }) => {
    if (!validId(parentId)) fail('unauthenticated', 'A parent account is required.');
    if (subjectId !== null && !validId(subjectId)) fail('invalid-argument', 'A valid subject ID is required.');
    const collection = kind === 'student' ? 'students' : 'subjects';
    // Keep the document identity stable when Firestore retries the transaction.
    const recordRef = subjectId ? db.collection(collection).doc(subjectId) : db.collection(collection).doc();
    const parentRef = db.collection('parents').doc(parentId);
    const entitlementRef = db.collection('accountEntitlements').doc(parentId);
    const coordinatorRef = db.collection('quotaMutationState').doc(parentId);

    return db.runTransaction(async (tx) => {
      const [parent, entitlement, coordinator] = await tx.getAll(parentRef, entitlementRef, coordinatorRef);
      if (!parent.exists) fail('permission-denied', 'A registered parent account is required.');
      const resolved = resolveEntitlementRecord({ parentId, entitlementDoc: entitlement.exists ? entitlement.data() : {} });
      let existing = null;
      if (subjectId) {
        const snapshot = await tx.get(recordRef);
        if (!snapshot.exists) fail('not-found', 'Subject not found.');
        existing = snapshot.data();
        if (existing.parent_id !== parentId) fail('permission-denied', 'This subject belongs to another parent.');
        // A retry of a successful activation neither consumes a slot nor edits work.
        if (isQuotaActiveSubject(existing)) return { id: recordRef.id, already_active: true };
      }

      const cap = kind === 'student' ? resolved.limits.maxStudents : resolved.limits.maxActiveSubjects;
      if (cap != null) {
        const owned = await tx.get(db.collection(collection).where('parent_id', '==', parentId));
        const count = kind === 'student' ? owned.size : owned.docs.filter((doc) => isQuotaActiveSubject(doc.data())).length;
        if (count >= cap) fail('resource-exhausted', kind === 'student'
          ? 'This account has reached the current plan student limit.'
          : 'This account has reached the current plan active subject limit.');
      }

      if (kind === 'subject' && !subjectId) {
        const ids = record.student_ids;
        if (!Array.isArray(ids) || !ids.length || !ids.every(validId)) fail('invalid-argument', 'Assigned student IDs are required.');
        const students = await tx.getAll(...[...new Set(ids)].map((id) => db.collection('students').doc(id)));
        if (students.some((student) => !student.exists || student.data().parent_id !== parentId)) {
          fail('failed-precondition', 'Every assigned student must exist and belong to the current parent account.');
        }
      }

      if (subjectId) {
        tx.update(recordRef, {
          is_active: true, is_archived: false, archived: false,
          ...(existing.status === 'archived' ? { status: 'active' } : {}),
          archived_at: null, updated_at: FieldValue.serverTimestamp(),
        });
      } else {
        tx.create(recordRef, { ...record, parent_id: parentId, is_active: true });
      }
      tx.set(coordinatorRef, {
        parent_id: parentId,
        revision: (Number.isSafeInteger(coordinator.data()?.revision) ? coordinator.data().revision : 0) + 1,
        updated_at: FieldValue.serverTimestamp(),
      });
      return { id: recordRef.id, ...(subjectId ? { already_active: false } : {}) };
    });
  };

  return {
    createStudent: ({ parentId, studentDoc }) => mutate({ parentId, kind: 'student', record: studentDoc }),
    createSubject: ({ parentId, subjectDoc }) => mutate({ parentId, kind: 'subject', record: subjectDoc }),
    reactivateSubject: ({ parentId, subjectId }) => mutate({ parentId, kind: 'subject', subjectId: subjectId ?? '' }),
  };
};
