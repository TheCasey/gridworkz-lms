import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { commandTrustedStudentSchoolTimer, getTrustedStudentSchoolState, submitTrustedSchoolBlock } from '../firebase/trustedOperations';
import { normalizeTrustedSchoolTimer, schoolSafeCompletedBlocks } from '../utils/schoolAuthorityUtils';

const uncertain = (error) => ['unavailable', 'deadline-exceeded', 'internal', 'unknown', 'cancelled'].includes((error?.code || '').replace(/^functions\//, ''));

export const useStudentSchoolState = ({ student = null, slug = '', pin = '', weekKey = '', sourceRevision = '', enabled = false } = {}) => {
  const context = useMemo(() => ({ student_id: student?.id || '', slug, access_pin: pin }), [student?.id, slug, pin]);
  const scope = enabled && context.student_id && weekKey ? JSON.stringify([context, weekKey]) : '';
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const [record, setRecord] = useState({ scope: '', data: null, error: null, receivedAtMs: 0 });
  const [operation, setOperation] = useState({ scope: '', kind: '' });
  const generation = useRef(0);
  const flight = useRef(null);
  const pending = useRef(new Map());
  const busyScopes = useRef(new Set());
  const visible = record.scope === scope ? record : { data: null, error: null, receivedAtMs: 0 };

  const refresh = useCallback(({ minRevision = 0 } = {}) => {
    if (!scope) return Promise.resolve(null);
    if (flight.current?.scope === scope && flight.current.minRevision >= minRevision) return flight.current.promise;
    const request = ++generation.current;
    const promise = getTrustedStudentSchoolState(context).then((data) => {
      if (scopeRef.current !== scope || generation.current !== request) return null;
      if (data.student_id !== context.student_id || data.school_authority_version !== 1) throw new Error('The school week changed. Reload the current week.');
      if (!busyScopes.current.has(scope)) {
        for (const [key, retry] of pending.current) {
          if (retry.scope !== scope) continue;
          const latest = data.blocks.find((item) => item.weekly_block_id === retry.payload.weekly_block_id);
          if (!latest || latest.revision > retry.payload.expected_revision) pending.current.delete(key);
        }
      }
      setRecord({ scope, data, error: null, receivedAtMs: Date.now() });
      return data;
    }).catch((error) => {
      if (scopeRef.current === scope && generation.current === request) {
        setRecord((previous) => ({ scope, data: previous.scope === scope ? previous.data : null, receivedAtMs: previous.scope === scope ? previous.receivedAtMs : 0, error }));
      }
      return null;
    }).finally(() => { if (flight.current?.request === request) flight.current = null; });
    flight.current = { scope, request, promise, minRevision };
    return promise;
  }, [scope, context, weekKey]);

  useEffect(() => {
    if (!scope) {
      generation.current += 1;
      setRecord({ scope: '', data: null, error: null, receivedAtMs: 0 });
      return undefined;
    }
    refresh({ minRevision: student?.school_state_revision || 0 });
    return () => { generation.current += 1; if (flight.current?.scope === scope) flight.current = null; };
  }, [scope, refresh, student?.school_state_revision, sourceRevision]);

  useEffect(() => {
    const data = visible.data;
    if (!scope || !Number.isFinite(data?.week_end_ms) || !Number.isFinite(data?.server_now_ms)) return undefined;
    // Schedule against server time, including when the device date is wrong.
    const refreshCurrent = () => refresh();
    const timer = setTimeout(refreshCurrent, Math.max(1, data.week_end_ms + 1 - data.server_now_ms));
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshCurrent(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [scope, visible.data, refresh]);

  const perform = useCallback(async (kind, blockId, intent, callable) => {
    if (!scope || !visible.data || busyScopes.current.has(scope)) return null;
    const block = visible.data.blocks.find((item) => item.weekly_block_id === blockId);
    if (!block) return null;
    const key = JSON.stringify([scope, kind, blockId]);
    const signature = JSON.stringify(intent);
    const existing = pending.current.get(key);
    const request = existing?.signature === signature ? existing : { scope, signature, payload: {
      ...context, week_key: visible.data.week_key, weekly_block_id: blockId, expected_revision: block.revision,
      ...intent, idempotency_key: nanoid(),
    } };
    pending.current.set(key, request);
    busyScopes.current.add(scope);
    setOperation({ scope, kind });
    try {
      const response = await callable(request.payload);
      pending.current.delete(key);
      if (scopeRef.current === scope) await refresh({ minRevision: response.school_state_revision || 0 });
      return scopeRef.current === scope ? response : null;
    } catch (error) {
      if (!uncertain(error)) pending.current.delete(key);
      if (scopeRef.current === scope) setRecord((previous) => ({ ...previous, scope, error }));
      return null;
    } finally {
      busyScopes.current.delete(scope);
      setOperation((previous) => previous.scope === scope ? { scope, kind: '' } : previous);
    }
  }, [scope, visible.data, context, weekKey, refresh]);

  const commandTimer = useCallback(({ action, blockId, timerSessionId = null }) => perform(`timer:${action}`, blockId,
    { action, ...(timerSessionId ? { timer_session_id: timerSessionId } : {}) }, commandTrustedStudentSchoolTimer), [perform]);
  const submit = useCallback(({ blockId, summaryText = '', resourcesUsed = [], customFieldResponses = {}, timerSessionId = null }) => perform('submit', blockId,
    { summary_text: summaryText, resources_used: resourcesUsed, custom_field_responses: customFieldResponses,
      ...(timerSessionId ? { timer_session_id: timerSessionId } : {}) }, submitTrustedSchoolBlock), [perform]);
  const data = visible.data;
  const timer = useMemo(() => normalizeTrustedSchoolTimer(data?.timer, { serverNowMs: data?.server_now_ms, localNowMs: visible.receivedAtMs }), [data, visible.receivedAtMs]);
  const completedBlocks = useMemo(() => schoolSafeCompletedBlocks(data?.blocks), [data?.blocks]);
  return { data, timer, completedBlocks, error: visible.error, loading: Boolean(scope && !data && !visible.error),
    ready: Boolean(scope && data && !visible.error), busy: operation.scope === scope && Boolean(operation.kind),
    refresh, commandTimer, submit };
};
export default useStudentSchoolState;
