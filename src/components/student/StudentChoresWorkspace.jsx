import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Clock3,
  Lock,
  Sparkles,
} from 'lucide-react';

const DEFAULT_COLORS = Object.freeze({
  charcoal: '#292827',
  amethyst: '#714cb6',
  cream: '#e9e5dd',
  parchment: '#dcd7d3',
  lavender: '#cbb7fb',
});

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  const resolved = new Date(value);
  if (Number.isNaN(resolved.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(resolved);
};

const SectionCard = ({ children, style = {}, ...props }) => (
  <section
    className="rounded-2xl p-6 bg-white"
    style={{ border: `1px solid ${DEFAULT_COLORS.parchment}`, ...style }}
    {...props}
  >
    {children}
  </section>
);

const ChoreCard = ({
  chore,
  actionLabel,
  actionDisabled = false,
  actionPending = false,
  detailLabel = '',
  detailValue = '',
  noteValue = '',
  onNoteChange = null,
  onAction = null,
  showNote = false,
  colors,
}) => (
  <div
    className="rounded-xl p-4"
    style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 style={{ fontSize: 16, fontWeight: 540, color: colors.charcoal, lineHeight: 1.2 }}>
            {chore.title}
          </h4>
          <span
            className="text-[11px] px-2 py-1 rounded-full uppercase"
            style={{ backgroundColor: `${colors.lavender}26`, color: colors.amethyst, fontWeight: 700 }}
          >
            {chore.frequency_pool}
          </span>
        </div>
        {!!chore.effort_label && (
          <p className="mt-1 text-[12px]" style={{ color: 'rgba(41,40,39,0.52)', fontWeight: 460 }}>
            {chore.effort_label}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled || actionPending}
        className="px-3 py-2 rounded-lg text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={{ backgroundColor: colors.charcoal, color: '#fff', fontWeight: 700 }}
      >
        {actionPending ? 'Working...' : actionLabel}
      </button>
    </div>

    {!!chore.instructions && (
      <div className="mt-4 rounded-lg p-3" style={{ backgroundColor: `${colors.lavender}1f`, borderLeft: `3px solid ${colors.lavender}` }}>
        <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: colors.amethyst, fontWeight: 700 }}>
          Instructions
        </p>
        <p className="text-[14px]" style={{ color: colors.charcoal, fontWeight: 460, lineHeight: 1.5 }}>
          {chore.instructions}
        </p>
      </div>
    )}

    {!!chore.definition_of_done && (
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
          Definition of done
        </p>
        <p className="text-[14px]" style={{ color: 'rgba(41,40,39,0.72)', fontWeight: 460, lineHeight: 1.5 }}>
          {chore.definition_of_done}
        </p>
      </div>
    )}

    {(detailLabel || chore.proof_requirement) && (
      <div className="mt-3 space-y-1">
        {!!detailLabel && (
          <p className="text-[12px]" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
            <span style={{ color: colors.charcoal, fontWeight: 540 }}>{detailLabel}:</span> {detailValue}
          </p>
        )}
        {!!chore.proof_requirement && (
          <p className="text-[12px]" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
            <span style={{ color: colors.charcoal, fontWeight: 540 }}>Proof:</span> {chore.proof_requirement}
          </p>
        )}
      </div>
    )}

    {showNote && (
      <div className="mt-4">
        <label className="block text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
          Done note
        </label>
        <textarea
          rows={3}
          value={noteValue}
          onChange={(event) => onNoteChange?.(event.target.value)}
          placeholder="Optional note for your parent"
          className="w-full px-3 py-2 rounded-lg text-[14px] resize-none focus:outline-none"
          style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal, fontWeight: 460 }}
        />
      </div>
    )}
  </div>
);

