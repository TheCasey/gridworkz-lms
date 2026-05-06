import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebaseConfig';
import { TrustedFunctionNames } from '../constants/schema';

const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
const functions = getFunctions(app, region);

const createStudentCallable = httpsCallable(functions, TrustedFunctionNames.CREATE_STUDENT);
const createSubjectCallable = httpsCallable(functions, TrustedFunctionNames.CREATE_SUBJECT);

export const createTrustedStudent = async (payload) => {
  const result = await createStudentCallable(payload);
  return result.data;
};

export const createTrustedSubject = async (payload) => {
  const result = await createSubjectCallable(payload);
  return result.data;
};
