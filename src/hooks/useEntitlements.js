import { initializeTrustedRoutineFirstAccount } from '../firebase/trustedOperations';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, getFirestore, onSnapshot } from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { Collections } from '../constants/schema';
import { useAuth } from '../contexts/AuthContext';
import {
  EntitlementFeatureKeys,
  EntitlementFeatureStatus,
  EntitlementLimitKeys,
  getEntitlementFeatureDefinition,
  getFeatureUpgradeCopy,
  getLockdownUpgradeCopy,
  LockdownEntitlementFeatureKeys,
  getSubscriptionStatusDefinition,
} from '../constants/entitlements';
import {
  hasReachedEntitlementLimit,
  isWithinEntitlementLimit,
  resolveEntitlementState,
} from '../utils/entitlementUtils';

export const useEntitlements = ({
  parentId,
  students = [],
  subjects = [],
  enabled = true,
} = {}) => {
  const { currentUser } = useAuth();
  const db = getFirestore(app);
  const resolvedParentId = parentId || currentUser?.uid || null;

  const [record, setRecord] = useState({ parentId: null, document: null, hasDocument: false, loading: true, error: null });
  const [bootstrapFailure, setBootstrapFailure] = useState(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(null);
  const [bootstrapAttempts, setBootstrapAttempts] = useState([]);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const bootstrapInFlight = useRef(new Set());
  const currentParent = useRef(resolvedParentId);
  const hasCurrentDocument = useRef(false);
  currentParent.current = resolvedParentId;
  const scopeMatches = record.parentId === resolvedParentId;
  const entitlementDoc = enabled && scopeMatches ? record.document : null;
  const hasEntitlementDoc = enabled && scopeMatches && record.hasDocument;
  const loading = Boolean(enabled && resolvedParentId && (!scopeMatches || record.loading));
  const error = scopeMatches ? record.error : null;
  const bootstrapError = bootstrapFailure?.parentId === resolvedParentId ? bootstrapFailure.error : null;

  useEffect(() => {
    let active = true;
    const requestParent = resolvedParentId;
    const isCurrent = () => active && currentParent.current === requestParent;
    hasCurrentDocument.current = false;
    setRecord({ parentId: requestParent, document: null, hasDocument: false, loading: Boolean(enabled && requestParent), error: null });
    if (!enabled || !requestParent) return undefined;
    const acceptSnapshot = (snapshot) => {
      if (!isCurrent()) return;
      hasCurrentDocument.current = snapshot.exists();
      if (snapshot.exists()) setBootstrapFailure(null);
      setRecord({
        parentId: requestParent,
        document: snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
        hasDocument: snapshot.exists(), loading: false, error: null,
      });
    };
    const unsubscribe = onSnapshot(doc(db, Collections.ACCOUNT_ENTITLEMENTS, requestParent), acceptSnapshot, (nextError) => {
      if (!isCurrent()) return;
      hasCurrentDocument.current = false;
      setRecord({ parentId: requestParent, document: null, hasDocument: false, error: nextError, loading: false });
    });
    return () => { active = false; unsubscribe(); };
  }, [db, enabled, resolvedParentId, retryGeneration]);

  // Only the trusted rollout gate may initialize a missing Free record.
  const bootstrapPending = Boolean(enabled && resolvedParentId && !loading && !error && !hasEntitlementDoc && !bootstrapAttempts.includes(resolvedParentId));
  useEffect(() => {
    if (!bootstrapPending || bootstrapInFlight.current.has(resolvedParentId)) return;
    const initiatingParent = resolvedParentId;
    const isCurrent = () => currentParent.current === initiatingParent;
    bootstrapInFlight.current.add(initiatingParent);
    setBootstrapLoading(initiatingParent);
    setBootstrapFailure(null);
    const initialize = async () => {
      try {
        const result = await initializeTrustedRoutineFirstAccount();
        if (!isCurrent()) return;
        // Resolve the initialized record before exposing the compatibility branch.
        if (result.product_direction_version >= 1) {
          const snapshot = await getDoc(doc(db, Collections.ACCOUNT_ENTITLEMENTS, initiatingParent));
          if (!isCurrent()) return;
          if (!snapshot.exists()) throw new Error('Account access is not ready. Please retry.');
          hasCurrentDocument.current = true;
          setRecord({ parentId: initiatingParent, document: { id: snapshot.id, ...snapshot.data() }, hasDocument: true, loading: false, error: null });
        }
      } catch (nextError) {
        if (isCurrent() && !hasCurrentDocument.current) setBootstrapFailure({ parentId: initiatingParent, error: nextError });
      } finally {
        bootstrapInFlight.current.delete(initiatingParent);
        if (isCurrent()) {
          setBootstrapAttempts((attempts) => [...attempts, initiatingParent]);
          setBootstrapLoading(null);
        }
      }
    };
    initialize();
  }, [bootstrapPending, resolvedParentId, db]);

  const retryBootstrap = useCallback(() => {
    if (!resolvedParentId || bootstrapInFlight.current.has(resolvedParentId)) return;
    setBootstrapFailure(null);
    setBootstrapAttempts((attempts) => attempts.filter((id) => id !== resolvedParentId));
    setRecord({ parentId: resolvedParentId, document: null, hasDocument: false, loading: true, error: null });
    setRetryGeneration((generation) => generation + 1);
  }, [resolvedParentId]);
  const accessLoading = loading || Boolean(resolvedParentId && bootstrapLoading === resolvedParentId) || bootstrapPending;
  const accessError = error || bootstrapError;
  const accessReady = Boolean(enabled && resolvedParentId && !accessLoading && !accessError);
  const entitlementState = useMemo(() => resolveEntitlementState({
    entitlementDoc,
    students: students.filter((student) => !student.parent_id || student.parent_id === resolvedParentId),
    subjects: subjects.filter((subject) => !subject.parent_id || subject.parent_id === resolvedParentId),
  }), [entitlementDoc, students, subjects, resolvedParentId]);

  const featureAccess = useMemo(() => Object.values(EntitlementFeatureKeys).reduce((resolvedAccess, featureKey) => {
    const definition = getEntitlementFeatureDefinition(featureKey);
    const isEnabled = Boolean(accessReady && entitlementState.features?.[featureKey]);

    resolvedAccess[featureKey] = {
      key: featureKey,
      title: definition?.title || featureKey,
      shortTitle: definition?.shortTitle || definition?.title || featureKey,
      status: isEnabled ? EntitlementFeatureStatus.INCLUDED : EntitlementFeatureStatus.LOCKED,
      statusLabel: isEnabled ? 'Included' : 'Locked',
      isEnabled,
      description: isEnabled
        ? (definition?.availableDescription || '')
        : (definition?.lockedDescription || ''),
      availabilityNote: definition?.availabilityNote || '',
      upgradeCopy: getFeatureUpgradeCopy(entitlementState.planId, featureKey),
    };

    return resolvedAccess;
  }, {}), [entitlementState.features, entitlementState.planId, accessReady]);

  const subscriptionStatusMeta = useMemo(
    () => getSubscriptionStatusDefinition(entitlementState.subscriptionStatus),
    [entitlementState.subscriptionStatus]
  );

  const lockdownAccess = useMemo(() => {
    const sourceFeatures = LockdownEntitlementFeatureKeys.map((featureKey) => featureAccess[featureKey]).filter(Boolean);
    const isEnabled = sourceFeatures.some((feature) => feature.isEnabled);

    return {
      title: 'Lockdown Controls',
      featureKeys: LockdownEntitlementFeatureKeys,
      sourceFeatures,
      isEnabled,
      isReadOnly: !isEnabled,
      canManagePolicy: isEnabled,
      canPairDevices: isEnabled,
      upgradeCopy: getLockdownUpgradeCopy(entitlementState.planId),
      lockedDescription: 'Lockdown pairing, student-bound policy visibility, and off-hours setup stay visible but read-only until the Lockdown plan is active.',
      restoreAccessCopy: 'Existing Lockdown access and saved setup are preserved. New Lockdown purchases are coming soon.',
      savedPolicyCopy: 'Saved lockdown setup stays visible on downgrade and becomes manageable again after re-upgrade.',
    };
  }, [entitlementState.planId, featureAccess]);

  const getLimitCheck = (limitKey) => entitlementState.limitChecks[limitKey] || null;
  const getFeatureAccess = (featureKey) => featureAccess[featureKey] || null;
  const studentLimitCheck = entitlementState.limitChecks[EntitlementLimitKeys.STUDENTS] || null;
  const curriculumLimitCheck = entitlementState.limitChecks[EntitlementLimitKeys.CURRICULUM_ITEMS] || null;
  const hasReachedLimit = (limitKey) => hasReachedEntitlementLimit(entitlementState.limitChecks, limitKey);
  const isWithinLimit = (limitKey) => isWithinEntitlementLimit(entitlementState.limitChecks, limitKey);
  const hasFeature = (featureKey) => Boolean(accessReady && entitlementState.features?.[featureKey]);

  return {
    ...entitlementState,
    entitlementDoc,
    hasEntitlementDoc,
    isMissingEntitlementDoc: Boolean(resolvedParentId) && !loading && !hasEntitlementDoc,
    isFreePlanFallback: entitlementState.isFreePlanFallback || Boolean(error),
    loading: accessLoading,
    error: accessError,
    retryBootstrap,
    parentId: resolvedParentId,
    getLimitCheck,
    getFeatureAccess,
    featureAccess,
    featureAccessList: Object.values(featureAccess),
    lockdownAccess,
    studentLimitCheck,
    curriculumLimitCheck,
    subscriptionStatusMeta,
    canAddStudent: accessReady && isWithinEntitlementLimit(entitlementState.limitChecks, EntitlementLimitKeys.STUDENTS),
    canAddCurriculumItem: accessReady && isWithinEntitlementLimit(entitlementState.limitChecks, EntitlementLimitKeys.CURRICULUM_ITEMS),
    hasReachedLimit,
    isWithinLimit,
    hasFeature,
  };
};

export default useEntitlements;
