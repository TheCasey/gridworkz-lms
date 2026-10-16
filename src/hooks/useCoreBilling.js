import { useCallback, useEffect, useRef, useState } from 'react';
import { createTrustedBillingPortal, createTrustedCoreCheckout, getTrustedCoreBillingStatus } from '../firebase/trustedOperations';
import { clearCheckoutIntent, isTrustedBillingUrl, retainCheckoutIntent } from '../utils/coreBillingView';

const session = () => { try { return window.sessionStorage; } catch { return null; } };
export default function useCoreBilling(parentId) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(Boolean(parentId));
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const scope = useRef(parentId);
  scope.current = parentId;
  const active = useRef(false);
  const intent = useRef(null);
  const request = useRef(0);
  const reload = useCallback(async () => {
    if (!parentId || active.current) return;
    const id = ++request.current;
    setLoading(true); setError('');
    try {
      const result = await getTrustedCoreBillingStatus();
      if (scope.current === parentId && id === request.current) setStatus(result);
    } catch {
      if (scope.current === parentId && id === request.current) {
        setStatus(null); setError('Billing options could not be loaded. Your current plan and saved work remain available.');
      }
    } finally {
      if (scope.current === parentId && id === request.current) setLoading(false);
    }
  }, [parentId]);
  useEffect(() => {
    scope.current = parentId;
    intent.current = null; active.current = false; setStatus(null); setAction(''); setError('');
    if (parentId) reload(); else setLoading(false);
    return () => { scope.current = null; request.current += 1; };
  }, [parentId, reload]);

  const open = async (kind) => {
    if (!parentId || active.current || loading || !status?.[kind === 'portal' ? 'portal_available' : 'checkout_available']) return;
    active.current = true; setAction(kind); setError('');
    const owner = parentId;
    let redirected = false;
    try {
      if (kind === 'checkout') intent.current ||= retainCheckoutIntent(owner, session());
      const payload = { return_target: 'settings', ...(kind === 'checkout' ? { intent_id: intent.current } : {}) };
      const result = kind === 'portal' ? await createTrustedBillingPortal(payload) : await createTrustedCoreCheckout(payload);
      if (scope.current !== owner) return;
      if (!isTrustedBillingUrl(result?.url, kind)) throw new Error('invalid-provider-url');
      if (kind === 'checkout') { clearCheckoutIntent(owner, session()); intent.current = null; }
      window.location.assign(result.url);
      redirected = true;
    } catch (failure) {
      if (scope.current !== owner) return;
      const code = failure?.details?.code;
      if (kind === 'checkout' && code === 'billing_intent_closed') {
        clearCheckoutIntent(owner, session()); intent.current = null;
      }
      setError(kind === 'checkout'
        ? 'Checkout could not be opened. Retry to safely continue checkout, or refresh your current billing options.'
        : 'Billing management could not be opened. Retry shortly.');
    } finally {
      if (scope.current === owner && !redirected) { active.current = false; setAction(''); }
    }
  };
  return { status, loading, error, action, reload, checkout: () => open('checkout'), portal: () => open('portal') };
}
