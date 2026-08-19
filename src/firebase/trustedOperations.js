import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebaseConfig';
import { TrustedFunctionNames } from '../constants/schema';

const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
const functions = getFunctions(app, region);

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

const createStudentCallable = httpsCallable(functions, TrustedFunctionNames.CREATE_STUDENT);
const createSubjectCallable = httpsCallable(functions, TrustedFunctionNames.CREATE_SUBJECT);
const getOperatorSessionCallable = httpsCallable(
  functions,
  TrustedFunctionNames.GET_OPERATOR_SESSION
);
const searchParentAccountsCallable = httpsCallable(
  functions,
  TrustedFunctionNames.SEARCH_PARENT_ACCOUNTS
);
const getOperatorEntitlementRecordCallable = httpsCallable(
  functions,
  TrustedFunctionNames.GET_OPERATOR_ENTITLEMENT_RECORD
);
const initializeEntitlementRecordCallable = httpsCallable(
  functions,
  TrustedFunctionNames.INITIALIZE_ENTITLEMENT_RECORD
);
const applyEntitlementOverrideCallable = httpsCallable(
  functions,
  TrustedFunctionNames.APPLY_ENTITLEMENT_OVERRIDE
);
const clearEntitlementOverrideCallable = httpsCallable(
  functions,
  TrustedFunctionNames.CLEAR_ENTITLEMENT_OVERRIDE
);
const issueLockdownEnrollmentCallable = httpsCallable(
  functions,
  TrustedFunctionNames.ISSUE_LOCKDOWN_ENROLLMENT
);
const issueLockdownRecoveryCallable = httpsCallable(
  functions,
  TrustedFunctionNames.ISSUE_LOCKDOWN_RECOVERY
);
const listLockdownDevicesCallable = httpsCallable(
  functions,
  TrustedFunctionNames.LIST_LOCKDOWN_DEVICES
);
const revokeLockdownDeviceCallable = httpsCallable(
  functions,
  TrustedFunctionNames.REVOKE_LOCKDOWN_DEVICE
);
const upsertLockdownResourceLibraryEntryCallable = httpsCallable(
  functions,
  TrustedFunctionNames.UPSERT_LOCKDOWN_RESOURCE_LIBRARY_ENTRY
);
const deleteLockdownResourceLibraryEntryCallable = httpsCallable(
  functions,
  TrustedFunctionNames.DELETE_LOCKDOWN_RESOURCE_LIBRARY_ENTRY
);
const upsertChoreSettingsCallable = httpsCallable(
  functions,
  TrustedFunctionNames.UPSERT_CHORE_SETTINGS
);
const upsertRoutineTemplateCallable = httpsCallable(
  functions,
  TrustedFunctionNames.UPSERT_ROUTINE_TEMPLATE
);
const upsertChoreDefinitionCallable = httpsCallable(
  functions,
  TrustedFunctionNames.UPSERT_CHORE_DEFINITION
);
const syncAllowanceLedgerCallable = httpsCallable(
  functions,
  TrustedFunctionNames.SYNC_ALLOWANCE_LEDGER
);
const upsertRewardSettingsCallable = httpsCallable(
  functions,
  TrustedFunctionNames.UPSERT_REWARD_SETTINGS
);
const adjustStudentPointsCallable = httpsCallable(
  functions,
  TrustedFunctionNames.ADJUST_STUDENT_POINTS
);
const upsertRewardCatalogItemCallable = httpsCallable(
  functions,
  TrustedFunctionNames.UPSERT_REWARD_CATALOG_ITEM
);
const requestRewardRedemptionCallable = httpsCallable(
  functions,
  TrustedFunctionNames.REQUEST_REWARD_REDEMPTION
);
const cancelRewardRedemptionCallable = httpsCallable(
  functions,
  TrustedFunctionNames.CANCEL_REWARD_REDEMPTION
);
const reviewRewardRedemptionCallable = httpsCallable(
  functions,
  TrustedFunctionNames.REVIEW_REWARD_REDEMPTION
);
const readStudentChoreStateCallable = httpsCallable(
  functions,
  TrustedFunctionNames.READ_STUDENT_CHORE_STATE
);
const claimChoreCallable = httpsCallable(
  functions,
  TrustedFunctionNames.CLAIM_CHORE
);
const completeChoreCallable = httpsCallable(
  functions,
  TrustedFunctionNames.COMPLETE_CHORE
);
const completeRoutineCallable = httpsCallable(
  functions,
  TrustedFunctionNames.COMPLETE_ROUTINE
);
const reviewChoreCompletionCallable = httpsCallable(
  functions,
  TrustedFunctionNames.REVIEW_CHORE_COMPLETION
);

