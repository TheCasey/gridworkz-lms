import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { app } from '../firebase/firebaseConfig';
import { Collections } from '../constants/schema';
import { buildStudentDefaultWeekId } from '../../functions/src/weeklyPlanningFoundation.js';
import { buildWeeklyPlanDraft, buildWeeklyPlanIdentity } from '../utils/weeklyPlanUtils';
import {
  saveTrustedWeeklyPlanDraft,
  publishTrustedWeeklyPlan,
  saveTrustedStudentDefaultWeek,
} from '../firebase/trustedOperations';

const candidateForWrite = (plan, identity, blocks) => ({
  id: identity.planId,
  parent_id: identity.parentId,
  student_id: identity.studentId,
  week_key: identity.weekKey,
  assignment_ids: [...new Set(blocks.map((block) => block.assignment_id))],
  weekly_exceptions: plan?.weekly_exceptions || [],
  blocks,
  parent_notes: plan?.parent_notes || '',
});
const uncertainFailure = (error) => !['aborted', 'invalid-argument', 'permission-denied', 'unauthenticated', 'failed-precondition', 'not-found', 'already-exists'].includes(String(error?.code || '').replace(/^functions\//, ''));

export const useWeeklyPlanRecord = ({ currentUser = null, studentId = '', subjects = [], parentSettings = {}, referenceDate = null, enabled = true, listen = true } = {}) => {
  const db = getFirestore(app);
  const [records, setRecords] = useState({ scope: '', published: null, draft: null, defaults: null, loaded: [] });
  const [error, setError] = useState(null);
  const [action, setAction] = useState('');
  // An uncertain request keeps its exact JSON payload and idempotency key for safe retry.
  const pending = useRef(new Map());
  const weekIdentity = useMemo(() => currentUser?.uid && studentId ? buildWeeklyPlanIdentity({
    parentId: currentUser.uid, studentId, referenceDate: referenceDate || new Date(), weekConfig: parentSettings,
  }) : null, [currentUser?.uid, studentId, referenceDate, parentSettings?.week_reset_day, parentSettings?.week_reset_hour, parentSettings?.week_reset_minute, parentSettings?.timezone]);
  const scope = weekIdentity?.planId || '';
  const visible = records.scope === scope ? records : { published: null, draft: null, defaults: null, loaded: [] };
  const loading = Boolean(listen && enabled && scope && visible.loaded.length < 3);

  useEffect(() => {
    setError(null);
    setRecords({ scope, published: null, draft: null, defaults: null, loaded: [] });
    if (!listen || !enabled || !scope) return undefined;
    let active = true;
    const definitions = [
      ['published', Collections.WEEKLY_PLANS, scope],
      ['draft', Collections.WEEKLY_PLAN_DRAFTS, scope],
      ['defaults', Collections.STUDENT_DEFAULT_WEEKS, buildStudentDefaultWeekId({ parentId: currentUser.uid, studentId })],
    ];
    const subscriptions = definitions.map(([key, collection, id]) => onSnapshot(doc(db, collection, id), (snapshot) => {
      if (!active) return;
      setRecords((previous) => ({
        ...previous, [key]: snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null,
        loaded: [...new Set([...previous.loaded, key])],
      }));
    }, (nextError) => { if (active) setError(nextError); }));
    return () => { active = false; subscriptions.forEach((unsubscribe) => unsubscribe()); };
  }, [db, scope, enabled, listen, currentUser?.uid, studentId]);

  const generatedPreview = useMemo(() => scope ? buildWeeklyPlanDraft({
    parentId: currentUser.uid, studentId, subjects, referenceDate: weekIdentity.weekStart,
    weekConfig: parentSettings, defaults: visible.defaults,
  }) : null, [scope, subjects, visible.defaults, parentSettings, currentUser?.uid, studentId, weekIdentity?.weekStart]);
  const buildDraftPreview = useCallback(() => generatedPreview, [generatedPreview]);

  const perform = useCallback(async (kind, payload, callable) => {
    const signature = JSON.stringify(payload);
    const requestId = `${kind}:${payload.student_id}:${payload.week_key || ''}`;
    const previous = pending.current.get(requestId);
    const request = previous?.signature === signature ? previous : {
      signature, payload: JSON.parse(JSON.stringify({ ...payload, idempotency_key: nanoid() })),
    };
    pending.current.set(requestId, request);
    setAction(kind);
    setError(null);
    try {
      const response = await callable(request.payload);
      pending.current.delete(requestId);
      return response;
    } catch (nextError) {
      if (!uncertainFailure(nextError)) pending.current.delete(requestId);
      setError(nextError);
      return null;
    } finally { setAction(''); }
  }, []);

  const mutatePlan = useCallback((kind, options = {}) => {
    if (!scope) return Promise.resolve(null);
    const source = options.candidate || visible.draft || visible.published || generatedPreview;
    const blocks = options.planOverrides?.blocks ?? source?.blocks ?? [];
    const payload = {
      student_id: studentId, week_key: weekIdentity.weekKey,
      candidate: candidateForWrite(source, weekIdentity, blocks),
      // Callers editing a local candidate must provide the baseline captured when it loaded.
      expected_draft_revision: options.expectedDraftRevision ?? visible.draft?.revision ?? 0,
      expected_published_revision: options.expectedPublishedRevision ?? visible.published?.revision ?? 0,
    };
    return perform(kind, payload, kind === 'publish' ? publishTrustedWeeklyPlan : saveTrustedWeeklyPlanDraft).then((response) => {
      if (response) setRecords((previous) => previous.scope === scope ? {
        ...previous,
        draft: { ...previous.draft, ...payload.candidate, status: 'draft', revision: response.draft_revision, base_published_revision: response.published_revision },
        published: kind === 'publish' ? { ...previous.published, ...payload.candidate, status: 'published', revision: response.published_revision } : previous.published,
      } : previous);
      return response;
    });
  }, [scope, studentId, weekIdentity, visible.draft, visible.published, generatedPreview, perform]);
  const saveDraftWeeklyPlan = useCallback((options) => mutatePlan('save', options), [mutatePlan]);
  const publishWeeklyPlan = useCallback((options) => mutatePlan('publish', options), [mutatePlan]);
  const saveDefaultWeek = useCallback(({ defaultBlockQuantities, expectedRevision }) => perform('defaults', {
    student_id: studentId, default_block_quantities: defaultBlockQuantities, expected_revision: expectedRevision,
  }, saveTrustedStudentDefaultWeek), [studentId, perform]);

  return {
    buildDraftPreview, error, clearError: () => setError(null), loading, planId: scope, weekIdentity,
    weeklyPlan: visible.published, draftPlan: visible.draft, studentDefaultWeek: visible.defaults,
    publishWeeklyPlan, saveDraftWeeklyPlan, saveDefaultWeek,
    savingPlan: action === 'save', publishingPlan: action === 'publish', savingDefaultWeek: action === 'defaults',
  };
};
export default useWeeklyPlanRecord;
