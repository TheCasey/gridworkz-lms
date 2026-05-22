import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTrustedOperatorSession } from '../firebase/trustedOperations';

const OpsRouteStatus = ({ title, detail }) => (
  <main className="min-h-screen bg-[#f8f4ea] text-[#292827]">
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-10">
      <section className="w-full rounded-lg border border-[#2f2a3d]/15 bg-white/80 p-8 shadow-sm">
        <p className="font-label text-xs font-semibold uppercase tracking-[0.14em] text-[#714cb6]">
          Operator Console
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-[#292827]">
          {title}
        </h1>
        {detail ? (
          <p className="mt-4 text-sm leading-6 text-[#292827]/70">
            {detail}
          </p>
        ) : null}
      </section>
    </div>
  </main>
);

const OpsEntitlements = () => {
  const { currentUser } = useAuth();
  const [sessionState, setSessionState] = useState({
    status: 'checking',
    session: null,
  });
  const userId = currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    let isMounted = true;
    setSessionState({ status: 'checking', session: null });

    getTrustedOperatorSession()
      .then((session) => {
        if (isMounted) {
          setSessionState({ status: 'allowed', session });
        }
      })
      .catch(() => {
        if (isMounted) {
          setSessionState({ status: 'denied', session: null });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (sessionState.status === 'checking') {
    return (
      <OpsRouteStatus
        title="Checking operator access"
        detail="Verifying this signed-in account against the operator allowlist."
      />
    );
  }

  if (sessionState.status === 'denied') {
    return (
      <OpsRouteStatus
        title="Operator access required"
        detail="This account is not on the active support operator allowlist."
      />
    );
  }

  const { session } = sessionState;
  const roleLabel = session.role === 'admin' ? 'Admin' : 'Support';

  return (
    <main className="min-h-screen bg-[#f8f4ea] text-[#292827]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
        <header className="flex flex-col gap-4 border-b border-[#2f2a3d]/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-label text-xs font-semibold uppercase tracking-[0.14em] text-[#714cb6]">
              Operator Console
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-[#292827]">
              Entitlement Console
            </h1>
          </div>
          <div className="rounded-lg border border-[#714cb6]/25 bg-white/75 px-4 py-3 text-sm text-[#292827]/75">
            <span className="font-semibold text-[#292827]">{roleLabel}</span>
            <span className="mx-2 text-[#292827]/30">/</span>
            <span>{session.email}</span>
          </div>
        </header>

        <section className="mt-8 rounded-lg border border-[#2f2a3d]/15 bg-white/80 p-6 shadow-sm">
          <p className="font-label text-xs font-semibold uppercase tracking-[0.14em] text-[#714cb6]">
            Account Workspace
          </p>
          <h2 className="mt-3 font-display text-2xl font-semibold text-[#292827]">
            No account loaded
          </h2>
        </section>
      </div>
    </main>
  );
};

export default OpsEntitlements;