export const createTrustedStudent = async (payload) => {
  const result = await createStudentCallable(payload);
  return result.data;
};

export const createTrustedSubject = async (payload) => {
  const result = await createSubjectCallable(payload);
  return result.data;
};

export const getTrustedOperatorSession = async () => {
  const result = await getOperatorSessionCallable();
  return result.data;
};

export const searchTrustedParentAccounts = async (payload = {}) => {
  const result = await searchParentAccountsCallable(payload);
  return result.data;
};

export const getTrustedOperatorEntitlementRecord = async (payload = {}) => {
  const result = await getOperatorEntitlementRecordCallable(payload);
  return result.data;
};

export const initializeTrustedEntitlementRecord = async (payload = {}) => {
  const result = await initializeEntitlementRecordCallable(payload);
  return result.data;
};

export const applyTrustedEntitlementOverride = async (payload = {}) => {
  const result = await applyEntitlementOverrideCallable(payload);
  return result.data;
};

export const clearTrustedEntitlementOverride = async (payload = {}) => {
  const result = await clearEntitlementOverrideCallable(payload);
  return result.data;
};

export const issueTrustedLockdownEnrollment = async (payload = {}) => {
  const result = await issueLockdownEnrollmentCallable(payload);
  return result.data;
};

export const issueTrustedLockdownRecovery = async (payload = {}) => {
  const result = await issueLockdownRecoveryCallable(payload);
  return result.data;
};

export const listTrustedLockdownDevices = async (payload = {}) => {
  const result = await listLockdownDevicesCallable(payload);
  return result.data;
};

export const revokeTrustedLockdownDevice = async (payload = {}) => {
  const result = await revokeLockdownDeviceCallable(payload);
  return result.data;
};

export const upsertTrustedLockdownResourceLibraryEntry = async (payload = {}) => {
  const result = await upsertLockdownResourceLibraryEntryCallable(payload);
  return result.data;
};

export const deleteTrustedLockdownResourceLibraryEntry = async (payload = {}) => {
  const result = await deleteLockdownResourceLibraryEntryCallable(payload);
  return result.data;
};

export const upsertTrustedChoreSettings = async (payload = {}) => {
  const result = await upsertChoreSettingsCallable(payload);
  return result.data;
};

export const upsertTrustedRoutineTemplate = async (payload = {}) => {
  const result = await upsertRoutineTemplateCallable(payload);
  return result.data;
};

export const upsertTrustedChoreDefinition = async (payload = {}) => {
  const result = await upsertChoreDefinitionCallable(payload);
  return result.data;
};

export const syncTrustedAllowanceLedger = async (payload = {}) => {
  const result = await syncAllowanceLedgerCallable(payload);
  return result.data;
};

export const upsertTrustedRewardSettings = async (payload = {}) => {
  const result = await upsertRewardSettingsCallable(payload);
  return result.data;
};

export const adjustTrustedStudentPoints = async (payload = {}) => {
  const result = await adjustStudentPointsCallable(payload);
  return result.data;
};

export const upsertTrustedRewardCatalogItem = async (payload = {}) => {
  const result = await upsertRewardCatalogItemCallable(payload);
  return result.data;
};

export const requestTrustedRewardRedemption = async (payload = {}) => {
  const result = await requestRewardRedemptionCallable(payload);
  return result.data;
};

export const cancelTrustedRewardRedemption = async (payload = {}) => {
  const result = await cancelRewardRedemptionCallable(payload);
  return result.data;
};

export const reviewTrustedRewardRedemption = async (payload = {}) => {
  const result = await reviewRewardRedemptionCallable(payload);
  return result.data;
};

export const readTrustedStudentChoreState = async (payload = {}) => {
  const result = await readStudentChoreStateCallable(payload);
  return result.data;
};

export const claimTrustedChore = async (payload = {}) => {
  const result = await claimChoreCallable(payload);
  return result.data;
};

export const completeTrustedChore = async (payload = {}) => {
  const result = await completeChoreCallable(payload);
  return result.data;
};

export const completeTrustedRoutine = async (payload = {}) => {
  const result = await completeRoutineCallable(payload);
  return result.data;
};

export const reviewTrustedChoreCompletion = async (payload = {}) => {
  const result = await reviewChoreCompletionCallable(payload);
  return result.data;
};
