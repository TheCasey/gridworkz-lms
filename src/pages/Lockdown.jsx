import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, Lock, Shield } from 'lucide-react';
import LockdownPolicyPanel from '../components/LockdownPolicyPanel';
import { dashboardFeaturesById } from '../constants/dashboardFeatures';

const Lockdown = () => {
  const {
    colors,
    currentUser,
    db,
    lockdownAccess,
    planName,
    resolvedDashboardFeaturesById,
  } = useOutletContext();

  const lockdownFeature = resolvedDashboardFeaturesById?.lockdown || null;
  const isLockedModule = Boolean(lockdownFeature?.isLocked);
  const settingsPath = `/dashboard/${dashboardFeaturesById.settings.path}`;

  return (
    <div className="p-8 space-y-6">
      <section
        className="rounded-[28px] border bg-white px-6 py-6 md:px-7"
        style={{ borderColor: colors.parchment }}
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-label"
              style={{
                backgroundColor: isLockedModule ? colors.lavenderTint : '#fbfaf8',
                color: isLockedModule ? colors.amethyst : colors.charcoal,
              }}
            >
              {isLockedModule ? <Lock className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
              {isLockedModule ? 'Locked Module' : 'Premium Module'}
            </div>
            <h3
              className="mt-4 text-[24px] font-display"
              style={{ color: colors.charcoal, lineHeight: 1.05, letterSpacing: '-0.4px' }}
            >
              Lockdown lives as its own route-backed module now.
            </h3>
            <p className="mt-3 text-[14px] font-body" style={{ color: 'rgba(41,40,39,0.65)' }}>
              Extension pairing and prototype policy controls stay on the existing entitlement rail,
              but they now mount from a dedicated dashboard route instead of the students overview.
            </p>
            {isLockedModule ? (
              <div
                className="mt-4 rounded-2xl border px-4 py-4"
                style={{ borderColor: colors.lavender, backgroundColor: colors.lavenderTint }}
              >
                <p className="text-[12px] uppercase tracking-wider font-label" style={{ color: colors.amethyst }}>
                  Locked State
                </p>
                <p className="mt-1.5 text-[13px] font-body" style={{ color: colors.charcoal }}>
                  {lockdownAccess?.upgradeCopy || 'Upgrade to Lockdown to unlock extension pairing and policy editing.'}
                </p>
              </div>
            ) : null}
          </div>

          <div
            className="rounded-[24px] border px-5 py-4 xl:max-w-sm"
            style={{ borderColor: colors.parchment, backgroundColor: '#fbfaf8' }}
          >
            <p className="text-[11px] uppercase tracking-wider font-label" style={{ color: 'rgba(41,40,39,0.45)' }}>
              Account Summary
            </p>
            <p className="mt-2 text-[14px] font-body" style={{ color: colors.charcoal }}>
              Settings remains the primary surface for plan status, usage limits, and premium capability summaries.
            </p>
            <Link
              to={settingsPath}
              className="mt-4 inline-flex items-center gap-2 text-[13px] font-label uppercase tracking-[0.16em]"
              style={{ color: colors.amethyst }}
            >
              Open Settings
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <LockdownPolicyPanel
        currentUser={currentUser}
        db={db}
        colors={colors}
        lockdownAccess={lockdownAccess}
        planName={planName}
      />
    </div>
  );
};

export default Lockdown;
