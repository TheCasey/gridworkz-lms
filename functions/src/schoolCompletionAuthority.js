import { buildTrustedSchoolReport } from './schoolReportFoundation.js';
import { SCHOOL_PUBLICATION_BRIDGES, getInheritedSchoolPublicationState, resolveSchoolReportCorrectionTarget } from './schoolPublicationBridge.js';
import { createHash } from 'node:crypto';
import { resolvePlanningWeek, weeklyPlanningPlanId } from './weeklyPlanningContracts.js';
import { projectPublicWeeklyBlocks } from './weeklyPlanningFoundation.js';
import { SCHOOL_COLLECTIONS as C, requireSchoolAuthority as requireValue, validateSchoolPayload, schoolExecutionSnapshotId,
  buildLegacySchoolExecution, buildHistoricalSchoolExecution, projectSafeSchoolPlan } from './schoolCompletionContracts.js';
import { buildParentCorrection, buildReportAmendment, resolveEffectiveSchoolBlockState, projectStudentSchoolBlockState,
  buildBlockCompletionStateId, validateSchoolStudentResponse, schoolTimerContext, trustedSchoolTimerElapsedMs,
  buildSchoolTimerCommand, projectStudentSchoolTimer } from './schoolCompletionFoundation.js';
const doc = (snapshot) => snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const milliseconds = (value) => value?.toMillis?.() ?? new Date(value).getTime();
const scopedEvidence = (evidence, scope) => evidence.map((item) => ({ ...item, ...scope }));

