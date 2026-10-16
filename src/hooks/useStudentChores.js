import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelTrustedRewardRedemption,
  claimTrustedChore,
  completeTrustedChore,
  completeTrustedRoutine,
  readTrustedStudentChoreState,
  requestTrustedRewardRedemption,
  unlockTrustedRoutineCosmetic,
  selectTrustedRoutineCosmetics,
} from '../firebase/trustedOperations';
import { buildStudentChoreWorkspaceModel } from '../utils/choreUtils';
import { buildStudentRewardStoreModel } from '../utils/rewardUtils';

const getTrustedOperationErrorCode = (error) => (
  error?.details?.code
  || error?.details?.errorInfo?.code
  || error?.code
  || ''
);

const getTrustedOperationErrorMessage = (error) => (
  error?.details?.message
  || error?.message
  || 'Something went wrong while loading chores.'
);

export const useStudentChores = ({
  student = null,
  slug = '',
  pin = '',
  isAuthenticated = false,
  enabled = true,
} = {}) => {
  const [storedChoreState, setChoreState] = useState(null);
  const [storedIdentity, setStoredIdentity] = useState('');
  const requestGeneration = useRef(0);
  const currentIdentity = useRef('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [claimingIds, setClaimingIds] = useState({});
  const [completingClaimIds, setCompletingClaimIds] = useState({});
  const [completingRoutineIds, setCompletingRoutineIds] = useState({});
  const [requestingRewardIds, setRequestingRewardIds] = useState({});
  const [cancelingRewardIds, setCancelingRewardIds] = useState({});

  const hasVerifiedStudentContext = Boolean(
    student?.id && student?.access_pin && isAuthenticated
  );
  const trustedStudentPayload = useMemo(() => ({
    student_id: student?.id || '',
    slug: slug || student?.slug || '',
    access_pin: hasVerifiedStudentContext ? pin : '',
  }), [hasVerifiedStudentContext, pin, slug, student?.id, student?.slug]);

  const identity = JSON.stringify([enabled, student?.id, slug, pin, isAuthenticated]);
  currentIdentity.current = identity;
  const choreState = storedIdentity === identity ? storedChoreState : null;
  const routineFirst = choreState?.contract === 'routine_rewards_v1';
  const [cosmeticPending, setCosmeticPending] = useState({});

  const loadChoreState = useCallback(async () => {
    const requestIdentity = identity;
    const request = ++requestGeneration.current;
    const isCurrent = () => request === requestGeneration.current && currentIdentity.current === requestIdentity;
    if (!enabled || !student?.id || !hasVerifiedStudentContext) {
      setChoreState(null);
      setHasLoaded(false);
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const nextState = await readTrustedStudentChoreState(trustedStudentPayload);
      if (!isCurrent()) return null;
      setStoredIdentity(requestIdentity);
      setChoreState(nextState);
      setError(null);
      setHasLoaded(true);
      return nextState;
    } catch (nextError) {
      if (!isCurrent()) return null;
      console.error('Unable to load trusted student chore state:', nextError);
      setError({
        code: getTrustedOperationErrorCode(nextError),
        message: getTrustedOperationErrorMessage(nextError),
      });
      setHasLoaded(false);
      return null;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [enabled, hasVerifiedStudentContext, student?.id, trustedStudentPayload, identity]);

  useEffect(() => {
    if (!enabled || !student?.id) {
      setChoreState(null);
      setError(null);
      setHasLoaded(false);
      setLoading(false);
      return undefined;
    }

    if (!hasVerifiedStudentContext) {
      setChoreState(null);
      setError(null);
      setHasLoaded(false);
      setLoading(false);
      return undefined;
    }

    setChoreState(null); setStoredIdentity(''); setError(null); setHasLoaded(false);
    setClaimingIds({}); setCompletingClaimIds({}); setCompletingRoutineIds({});
    setRequestingRewardIds({}); setCancelingRewardIds({}); setCosmeticPending({});
    loadChoreState();
    return () => { requestGeneration.current += 1; };
  }, [enabled, hasVerifiedStudentContext, loadChoreState, student?.id]);

  const runTrustedMutation = useCallback(async ({
    operation,
    setPendingState,
    pendingKey,
  }) => {
    if (!hasVerifiedStudentContext) {
      return;
    }

    const mutationIdentity = identity;
    const isCurrent = () => currentIdentity.current === mutationIdentity;
    setPendingState((current) => ({ ...current, [pendingKey]: true }));

    try {
      await operation();
      if (!isCurrent()) return;
      await loadChoreState();
    } catch (nextError) {
      if (!isCurrent()) return;
      console.error('Unable to complete trusted student chore action:', nextError);
      setError({
        code: getTrustedOperationErrorCode(nextError),
        message: getTrustedOperationErrorMessage(nextError),
      });
      throw nextError;
    } finally {
      if (isCurrent()) setPendingState((current) => {
        const nextState = { ...current };
        delete nextState[pendingKey];
        return nextState;
      });
    }
  }, [hasVerifiedStudentContext, loadChoreState, identity]);

  const claimChore = useCallback(async (choreDefinitionId) => {
    if (!choreDefinitionId || !hasVerifiedStudentContext) return;

    await runTrustedMutation({
      pendingKey: choreDefinitionId,
      setPendingState: setClaimingIds,
      operation: () => claimTrustedChore({
        ...trustedStudentPayload,
        chore_definition_id: choreDefinitionId,
      }),
    });
  }, [hasVerifiedStudentContext, runTrustedMutation, trustedStudentPayload]);

  const completeChore = useCallback(async ({ claimId, proofNote = '' } = {}) => {
    if (!claimId || !hasVerifiedStudentContext) return;

    await runTrustedMutation({
      pendingKey: claimId,
      setPendingState: setCompletingClaimIds,
      operation: () => completeTrustedChore({
        ...trustedStudentPayload,
        claim_id: claimId,
        proof_note: proofNote,
      }),
    });
  }, [hasVerifiedStudentContext, runTrustedMutation, trustedStudentPayload]);

  const completeRoutine = useCallback(async ({ routineTemplateId, completedItemIds = [], dateKey = null } = {}) => {
    if (!routineTemplateId || !hasVerifiedStudentContext) return;

    await runTrustedMutation({
      pendingKey: routineTemplateId,
      setPendingState: setCompletingRoutineIds,
      operation: () => completeTrustedRoutine({
        ...trustedStudentPayload,
        routine_template_id: routineTemplateId,
        completed_item_ids: completedItemIds,
        ...(routineFirst && dateKey ? { date_key: dateKey } : {}),
      }),
    });
  }, [hasVerifiedStudentContext, runTrustedMutation, trustedStudentPayload, routineFirst]);

  const requestRewardRedemption = useCallback(async (rewardCatalogItemId) => {
    if (!rewardCatalogItemId || !hasVerifiedStudentContext) return;

    await runTrustedMutation({
      pendingKey: rewardCatalogItemId,
      setPendingState: setRequestingRewardIds,
      operation: () => requestTrustedRewardRedemption({
        ...trustedStudentPayload,
        reward_catalog_item_id: rewardCatalogItemId,
      }),
    });
  }, [hasVerifiedStudentContext, runTrustedMutation, trustedStudentPayload]);

  const cancelRewardRedemption = useCallback(async (redemptionId) => {
    if (!redemptionId || !hasVerifiedStudentContext) return;

    await runTrustedMutation({
      pendingKey: redemptionId,
      setPendingState: setCancelingRewardIds,
      operation: () => cancelTrustedRewardRedemption({
        ...trustedStudentPayload,
        redemption_id: redemptionId,
      }),
    });
  }, [hasVerifiedStudentContext, runTrustedMutation, trustedStudentPayload]);

  const unlockCosmetic = async (cosmeticId) => runTrustedMutation({
    pendingKey: cosmeticId, setPendingState: setCosmeticPending,
    operation: () => unlockTrustedRoutineCosmetic({ ...trustedStudentPayload, cosmetic_id: cosmeticId }),
  });
  const selectCosmetics = async (selectedCosmeticIds) => runTrustedMutation({
    pendingKey: 'selection', setPendingState: setCosmeticPending,
    operation: () => selectTrustedRoutineCosmetics({ ...trustedStudentPayload, selected_cosmetic_ids: selectedCosmeticIds, expected_revision: choreState?.routine_rewards?.cosmetics?.revision }),
  });

  const isPinError = error?.code === 'missing_pin' || error?.code === 'pin_mismatch';
  const isResolvingAccess = Boolean(
    enabled
    && hasVerifiedStudentContext
    && !hasLoaded
    && !error
  );
  const workspace = useMemo(() => {
    if (isPinError) {
      return buildStudentChoreWorkspaceModel({
        enabled: true,
        hasStudentContext: false,
        now: new Date(),
        weekConfig: student || {},
      });
    }

    return buildStudentChoreWorkspaceModel({
      choreState,
      enabled: Boolean(enabled && hasLoaded && !error),
      hasStudentContext: hasVerifiedStudentContext,
      now: new Date(),
      weekConfig: student || {},
    });
  }, [choreState, enabled, error, hasLoaded, hasVerifiedStudentContext, isPinError, student]);
  const rewardStore = useMemo(() => buildStudentRewardStoreModel({
    rewardState: choreState?.rewards || null,
    enabled: Boolean(
      enabled
      && hasLoaded
      && !error
      && !isPinError
      && choreState?.access?.can_use_rewards === true
    ),
    hasStudentContext: hasVerifiedStudentContext,
  }), [
    choreState?.access?.can_use_rewards,
    choreState?.rewards,
    enabled,
    error,
    hasLoaded,
    hasVerifiedStudentContext,
    isPinError,
  ]);

  return {
    routineFirst,
    routineRewards: choreState?.routine_rewards || null,
    unlockCosmetic,
    selectCosmetics,
    cosmeticPending,
    workspace,
    rewardStore,
    choreState,
    error,
    loading,
    isResolvingAccess,
    hasVisibleWorkspace: workspace.canShowArea,
    canShowTab: Boolean(enabled && hasVerifiedStudentContext && !isPinError),
    canShowRewardTab: !routineFirst && Boolean(rewardStore.canShowArea || isResolvingAccess),
    refresh: loadChoreState,
    claimChore,
    completeChore,
    completeRoutine,
    requestRewardRedemption,
    cancelRewardRedemption,
    claimingIds,
    completingClaimIds,
    completingRoutineIds,
    requestingRewardIds,
    cancelingRewardIds,
  };
};

export default useStudentChores;
