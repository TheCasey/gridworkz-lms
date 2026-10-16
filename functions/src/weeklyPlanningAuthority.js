import { schoolTimerContext } from './schoolCompletionFoundation.js';
import { SCHOOL_PUBLICATION_BRIDGES, buildSchoolPublicationBridge, resolveSchoolPublicationLinks } from './schoolPublicationBridge.js';
import { buildLegacySchoolExecution, schoolExecutionSnapshotId } from './schoolCompletionContracts.js';
import { createHash } from 'node:crypto';
import {
  WEEKLY_PLANNING_COLLECTIONS as collections,
  buildPlanningArchiveWrite,
  buildPlanningDefaultWrite,
  buildPlanningPublishWrites,
  buildPlanningSaveWrite,
  getPlanningRevision,
  requireWeeklyPlanning,
  resolvePlanningWeek,
  validatePlanningId,
  validatePlanningPayload,
  weeklyPlanningPlanId,
} from './weeklyPlanningContracts.js';

const document = (snapshot) => snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null;
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const fingerprint = (action, payload) => createHash('sha256').update(JSON.stringify(canonical({ action, payload }))).digest('hex');

// Trusted owner-only writes. Every read participates in the transaction before
// any write, including source ownership, drafts, publication and retry receipt.
export const createWeeklyPlanningService = ({ db, Timestamp, HttpsError }) => {
  const ref = (collection, id) => db.collection(collection).doc(id);
  const wrap = async (operation) => {
    try { return await operation(); } catch (error) {
      if (error instanceof HttpsError || typeof error.code !== 'string') throw error;
      const conflict = ['revision-conflict', 'published-base-conflict', 'idempotency-conflict'].includes(error.code);
      const permission = error.code === 'scope-mismatch';
      const invalid = error.code.startsWith('invalid-') || error.code.startsWith('unsupported-') || error.code.startsWith('missing-stable-') || error.code.startsWith('duplicate-');
      if (error.code === 'legacy-link-review-required') throw new HttpsError('failed-precondition', 'Match each planned block to its frozen current-week work, or explicitly choose new work, before publishing.', { code: error.code });
      if (error.code === 'missing-household-timezone') throw new HttpsError('failed-precondition', 'Save your school timezone in Settings before saving or publishing a Weekly Plan.', { code: error.code });
      throw new HttpsError(conflict ? 'aborted' : permission ? 'permission-denied' : invalid ? 'invalid-argument' : 'failed-precondition', error.message, { code: error.code });
    }
  };
  const execute = (action, { parentId, payload }) => wrap(async () => {
    validatePlanningId(parentId);
    validatePlanningPayload(payload, action);
    requireWeeklyPlanning(JSON.stringify(payload).length <= 500000, 'request-size-limit');
    const { student_id: studentId, week_key: weekKey, idempotency_key: idempotencyKey } = payload;
    const receiptId = createHash('sha256').update(`${parentId}\0${idempotencyKey}`).digest('hex');
    const receiptRef = ref(collections.RECEIPTS, receiptId);
    const requestFingerprint = fingerprint(action, payload);
    const now = Timestamp.now();
    return db.runTransaction(async (transaction) => {
      const [parentSnapshot, studentSnapshot, receiptSnapshot] = await Promise.all([
        transaction.get(ref('parents', parentId)), transaction.get(ref('students', studentId)), transaction.get(receiptRef),
      ]);
      const student = document(studentSnapshot);
      requireWeeklyPlanning(parentSnapshot.exists && student?.parent_id === parentId, 'scope-mismatch');
      requireWeeklyPlanning(student.weekly_planning_version == null || student.weekly_planning_version === 1, 'unsupported-planning-version');
      const receipt = document(receiptSnapshot);
      if (receipt) {
        requireWeeklyPlanning(receipt.parent_id === parentId && receipt.student_id === studentId
          && receipt.action === action && receipt.request_fingerprint === requestFingerprint, 'idempotency-conflict');
        return { ...receipt.response, replayed: true };
      }
      let response;
      let writes = [];
      let publicationBridge = null;
      let newExecution = null;
      let releasedLegacyTimer = null;
      if (action === 'defaults') {
        const defaultsId = `${parentId}_${studentId}`;
        const [defaultsSnapshot, subjectsSnapshot] = await Promise.all([
          transaction.get(ref(collections.DEFAULTS, defaultsId)),
          transaction.get(db.collection('subjects').where('parent_id', '==', parentId)),
        ]);
        const write = buildPlanningDefaultWrite({ parentId, studentId, defaultBlockQuantities: payload.default_block_quantities,
          currentDefaults: document(defaultsSnapshot), expectedRevision: payload.expected_revision, serverTime: now, subjects: subjectsSnapshot.docs.map(document) });
        writes = [write];
        response = { defaults_id: write.id, student_id: studentId, revision: write.data.revision, replayed: false };
      } else {
        const planId = weeklyPlanningPlanId({ parentId, studentId, weekKey });
        const [draftSnapshot, publishedSnapshot, subjectsSnapshot, executionSnapshot, bridgeSnapshot, timerSnapshot] = await Promise.all([
          transaction.get(ref(collections.DRAFTS, planId)), transaction.get(ref(collections.PLANS, planId)),
          action === 'archive' ? Promise.resolve(null) : transaction.get(db.collection('subjects').where('parent_id', '==', parentId)),
          action === 'publish' ? transaction.get(ref('schoolExecutionSnapshots', schoolExecutionSnapshotId({ parentId, studentId, weekKey }))) : Promise.resolve(null),
          action === 'publish' ? transaction.get(ref(SCHOOL_PUBLICATION_BRIDGES, planId)) : Promise.resolve(null),
          action === 'publish' ? transaction.get(ref('timerSessions', studentId)) : Promise.resolve(null),
        ]);
        const currentDraft = document(draftSnapshot);
        const currentPublished = document(publishedSnapshot);
        requireWeeklyPlanning(typeof parentSnapshot.data().timezone === 'string' && parentSnapshot.data().timezone.trim().length > 0,
          'missing-household-timezone');
        const options = { parentId, studentId, weekKey, planId, currentDraft, currentPublished,
          expectedDraftRevision: payload.expected_draft_revision, expectedPublishedRevision: payload.expected_published_revision,
          candidate: payload.candidate, range: resolvePlanningWeek({ weekKey, settings: parentSnapshot.data(), now: now.toDate() }), serverTime: now,
          subjects: subjectsSnapshot?.docs.map(document) || [] };
        if (action === 'archive') {
          const write = buildPlanningArchiveWrite(options);
          if (write) writes = [write];
        } else if (action === 'publish') writes = buildPlanningPublishWrites(options);
        else writes = [buildPlanningSaveWrite(options)];
        const draftWrite = writes.find((write) => write.collection === collections.DRAFTS);
        const publishedWrite = writes.find((write) => write.collection === collections.PLANS);
        if (action === 'publish') {
          let sourceExecution = executionSnapshot ? document(executionSnapshot) : null;
          const existingBridge = bridgeSnapshot ? document(bridgeSnapshot) : null;
          const firstPublication = !currentPublished || currentPublished.status === 'draft';
          const currentWeek = options.range.currentKey === weekKey;
          const firstLegacyPublication = firstPublication && currentWeek && student.weekly_planning_version !== 1;
          if (firstLegacyPublication && !sourceExecution) {
            const [multi, single] = await Promise.all([
              transaction.get(db.collection('subjects').where('parent_id', '==', parentId).where('student_ids', 'array-contains', studentId).limit(1001)),
              transaction.get(db.collection('subjects').where('parent_id', '==', parentId).where('student_id', '==', studentId).limit(1001)),
            ]);
            requireWeeklyPlanning(multi.size <= 1000 && single.size <= 1000, 'execution-source-read-limit');
            const assigned = new Map([...multi.docs, ...single.docs].map(document).map((subject) => [subject.id, subject]));
            newExecution = buildLegacySchoolExecution({ parentId, studentId, weekKey, subjects: [...assigned.values()], serverTime: now, range: options.range });
            sourceExecution = newExecution;
          }
          // Old published authority is its own real source, rather than a
          // fabricated legacy execution with a different evidence scope.
          const oldPublishedSource = currentWeek && !existingBridge && currentPublished?.status === 'published'
            && currentPublished.school_completion_version == null && currentPublished.blocks?.length ? currentPublished : null;
          const liveSource = !existingBridge ? firstLegacyPublication ? sourceExecution : oldPublishedSource : null;
          const firstBridgeAdoption = Boolean(liveSource);
          requireWeeklyPlanning(!existingBridge || !firstPublication, 'publication-bridge-conflict');
          const links = resolveSchoolPublicationLinks({ plan: publishedWrite.data, sourceExecution: liveSource,
            requestedLinks: draftWrite.data.legacy_source_links || {}, retainedLinks: currentDraft?.legacy_source_links || {},
            existingBridge, firstPublication: firstPublication || firstBridgeAdoption });
          draftWrite.data.legacy_source_links = links;
          publishedWrite.data.school_completion_version = 1;
          if (liveSource) {
            const start = liveSource.week_start?.toDate?.() ?? liveSource.week_start;
            const end = liveSource.week_end?.toDate?.() ?? liveSource.week_end;
            requireWeeklyPlanning(start instanceof Date && end instanceof Date && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start < end, 'legacy-link-review-required');
            const [sourceStatesSnapshot, evidenceSnapshot] = await Promise.all([
              transaction.get(db.collection('blockCompletionStates').where('parent_id', '==', parentId).where('student_id', '==', studentId)
                .where('week_key', '==', weekKey).where('weekly_plan_id', '==', liveSource.id).limit(1001)),
              transaction.get(db.collection('submissions').where('student_id', '==', studentId).where('timestamp', '>=', Timestamp.fromDate(start))
                .where('timestamp', '<=', Timestamp.fromDate(end)).limit(2001)),
            ]);
            requireWeeklyPlanning(sourceStatesSnapshot.size <= 1000 && evidenceSnapshot.size <= 2000, 'publication-bridge-size-limit');
            publicationBridge = buildSchoolPublicationBridge({ plan: publishedWrite.data, sourceExecution: liveSource,
              sourceStates: sourceStatesSnapshot.docs.map(document), evidence: evidenceSnapshot.docs.map(document).filter((item) => item.parent_id === parentId),
              legacySourceLinks: links, serverTime: now });
            const oldTimer = timerSnapshot ? document(timerSnapshot) : null;
            const timerTarget = publishedWrite.data.blocks.find((block) => block.id === oldTimer?.weekly_block_id);
            const keepCurrentTimer = liveSource.id === planId && oldTimer?.authority_version === 1 && timerTarget
              && oldTimer.context_signature === schoolTimerContext(publishedWrite.data, timerTarget, oldTimer.state_revision);
            if (oldTimer?.weekly_plan_id === liveSource.id && oldTimer.status !== 'released' && !keepCurrentTimer) releasedLegacyTimer = { ...oldTimer,
              authority_version: 1, status: 'released', target_end_ms: null, released_at: now };
          }
        }
        response = { plan_id: planId, student_id: studentId, week_key: weekKey,
          draft_revision: draftWrite?.data.revision ?? getPlanningRevision(currentDraft),
          published_revision: publishedWrite?.data.revision ?? getPlanningRevision(currentPublished),
          status: action === 'archive' ? 'archived' : action === 'publish' ? 'published' : 'draft', replayed: false };
      }
      writes.forEach((write) => {
        const data = { ...write.data };
        if (data.week_start instanceof Date) data.week_start = Timestamp.fromDate(data.week_start);
        if (data.week_end instanceof Date) data.week_end = Timestamp.fromDate(data.week_end);
        transaction.set(ref(write.collection, write.id), data);
      });
      if (newExecution) transaction.create(ref('schoolExecutionSnapshots', newExecution.id), { ...newExecution,
        week_start: Timestamp.fromDate(newExecution.week_start), week_end: Timestamp.fromDate(newExecution.week_end) });
      if (publicationBridge) transaction.create(ref(SCHOOL_PUBLICATION_BRIDGES, publicationBridge.id), publicationBridge);
      if (releasedLegacyTimer) transaction.set(ref('timerSessions', studentId), releasedLegacyTimer);
      if (action === 'publish') {
        transaction.update(ref('students', studentId), { weekly_planning_version: 1,
          school_authority_version: 1, school_state_revision: (student.school_state_revision || 0) + 1,
          school_authority_adopted_at: student.school_authority_adopted_at ?? now,
          ...resolvePlanningWeek({ weekKey, settings: parentSnapshot.data(), now: now.toDate() }).config,
          weekly_planning_adopted_at: student.weekly_planning_adopted_at ?? now, updated_at: now });
      }
      transaction.create(receiptRef, { parent_id: parentId, student_id: studentId, schema_version: 1, action,
        idempotency_key: idempotencyKey, request_fingerprint: requestFingerprint, response, recorded_at: now });
      return response;
    });
  });
  return {
    saveDraft: (options) => execute('save', options), publish: (options) => execute('publish', options),
    saveDefaults: (options) => execute('defaults', options), archive: (options) => execute('archive', options),
  };
};
