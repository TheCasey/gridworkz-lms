import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelTrustedRewardRedemption,
  claimTrustedChore,
  completeTrustedChore,
  completeTrustedRoutine,
  readTrustedStudentChoreState,
  requestTrustedRewardRedemption,
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
  const [choreState, setChoreState] = useState(null);
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

  const loadChoreState = useCallback(async () => {
    if (!enabled || !student?.id || !hasVerifiedStudentContext) {
      setChoreState(null);
      setHasLoaded(false);
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const nextState = await readTrustedStudentChoreState(trustedStudentPayload);
      setChoreState(nextState);
      setError(null);
      setHasLoaded(true);
      return nextState;
    } catch (nextError) {
      console.error('Unable to load trusted student chore state:', nextError);
      setChoreState(null);
      setError({
        code: getTrustedOperationErrorCode(nextError),
        message: getTrustedOperationErrorMessage(nextError),
      });
      setHasLoaded(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, hasVerifiedStudentContext, student?.id, trustedStudentPayload]);

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

    loadChoreState();
    return undefined;
  }, [enabled, hasVerifiedStudentContext, loadChoreState, student?.id]);

  const runTrustedMutation = useCallback(async ({
    operation,
    setPendingState,
    pendingKey,
  }) => {
    if (!hasVerifiedStudentContext) {
      return;
    }

    setPendingState((current) => ({ ...current, [pendingKey]: true }));

    try {
      await operation();
      await loadChoreState();
      setError(null);
    } catch (nextError) {
      console.error('Unable to complete trusted student chore action:', nextError);
      setError({
        code: getTrustedOperationErrorCode(nextError),
        message: getTrustedOperationErrorMessage(nextError),
      });
      throw nextError;
    } finally {
      setPendingState((current) => {
        const nextState = { ...current };
        delete nextState[pendingKey];
        return nextState;
      });
    }
  }, [hasVerifiedStudentContext, loadChoreState]);

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

  const completeRoutine = useCallback(async ({ routineTemplateId, completedItemIds = [] } = {}) => {
    if (!routineTemplateId || !hasVerifiedStudentContext) return;

    await runTrustedMutation({
      pendingKey: routineTemplateId,
      setPendingState: setCompletingRoutineIds,
      operation: () => completeTrustedRoutine({
        ...trustedStudentPayload,
        routine_template_id: routineTemplateId,
        completed_item_ids: completedItemIds,
      }),
    });
  }, [hasVerifiedStudentContext, runTrustedMutation, trustedStudentPayload]);

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
    workspace,
    rewardStore,
    choreState,
    error,
    loading,
    isResolvingAccess,
    hasVisibleWorkspace: workspace.canShowArea,
    canShowTab: Boolean(enabled && hasVerifiedStudentContext && !isPinError),
    canShowRewardTab: Boolean(rewardStore.canShowArea || isResolvingAccess),
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
