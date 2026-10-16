import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useCoreBilling from '../hooks/useCoreBilling';
import { billingReturnMessage } from '../utils/coreBillingView';

export default function CoreBillingPanel() {
  const { currentUser } = useAuth();
  const { search } = useLocation();
  const billing = useCoreBilling(currentUser?.uid);
  const returned = billingReturnMessage(search);
  const testMode = billing.status?.mode === 'test';
  return <section className="op-panel-muted mt-5 p-4 space-y-3" aria-label="Core billing" aria-busy={billing.loading || Boolean(billing.action)}>
    <h3 className="font-label text-sm">Core · $5/month</h3>
    <p className="op-subtle text-sm leading-6">Free includes complete schoolwork, Daily Routines, daily points and built-in avatars for 2 students and 3 active curriculum records. Core adds unlimited students and active curriculum. Your saved work remains available after a downgrade.</p>
    {returned && <p role="status" className="text-sm">{returned}</p>}
    {billing.loading && <p role="status" className="text-sm">Loading billing options…</p>}
    {billing.error && <p role="alert" className="text-sm">{billing.error}</p>}
    {testMode && <p className="text-sm font-label">Test billing · No live payments</p>}
    {billing.status?.binding_state === 'reconciliation_required' && <p role="status" className="text-sm">Your billing connection needs review. Contact support before starting another subscription.</p>}
    {!billing.loading && !billing.error && billing.status && !billing.status.checkout_available && !billing.status.portal_available && <p className="op-subtle text-sm">Self-serve Core billing is not available for this account yet. You can continue using your current plan.</p>}
    <div className="flex flex-wrap gap-3">
      {billing.status?.checkout_available && <button type="button" className="op-button" disabled={billing.loading || Boolean(billing.action)} onClick={billing.checkout}>{billing.action === 'checkout' ? 'Opening checkout…' : testMode ? 'Open test checkout' : 'Upgrade to Core · $5/month'}</button>}
      {billing.status?.portal_available && <button type="button" className="op-button op-button-secondary" disabled={billing.loading || Boolean(billing.action)} onClick={billing.portal}>{billing.action === 'portal' ? 'Opening billing management…' : testMode ? 'Manage test subscription' : 'Manage subscription'}</button>}
      <button type="button" className="op-button op-button-secondary" disabled={billing.loading || Boolean(billing.action)} onClick={billing.reload}>{billing.error ? 'Retry billing options' : 'Refresh billing options'}</button>
    </div>
    <p className="op-subtle text-xs">Lockdown is coming soon. New Lockdown purchases are unavailable.</p>
  </section>;
}
