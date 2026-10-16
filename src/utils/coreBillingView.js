export const isTrustedBillingUrl = (value, kind) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      && url.hostname === (kind === 'portal' ? 'billing.stripe.com' : 'checkout.stripe.com');
  } catch { return false; }
};

const storageKey = (parentId) => `gridworkz:core-checkout:v1:${parentId}`;
export const retainCheckoutIntent = (parentId, storage, createId = () => crypto.randomUUID()) => {
  const key = storageKey(parentId);
  let existing;
  try { existing = storage?.getItem(key); } catch { /* Storage can be unavailable. */ }
  const intent = /^[A-Za-z0-9_-]{16,100}$/.test(existing || '') ? existing : createId();
  try { storage?.setItem(key, intent); } catch { /* Caller also keeps it in memory. */ }
  return intent;
};
export const clearCheckoutIntent = (parentId, storage) => {
  try { storage?.removeItem(storageKey(parentId)); } catch { /* Optional persistence. */ }
};

export const billingReturnMessage = (search) => {
  const result = new URLSearchParams(search).get('billing');
  if (result === 'success') return 'Checkout returned successfully. Your plan updates after billing confirmation; you can refresh the billing options below.';
  if (result === 'canceled') return 'Checkout was closed. Your current plan and saved work are unchanged.';
  return '';
};