const StudentChoresWorkspace = ({
  workspace,
  loading = false,
  error = null,
  onClaimChore,
  onCompleteChore,
  onCompleteRoutine,
  claimingIds = {},
  completingClaimIds = {},
  completingRoutineIds = {},
  colors = DEFAULT_COLORS,
}) => {
  const [routineChecks, setRoutineChecks] = useState({});
  const [proofNotes, setProofNotes] = useState({});
  const rewardWallet = workspace.rewardWallet || null;

  useEffect(() => {
    setRoutineChecks((current) => (
      workspace.routines.reduce((nextState, routine) => {
        if (routine.is_completed_today) {
          nextState[routine.id] = routine.completed_item_ids.length > 0
            ? routine.completed_item_ids
            : routine.checklist_items.map((item) => item.id).filter(Boolean);
          return nextState;
        }

        nextState[routine.id] = current[routine.id] || [];
        return nextState;
      }, {})
    ));
  }, [workspace.routineDateKey, workspace.routines]);

  const visibleMessage = useMemo(() => {
    if (workspace.accessState === 'locked') {
      return {
        icon: Lock,
        title: 'Chores are locked right now',
        detail: 'Verify the student session before using the household workspace.',
      };
    }

    if (workspace.accessState === 'empty') {
      return {
        icon: ClipboardList,
        title: 'No chores are ready yet',
        detail: 'When your parent adds routines or chore pools, they will show up here.',
      };
    }

    if (workspace.accessState === 'all_done') {
      return {
        icon: Sparkles,
        title: 'You are done for now',
        detail: 'Your routine is complete and there are no chore claims waiting on you.',
      };
    }

    return null;
  }, [workspace.accessState]);

  const toggleRoutineItem = (routineId, itemId) => {
    setRoutineChecks((current) => {
      const selected = current[routineId] || [];
      const nextSelected = selected.includes(itemId)
        ? selected.filter((entry) => entry !== itemId)
        : [...selected, itemId];

      return {
        ...current,
        [routineId]: nextSelected,
      };
    });
  };

  return (
    <div className="space-y-7" data-testid="student-chores-workspace">
      <SectionCard>
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
              Own Path
            </p>
            <h2 style={{ fontSize: 24, fontWeight: 540, color: colors.charcoal, lineHeight: 1.05 }}>
              Chores
            </h2>
            <p className="mt-2 max-w-2xl text-[14px]" style={{ color: 'rgba(41,40,39,0.68)', fontWeight: 460, lineHeight: 1.55 }}>
              Finish your daily routine once, then claim and complete the chores that are ready for you.
            </p>
          </div>

          <div className={`grid gap-3 md:min-w-[320px] ${rewardWallet ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
            <div className="rounded-xl p-4" style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                Weekly remaining
              </p>
              <p style={{ fontSize: 24, fontWeight: 540, color: colors.charcoal }}>
                {workspace.counts.remaining.weekly}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                Monthly remaining
              </p>
              <p style={{ fontSize: 24, fontWeight: 540, color: colors.charcoal }}>
                {workspace.counts.remaining.monthly}
              </p>
            </div>
            {rewardWallet ? (
              <div className="rounded-xl p-4" style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}>
                <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                  Points
                </p>
                <p style={{ fontSize: 24, fontWeight: 540, color: colors.charcoal }}>
                  {rewardWallet.total_points || 0}
                </p>
                <p className="mt-1 text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                  {rewardWallet.updated_at ? `Updated ${formatDateTime(rewardWallet.updated_at)}` : 'Shared wallet'}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {error?.message && (
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: '#fbf8ff', border: `1px solid ${colors.lavender}` }}
        >
          <p style={{ fontSize: 14, color: colors.charcoal, fontWeight: 540 }}>{error.message}</p>
        </div>
      )}

      {visibleMessage && (
        <SectionCard>
          <div className="flex items-start gap-3">
            <visibleMessage.icon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: colors.amethyst }} />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 540, color: colors.charcoal }}>
                {visibleMessage.title}
              </h3>
              <p className="mt-1 text-[14px]" style={{ color: 'rgba(41,40,39,0.6)', fontWeight: 460, lineHeight: 1.5 }}>
                {visibleMessage.detail}
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      {workspace.canInteract && (
        <>
          <SectionCard>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                  Today
                </p>
                <h3 style={{ fontSize: 18, fontWeight: 540, color: colors.charcoal }}>
                  Routine
                </h3>
              </div>
              <span
                className="text-[11px] px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${colors.lavender}26`, color: colors.amethyst, fontWeight: 700 }}
              >
                {workspace.routines.filter((routine) => routine.is_completed_today).length}/{workspace.routines.length || 0} complete
              </span>
            </div>

            {workspace.routines.length === 0 ? (
              <p className="text-[14px]" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
                No routine templates are assigned right now.
              </p>
            ) : (
              <div className="space-y-4">
                {workspace.routines.map((routine) => {
                  const checkedItems = routineChecks[routine.id] || [];
                  const allChecked = routine.checklist_items.length === 0 || routine.checklist_items.every(
                    (item) => checkedItems.includes(item.id)
                  );

                  return (
                    <div
                      key={routine.id}
                      className="rounded-xl p-4"
                      style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 style={{ fontSize: 16, fontWeight: 540, color: colors.charcoal }}>
                            {routine.title}
                          </h4>
                          <p className="mt-1 text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                            One daily completion is saved for {workspace.routineDateKey}.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onCompleteRoutine?.({
                            routineTemplateId: routine.id,
                            completedItemIds: checkedItems,
                          })}
                          disabled={routine.is_completed_today || !allChecked || completingRoutineIds[routine.id]}
                          className="px-3 py-2 rounded-lg text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          style={{ backgroundColor: colors.charcoal, color: '#fff', fontWeight: 700 }}
                        >
                          {routine.is_completed_today
                            ? 'Completed'
                            : completingRoutineIds[routine.id]
                              ? 'Saving...'
                              : 'Complete routine'}
                        </button>
                      </div>

                      {routine.checklist_items.length > 0 && (
                        <div className="mt-4 grid gap-2">
                          {routine.checklist_items.map((item) => {
                            const checked = checkedItems.includes(item.id);
                            return (
                              <label
                                key={item.id || item.label}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                                style={{
                                  backgroundColor: checked ? `${colors.lavender}1f` : '#fff',
                                  border: `1px solid ${checked ? colors.lavender : colors.parchment}`,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={routine.is_completed_today}
                                  onChange={() => toggleRoutineItem(routine.id, item.id)}
                                  className="w-4 h-4"
                                />
                                <span style={{ fontSize: 14, color: colors.charcoal, fontWeight: 460 }}>
                                  {item.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {routine.is_completed_today && (
                        <p className="mt-3 text-[12px]" style={{ color: colors.amethyst, fontWeight: 460 }}>
                          Completed {formatDateTime(routine.completed_at)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                  Choose next
                </p>
                <h3 style={{ fontSize: 18, fontWeight: 540, color: colors.charcoal }}>
                  Available chores
                </h3>
              </div>
              <span className="text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                {workspace.availableChores.length} ready to claim
              </span>
            </div>

            {loading && workspace.availableChores.length === 0 ? (
              <p className="text-[14px]" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
                Loading chores...
              </p>
            ) : workspace.availableChores.length === 0 ? (
              <div className="rounded-xl p-4" style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}>
                <p style={{ fontSize: 14, color: colors.charcoal, fontWeight: 540 }}>No chores are available right now.</p>
                <p className="mt-1 text-[13px]" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
                  Finish claimed chores or check back after the next cooldown or reset.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {workspace.availableChores.map((chore) => (
                  <ChoreCard
                    key={chore.id}
                    chore={chore}
                    actionLabel="Claim chore"
                    actionPending={Boolean(claimingIds[chore.id])}
                    onAction={() => onClaimChore?.(chore.id)}
                    colors={colors}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 700 }}>
                  Finish what you started
                </p>
                <h3 style={{ fontSize: 18, fontWeight: 540, color: colors.charcoal }}>
                  Claimed chores
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'rgba(41,40,39,0.5)', fontWeight: 460 }}>
                <Clock3 className="w-3.5 h-3.5" />
                {workspace.claimedChores.length} waiting on you
              </span>
            </div>

            {workspace.claimedChores.length === 0 ? (
              <div className="rounded-xl p-4" style={{ backgroundColor: '#faf9f8', border: `1px solid ${colors.parchment}` }}>
                <p style={{ fontSize: 14, color: colors.charcoal, fontWeight: 540 }}>No chores are claimed right now.</p>
                <p className="mt-1 text-[13px]" style={{ color: 'rgba(41,40,39,0.55)', fontWeight: 460 }}>
                  Claim one from the available list when you are ready.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {workspace.claimedChores.map((chore) => {
                  const claimId = chore.active_claim_id || '';
                  const noteValue = proofNotes[claimId] || '';

                  return (
                    <ChoreCard
                      key={claimId || chore.id}
                      chore={chore}
                      actionLabel="Complete chore"
                      actionDisabled={!claimId}
                      actionPending={Boolean(completingClaimIds[claimId])}
                      detailLabel="Claim expires"
                      detailValue={formatDateTime(chore.claim_expires_at) || 'No deadline'}
                      noteValue={noteValue}
                      onNoteChange={(value) => setProofNotes((current) => ({ ...current, [claimId]: value }))}
                      onAction={() => onCompleteChore?.({
                        claimId,
                        proofNote: noteValue,
                      })}
                      showNote
                      colors={colors}
                    />
                  );
                })}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
};

export default StudentChoresWorkspace;
