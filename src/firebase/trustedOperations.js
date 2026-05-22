import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebaseConfig';
import { TrustedFunctionNames } from '../constants/schema';

const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
const functions = getFunctions(app, region);

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