// Reports are immutable inputs. Counts/status change; original summaries/time/evidence stay untouched.
export const amendSchoolReportSnapshot = (snapshot, block, state) => {
  const result = { ...snapshot, subjects_data: Object.fromEntries(Object.entries(snapshot.subjects_data || {}).map(([id, value]) => [id, { ...value }])) };
  const assigned = Array.isArray(snapshot.assigned_blocks_snapshot) ? snapshot.assigned_blocks_snapshot : [];
  const matches = assigned.filter((item) => item.blockId === block.id);
  requireValue(matches.length <= 1, 'report-lineage-review-required');
  const previous = matches[0];
  if (!previous) {
    requireValue(snapshot.snapshot_model === 'subjects' && result.subjects_data[block.legacy_subject_id], 'historical-assignment-review-required');
    // A subjects-only report cannot reliably attribute every completion to an index.
    // Store an explicit status overlay; retain its original numerical/evidence snapshot.
    result.block_completion_overrides = { ...(snapshot.block_completion_overrides || {}), [block.id]: {
      subject_id: block.legacy_subject_id, block_index: block.legacy_block_index, status: state.status,
      provenance: state.provenance, revision: state.revision, correction_event_id: state.last_correction_event_id,
    } };
    result.completion_counts_require_review = true;
    return result;
  }
  const completed = state.status === 'completed';
  const delta = Number(completed) - Number(Boolean(previous.completed));
  result.assigned_blocks_snapshot = assigned.map((item) => item === previous ? { ...item, completed, completionStatus: state.status,
    completionProvenance: state.provenance, correctionEventId: state.last_correction_event_id, stateRevision: state.revision } : item);
  result.total_blocks = Math.max(0, (result.total_blocks || 0) + delta);
  if (result.subjects_data[block.legacy_subject_id]) result.subjects_data[block.legacy_subject_id].totalBlocks = Math.max(0, (result.subjects_data[block.legacy_subject_id].totalBlocks || 0) + delta);
  return result;
};
export const createSchoolCompletionService = ({ db, Timestamp, HttpsError, resolveTrustedStudentContext }) => {
  const ref = (collection, id) => db.collection(collection).doc(id);
  const wrap = async (operation) => {
    try { return await operation(); } catch (error) {
      if (error instanceof HttpsError || typeof error.code !== 'string') throw error;
      const conflict = ['revision-conflict', 'idempotency-conflict'].includes(error.code);
      const permission = ['scope-mismatch', 'student-context-changed'].includes(error.code);
      const message = error.code === 'missing-household-timezone' ? 'Save your school timezone in Settings before using school completion.'
        : error.code === 'historical-assignment-review-required' ? 'This historical block has no unambiguous saved assignment. Review the original saved report; no correction was applied.' : error.message;
      throw new HttpsError(conflict ? 'aborted' : permission ? 'permission-denied' : error.code.startsWith('invalid-') || error.code.startsWith('unsupported-') ? 'invalid-argument' : 'failed-precondition', message, { code: error.code });
    }
  };
  const execute = (action, { parentId: ownerId = null, payload }) => wrap(async () => {
    validateSchoolPayload(payload, action);
    const parentAction = ['correct', 'report'].includes(action);
    const context = parentAction ? null : await resolveTrustedStudentContext(payload);
    const parentId = ownerId ?? context.parentId;
    const studentId = parentAction ? payload.student_id : context.studentId;
    const now = Timestamp.now();
    const fingerprint = hash(JSON.stringify(canonical({ action, parentId, studentId, payload })));
    const receiptId = action === 'read' ? null : hash(`${parentId}\0${payload.idempotency_key}`);
    return db.runTransaction(async (tx) => {
      const [parentSnap, studentSnap, receiptSnap] = await Promise.all([tx.get(ref('parents', parentId)), tx.get(ref('students', studentId)),
        receiptId ? tx.get(ref(C.RECEIPTS, receiptId)) : Promise.resolve(null)]);
      const parent = doc(parentSnap); const student = doc(studentSnap); const receipt = receiptSnap ? doc(receiptSnap) : null;
      requireValue(parent && student?.parent_id === parentId, 'scope-mismatch');
      requireValue(!context || student.is_active !== false && student.access_pin === context.studentRecord.access_pin && student.parent_id === context.parentId,
        'student-context-changed');
      requireValue(student.school_authority_version == null || student.school_authority_version === 1, 'unsupported-school-version');
      if (receipt) { requireValue(receipt.request_fingerprint === fingerprint && receipt.action === action, 'idempotency-conflict'); return { ...receipt.response, replayed: true, server_now_ms: now.toMillis() }; }
      requireValue(typeof parent.timezone === 'string' && parent.timezone.trim(), 'missing-household-timezone');
      // A valid provisional key is only used to discover the canonical household current key.
      const current = resolvePlanningWeek({ weekKey: '2026-01-05', settings: parent, now: now.toDate() }).currentKey;
      const weekKey = payload.week_key || current;
      const range = resolvePlanningWeek({ weekKey, settings: parent, now: now.toDate() });
      requireValue(parentAction ? weekKey <= current : weekKey === current, 'non-current-student-week');
      const planId = weeklyPlanningPlanId({ parentId, studentId, weekKey });
      const executionId = schoolExecutionSnapshotId({ parentId, studentId, weekKey });
      const scoped = (collection) => db.collection(collection).where('parent_id', '==', parentId).where('student_id', '==', studentId).where('week_key', '==', weekKey);
      const [planSnap, executionSnap, statesSnap, timerSnap, reportsSnap] = await Promise.all([
        tx.get(ref('weeklyPlans', planId)), tx.get(ref(C.EXECUTIONS, executionId)),
        tx.get(scoped(C.STATES).limit(1001)),
        tx.get(ref('timerSessions', studentId)), tx.get(scoped('weeklyReports').limit(21)),
      ]);
      requireValue(statesSnap.size <= 1000 && reportsSnap.size <= 20, 'school-transaction-read-limit');
      if (action === 'report') {
        const existingReport = reportsSnap.docs.map(doc).find((item) => item.id === planId);
        if (existingReport) {
          const response = { report_id: existingReport.id, created: false, replayed: false, school_state_revision: student.school_state_revision || 0 };
          tx.create(ref(C.RECEIPTS, receiptId), { parent_id: parentId, student_id: studentId, action, request_fingerprint: fingerprint, response, recorded_at: now, schema_version: 1 });
          return response;
        }
      }
      const published = doc(planSnap); let plan = null; let newExecution = false;
      if (published && (published.status === 'published' || parentAction && published.status === 'archived')) {
        requireValue(published.parent_id === parentId && published.student_id === studentId && published.week_key === weekKey, 'scope-mismatch');
        plan = { ...published, blocks: projectPublicWeeklyBlocks(published.blocks || []) };
      } else if (published?.status === 'archived' || student.weekly_planning_version >= 1 && !(student.weekly_planning_adopted_at && milliseconds(student.weekly_planning_adopted_at) > range.weekEnd.getTime())) {
        // Adoption permanently suppresses fallback, including intentionally empty or missing weeks.
        plan = null;
      } else {
        plan = doc(executionSnap);
        if (!plan) {
          newExecution = true;
          if (weekKey === current) {
            const [multi, single] = await Promise.all([
              tx.get(db.collection('subjects').where('parent_id', '==', parentId).where('student_ids', 'array-contains', studentId).limit(1001)),
              tx.get(db.collection('subjects').where('parent_id', '==', parentId).where('student_id', '==', studentId).limit(1001)),
            ]);
            requireValue(multi.size <= 1000 && single.size <= 1000, 'execution-source-read-limit');
            const assigned = new Map([...multi.docs, ...single.docs].map(doc).map((subject) => [subject.id, subject]));
            plan = buildLegacySchoolExecution({ parentId, studentId, weekKey, subjects: [...assigned.values()], serverTime: now, range });
          } else plan = buildHistoricalSchoolExecution({ parentId, studentId, weekKey, reports: reportsSnap.docs.map(doc), serverTime: now });
        }
      }
      if (plan) requireValue(plan.parent_id === parentId && plan.student_id === studentId && plan.week_key === weekKey && plan.blocks.length <= 500, 'scope-mismatch');
      if (!parentAction && plan?.status !== 'published') plan = null;
      const date = (value) => value?.toDate?.() ?? (value ? new Date(value) : null);
      const historicalReport = reportsSnap.docs.map(doc).find((report) => !report.weekly_plan_id || report.weekly_plan_id === plan?.id);
      const recordedStart = date(plan?.week_start ?? historicalReport?.week_start);
      const recordedEnd = date(plan?.week_end ?? historicalReport?.week_end);
      requireValue(weekKey === current || recordedStart && recordedEnd && Number.isFinite(recordedStart.getTime())
        && Number.isFinite(recordedEnd.getTime()) && recordedStart < recordedEnd, 'historical-assignment-review-required');
      const evidenceStart = recordedStart || range.weekStart;
      const evidenceEnd = recordedEnd || range.weekEnd;
      const evidenceSnap = await tx.get(db.collection('submissions').where('student_id', '==', studentId)
        .where('timestamp', '>=', Timestamp.fromDate(evidenceStart)).where('timestamp', '<=', Timestamp.fromDate(evidenceEnd)).limit(2001));
      requireValue(evidenceSnap.size <= 2000, 'school-transaction-read-limit');
      const evidence = evidenceSnap.docs.map(doc).filter((item) => item.parent_id === parentId).sort((a, b) => milliseconds(a.timestamp) - milliseconds(b.timestamp));
      const states = new Map(statesSnap.docs.map(doc).map((state) => [state.id, state]));
      // Missing/empty/adopted suppression was resolved above; a private bridge
      // cannot revive absent work or attach to a different execution scope.
      const bridge = plan?.school_completion_version === 1 && plan.blocks.length
        ? doc(await tx.get(ref(SCHOOL_PUBLICATION_BRIDGES, plan.id))) : null;
      const effective = (block) => resolveEffectiveSchoolBlockState({ plan, block,
        state: states.get(buildBlockCompletionStateId({ planId: plan.id, blockId: block.id })),
        inheritedState: getInheritedSchoolPublicationState({ bridge, plan, block }), evidence });
      const timerStored = doc(timerSnap);
      const timerInScope = weekKey === current || timerStored?.week_key === weekKey;
      let timer = timerInScope ? timerStored : null;
      if (timer) {
        const timerBlock = plan?.blocks.find((block) => block.id === timer.weekly_block_id);
        if (student.school_authority_version !== 1 || !timerBlock || timer.authority_version !== 1 || timer.context_signature !== schoolTimerContext(plan, timerBlock, effective(timerBlock).revision)
          || effective(timerBlock).status === 'completed') timer = null;
      }
      const writes = [];
      let changed = student.school_authority_version !== 1 || Object.entries(range.config).some(([key, value]) => student[key] !== value) || newExecution || Boolean(timerStored && timerInScope && !timer && timerStored.status !== 'released');
      if (newExecution) writes.push({ collection: C.EXECUTIONS, id: executionId, data: { ...plan,
        ...(plan.week_start instanceof Date ? { week_start: Timestamp.fromDate(plan.week_start), week_end: Timestamp.fromDate(plan.week_end) } : {}) } });
      if (timerStored && timerInScope && !timer && timerStored.status !== 'released') writes.push({ collection: 'timerSessions', id: studentId, data: { ...timerStored, status: 'released', target_end_ms: null, released_at: now, authority_version: 1 } });
      let response;
      if (action === 'report') {
        if (plan?.blocks.length) {
          const effectiveStates = plan.blocks.map(effective);
          const evidenceIds = [...new Set(effectiveStates.flatMap((state) => state.original_evidence_ids))];
          const originals = await Promise.all(evidenceIds.map(async (id) => evidence.find((item) => item.id === id) || doc(await tx.get(ref('submissions', id)))));
          requireValue(originals.every((item) => item && item.parent_id === parentId && item.student_id === studentId), 'missing-original-evidence');
          const report = buildTrustedSchoolReport({ id: planId, parent, student, plan, states: effectiveStates, evidence: originals,
            weekStart: evidenceStart, weekEnd: evidenceEnd, schoolRevision: (student.school_state_revision || 0) + Number(changed), serverTime: now, source: payload.source });
          requireValue(JSON.stringify(report).length <= 750000, 'report-size-limit');
          writes.push({ collection: 'weeklyReports', id: planId, data: report });
          response = { report_id: planId, created: true, replayed: false };
        } else response = { report_id: null, created: false, replayed: false };
      } else if (action === 'read') {
        response = { student_id: studentId, week_key: weekKey, weekly_plan_id: plan?.id ?? '', authority_kind: plan?.authority_kind || (plan ? 'published' : 'empty'),
          school_authority_version: 1, week_start_ms: range.weekStart.getTime(), week_end_ms: range.weekEnd.getTime(), weekly_plan: projectSafeSchoolPlan(plan), blocks: plan?.blocks.map((block) => projectStudentSchoolBlockState(effective(block), block)) || [], timer: projectStudentSchoolTimer(timer) };
      } else {
        requireValue(plan, 'missing-authoritative-plan');
        const matches = plan.blocks.filter((block) => block.id === payload.weekly_block_id && block.student_id === studentId);
        requireValue(matches.length === 1, 'invalid-correction-block');
        const block = matches[0]; const prior = effective(block);
        requireValue(prior.revision === payload.expected_revision, 'revision-conflict');
        const scope = { parent_id: parentId, student_id: studentId, week_key: weekKey, weekly_plan_id: plan.id, weekly_block_id: block.id };
        const amendmentIds = [];
        if (action === 'timer') {
          const sessionId = payload.action === 'start' ? `school-timer:${receiptId}` : payload.timer_session_id;
          const nextTimer = buildSchoolTimerCommand({ action: payload.action, sessionId, currentTimer: timer, plan, block, state: prior, nowMs: now.toMillis() });
          changed = changed || JSON.stringify(nextTimer) !== JSON.stringify(timer);
          writes.push({ collection: 'timerSessions', id: studentId, data: nextTimer });
          response = { timer: projectStudentSchoolTimer(nextTimer), replayed: false };
        } else {
          let state; let eventId = null; let submissionId = null;
          if (action === 'correct') {
            const sourceEvidence = await Promise.all(prior.original_evidence_ids.map(async (id) => evidence.find((item) => item.id === id) || doc(await tx.get(ref('submissions', id)))));
            requireValue(sourceEvidence.every((item) => item && item.parent_id === parentId && item.student_id === studentId), 'missing-original-evidence');
            const correction = buildParentCorrection({ request: Object.fromEntries(['new_status', 'reason', 'note', 'idempotency_key', 'expected_revision'].map((key) => [key, payload[key]])),
              plan, currentState: prior, originalEvidence: scopedEvidence(sourceEvidence, scope), actorId: parentId, serverTime: now });
            eventId = correction.event.id;
            state = { ...correction.state, provenance: 'parent_correction', actor_id: parentId, completed_at: payload.new_status === 'completed' ? now : null };
            writes.push({ collection: C.EVENTS, id: eventId, data: correction.event });
            const reports = reportsSnap.docs.map(doc).map((report) => ({ report,
              target: resolveSchoolReportCorrectionTarget({ report, plan, block, bridge }) })).filter((item) => item.target);
            const heads = await Promise.all(reports.map(({ report }) => tx.get(ref(C.REPORT_HEADS, report.id))));
            const previous = await Promise.all(heads.map((head) => head.exists ? tx.get(ref(C.AMENDMENTS, head.data().latest_amendment_id)) : Promise.resolve(null)));
            reports.forEach(({ report, target }, index) => {
              const last = previous[index] ? doc(previous[index]) : null;
              const amendment = buildReportAmendment({ originalReport: report, previousAmendment: last, correctionEvents: [correction.event],
                amendedSnapshot: amendSchoolReportSnapshot(last?.snapshot || report, target.block, state), reportLineage: target.lineage, expectedVersion: last?.report_version || 1, actorId: parentId, serverTime: now });
              amendment.correction_event_ids = [...(last?.correction_event_ids || []), eventId];
              amendmentIds.push(amendment.id);
              writes.push({ collection: C.AMENDMENTS, id: amendment.id, data: amendment });
              writes.push({ collection: C.REPORT_HEADS, id: report.id, data: { ...scope, weekly_plan_id: report.weekly_plan_id || '', original_report_id: report.id,
                latest_amendment_id: amendment.id, report_version: amendment.report_version, updated_at: now } });
            });
          } else {
            requireValue(prior.status !== 'completed', 'already-completed');
            validateSchoolStudentResponse(payload, block);
            if (block.require_timer) requireValue(timer && timer.session_id === payload.timer_session_id && timer.weekly_block_id === block.id
              && timer.context_signature === schoolTimerContext(plan, block, prior.revision) && trustedSchoolTimerElapsedMs(timer, now.toMillis()) >= timer.duration_ms, 'timer-not-complete');
            submissionId = `school-submission:${receiptId}`;
            const submission = { ...scope, id: submissionId, subject_id: block.legacy_subject_id, subject_name: block.legacy_subject_title || block.title,
              block_index: block.legacy_block_index, timestamp: now, created_at: now, summary_text: payload.summary_text,
              resources_used: payload.resources_used, custom_field_responses: payload.custom_field_responses,
              block_duration: block.require_timer ? timer.duration_ms / 60000 : 0, trusted_elapsed_ms: block.require_timer ? trustedSchoolTimerElapsedMs(timer, now.toMillis()) : 0,
              authority_version: 1, actor_id: studentId, is_locked: true, timer_session_id: block.require_timer ? timer.session_id : null };
            state = { ...prior, revision: prior.revision + 1, status: 'completed', provenance: 'student', actor_id: studentId,
              completed_at: now, updated_at: now, last_submission_id: submissionId, original_evidence_ids: [...prior.original_evidence_ids, submissionId] };
            writes.push({ collection: 'submissions', id: submissionId, data: submission });
          }
          writes.push({ collection: C.STATES, id: state.id, data: state });
          writes.push({ collection: C.HISTORY, id: `${state.id}:revision:${state.revision}`, data: { ...state, recorded_at: now, event_id: eventId, submission_id: submissionId } });
          if (timerInScope && timerStored?.weekly_plan_id === plan.id && timerStored.weekly_block_id === block.id) writes.push({ collection: 'timerSessions', id: studentId, data: { ...timerStored, status: 'released', target_end_ms: null, released_at: now, authority_version: 1 } });
          changed = true;
          response = { state_id: state.id, event_id: eventId, submission_id: submissionId, revision: state.revision, status: state.status, amendment_ids: amendmentIds, replayed: false };
        }
      }
      const marker = (student.school_state_revision || 0) + Number(changed);
      response.school_state_revision = marker;
      response.server_now_ms = now.toMillis();
      // All reads, including amendment heads/versions, finish before any write.
      requireValue(writes.length <= 70, 'school-transaction-write-limit');
      writes.forEach((write) => [C.EVENTS, C.HISTORY, C.EXECUTIONS, C.AMENDMENTS, 'submissions', 'weeklyReports'].includes(write.collection)
        ? tx.create(ref(write.collection, write.id), write.data) : tx.set(ref(write.collection, write.id), write.data));
      if (changed) tx.update(ref('students', studentId), { school_authority_version: 1, school_state_revision: marker,
        school_authority_adopted_at: student.school_authority_adopted_at || now, ...range.config, updated_at: now });
      if (receiptId) tx.create(ref(C.RECEIPTS, receiptId), { parent_id: parentId, student_id: studentId, action, request_fingerprint: fingerprint,
        response, recorded_at: now, schema_version: 1 });
      return response;
    });
  });
  return { fileReport: (options) => execute('report', options), read: (options) => execute('read', options), correct: (options) => execute('correct', options),
    submit: (options) => execute('submit', options), timer: (options) => execute('timer', options) };
};
