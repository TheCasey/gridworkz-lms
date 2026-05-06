import { useEffect, useMemo, useState } from 'react';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
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

  const [entitlementDoc, setEntitlementDoc] = useState(null);
  const [hasEntitlementDoc, setHasEntitlementDoc] = useState(false);
  const [loading, setLoading] = useState(Boolean(enabled && resolvedParentId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !resolvedParentId) {
      setEntitlementDoc(null);
      setHasEntitlementDoc(false);
      setError(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const entitlementRef = doc(db, Collections.ACCOUNT_ENTITLEMENTS, resolvedParentId);

    return onSnapshot(entitlementRef, (snapshot) => {
      if (snapshot.exists()) {
        setEntitlementDoc({ id: snapshot.id, ...snapshot.data() });
        setHasEntitlementDoc(true);
      } else {
        setEntitlementDoc(null);
        setHasEntitlementDoc(false);
      }

      setError(null);
      setLoading(false);
    }, (nextError) => {
      console.error('Error loading account entitlements:', nextError);
      setEntitlementDoc(null);
      setHasEntitlementDoc(false);
      setError(nextError);
      setLoading(false);
    });
  }, [db, enabled, resolvedParentId]);

  const entitlementState = useMemo(() => resolveEntitlementState({
    entitlementDoc,
    students,
    subjects,
  }), [entitlementDoc, students, subjects]);

  const featureAccess = useMemo(() => Object.values(EntitlementFeatureKeys).reduce((resolvedAccess, featureKey) => {
    const definition = getEntitlementFeatureDefinition(featureKey);
    const isEnabled = Boolean(entitlementState.features?.[featureKey]);

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
  }, {}), [entitlementState.features, entitlementState.planId]);

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
      lockedDescription: 'Lockdown extension pairing, kiosk setup, and policy editing stay visible but read-only until the Lockdown plan is active.',
      restoreAccessCopy: 'Upgrade back to Lockdown to restore pairing and policy editing without losing saved policy data.',
      savedPolicyCopy: 'Saved lockdown policy data stays in place on downgrade and becomes editable again after re-upgrade.',
    };
  }, [entitlementState.planId, featureAccess]);

  const getLimitCheck = (limitKey) => entitlementState.limitChecks[limitKey] || null;
  const getFeatureAccess = (featureKey) => featureAccess[featureKey] || null;
  const studentLimitCheck = entitlementState.limitChecks[EntitlementLimitKeys.STUDENTS] || null;
  const curriculumLimitCheck = entitlementState.limitChecks[EntitlementLimitKeys.CURRICULUM_ITEMS] || null;
  const hasReachedLimit = (limitKey) => hasReachedEntitlementLimit(entitlementState.limitChecks, limitKey);
  const isWithinLimit = (limitKey) => isWithinEntitlementLimit(entitlementState.limitChecks, limitKey);
  const hasFeature = (featureKey) => Boolean(entitlementState.features?.[featureKey]);

  return {
    ...entitlementState,
    entitlementDoc,
    hasEntitlementDoc,
    isMissingEntitlementDoc: Boolean(resolvedParentId) && !loading && !hasEntitlementDoc,
    isFreePlanFallback: entitlementState.isFreePlanFallback || Boolean(error),
    loading,
    error,
    parentId: resolvedParentId,
    getLimitCheck,
    getFeatureAccess,
    featureAccess,
    featureAccessList: Object.values(featureAccess),
    lockdownAccess,
    studentLimitCheck,
    curriculumLimitCheck,
    subscriptionStatusMeta,
    canAddStudent: isWithinEntitlementLimit(entitlementState.limitChecks, EntitlementLimitKeys.STUDENTS),
    canAddCurriculumItem: isWithinEntitlementLimit(entitlementState.limitChecks, EntitlementLimitKeys.CURRICULUM_ITEMS),
    hasReachedLimit,
    isWithinLimit,
    hasFeature,
  };
};

export default useEntitlements;
