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
    parentSettings,
    planName,
    resolvedDashboardFeaturesById,
    students,
    subjects,
  } = useOutletContext();

  const lockdownFeature = resolvedDashboardFeaturesById?.lockdown || null;
  const isLockedModule = Boolean(lockdownFeature?.isLocked);
  const settingsPath = `/dashboard/${dashboardFeaturesById.settings.path}`;
  const launchPositioningLabel = isLockedModule ? 'Coming Soon Tier' : 'Launch Preview';

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
              {launchPositioningLabel}
            </div>
            <h3
              className="mt-4 text-[24px] font-display"
              style={{ color: colors.charcoal, lineHeight: 1.05, letterSpacing: '-0.4px' }}
            >
              Review student-bound pairing, current access, and Lockdown setup from one parent summary shell.
            </h3>
            <p className="mt-3 text-[14px] font-body" style={{ color: 'rgba(41,40,39,0.65)' }}>
              Choose the student first, scan the current schedule and allowed-right-now state, then open focused pairing,
              resource, device, and advanced management surfaces without dropping back into a long inline policy console.
              The route stays live for entitlement-aware setup while the broader Lockdown tier remains positioned as coming soon in the Core-first launch.
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
                  Lockdown stays visible here as the next tier beyond Core, but broad self-serve rollout is still coming soon. This shell keeps the live route visible without presenting it as a broadly launched module.
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
              Account Settings remains the account-level surface for plan status, usage limits, and premium capability summaries while Lockdown handles student-bound device access. Eligible households can still use the live route even while the broader tier stays in coming-soon positioning.
            </p>
            <Link
              to={settingsPath}
              className="mt-4 inline-flex items-center gap-2 text-[13px] font-label uppercase tracking-[0.16em]"
              style={{ color: colors.amethyst }}
            >
              Open Account Settings
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
        parentSettings={parentSettings}
        planName={planName}
        students={students}
        subjects={subjects}
      />
    </div>
  );
};

export default Lockdown;
