// Keep the exact command across view changes/reloads until its outcome is known.
const requests = new Map();
const storageKey = (planId) => `school-parent-correction:${planId}`;
export const readParentSchoolCorrectionRequest = (planId) => {
  if (!planId) return null;
  if (requests.has(planId)) return requests.get(planId);
  try { const value = JSON.parse(sessionStorage.getItem(storageKey(planId))); if (value) requests.set(planId, value); return value; }
  catch { return null; }
};
export const retainParentSchoolCorrectionRequest = (planId, payload) => {
  requests.set(planId, payload);
  try { sessionStorage.setItem(storageKey(planId), JSON.stringify(payload)); } catch { /* Memory still retains exact retry. */ }
};
export const clearParentSchoolCorrectionRequest = (planId) => {
  requests.delete(planId);
  try { sessionStorage.removeItem(storageKey(planId)); } catch { /* Storage may be unavailable. */ }
};
