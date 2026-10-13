import {
  applyPointLedgerMutation,
  buildPointLedgerEntryId,
  normalizePointWallet,
  POINT_SOURCE_TYPES,
} from './pointLedgerUtils.js';
import {
  ROUTINE_REWARD_CATALOG,
  ROUTINE_REWARD_COLLECTIONS,
  ROUTINE_REWARD_CONTRACT,
  assertRoutineScopedRecord,
  buildAllowanceHistorySettlement,
  buildFrozenRoutineDaySnapshot,
  buildFrozenRoutineDayAwardDecision,
  buildHouseholdHistoryEventId,
  buildRoutineCosmeticSelection,
  buildRoutineCosmeticState,
  buildRoutineCosmeticStateId,
  buildRoutineCosmeticUnlock,
  buildRoutineDayPointerId,
  buildRoutineDaySnapshotId,
  getRoutineCatalogItem,
  isFrozenRoutineDayComplete,
  requireRoutineReward,
  resolveRoutineRewardAccess,
  routineLocalDateKey,
  validateRoutineCompletionItems,
  validateRoutineRewardSettingsPayload,
} from './routineRewardContracts.js';

const data = (snapshot) => snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null;
const millis = (value) => value?.toMillis?.() ?? (value instanceof Date ? value.getTime() : NaN);
const cleanWallet = (wallet) => ({ id: wallet.id, student_id: wallet.student_id, total_points: wallet.total_points, lifetime_points: wallet.lifetime_points });
const publicCosmetics = (state) => ({ id: state.id, revision: state.revision, owned_cosmetic_ids: [...state.owned_cosmetic_ids], selected_cosmetic_ids: { ...state.selected_cosmetic_ids } });
const contextFields = ['student_id', 'studentId', 'slug', 'student_slug', 'studentSlug', 'access_pin', 'accessPin', 'pin'];
const assertPayloadKeys = (payload, fields) => requireRoutineReward(payload && typeof payload === 'object' && !Array.isArray(payload)
  && Object.keys(payload).every((key) => [...contextFields, ...fields].includes(key)), 'unsupported-request-field');

