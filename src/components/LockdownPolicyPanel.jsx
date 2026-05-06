import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Copy, Globe, Lock, Save, Shield, Youtube } from 'lucide-react';
import {
  buildLockdownPairingCode,
  buildDefaultLockdownPolicy,
  LOCKDOWN_POLICY_COLLECTION,
  normalizeLockdownPolicy,
  validateOriginInput,
} from '../utils/lockdownPolicyUtils';

const LockdownPolicyPanel = ({
  currentUser,
  db,
  colors,
  lockdownAccess,
  planName,
}) => {
  const [policy, setPolicy] = useState(() => buildDefaultLockdownPolicy(currentUser?.uid || ''));
  const [draftOrigin, setDraftOrigin] = useState('');
  const [originError, setOriginError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hasSavedDocument, setHasSavedDocument] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [copyMessage, setCopyMessage] = useState('');

  const canManagePolicy = Boolean(lockdownAccess?.canManagePolicy);
  const canPairDevices = Boolean(lockdownAccess?.canPairDevices);
  const isReadOnly = Boolean(lockdownAccess?.isReadOnly);

  const policyRef = useMemo(() => {
    if (!currentUser?.uid) return null;
    return doc(db, LOCKDOWN_POLICY_COLLECTION, currentUser.uid);
  }, [currentUser?.uid, db]);

  useEffect(() => {
    if (!policyRef || !currentUser?.uid) {
      setReady(false);
      return undefined;
    }

    const fallbackPolicy = buildDefaultLockdownPolicy(currentUser.uid);
    const unsubscribe = onSnapshot(policyRef, (snapshot) => {
      const nextPolicy = snapshot.exists()
        ? normalizeLockdownPolicy(snapshot.data(), currentUser.uid)
        : fallbackPolicy;

      setPolicy(nextPolicy);
      setHasSavedDocument(snapshot.exists());
      setLastSavedAt(snapshot.exists() ? snapshot.data()?.updated_at ?? null : null);
      setDraftOrigin('');
      setReady(true);
      setIsDirty(false);
      setSaveError('');
    }, (error) => {
      console.error('Error loading lockdown policy:', error);
      setPolicy(fallbackPolicy);
      setHasSavedDocument(false);
      setLastSavedAt(null);
      setReady(true);
      setIsDirty(false);
      setSaveError('The Lockdown PoC policy could not be loaded from Firestore.');
    });

    return unsubscribe;
  }, [currentUser?.uid, policyRef]);

  useEffect(() => {
    if (!saveSuccess) return undefined;

    const timeoutId = window.setTimeout(() => setSaveSuccess(''), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [saveSuccess]);

  useEffect(() => {
    if (!copyMessage) return undefined;

    const timeoutId = window.setTimeout(() => setCopyMessage(''), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [copyMessage]);

  const setDirtyPolicy = (updater) => {
    if (!canManagePolicy) {
      setSaveError(lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore editing.');
      return;
    }

    setPolicy((currentPolicy) => updater(currentPolicy));
    setIsDirty(true);
    setSaveError('');
    setSaveSuccess('');
  };

  const handleAddOrigin = () => {
    if (!canManagePolicy) {
      setSaveError(lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore editing.');
      return;
    }

    const { origin, error } = validateOriginInput(draftOrigin);
    if (error) {
      setOriginError(error);
      return;
    }

    if (policy.allowed_origins.includes(origin)) {
      setOriginError('That website origin is already in the allowlist.');
      return;
    }

    setDirtyPolicy((currentPolicy) => ({
      ...currentPolicy,
      allowed_origins: [...currentPolicy.allowed_origins, origin],
    }));
    setDraftOrigin('');
    setOriginError('');
  };

  const handleRemoveOrigin = (originToRemove) => {
    setDirtyPolicy((currentPolicy) => ({
      ...currentPolicy,
      allowed_origins: currentPolicy.allowed_origins.filter((origin) => origin !== originToRemove),
    }));
  };

  const handleSave = async () => {
    if (!policyRef || !currentUser?.uid) return;

    if (!canManagePolicy) {
      setSaveError(lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore editing.');
      return;
    }

    if (draftOrigin.trim()) {
      setOriginError('Add or clear the website entry before saving.');
      return;
    }

    const validatedOrigins = [];
    for (const origin of policy.allowed_origins) {
      const { origin: normalizedOrigin, error } = validateOriginInput(origin);
      if (error) {
        setOriginError(`Invalid saved entry: ${origin}. ${error}`);
        return;
      }
      validatedOrigins.push(normalizedOrigin);
    }

    setSaving(true);
    setSaveError('');
    setOriginError('');

    try {
      const nextPolicy = normalizeLockdownPolicy({
        ...policy,
        parent_id: currentUser.uid,
        allowed_origins: validatedOrigins,
      }, currentUser.uid);

      await setDoc(policyRef, {
        ...nextPolicy,
        parent_id: currentUser.uid,
        updated_at: serverTimestamp(),
        ...(hasSavedDocument ? {} : { created_at: serverTimestamp() }),
      }, { merge: true });

      setSaveSuccess('Saved to Firestore.');
    } catch (error) {
      console.error('Error saving lockdown policy:', error);
      setSaveError('The Lockdown PoC policy could not be saved. Check Firestore rules and try again.');
    } finally {
      setSaving(false);
    }
  };

  const lastSavedLabel = useMemo(() => {
    if (!lastSavedAt?.toDate) return 'Not saved yet';
    return lastSavedAt.toDate().toLocaleString();
  }, [lastSavedAt]);

  const policyDocumentId = currentUser?.uid || '';
  const pairingCode = useMemo(
    () => buildLockdownPairingCode(policyDocumentId),
    [policyDocumentId]
  );

  const handleCopy = async (value, label, { requiresPairingAccess = false } = {}) => {
    if (!value) {
      setCopyMessage(`Could not copy the ${label}.`);
      return;
    }

    if (requiresPairingAccess && !canPairDevices) {
      setCopyMessage('Upgrade back to Lockdown to restore extension pairing.');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch (error) {
      console.error(`Error copying ${label}:`, error);
      setCopyMessage(`Could not copy the ${label}.`);
    }
  };

  const panelDescription = canManagePolicy
    ? 'Save one parent-owned prototype policy document for the extension PoC. This surface stays on the shared lockdown entitlement rail for extension pairing today and kiosk/device-management surfaces later.'
    : 'Your lockdown setup remains visible here in read-only mode. Saved policy data stays in Firestore, but extension pairing and policy edits remain disabled until the Lockdown plan is restored.';

  return (
    <section
      className="rounded-[28px] border bg-white overflow-hidden"
      style={{ borderColor: colors.parchment }}
    >
      <div
        className="px-6 py-5 border-b"
        style={{ borderColor: colors.parchment, backgroundColor: `${colors.lavenderTint}99` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] uppercase tracking-[0.18em] font-label mb-3"
              style={{ backgroundColor: '#ffffff', color: colors.amethyst }}
            >
              {isReadOnly ? <Lock className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
              {isReadOnly ? 'Lockdown Read Only' : 'Lockdown PoC'}
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 540, color: colors.charcoal }}>Prototype policy</h3>
            <p className="text-[13px] mt-1 max-w-2xl" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
              {panelDescription}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.16em] font-label" style={{ color: 'rgba(41,40,39,0.45)' }}>
              Current Plan
            </p>
            <p className="text-[12px] mt-1" style={{ color: colors.charcoal, fontWeight: 540 }}>
              {planName}
            </p>
            <p className="text-[11px] mt-2" style={{ color: isReadOnly ? colors.amethyst : 'rgba(41,40,39,0.45)', fontWeight: 540 }}>
              {isReadOnly ? 'Pairing and editing disabled' : 'Pairing and editing enabled'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {!ready ? (
          <div className="rounded-2xl px-4 py-5 text-[14px] font-body" style={{ backgroundColor: colors.cream, color: 'rgba(41,40,39,0.55)' }}>
            Loading Lockdown PoC policy...
          </div>
        ) : (
          <>
            {isReadOnly && (
              <div className="rounded-2xl border px-4 py-4" style={{ borderColor: colors.lavender, backgroundColor: colors.lavenderTint }}>
                <p className="text-[12px] uppercase tracking-wider font-label" style={{ color: colors.amethyst }}>
                  Upgrade Required For Active Management
                </p>
                <p className="mt-1.5 text-[14px] font-body" style={{ color: colors.charcoal }}>
                  {lockdownAccess?.upgradeCopy || 'Upgrade to Lockdown to unlock extension pairing and policy editing.'}
                </p>
                <p className="mt-2 text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.68)' }}>
                  {hasSavedDocument
                    ? (lockdownAccess?.savedPolicyCopy || 'Saved lockdown policy data stays in place until you re-upgrade.')
                    : 'No lockdown policy has been saved on this account yet. Upgrade to Lockdown to create one.'}
                </p>
                <p className="mt-2 text-[13px] font-body" style={{ color: 'rgba(41,40,39,0.68)' }}>
                  {lockdownAccess?.restoreAccessCopy || 'Upgrade back to Lockdown to restore pairing and policy editing without losing saved data.'}
                </p>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div className="rounded-2xl border p-5" style={{ borderColor: colors.parchment }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] font-label" style={{ color: colors.amethyst }}>
                      Blocking State
                    </p>
                    <h4 className="mt-2" style={{ fontSize: 18, fontWeight: 540, color: colors.charcoal }}>
                      Parent portal control
                    </h4>
                    <p className="text-[13px] mt-1" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                      Turn the prototype blocking state on or off. Paired extensions poll this saved value and update their cached policy automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDirtyPolicy((currentPolicy) => ({
                      ...currentPolicy,
                      is_enabled: !currentPolicy.is_enabled,
                    }))}
                    disabled={!canManagePolicy}
                    className="relative inline-flex h-8 w-16 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: policy.is_enabled ? colors.amethyst : colors.parchment }}
                    aria-pressed={policy.is_enabled}
                    aria-disabled={!canManagePolicy}
                  >
                    <span
                      className="inline-block h-6 w-6 transform rounded-full bg-white transition-transform"
                      style={{ transform: policy.is_enabled ? 'translateX(34px)' : 'translateX(4px)' }}
                    />
                  </button>
                </div>
                <div className="mt-4 rounded-2xl px-4 py-3" style={{ backgroundColor: policy.is_enabled ? '#efe7ff' : colors.cream }}>
                  <p className="text-[13px]" style={{ color: colors.charcoal, fontWeight: 540 }}>
                    {policy.is_enabled ? 'Blocking enabled' : 'Blocking disabled'}
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                    {canManagePolicy
                      ? 'Save to persist this value in Firestore and reload it after refresh.'
                      : 'This saved state remains visible after downgrade, but editing is disabled until the Lockdown plan is restored.'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: colors.parchment }}>
                <div className="flex items-center gap-2">
                  <Youtube className="w-4 h-4" style={{ color: colors.amethyst }} />
                  <p className="text-[11px] uppercase tracking-[0.16em] font-label" style={{ color: colors.amethyst }}>
                    Current Creator Policy
                  </p>
                </div>
                <p className="text-[13px] mt-3" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                  Creator editing stays out of scope in Phase 4. Existing creator entries stay visible in both active and read-only states.
                </p>
                <div className="mt-4 space-y-2">
                  {policy.allowed_youtube_channels.length === 0 ? (
                    <div className="rounded-xl px-3 py-3" style={{ backgroundColor: colors.cream }}>
                      <p className="text-[13px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                        No creator entries are saved in this policy yet.
                      </p>
                    </div>
                  ) : (
                    policy.allowed_youtube_channels.map((channel) => (
                      <div
                        key={channel.channel_id}
                        className="rounded-xl px-3 py-3"
                        style={{ backgroundColor: colors.cream }}
                      >
                        <p className="text-[13px]" style={{ color: colors.charcoal, fontWeight: 540 }}>
                          {channel.title || channel.channel_id}
                        </p>
                        <p className="text-[12px] mt-1" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                          {channel.handle ? `${channel.handle} · ` : ''}{channel.channel_id}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border p-5" style={{ borderColor: colors.parchment }}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] font-label" style={{ color: colors.amethyst }}>
                    Extension Pairing
                  </p>
                  <h4 className="mt-2" style={{ fontSize: 18, fontWeight: 540, color: colors.charcoal }}>
                    Pair this saved policy
                  </h4>
                  <p className="text-[13px] mt-1 max-w-2xl" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                    {canPairDevices
                      ? 'Use the pairing code in the extension options page. In this PoC, the code bundles the policy document id plus public Firebase web config so the extension can poll Firestore directly.'
                      : 'Pairing stays disabled outside the Lockdown plan. Keep this policy id visible for reference, then re-upgrade to restore active pairing controls.'}
                  </p>
                </div>
                {copyMessage && (
                  <p className="text-[12px]" style={{ color: canPairDevices ? '#0f7b41' : colors.amethyst, fontWeight: 540 }}>
                    {copyMessage}
                  </p>
                )}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: colors.cream }}>
                  <p className="text-[11px] uppercase tracking-[0.16em] font-label" style={{ color: colors.amethyst }}>
                    Policy ID
                  </p>
                  <p className="text-[13px] mt-2 break-all" style={{ color: colors.charcoal, fontWeight: 540 }}>
                    {policyDocumentId}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopy(policyDocumentId, 'Policy ID', { requiresPairingAccess: true })}
                    disabled={!canPairDevices}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal, fontSize: 12, fontWeight: 700 }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Policy ID
                  </button>
                </div>

                <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: colors.cream }}>
                  <p className="text-[11px] uppercase tracking-[0.16em] font-label" style={{ color: colors.amethyst }}>
                    Pairing Code
                  </p>
                  <p className="text-[13px] mt-2 break-all" style={{ color: colors.charcoal, fontWeight: 540 }}>
                    {pairingCode || 'Firebase web config is missing, so the pairing code could not be generated in this environment.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopy(pairingCode, 'Pairing code', { requiresPairingAccess: true })}
                    disabled={!pairingCode || !canPairDevices}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal, fontSize: 12, fontWeight: 700 }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Pairing Code
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border p-5" style={{ borderColor: colors.parchment }}>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" style={{ color: colors.amethyst }} />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] font-label" style={{ color: colors.amethyst }}>
                    Website Allowlist
                  </p>
                  <h4 className="mt-1" style={{ fontSize: 18, fontWeight: 540, color: colors.charcoal }}>
                    Allowed origins only
                  </h4>
                </div>
              </div>

              <p className="text-[13px] mt-3" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                Enter exact site origins such as `https://www.khanacademy.org`. Paths, query strings, and invalid URLs are rejected before save.
              </p>

              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  value={draftOrigin}
                  onChange={(event) => {
                    if (!canManagePolicy) return;
                    setDraftOrigin(event.target.value);
                    if (originError) setOriginError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddOrigin();
                    }
                  }}
                  disabled={!canManagePolicy}
                  placeholder="https://www.example.com"
                  className="flex-1 px-3 py-3 rounded-xl focus:outline-none text-[14px] transition-colors bg-white disabled:opacity-55 disabled:cursor-not-allowed"
                  style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal, fontWeight: 460 }}
                />
                <button
                  type="button"
                  onClick={handleAddOrigin}
                  disabled={!canManagePolicy}
                  className="px-4 py-3 rounded-xl transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                  style={{ backgroundColor: colors.charcoal, color: '#ffffff', fontSize: 13, fontWeight: 700 }}
                >
                  Add Origin
                </button>
              </div>

              {originError && (
                <p className="text-[12px] mt-3" style={{ color: '#b42318', fontWeight: 540 }}>
                  {originError}
                </p>
              )}

              <div className="mt-5 space-y-3">
                {policy.allowed_origins.length === 0 ? (
                  <div className="rounded-xl px-4 py-4 text-[13px]" style={{ backgroundColor: colors.cream, color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                    No website origins saved yet.
                  </div>
                ) : (
                  policy.allowed_origins.map((origin) => (
                    <div
                      key={origin}
                      className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
                      style={{ backgroundColor: colors.cream }}
                    >
                      <div>
                        <p className="text-[14px]" style={{ color: colors.charcoal, fontWeight: 540 }}>
                          {origin}
                        </p>
                        <p className="text-[12px] mt-1" style={{ color: 'rgba(41,40,39,0.45)', fontWeight: 460 }}>
                          Origin-level rule
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOrigin(origin)}
                        disabled={!canManagePolicy}
                        className="px-3 py-2 rounded-lg transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#ffffff', border: `1px solid ${colors.parchment}`, color: colors.charcoal, fontSize: 12, fontWeight: 700 }}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border px-5 py-4 md:flex-row md:items-center md:justify-between" style={{ borderColor: colors.parchment }}>
              <div>
                <p className="text-[13px]" style={{ color: colors.charcoal, fontWeight: 540 }}>
                  {hasSavedDocument ? 'Saved policy document found.' : 'No saved policy document yet.'}
                </p>
                <p className="text-[12px] mt-1" style={{ color: 'rgba(41,40,39,0.45)', fontWeight: 460 }}>
                  Last saved: {lastSavedLabel}
                </p>
                {saveError && (
                  <p className="text-[12px] mt-2" style={{ color: '#b42318', fontWeight: 540 }}>
                    {saveError}
                  </p>
                )}
                {saveSuccess && (
                  <p className="text-[12px] mt-2" style={{ color: '#0f7b41', fontWeight: 540 }}>
                    {saveSuccess}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={!ready || saving || !isDirty || !canManagePolicy}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                style={{ backgroundColor: colors.charcoal, color: '#ffffff', fontSize: 13, fontWeight: 700 }}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : (canManagePolicy ? 'Save Lockdown Policy' : 'Upgrade To Edit')}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default LockdownPolicyPanel;