// All reads occur before writes. Every completion transaction reads all frozen
// completion ids and the single day ledger id, so concurrent final periods retry.
export const createRoutineRewardService = ({ db, Timestamp, HttpsError, resolveEntitlementRecord }) => {
  const ref = (collection, id) => db.collection(collection).doc(id);
  const wrap = async (operation) => {
    try { return await operation(); } catch (error) {
      if (error instanceof HttpsError || !error.code) throw error;
      const permission = ['scope-mismatch', 'routine-rewards-disabled', 'product-direction-inactive', 'daily-routines-disabled'].includes(error.code);
      const invalid = ['unsupported-request-field', 'invalid-settings', 'invalid-identity', 'invalid-checklist-completion', 'incomplete-checklist', 'invalid-cosmetic-selection', 'unknown-cosmetic', 'invalid-settlement-request', 'invalid-date-key', 'invalid-timezone'].includes(error.code);
      throw new HttpsError(permission ? 'permission-denied' : invalid ? 'invalid-argument' : 'failed-precondition', error.message, { code: error.code });
    }
  };
  const activeAccess = async (transaction, parentId, requireRewards = true) => {
    const entitlementSnapshot = await transaction.get(ref('accountEntitlements', parentId));
    const entitlement = data(entitlementSnapshot) || {};
    const resolved = resolveEntitlementRecord({ parentId, entitlementDoc: entitlement });
    const access = resolveRoutineRewardAccess({ features: resolved.features, entitlementDoc: entitlement });
    requireRoutineReward(access.productDirectionActive, 'product-direction-inactive');
    if (requireRewards) requireRoutineReward(access.canUseRoutineRewards, 'routine-rewards-disabled');
    return access;
  };
  const assertStudent = async (transaction, parentId, studentId) => {
    const student = data(await transaction.get(ref('students', studentId)));
    requireRoutineReward(student?.parent_id === parentId && student.is_active !== false, 'scope-mismatch');
  };
  const loadDay = async (transaction, parentId, studentId, now) => {
    const pointerRef = ref(ROUTINE_REWARD_COLLECTIONS.DAY_POINTERS, buildRoutineDayPointerId({ parentId, studentId }));
    const pointer = data(await transaction.get(pointerRef));
    if (pointer) assertRoutineScopedRecord(pointer, parentId, studentId);
    let snapshot;
    let snapshotRef;
    let createSnapshot = false;
    if (pointer && millis(pointer.day_start) <= now.toMillis() && millis(pointer.day_end) > now.toMillis()) {
      requireRoutineReward(pointer.snapshot_id === buildRoutineDaySnapshotId({ parentId, studentId, dateKey: pointer.date_key }), 'invalid-day-pointer');
      snapshotRef = ref(ROUTINE_REWARD_COLLECTIONS.DAY_SNAPSHOTS, pointer.snapshot_id);
      snapshot = data(await transaction.get(snapshotRef));
      requireRoutineReward(Boolean(snapshot), 'missing-day-snapshot');
    } else {
      const [parentSnapshot, choreSettingsSnapshot, rewardSettingsSnapshot] = await Promise.all([
        transaction.get(ref('parents', parentId)), transaction.get(ref('choreSettings', parentId)), transaction.get(ref('rewardSettings', parentId)),
      ]);
      const timezone = choreSettingsSnapshot.data()?.timezone || parentSnapshot.data()?.timezone || 'America/Chicago';
      const dateKey = routineLocalDateKey(now.toDate(), timezone);
      snapshotRef = ref(ROUTINE_REWARD_COLLECTIONS.DAY_SNAPSHOTS, buildRoutineDaySnapshotId({ parentId, studentId, dateKey }));
      snapshot = data(await transaction.get(snapshotRef));
      if (!snapshot) {
        const templatesQuery = db.collection('routineTemplates').where('parent_id', '==', parentId);
        const templateSnapshots = await transaction.get(templatesQuery);
        snapshot = buildFrozenRoutineDaySnapshot({ parentId, studentId, now: now.toDate(), timezone, templates: templateSnapshots.docs.map(data), rewardSettings: rewardSettingsSnapshot.data() || {} });
        snapshot = { ...snapshot, day_start: Timestamp.fromDate(snapshot.day_start), day_end: Timestamp.fromDate(snapshot.day_end), recorded_at: now };
        createSnapshot = true;
      }
    }
    assertRoutineScopedRecord(snapshot, parentId, studentId);
    requireRoutineReward(snapshot.schema_version === 1 && Array.isArray(snapshot.templates), 'invalid-day-snapshot');
    requireRoutineReward(snapshot.id === buildRoutineDaySnapshotId({ parentId, studentId, dateKey: snapshot.date_key }), 'invalid-day-snapshot');
    const completionRefs = snapshot.templates.map((template) => ref('routineCompletions', `${template.id}_${studentId}_${snapshot.date_key}`));
    const completionSnapshots = await Promise.all(completionRefs.map((completionRef) => transaction.get(completionRef)));
    const completions = completionSnapshots.map(data).filter(Boolean);
    completions.forEach((completion) => assertRoutineScopedRecord(completion, parentId, studentId));
    const writeDay = () => {
      if (createSnapshot) transaction.create(snapshotRef, snapshot);
      if (!pointer || pointer.snapshot_id !== snapshot.id) transaction.set(pointerRef, {
        id: pointerRef.id, parent_id: parentId, student_id: studentId, schema_version: 1,
        snapshot_id: snapshot.id, date_key: snapshot.date_key, timezone: snapshot.timezone,
        day_start: snapshot.day_start, day_end: snapshot.day_end, updated_at: now,
      });
    };
    return { snapshot, completions, completionRefs, writeDay };
  };
  const loadCosmetics = async (transaction, parentId, studentId, now) => {
    const cosmeticRef = ref(ROUTINE_REWARD_COLLECTIONS.COSMETIC_STATES, buildRoutineCosmeticStateId({ parentId, studentId }));
    const walletRef = ref('studentPointWallets', studentId);
    const legacyQuery = db.collection('rewardRedemptions').where('parent_id', '==', parentId).where('student_id', '==', studentId);
    const [cosmeticSnapshot, walletSnapshot, legacySnapshot] = await Promise.all([
      transaction.get(cosmeticRef), transaction.get(walletRef), transaction.get(legacyQuery),
    ]);
    const existingState = data(cosmeticSnapshot);
    const walletRecord = data(walletSnapshot);
    if (walletRecord) assertRoutineScopedRecord(walletRecord, parentId, studentId);
    const wallet = normalizePointWallet(walletRecord || { parent_id: parentId, student_id: studentId }, studentId);
    const state = buildRoutineCosmeticState({ existingState, legacyRedemptions: legacySnapshot.docs.map(data), parentId, studentId, now });
    const stateChanged = !existingState || state.revision !== existingState.revision
      || JSON.stringify(state.owned_cosmetic_ids) !== JSON.stringify(existingState.owned_cosmetic_ids)
      || JSON.stringify(state.selected_cosmetic_ids) !== JSON.stringify(existingState.selected_cosmetic_ids);
    return { state, wallet, cosmeticRef, walletRef, existingState, stateChanged };
  };
  const writeState = (transaction, stateRef, state, now) => transaction.set(stateRef, { ...state, updated_at: now }, { merge: true });
  const writeLedgerMutation = (transaction, ledgerRef, walletRef, next, now) => {
    requireRoutineReward(next.applied, next.code || 'invalid-ledger-mutation');
    requireRoutineReward(Number.isSafeInteger(next.wallet.total_points) && Number.isSafeInteger(next.wallet.lifetime_points), 'wallet-overflow');
    transaction.create(ledgerRef, { ...next.ledgerEntry, created_at: now });
    transaction.set(walletRef, { ...next.wallet, updated_at: now }, { merge: true });
  };
  const responseDay = (day) => ({
    snapshot_id: day.snapshot.id, date_key: day.snapshot.date_key, timezone: day.snapshot.timezone,
    routine_day_points: day.snapshot.routine_day_points, routine_points_enabled: day.snapshot.routine_points_enabled,
    complete: isFrozenRoutineDayComplete(day.snapshot, day.completions),
  });
  const responseRoutines = (day) => day.snapshot.templates.map((template) => ({
    ...template, counts_toward_allowance: false, counts_toward_points: day.snapshot.routine_points_enabled,
    completions: day.completions.filter((completion) => completion.routine_template_id === template.id).map((completion) => ({
      id: completion.id, date_key: completion.date_key, completed_item_ids: completion.completed_item_ids,
      completed_at: completion.completed_at?.toDate?.().toISOString() || null,
    })),
  }));
  const publicAccess = (access) => ({
    product_direction_version: 1, can_use_daily_routines: access.canUseDailyRoutines,
    can_use_routine_rewards: access.canUseRoutineRewards, can_use_chores: false, can_use_rewards: false,
  });

  return {
    read: ({ parentId, studentId, requireRewards = true }) => wrap(() => db.runTransaction(async (transaction) => {
      const now = Timestamp.now();
      const access = await activeAccess(transaction, parentId, requireRewards);
      await assertStudent(transaction, parentId, studentId);
      const day = await loadDay(transaction, parentId, studentId, now);
      const cosmetics = access.canUseRoutineRewards ? await loadCosmetics(transaction, parentId, studentId, now) : null;
      let mutation = null;
      let ledgerRef;
      let ledger;
      if (cosmetics) {
        const sourceId = `routine_day:${day.snapshot.date_key}`;
        ledgerRef = ref('pointLedgerEntries', buildPointLedgerEntryId({ studentId, sourceType: POINT_SOURCE_TYPES.ROUTINE_COMPLETION, sourceId }));
        ledger = data(await transaction.get(ledgerRef));
        if (ledger) assertRoutineScopedRecord(ledger, parentId, studentId);
        const decision = buildFrozenRoutineDayAwardDecision({ snapshot: day.snapshot, completions: day.completions, canUseRoutineRewards: access.canUseRoutineRewards, existingLedger: ledger });
        if (decision.should_award) {
          mutation = applyPointLedgerMutation({ parentId, studentId, sourceType: POINT_SOURCE_TYPES.ROUTINE_COMPLETION, sourceId,
            deltaPoints: decision.delta_points, description: 'Full routine day',
            metadata: { date_key: day.snapshot.date_key, routine_day_snapshot_id: day.snapshot.id, routine_template_ids: day.snapshot.templates.map((item) => item.id), reconciliation: 'activated_read' },
            pointWallets: [cosmetics.wallet], pointLedgerEntries: [], createdAt: now, entryId: ledgerRef.id });
          requireRoutineReward(mutation.applied, 'invalid-ledger-mutation');
        }
      }
      day.writeDay();
      if (cosmetics?.stateChanged) writeState(transaction, cosmetics.cosmeticRef, cosmetics.state, now);
      if (mutation) writeLedgerMutation(transaction, ledgerRef, cosmetics.walletRef, mutation, now);
      return {
        contract: ROUTINE_REWARD_CONTRACT, student_id: studentId,
        routines: access.canUseDailyRoutines ? responseRoutines(day) : [], access: publicAccess(access),
        routine_rewards: cosmetics ? { wallet: cleanWallet(mutation?.wallet || cosmetics.wallet), catalog: ROUTINE_REWARD_CATALOG.map((item) => ({ ...item, is_unlocked: cosmetics.state.owned_cosmetic_ids.includes(item.id) })), cosmetics: publicCosmetics(cosmetics.state), day: responseDay(day), awarded: Boolean(mutation), award_entry_id: ledger?.id || mutation?.ledgerEntry.id || null } : null,
      };
    })),
    complete: ({ parentId, studentId, payload }) => wrap(() => db.runTransaction(async (transaction) => {
      assertPayloadKeys(payload, ['routine_template_id', 'routineTemplateId', 'date_key', 'dateKey', 'completed_item_ids']);
      const now = Timestamp.now();
      const access = await activeAccess(transaction, parentId, false);
      requireRoutineReward(access.canUseDailyRoutines, 'daily-routines-disabled');
      await assertStudent(transaction, parentId, studentId);
      const day = await loadDay(transaction, parentId, studentId, now);
      const requestedDate = payload.date_key || payload.dateKey;
      requireRoutineReward(!requestedDate || requestedDate === day.snapshot.date_key, 'invalid-date-key');
      const templateId = payload.routine_template_id || payload.routineTemplateId;
      const template = day.snapshot.templates.find((item) => item.id === templateId);
      requireRoutineReward(Boolean(template), 'routine-not-in-day-snapshot');
      const completedItems = validateRoutineCompletionItems(template, payload.completed_item_ids);
      const completionRef = ref('routineCompletions', `${template.id}_${studentId}_${day.snapshot.date_key}`);
      const previous = day.completions.find((completion) => completion.routine_template_id === template.id);
      const alreadyCompleted = previous && isFrozenRoutineDayComplete({ ...day.snapshot, templates: [template] }, [previous]);
      const completion = {
        id: completionRef.id, parent_id: parentId, student_id: studentId, routine_template_id: template.id,
        date_key: day.snapshot.date_key, completed_item_ids: completedItems,
        completed_at: alreadyCompleted ? previous.completed_at : now,
        created_at: previous?.created_at || now, updated_at: now, routine_day_snapshot_id: day.snapshot.id,
      };
      const nextCompletions = [...day.completions.filter((item) => item.routine_template_id !== template.id), completion];
      const sourceId = `routine_day:${day.snapshot.date_key}`;
      let ledgerRef;
      let walletRef;
      let ledger = null;
      let wallet = null;
      if (access.canUseRoutineRewards) {
        ledgerRef = ref('pointLedgerEntries', buildPointLedgerEntryId({ studentId, sourceType: POINT_SOURCE_TYPES.ROUTINE_COMPLETION, sourceId }));
        walletRef = ref('studentPointWallets', studentId);
        const [ledgerSnapshot, walletSnapshot] = await Promise.all([transaction.get(ledgerRef), transaction.get(walletRef)]);
        ledger = data(ledgerSnapshot);
        const walletRecord = data(walletSnapshot);
        if (ledger) assertRoutineScopedRecord(ledger, parentId, studentId);
        if (walletRecord) assertRoutineScopedRecord(walletRecord, parentId, studentId);
        wallet = normalizePointWallet(walletRecord || { parent_id: parentId, student_id: studentId }, studentId);
      }
      const decision = buildFrozenRoutineDayAwardDecision({ snapshot: day.snapshot, completions: nextCompletions, canUseRoutineRewards: access.canUseRoutineRewards, existingLedger: ledger });
      const fullDay = decision.complete;
      let mutation = null;
      if (decision.should_award) {
        mutation = applyPointLedgerMutation({ parentId, studentId, sourceType: POINT_SOURCE_TYPES.ROUTINE_COMPLETION, sourceId,
          deltaPoints: decision.delta_points, description: 'Full routine day',
          metadata: { date_key: day.snapshot.date_key, routine_day_snapshot_id: day.snapshot.id, routine_template_ids: day.snapshot.templates.map((item) => item.id) },
          pointWallets: [wallet], pointLedgerEntries: [], createdAt: now, entryId: ledgerRef.id });
        requireRoutineReward(mutation.applied, 'invalid-ledger-mutation');
        wallet = mutation.wallet;
      }
      day.writeDay();
      if (!alreadyCompleted) transaction.set(completionRef, completion, { merge: true });
      if (mutation) writeLedgerMutation(transaction, ledgerRef, walletRef, mutation, now);
      return {
        contract: ROUTINE_REWARD_CONTRACT, routine_completion_id: completionRef.id,
        date_key: day.snapshot.date_key, already_completed: Boolean(alreadyCompleted),
        routine_rewards: access.canUseRoutineRewards
          ? { wallet: cleanWallet(wallet), day: { ...responseDay(day), complete: fullDay }, awarded: Boolean(mutation), award_entry_id: ledger?.id || mutation?.ledgerEntry.id || null }
          : null,
      };
    })),
    unlock: ({ parentId, studentId, payload }) => wrap(() => db.runTransaction(async (transaction) => {
      assertPayloadKeys(payload, ['cosmetic_id']);
      await activeAccess(transaction, parentId);
      await assertStudent(transaction, parentId, studentId);
      const item = getRoutineCatalogItem(payload.cosmetic_id);
      const now = Timestamp.now();
      const cosmetics = await loadCosmetics(transaction, parentId, studentId, now);
      const sourceId = `routine_cosmetic:${item.id}`;
      const ledgerRef = ref('pointLedgerEntries', buildPointLedgerEntryId({ studentId, sourceType: POINT_SOURCE_TYPES.REWARD_BUILT_IN_UNLOCK, sourceId }));
      const ledger = data(await transaction.get(ledgerRef));
      if (ledger) assertRoutineScopedRecord(ledger, parentId, studentId);
      let decision;
      let mutation = null;
      if (ledger && !cosmetics.state.owned_cosmetic_ids.includes(item.id)) {
        requireRoutineReward(ledger.delta_points === -item.point_cost, 'unlock-ledger-conflict');
        decision = { already_owned: true, state: { ...cosmetics.state, owned_cosmetic_ids: [...cosmetics.state.owned_cosmetic_ids, item.id], revision: cosmetics.state.revision + 1 } };
      } else {
        decision = buildRoutineCosmeticUnlock({ state: cosmetics.state, wallet: cosmetics.wallet, cosmeticId: item.id });
        if (!decision.already_owned && decision.delta_points !== 0) {
          mutation = applyPointLedgerMutation({ parentId, studentId, sourceType: POINT_SOURCE_TYPES.REWARD_BUILT_IN_UNLOCK, sourceId,
            deltaPoints: decision.delta_points, description: `Routine cosmetic: ${item.title}`, metadata: { cosmetic_id: item.id },
            pointWallets: [cosmetics.wallet], pointLedgerEntries: [], createdAt: now, entryId: ledgerRef.id });
          requireRoutineReward(mutation.applied, 'invalid-ledger-mutation');
        }
      }
      writeState(transaction, cosmetics.cosmeticRef, decision.state, now);
      if (mutation) writeLedgerMutation(transaction, ledgerRef, cosmetics.walletRef, mutation, now);
      return { contract: ROUTINE_REWARD_CONTRACT, cosmetic_id: item.id, already_owned: decision.already_owned,
        cosmetics: publicCosmetics(decision.state), wallet: cleanWallet(mutation?.wallet || cosmetics.wallet) };
    })),
    select: ({ parentId, studentId, payload }) => wrap(() => db.runTransaction(async (transaction) => {
      assertPayloadKeys(payload, ['selected_cosmetic_ids', 'expected_revision']);
      await activeAccess(transaction, parentId);
      await assertStudent(transaction, parentId, studentId);
      const now = Timestamp.now();
      const cosmetics = await loadCosmetics(transaction, parentId, studentId, now);
      const state = buildRoutineCosmeticSelection({ state: cosmetics.state, selectedCosmeticIds: payload.selected_cosmetic_ids, expectedRevision: payload.expected_revision });
      writeState(transaction, cosmetics.cosmeticRef, state, now);
      return { contract: ROUTINE_REWARD_CONTRACT, cosmetics: publicCosmetics(state) };
    })),
    upsertSettings: ({ parentId, payload }) => wrap(() => db.runTransaction(async (transaction) => {
      const settings = validateRoutineRewardSettingsPayload(payload);
      await activeAccess(transaction, parentId);
      const settingsRef = ref('rewardSettings', parentId);
      const previous = await transaction.get(settingsRef);
      const now = Timestamp.now();
      transaction.set(settingsRef, { ...settings, parent_id: parentId, routine_reward_schema_version: 1, updated_at: now,
        ...(!previous.exists ? { created_at: now } : {}) }, { merge: true });
      return { contract: ROUTINE_REWARD_CONTRACT, id: parentId, ...settings };
    })),
    settleHistory: ({ parentId, payload }) => wrap(() => db.runTransaction(async (transaction) => {
      requireRoutineReward(payload && Object.keys(payload).every((key) => ['obligation_type', 'obligation_id', 'action', 'idempotency_key'].includes(key))
        && ['allowance', 'redemption'].includes(payload.obligation_type)
        && typeof payload.obligation_id === 'string' && payload.obligation_id.length > 0 && !payload.obligation_id.includes('/')
        && typeof payload.idempotency_key === 'string' && payload.idempotency_key.length > 0, 'invalid-settlement-request');
      requireRoutineReward(payload.obligation_type === 'allowance' ? payload.action === 'acknowledge_payment' : ['cancel_refund', 'fulfill'].includes(payload.action), 'invalid-settlement-request');
      await activeAccess(transaction, parentId, false);
      const eventRef = ref(ROUTINE_REWARD_COLLECTIONS.HISTORY_EVENTS, buildHouseholdHistoryEventId({ parentId, idempotencyKey: payload.idempotency_key }));
      const obligationRef = ref(payload.obligation_type === 'allowance' ? 'allowancePeriods' : 'rewardRedemptions', payload.obligation_id);
      const [eventSnapshot, obligationSnapshot] = await Promise.all([transaction.get(eventRef), transaction.get(obligationRef)]);
      const existingEvent = data(eventSnapshot);
      const obligation = data(obligationSnapshot);
      requireRoutineReward(obligation?.parent_id === parentId, 'scope-mismatch');
      if (existingEvent) {
        requireRoutineReward(existingEvent.parent_id === parentId && existingEvent.obligation_type === payload.obligation_type
          && existingEvent.obligation_id === payload.obligation_id && existingEvent.action === payload.action, 'idempotency-conflict');
        return { contract: ROUTINE_REWARD_CONTRACT, event_id: existingEvent.id, status: existingEvent.new_status, replayed: true };
      }
      const now = Timestamp.now();
      let update;
      let refund = null;
      let refundRef;
      let walletRef;
      let stockRef;
      let stockUpdate;
      let refundEntryId = null;
      if (payload.obligation_type === 'allowance') {
        update = { ...buildAllowanceHistorySettlement(obligation), paid_at: now, updated_at: now };
      } else {
        requireRoutineReward(['requested', 'approved'].includes(obligation.status), 'obligation-already-settled');
        const studentId = obligation.student_id;
        requireRoutineReward(typeof studentId === 'string' && studentId.length > 0, 'invalid-obligation');
        requireRoutineReward(Number.isSafeInteger(obligation.point_cost_snapshot) && obligation.point_cost_snapshot >= 0, 'invalid-obligation');
        const reservationRef = ref('pointLedgerEntries', buildPointLedgerEntryId({ studentId, sourceType: POINT_SOURCE_TYPES.REWARD_REDEMPTION_RESERVATION, sourceId: obligation.id }));
        const reservation = data(await transaction.get(reservationRef));
        if (reservation) assertRoutineScopedRecord(reservation, parentId, studentId);
        if (obligation.point_cost_snapshot > 0) requireRoutineReward(reservation?.delta_points === -obligation.point_cost_snapshot
          && reservation.source_id === obligation.id && reservation.source_type === POINT_SOURCE_TYPES.REWARD_REDEMPTION_RESERVATION, 'missing-reservation-evidence');
        update = { status: payload.action === 'fulfill' ? 'fulfilled' : 'canceled', updated_at: now,
          [payload.action === 'fulfill' ? 'fulfilled_at' : 'canceled_at']: now };
        if (payload.action === 'cancel_refund') {
          walletRef = ref('studentPointWallets', studentId);
          refundRef = ref('pointLedgerEntries', buildPointLedgerEntryId({ studentId, sourceType: POINT_SOURCE_TYPES.REWARD_REDEMPTION_REFUND, sourceId: obligation.id }));
          const [refundSnapshot, walletSnapshot] = await Promise.all([transaction.get(refundRef), transaction.get(walletRef)]);
          const existingRefund = data(refundSnapshot);
          const walletRecord = data(walletSnapshot);
          if (walletRecord) assertRoutineScopedRecord(walletRecord, parentId, studentId);
          if (existingRefund) assertRoutineScopedRecord(existingRefund, parentId, studentId);
          if (obligation.point_cost_snapshot > 0) {
            if (existingRefund) {
              requireRoutineReward(existingRefund.delta_points === obligation.point_cost_snapshot
                && existingRefund.source_id === obligation.id && existingRefund.source_type === POINT_SOURCE_TYPES.REWARD_REDEMPTION_REFUND, 'refund-ledger-conflict');
              refundEntryId = existingRefund.id;
            }
            if (!existingRefund) refund = applyPointLedgerMutation({ parentId, studentId, sourceType: POINT_SOURCE_TYPES.REWARD_REDEMPTION_REFUND, sourceId: obligation.id,
              deltaPoints: -reservation.delta_points, description: 'Household History reservation refund', metadata: { household_history_event_id: eventRef.id, reward_redemption_id: obligation.id },
              pointWallets: [normalizePointWallet(walletRecord || { parent_id: parentId, student_id: studentId }, studentId)], pointLedgerEntries: [], createdAt: now, entryId: refundRef.id });
          }
          if (obligation.reward_type_snapshot === 'parent_created' && obligation.reward_catalog_item_id) {
            stockRef = ref('rewardCatalogItems', obligation.reward_catalog_item_id);
            const catalogItem = data(await transaction.get(stockRef));
            if (catalogItem) {
              requireRoutineReward(catalogItem.parent_id === parentId, 'scope-mismatch');
              requireRoutineReward(Number.isSafeInteger(catalogItem.stock_quantity) && Number.isSafeInteger(catalogItem.available_quantity), 'invalid-obligation');
              stockUpdate = { available_quantity: Math.min(catalogItem.stock_quantity, catalogItem.available_quantity + 1), updated_at: now };
            }
          }
        }
      }
      if (refund) requireRoutineReward(refund.applied, 'invalid-ledger-mutation');
      const event = { id: eventRef.id, parent_id: parentId, student_id: obligation.student_id, schema_version: 1,
        obligation_type: payload.obligation_type, obligation_id: obligation.id, action: payload.action, idempotency_key: payload.idempotency_key,
        actor_id: parentId, recorded_at: now, prior_status: obligation.paid_status || obligation.status || '', new_status: update.paid_status || update.status,
        refund_entry_id: refund?.ledgerEntry.id || refundEntryId, original_obligation: obligation };
      transaction.create(eventRef, event);
      transaction.set(obligationRef, update, { merge: true });
      if (refund) writeLedgerMutation(transaction, refundRef, walletRef, refund, now);
      if (stockUpdate) transaction.set(stockRef, stockUpdate, { merge: true });
      return { contract: ROUTINE_REWARD_CONTRACT, event_id: eventRef.id, status: event.new_status, replayed: false };
    })),
  };
};
