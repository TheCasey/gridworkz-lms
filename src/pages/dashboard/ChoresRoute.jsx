import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Archive,
  Ban,
  CheckCircle2,
  Clock3,
  Edit,
  Gift,
  ListTodo,
  Loader2,
  Lock,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { RESET_DAY_OPTIONS } from '../../utils/schoolSettingsUtils';
import { EntitlementFeatureKeys } from '../../constants/entitlements';
import {
  DASHBOARD_CHORES_CHILD_FEATURE_IDS,
  DASHBOARD_FEATURE_STATES,
  dashboardFeaturesById,
} from '../../constants/dashboardFeatures';
import {
  ChoreFrequencyPools,
  RewardCatalogItemTypes,
  RewardRedemptionStatuses,
} from '../../constants/schema';
import useChoreSetup from '../../hooks/useChoreSetup';
import {
  buildChoreDefinitionDraft,
  buildChoreSettingsDraft,
  buildRoutineTemplateDraft,
  createDefaultChoreDefinitionDraft,
  createDefaultRoutineTemplateDraft,
  normalizeChoreDefinitionDraft,
  normalizeChoreSettingsDraft,
  normalizeRoutineTemplateDraft,
} from '../../utils/choreParentViewModel';
import {
  adjustTrustedStudentPoints,
  reviewTrustedChoreCompletion,
  reviewTrustedRewardRedemption,
  syncTrustedAllowanceLedger,
  upsertTrustedChoreDefinition,
  upsertTrustedRewardCatalogItem,
  upsertTrustedChoreSettings,
  upsertTrustedRewardSettings,
  upsertTrustedRoutineTemplate,
} from '../../firebase/trustedOperations';
import {
  BUILT_IN_REWARD_DEFINITIONS,
  buildRewardCatalogDraft,
  createDefaultRewardDraft,
  normalizePointSettings,
  normalizeRewardCatalogDraft,
} from '../../utils/rewardUtils';

const inputClassName = 'op-input text-[14px] font-body';
const labelClassName = 'mb-2 block text-[11px] uppercase tracking-[0.16em] font-label text-[rgba(203,183,251,0.72)]';
const textareaClassName = `${inputClassName} min-h-[96px] resize-y`;

const buildSectionTitle = (title, description, Icon) => (
  <div className="flex items-start gap-3">
    <div
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-[rgba(203,183,251,0.24)] bg-[#202034]"
    >
      <Icon className="h-5 w-5 text-[#cbb7fb]" />
    </div>
    <div>
      <h3 className="text-[22px] font-display text-white" style={{ lineHeight: 1.05 }}>
        {title}
      </h3>
      <p className="op-subtle mt-2 text-[13px] font-body leading-5">{description}</p>
    </div>
  </div>
);

const SectionCard = ({ children }) => (
  <section className="op-panel p-5 md:p-6">
    {children}
  </section>
);

const SummaryCard = ({ label, value, detail }) => (
  <div className="op-stat p-4">
    <p className="op-eyebrow">{label}</p>
    <p className="mt-3 text-[30px] font-display text-white" style={{ lineHeight: 1 }}>
      {value}
    </p>
    <p className="op-subtle mt-2 text-[13px] font-body leading-5">{detail}</p>
  </div>
);

const ActionButton = ({ children, disabled, onClick, tone = 'dark', type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`op-button ${tone === 'light' ? 'op-button-secondary' : ''}`}
  >
    {children}
  </button>
);

const Toggle = ({ checked, disabled = false, onChange }) => (
  <button
    type="button"
    onClick={() => {
      if (!disabled) {
        onChange(!checked);
      }
    }}
    disabled={disabled}
    className="relative inline-flex h-6 w-11 items-center transition-colors disabled:cursor-not-allowed"
    style={{
      backgroundColor: checked ? '#cbb7fb' : 'rgba(238,234,248,0.1)',
      border: `1px solid ${checked ? '#cbb7fb' : 'rgba(238,234,248,0.18)'}`,
      opacity: disabled ? 0.55 : 1,
    }}
  >
    <span
      className={`inline-block h-4 w-4 transform bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
    />
  </button>
);

const EmptyState = ({ icon: Icon, title, detail }) => (
  <div
    className="border border-dashed border-[rgba(203,183,251,0.22)] bg-[rgba(238,234,248,0.04)] px-5 py-8 text-center"
  >
    <div
      className="mx-auto flex h-12 w-12 items-center justify-center border border-[rgba(203,183,251,0.24)] bg-[#202034]"
    >
      <Icon className="h-5 w-5 text-[#cbb7fb]" />
    </div>
    <h4 className="mt-3 text-[15px] font-display text-white">{title}</h4>
    <p className="op-subtle mt-2 text-[13px] font-body leading-5">{detail}</p>
  </div>
);

const readOnlyMessage = 'This account can view saved chores setup data, but entitlement lock keeps create, edit, archive, and review actions disabled.';
const paidModuleReadOnlyMessage = 'Daily routines are available on this account. Core or Lockdown is required for chore pools, allowance tracking, points, rewards, redemptions, achievements, and related cosmetics.';
const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);
const formatSignedPoints = (value) => {
  const normalizedValue = Number.parseInt(value, 10) || 0;
  return normalizedValue > 0 ? `+${normalizedValue}` : String(normalizedValue);
};
const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  const resolved = value?.toDate?.() || new Date(value);
  if (Number.isNaN(resolved?.getTime?.())) {
    return '';
  }

  return resolved.toLocaleString();
};

const ChoresRoute = () => {
  const {
    activeDashboardFeatureId,
    colors,
    currentUser,
    entitlementSummary,
    featureShellState,
    parentSettings,
    resolvedDashboardFeaturesById,
    students,
  } = useOutletContext();
  const featureAccessList = entitlementSummary?.featureAccessList || [];
  const routinesAccess = featureAccessList.find((feature) => feature.key === EntitlementFeatureKeys.DAILY_ROUTINES);
  const choresAccess = featureAccessList.find((feature) => feature.key === EntitlementFeatureKeys.CHORES);
  const rewardsAccess = featureAccessList.find((feature) => feature.key === EntitlementFeatureKeys.REWARDS);
  const canManageDailyRoutines = Boolean(routinesAccess?.isEnabled || choresAccess?.isEnabled);
  const canManageChorePools = Boolean(choresAccess?.isEnabled);
  const canManageRewards = Boolean(rewardsAccess?.isEnabled);
  const activeChoresFeatureId = activeDashboardFeatureId || dashboardFeaturesById.chores.id;
  const isSectionDashboard = activeChoresFeatureId === dashboardFeaturesById.chores.id;
  const isDailyRoutinesRoute = activeChoresFeatureId === DASHBOARD_CHORES_CHILD_FEATURE_IDS.DAILY_ROUTINES;
  const isWeeklyChoresRoute = activeChoresFeatureId === DASHBOARD_CHORES_CHILD_FEATURE_IDS.WEEKLY_CHORES;
  const isMonthlyChoresRoute = activeChoresFeatureId === DASHBOARD_CHORES_CHILD_FEATURE_IDS.MONTHLY_CHORES;
  const isAllowanceRoute = activeChoresFeatureId === DASHBOARD_CHORES_CHILD_FEATURE_IDS.ALLOWANCE;
  const isRewardsRoute = activeChoresFeatureId === DASHBOARD_CHORES_CHILD_FEATURE_IDS.REWARDS;
  const isRoutineReadOnly = featureShellState === DASHBOARD_FEATURE_STATES.LOCKED || !canManageDailyRoutines;
  const isReadOnly = featureShellState === DASHBOARD_FEATURE_STATES.LOCKED || !canManageChorePools;
  const isRewardReadOnly = featureShellState === DASHBOARD_FEATURE_STATES.LOCKED || !canManageRewards;
  const isPaidModuleLocked = !canManageChorePools || !canManageRewards;
  const {
    choreDefinitions,
    choreSettings,
    error,
    loading,
    pointWallets,
    rewardCatalogItems,
    rewardRedemptions,
    rewardSettings,
    routineTemplates,
    viewModel,
  } = useChoreSetup({
    parentId: currentUser?.uid,
    parentSettings,
    students,
    enabled: Boolean(currentUser),
    isLocked: isReadOnly,
  });

  const [routineDraft, setRoutineDraft] = useState(() => createDefaultRoutineTemplateDraft());
  const [choreDraft, setChoreDraft] = useState(() => createDefaultChoreDefinitionDraft());
  const [settingsDraft, setSettingsDraft] = useState(() => buildChoreSettingsDraft({
    choreSettings: {},
    parentSettings,
    students,
  }));
  const [rewardDraft, setRewardDraft] = useState(() => createDefaultRewardDraft());
  const [showRoutineEditor, setShowRoutineEditor] = useState(false);
  const [showChoreEditor, setShowChoreEditor] = useState(false);
  const [showRewardEditor, setShowRewardEditor] = useState(false);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [savingChore, setSavingChore] = useState(false);
  const [savingReward, setSavingReward] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pointSettingsDraft, setPointSettingsDraft] = useState(() => normalizePointSettings({}));
  const [savingPointSettings, setSavingPointSettings] = useState(false);
  const [syncingAllowance, setSyncingAllowance] = useState(false);
  const [busyRecordId, setBusyRecordId] = useState('');
  const [reviewingId, setReviewingId] = useState('');
  const [reviewNotes, setReviewNotes] = useState({});
  const [allowanceAdjustmentDrafts, setAllowanceAdjustmentDrafts] = useState({});
  const [allowancePaidDrafts, setAllowancePaidDrafts] = useState({});
  const [allowanceBusyStudentId, setAllowanceBusyStudentId] = useState('');
  const [pointAdjustmentDrafts, setPointAdjustmentDrafts] = useState({});
  const [pointAdjustmentNotes, setPointAdjustmentNotes] = useState({});
  const [pointBusyStudentId, setPointBusyStudentId] = useState('');
  const [rewardRestockDrafts, setRewardRestockDrafts] = useState({});
  const [rewardBusyId, setRewardBusyId] = useState('');
  const [reviewingRewardId, setReviewingRewardId] = useState('');
  const [hasAttemptedAllowanceSync, setHasAttemptedAllowanceSync] = useState(false);
  const [selectedChoresOverviewStudentId, setSelectedChoresOverviewStudentId] = useState('');

  useEffect(() => {
    setSettingsDraft(buildChoreSettingsDraft({
      choreSettings: choreSettings || {},
      parentSettings,
      students,
    }));
  }, [choreSettings, parentSettings, students]);

  useEffect(() => {
    setPointSettingsDraft(normalizePointSettings(rewardSettings || {}));
  }, [rewardSettings]);

  useEffect(() => {
    const allowanceCards = viewModel?.allowance?.cards || [];
    setAllowanceAdjustmentDrafts(Object.fromEntries(
      allowanceCards.map((card) => [card.student_id, String(card.parent_adjustment_amount ?? 0)])
    ));
    setAllowancePaidDrafts(Object.fromEntries(
      allowanceCards.map((card) => [card.student_id, String(card.paid_amount ?? 0)])
    ));
  }, [viewModel?.allowance?.cards]);

  useEffect(() => {
    setRewardRestockDrafts(Object.fromEntries(
      (Array.isArray(rewardCatalogItems) ? rewardCatalogItems : []).map((rewardCatalogItem) => [
        rewardCatalogItem.id,
        '',
      ])
    ));
  }, [rewardCatalogItems]);

  useEffect(() => {
    const allowanceCards = viewModel?.allowance?.cards || [];
    if (
      loading ||
      !currentUser?.uid ||
      isReadOnly ||
      syncingAllowance ||
      hasAttemptedAllowanceSync ||
      !students.length ||
      allowanceCards.length === 0 ||
      allowanceCards.every((card) => !card.is_missing)
    ) {
      return;
    }

    let isMounted = true;

    const runInitialAllowanceSync = async () => {
      setSyncingAllowance(true);
      try {
        await syncTrustedAllowanceLedger();
      } catch (syncError) {
        console.error('Error syncing allowance ledger:', syncError);
      } finally {
        if (isMounted) {
          setSyncingAllowance(false);
          setHasAttemptedAllowanceSync(true);
        }
      }
    };

    runInitialAllowanceSync();

    return () => {
      isMounted = false;
    };
  }, [
    currentUser?.uid,
    hasAttemptedAllowanceSync,
    isReadOnly,
    loading,
    students.length,
    syncingAllowance,
    viewModel?.allowance?.cards,
  ]);

  const resetRoutineEditor = () => {
    setRoutineDraft(createDefaultRoutineTemplateDraft());
    setShowRoutineEditor(false);
  };

  const resetChoreEditor = () => {
    setChoreDraft(createDefaultChoreDefinitionDraft());
    setShowChoreEditor(false);
  };

  const resetRewardEditor = () => {
    setRewardDraft(createDefaultRewardDraft());
    setShowRewardEditor(false);
  };

  const handleRoutineChecklistChange = (index, value) => {
    setRoutineDraft((prev) => ({
      ...prev,
      checklist_items: prev.checklist_items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, label: value } : item
      )),
    }));
  };

  const handleSaveRoutine = async (event) => {
    event.preventDefault();
    if (isRoutineReadOnly) {
      return;
    }

    const payload = normalizeRoutineTemplateDraft(routineDraft);
    if (!payload.title) {
      alert('Enter a routine title before saving.');
      return;
    }
    if (!payload.checklist_items.length) {
      alert('Add at least one checklist item before saving a routine.');
      return;
    }

    setSavingRoutine(true);
    try {
      await upsertTrustedRoutineTemplate(payload);
      resetRoutineEditor();
    } catch (saveError) {
      console.error('Error saving routine template:', saveError);
      alert('Failed to save the routine. Please try again.');
    } finally {
      setSavingRoutine(false);
    }
  };

  const handleSaveChore = async (event) => {
    event.preventDefault();
    if (isReadOnly) {
      return;
    }

    const payload = normalizeChoreDefinitionDraft(choreDraft);
    if (!payload.title) {
      alert('Enter a chore title before saving.');
      return;
    }
    if (!payload.all_students_eligible && !payload.eligible_student_ids.length) {
      alert('Select at least one eligible student or open the chore to all students.');
      return;
    }

    setSavingChore(true);
    try {
      await upsertTrustedChoreDefinition(payload);
      resetChoreEditor();
    } catch (saveError) {
      console.error('Error saving chore definition:', saveError);
      alert('Failed to save the chore. Please try again.');
    } finally {
      setSavingChore(false);
    }
  };

  const handleSaveReward = async (event) => {
    event.preventDefault();
    if (isRewardReadOnly) {
      return;
    }

    const payload = normalizeRewardCatalogDraft(rewardDraft);
    if (!payload.title) {
      alert('Enter a reward title before saving.');
      return;
    }
    if (!payload.eligible_student_ids.length && rewardDraft.assign_to_all_students !== true) {
      alert('Select at least one eligible student or open the reward to all students.');
      return;
    }

    setSavingReward(true);
    try {
      await upsertTrustedRewardCatalogItem(payload);
      resetRewardEditor();
    } catch (saveError) {
      console.error('Error saving reward catalog item:', saveError);
      alert('Failed to save the reward. Please try again.');
    } finally {
      setSavingReward(false);
    }
  };

  const handleSaveSettings = async (event) => {
    event.preventDefault();
    if (isReadOnly) {
      return;
    }

    setSavingSettings(true);
    try {
      await upsertTrustedChoreSettings(
        normalizeChoreSettingsDraft({
          draft: settingsDraft,
          parentSettings,
          students,
        })
      );
    } catch (saveError) {
      console.error('Error saving chore settings:', saveError);
      alert('Failed to save chore settings. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSavePointSettings = async (event) => {
    event.preventDefault();
    if (isRewardReadOnly) {
      return;
    }

    setSavingPointSettings(true);
    try {
      await upsertTrustedRewardSettings(normalizePointSettings(pointSettingsDraft));
    } catch (saveError) {
      console.error('Error saving point settings:', saveError);
      alert('Failed to save point settings. Please try again.');
    } finally {
      setSavingPointSettings(false);
    }
  };

  const handleArchiveRoutine = async (routineRecord, nextIsActive) => {
    if (isRoutineReadOnly) {
      return;
    }

    setBusyRecordId(routineRecord.id);
    try {
      await upsertTrustedRoutineTemplate({
        ...normalizeRoutineTemplateDraft(buildRoutineTemplateDraft(routineRecord)),
        is_active: nextIsActive,
      });
    } catch (archiveError) {
      console.error('Error updating routine state:', archiveError);
      alert('Failed to update the routine state. Please try again.');
    } finally {
      setBusyRecordId('');
    }
  };

  const handleArchiveChore = async (choreRecord, nextIsActive) => {
    if (isReadOnly) {
      return;
    }

    setBusyRecordId(choreRecord.id);
    try {
      await upsertTrustedChoreDefinition({
        ...normalizeChoreDefinitionDraft(buildChoreDefinitionDraft(choreRecord)),
        is_active: nextIsActive,
      });
    } catch (archiveError) {
      console.error('Error updating chore state:', archiveError);
      alert('Failed to update the chore state. Please try again.');
    } finally {
      setBusyRecordId('');
    }
  };

  const handleArchiveReward = async (rewardRecord, nextIsActive) => {
    if (isRewardReadOnly) {
      return;
    }

    setRewardBusyId(rewardRecord.id);
    try {
      await upsertTrustedRewardCatalogItem({
        ...normalizeRewardCatalogDraft(buildRewardCatalogDraft(rewardRecord)),
        is_active: nextIsActive,
      });
    } catch (archiveError) {
      console.error('Error updating reward state:', archiveError);
      alert('Failed to update the reward state. Please try again.');
    } finally {
      setRewardBusyId('');
    }
  };

  const handleRestockReward = async (rewardRecord) => {
    if (isRewardReadOnly) {
      return;
    }

    const restockQuantity = Number.parseInt(rewardRestockDrafts[rewardRecord.id], 10);
    if (!Number.isFinite(restockQuantity) || restockQuantity <= 0) {
      alert('Enter a positive whole-number restock quantity first.');
      return;
    }

    setRewardBusyId(rewardRecord.id);
    try {
      await upsertTrustedRewardCatalogItem({
        ...normalizeRewardCatalogDraft(buildRewardCatalogDraft(rewardRecord)),
        restock_quantity: restockQuantity,
      });
      setRewardRestockDrafts((prev) => ({
        ...prev,
        [rewardRecord.id]: '',
      }));
    } catch (restockError) {
      console.error('Error restocking reward:', restockError);
      alert('Failed to restock the reward. Please try again.');
    } finally {
      setRewardBusyId('');
    }
  };

  const handleReviewAction = async (completionId, action) => {
    if (isReadOnly) {
      return;
    }

    setReviewingId(completionId);
    try {
      await reviewTrustedChoreCompletion({
        completion_id: completionId,
        action,
        review_note: reviewNotes[completionId] || '',
      });
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[completionId];
        return next;
      });
    } catch (reviewError) {
      console.error('Error reviewing chore completion:', reviewError);
      alert('Failed to save the review decision. Please try again.');
    } finally {
      setReviewingId('');
    }
  };

  const handleRewardRedemptionAction = async (redemptionId, action) => {
    if (isRewardReadOnly) {
      return;
    }

    setReviewingRewardId(redemptionId);
    try {
      await reviewTrustedRewardRedemption({
        redemption_id: redemptionId,
        action,
      });
    } catch (reviewError) {
      console.error('Error reviewing reward redemption:', reviewError);
      alert('Failed to save the reward decision. Please try again.');
    } finally {
      setReviewingRewardId('');
    }
  };

  const handleSyncAllowance = async () => {
    if (isReadOnly || syncingAllowance) {
      return;
    }

    setSyncingAllowance(true);
    try {
      await syncTrustedAllowanceLedger();
      setHasAttemptedAllowanceSync(true);
    } catch (syncError) {
      console.error('Error syncing allowance ledger:', syncError);
      alert('Failed to refresh the allowance ledger. Please try again.');
    } finally {
      setSyncingAllowance(false);
    }
  };

  const handleAllowanceBookkeeping = async (studentId, markPaidAt = false) => {
    if (isReadOnly) {
      return;
    }

    setAllowanceBusyStudentId(studentId);
    try {
      await syncTrustedAllowanceLedger({
        student_id: studentId,
        parent_adjustment_amount: allowanceAdjustmentDrafts[studentId],
        paid_amount: allowancePaidDrafts[studentId],
        mark_paid_at: markPaidAt,
      });
    } catch (saveError) {
      console.error('Error saving allowance bookkeeping:', saveError);
      alert('Failed to save the allowance record. Please try again.');
    } finally {
      setAllowanceBusyStudentId('');
    }
  };

  const handleAdjustPoints = async (studentId) => {
    if (isRewardReadOnly) {
      return;
    }

    const deltaPoints = Number.parseInt(pointAdjustmentDrafts[studentId], 10);
    if (!Number.isFinite(deltaPoints) || deltaPoints === 0) {
      alert('Enter a non-zero whole-number point adjustment before saving.');
      return;
    }

    setPointBusyStudentId(studentId);
    try {
      await adjustTrustedStudentPoints({
        student_id: studentId,
        delta_points: deltaPoints,
        description: pointAdjustmentNotes[studentId] || '',
      });
      setPointAdjustmentDrafts((prev) => ({
        ...prev,
        [studentId]: '',
      }));
      setPointAdjustmentNotes((prev) => ({
        ...prev,
        [studentId]: '',
      }));
    } catch (saveError) {
      console.error('Error saving point adjustment:', saveError);
      alert('Failed to save the point adjustment. Please try again.');
    } finally {
      setPointBusyStudentId('');
    }
  };

  const activeRoutineCards = viewModel?.routines?.active || [];
  const archivedRoutineCards = viewModel?.routines?.archived || [];
  const weeklyCards = viewModel?.chores?.weekly?.active || [];
  const monthlyCards = viewModel?.chores?.monthly?.active || [];
  const archivedWeeklyCards = viewModel?.chores?.weekly?.archived || [];
  const archivedMonthlyCards = viewModel?.chores?.monthly?.archived || [];
  const pendingReview = viewModel?.pending_review || [];
  const progressCards = viewModel?.progress_by_student || [];
  const quotaWarnings = viewModel?.quota_warnings || [];
  const allowanceCards = viewModel?.allowance?.cards || [];
  const allowanceSummary = viewModel?.allowance?.summary || {};
  const allowancePeriod = viewModel?.allowance?.current_period || {};
  const pointWalletByStudentId = new Map(
    (Array.isArray(pointWallets) ? pointWallets : []).map((wallet) => [wallet.student_id, wallet])
  );
  const pointWalletCards = students.map((student) => {
    const wallet = pointWalletByStudentId.get(student.id) || null;

    return {
      student_id: student.id,
      student_name: student.name || 'Student',
      total_points: Number.parseInt(wallet?.total_points, 10) || 0,
      lifetime_points: Number.parseInt(wallet?.lifetime_points, 10) || 0,
      updated_at: wallet?.updated_at?.toDate?.() || (wallet?.updated_at ? new Date(wallet.updated_at) : null),
    };
  });
  const totalVisibleWalletPoints = pointWalletCards.reduce(
    (sum, wallet) => sum + (wallet.total_points || 0),
    0
  );
  const studentNameById = useMemo(() => new Map(
    (Array.isArray(students) ? students : []).map((student) => [student.id, student.name || 'Student'])
  ), [students]);
  const parentRewardCards = useMemo(() => (
    (Array.isArray(rewardCatalogItems) ? rewardCatalogItems : [])
      .filter((rewardCatalogItem) => rewardCatalogItem?.type !== RewardCatalogItemTypes.BUILT_IN)
      .map((rewardCatalogItem) => {
        const eligibleStudentIds = Array.isArray(rewardCatalogItem?.eligible_student_ids)
          ? rewardCatalogItem.eligible_student_ids.filter(Boolean)
          : [];
        const eligibleStudentNames = eligibleStudentIds
          .map((studentId) => studentNameById.get(studentId))
          .filter(Boolean);

        return {
          ...rewardCatalogItem,
          title: rewardCatalogItem?.title || 'Reward',
          description: rewardCatalogItem?.description || '',
          point_cost: Number.parseInt(rewardCatalogItem?.point_cost, 10) || 0,
          stock_quantity: Number.parseInt(rewardCatalogItem?.stock_quantity, 10) || 0,
          available_quantity: Number.parseInt(
            rewardCatalogItem?.available_quantity,
            10
          ) || 0,
          fulfillment_terms: rewardCatalogItem?.fulfillment_terms || '',
          eligible_student_label: eligibleStudentNames.length
            ? eligibleStudentNames.join(', ')
            : 'All students',
          is_active: rewardCatalogItem?.is_active !== false,
          updated_at: rewardCatalogItem?.updated_at?.toDate?.()
            || (rewardCatalogItem?.updated_at ? new Date(rewardCatalogItem.updated_at) : null),
        };
      })
      .sort((left, right) => {
        const leftTime = left.updated_at?.getTime?.() || 0;
        const rightTime = right.updated_at?.getTime?.() || 0;
        return rightTime - leftTime;
      })
  ), [rewardCatalogItems, studentNameById]);
  const activeParentRewardCards = parentRewardCards.filter((rewardCatalogItem) => rewardCatalogItem.is_active);
  const archivedParentRewardCards = parentRewardCards.filter((rewardCatalogItem) => !rewardCatalogItem.is_active);
  const builtInRewardCards = BUILT_IN_REWARD_DEFINITIONS;
  const rewardRequestCards = useMemo(() => (
    (Array.isArray(rewardRedemptions) ? rewardRedemptions : [])
      .map((rewardRedemption) => ({
        ...rewardRedemption,
        title_snapshot: rewardRedemption?.title_snapshot || 'Reward',
        point_cost_snapshot: Number.parseInt(rewardRedemption?.point_cost_snapshot, 10) || 0,
        stock_quantity_snapshot: Number.parseInt(rewardRedemption?.stock_quantity_snapshot, 10) || 0,
        available_quantity_snapshot: Number.parseInt(rewardRedemption?.available_quantity_snapshot, 10) || 0,
        student_name: studentNameById.get(rewardRedemption?.student_id) || 'Student',
        requested_at_date: rewardRedemption?.requested_at?.toDate?.()
          || (rewardRedemption?.requested_at ? new Date(rewardRedemption.requested_at) : null),
        approved_at_date: rewardRedemption?.approved_at?.toDate?.()
          || (rewardRedemption?.approved_at ? new Date(rewardRedemption.approved_at) : null),
        fulfilled_at_date: rewardRedemption?.fulfilled_at?.toDate?.()
          || (rewardRedemption?.fulfilled_at ? new Date(rewardRedemption.fulfilled_at) : null),
      }))
      .sort((left, right) => (
        (right.requested_at_date?.getTime?.() || 0) - (left.requested_at_date?.getTime?.() || 0)
      ))
  ), [rewardRedemptions, studentNameById]);
  const openRewardRequestCards = rewardRequestCards.filter((rewardRedemption) => (
    rewardRedemption.status === RewardRedemptionStatuses.REQUESTED
    || rewardRedemption.status === RewardRedemptionStatuses.APPROVED
  ));
  const closedRewardRequestCards = rewardRequestCards.filter((rewardRedemption) => (
    rewardRedemption.status === RewardRedemptionStatuses.FULFILLED
    || rewardRedemption.status === RewardRedemptionStatuses.REJECTED
    || rewardRedemption.status === RewardRedemptionStatuses.CANCELED
  ));
  const summaryCards = [
    {
      label: 'Daily Routines',
      value: viewModel?.summaries?.active_routine_count || 0,
      detail: `${archivedRoutineCards.length} archived routine${archivedRoutineCards.length === 1 ? '' : 's'} kept for household history.`,
    },
    {
      label: 'Weekly Chores',
      value: viewModel?.summaries?.active_weekly_chore_count || 0,
      detail: `${archivedWeeklyCards.length} archived weekly record${archivedWeeklyCards.length === 1 ? '' : 's'} preserved.`,
    },
    {
      label: 'Monthly Chores',
      value: viewModel?.summaries?.active_monthly_chore_count || 0,
      detail: `${archivedMonthlyCards.length} archived monthly record${archivedMonthlyCards.length === 1 ? '' : 's'} preserved.`,
    },
    {
      label: 'Pending Review',
      value: viewModel?.summaries?.pending_review_count || 0,
      detail: isReadOnly
        ? 'Review decisions stay read-only while this entitlement is locked.'
        : 'Approval-required completions stay here until a parent decision is recorded.',
    },
  ];
  const chorePoolSections = [
    {
      pool: ChoreFrequencyPools.WEEKLY,
      title: 'Weekly Chores',
      description: 'Shared weekly pools keep chores flexible while still letting you control eligibility, cooldowns, and review.',
      cards: weeklyCards,
      archivedCards: archivedWeeklyCards,
    },
    {
      pool: ChoreFrequencyPools.MONTHLY,
      title: 'Monthly Chores',
      description: 'Monthly chores remain unavailable until both the month boundary and cooldown permit them again.',
      cards: monthlyCards,
      archivedCards: archivedMonthlyCards,
    },
  ];
  const visibleChorePoolSections = chorePoolSections.filter((section) => (
    (isWeeklyChoresRoute && section.pool === ChoreFrequencyPools.WEEKLY)
    || (isMonthlyChoresRoute && section.pool === ChoreFrequencyPools.MONTHLY)
  ));
  const filteredPendingReview = pendingReview.filter((record) => {
    if (isWeeklyChoresRoute) {
      return record.frequency_pool === ChoreFrequencyPools.WEEKLY;
    }

    if (isMonthlyChoresRoute) {
      return record.frequency_pool === ChoreFrequencyPools.MONTHLY;
    }

    return true;
  });
  const pendingReviewSectionTitle = isWeeklyChoresRoute ? 'Weekly Review Queue' : 'Monthly Review Queue';
  const pendingReviewSectionDescription = isWeeklyChoresRoute
    ? 'Approval-required weekly chore completions wait here until a parent approves, returns, or rejects them.'
    : 'Approval-required monthly chore completions wait here until a parent approves, returns, or rejects them.';
  const resolvedChoresChildFeaturesById = Object.fromEntries(
    Object.values(DASHBOARD_CHORES_CHILD_FEATURE_IDS).map((featureId) => [
      featureId,
      resolvedDashboardFeaturesById?.[featureId] || dashboardFeaturesById[featureId],
    ])
  );
  const choresDashboardLaunchCards = [
    {
      featureId: DASHBOARD_CHORES_CHILD_FEATURE_IDS.DAILY_ROUTINES,
      description: 'Keep grouped household routines current without turning repeated checklists into separate chores.',
      detail: summaryCards[0].detail,
      icon: Sparkles,
      statValue: summaryCards[0].value,
    },
    {
      featureId: DASHBOARD_CHORES_CHILD_FEATURE_IDS.WEEKLY_CHORES,
      description: 'Manage the shared weekly pool and keep approvals next to the chores that generated them.',
      detail: summaryCards[1].detail,
      icon: ListTodo,
      statValue: summaryCards[1].value,
    },
    {
      featureId: DASHBOARD_CHORES_CHILD_FEATURE_IDS.MONTHLY_CHORES,
      description: 'Review the longer-cycle pool with the same entitlement-aware setup and review behavior.',
      detail: summaryCards[2].detail,
      icon: Clock3,
      statValue: summaryCards[2].value,
    },
    {
      featureId: DASHBOARD_CHORES_CHILD_FEATURE_IDS.ALLOWANCE,
      description: 'Set quota targets, keep the allowance policy current, and review trusted bookkeeping totals.',
      detail: allowancePeriod.period_label || 'Save allowance settings to start tracking the current period.',
      icon: CheckCircle2,
      statValue: formatCurrency(allowanceSummary.remaining_total || 0),
    },
    {
      featureId: DASHBOARD_CHORES_CHILD_FEATURE_IDS.REWARDS,
      description: 'Manage point settings, stocked rewards, and the live reward redemption queue in one place.',
      detail: `${openRewardRequestCards.length} open request${openRewardRequestCards.length === 1 ? '' : 's'} and ${activeParentRewardCards.length} active parent reward${activeParentRewardCards.length === 1 ? '' : 's'}.`,
      icon: Gift,
      statValue: openRewardRequestCards.length,
    },
  ];
  const selectedChoresOverviewStudent = progressCards.find((card) => (
    card.student_id === selectedChoresOverviewStudentId
  )) || progressCards[0] || null;
  const selectedChoresStudentName = selectedChoresOverviewStudent?.student_name || 'Household';
  const overviewActivityCards = [
    ...filteredPendingReview.slice(0, 5).map((record) => ({
      id: `review-${record.id}`,
      tone: 'review',
      title: record.chore_title || 'Chore awaiting review',
      detail: `${record.student_name || 'Student'} submitted ${record.frequency_pool || 'chore'} work.`,
      meta: formatDateTime(record.submitted_at || record.completed_at) || 'Pending review',
      action: isReadOnly ? 'Read-only' : 'Review',
    })),
    ...openRewardRequestCards.slice(0, 4).map((record) => ({
      id: `reward-${record.id}`,
      tone: 'reward',
      title: record.title_snapshot,
      detail: `${record.student_name} requested a ${record.point_cost_snapshot} point reward.`,
      meta: formatDateTime(record.requested_at_date) || 'Reward queue',
      action: isRewardReadOnly ? 'Read-only' : 'Open',
    })),
    ...allowanceCards
      .filter((card) => Number(card.remaining_amount || 0) > 0)
      .slice(0, 4)
      .map((card) => ({
        id: `allowance-${card.student_id}`,
        tone: 'money',
        title: `${card.student_name} allowance due`,
        detail: `${formatCurrency(card.remaining_amount)} remaining for ${card.period_label || allowancePeriod.period_label || 'current period'}.`,
        meta: card.paid_status?.replace('_', ' ') || 'Allowance ledger',
        action: 'Ledger',
      })),
  ].slice(0, 8);

  const renderRoutineCard = (routine) => (
    <div
      key={routine.id}
      className="op-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-[16px] font-display text-white">{routine.title}</h4>
            <span className="op-pill">
              {routine.is_active ? 'Active' : 'Archived'}
            </span>
          </div>
          <p className="op-subtle mt-2 text-[13px] font-body leading-5">
            {routine.checklist_count} checklist item{routine.checklist_count === 1 ? '' : 's'} • {routine.assignment_label}
          </p>
          <p className="mt-1 text-[12px] font-body leading-5 text-[rgba(238,234,248,0.46)]">
            {routine.counts_toward_allowance ? 'Counts toward allowance when policy allows routines.' : 'Does not count toward allowance.'}
          </p>
          <p className="mt-1 text-[12px] font-body leading-5 text-[rgba(238,234,248,0.46)]">
            {routine.counts_toward_points ? 'Eligible for routine point awards when household point settings enable them.' : 'Does not award routine points.'}
          </p>
          <p className="mt-1 text-[12px] font-body leading-5 text-[rgba(238,234,248,0.46)]">
            {routine.completion_count} saved completion{routine.completion_count === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ActionButton
            tone="light"
            disabled={isRoutineReadOnly || busyRecordId === routine.id}
            onClick={() => {
              setRoutineDraft(buildRoutineTemplateDraft(routineTemplates.find((record) => record.id === routine.id) || routine));
              setShowRoutineEditor(true);
            }}
          >
            <Edit className="h-4 w-4" />
            Edit
          </ActionButton>
          <ActionButton
            tone="light"
            disabled={isRoutineReadOnly || busyRecordId === routine.id}
            onClick={() => handleArchiveRoutine(routineTemplates.find((record) => record.id === routine.id) || routine, !routine.is_active)}
          >
            {busyRecordId === routine.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : routine.is_active ? (
              <Archive className="h-4 w-4" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {routine.is_active ? 'Archive' : 'Restore'}
          </ActionButton>
        </div>
      </div>
    </div>
  );

  const renderChoreCard = (chore) => (
    <div
      key={chore.id}
      className="op-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[16px] font-display text-white">{chore.title}</h4>
            <span className="op-pill">
              {chore.requires_parent_approval ? 'Parent Review' : 'Auto Approve'}
            </span>
            {chore.minimum_cooldown_days > 0 ? (
              <span className="op-pill">
                {chore.minimum_cooldown_days}d cooldown
              </span>
            ) : null}
          </div>
          <p className="op-subtle mt-2 text-[13px] font-body leading-5">
            {chore.eligibility_label}
          </p>
          {chore.instructions ? (
            <p className="op-subtle mt-2 text-[13px] font-body leading-5">{chore.instructions}</p>
          ) : null}
          {chore.definition_of_done ? (
            <p className="mt-2 text-[12px] font-body leading-5 text-[rgba(238,234,248,0.46)]">
              Definition of done: {chore.definition_of_done}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <ActionButton
            tone="light"
            disabled={isReadOnly || busyRecordId === chore.id}
            onClick={() => {
              setChoreDraft(buildChoreDefinitionDraft(choreDefinitions.find((record) => record.id === chore.id) || chore));
              setShowChoreEditor(true);
            }}
          >
            <Edit className="h-4 w-4" />
            Edit
          </ActionButton>
          <ActionButton
            tone="light"
            disabled={isReadOnly || busyRecordId === chore.id}
            onClick={() => handleArchiveChore(choreDefinitions.find((record) => record.id === chore.id) || chore, !chore.is_active)}
          >
            {busyRecordId === chore.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : chore.is_active ? (
              <Archive className="h-4 w-4" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {chore.is_active ? 'Archive' : 'Restore'}
          </ActionButton>
        </div>
      </div>
    </div>
  );

  const renderAllowanceCard = (allowanceCard) => (
    <div
      key={allowanceCard.student_id}
      className="op-surface p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[17px] font-display text-white">{allowanceCard.student_name}</h4>
            <span className="op-pill">
              {allowanceCard.paid_status.replace('_', ' ')}
            </span>
            {allowanceCard.is_missing ? (
              <span className="op-pill">
                Needs Sync
              </span>
            ) : null}
          </div>
          <p className="op-subtle mt-2 text-[13px] font-body leading-5">
            {allowanceCard.period_label || allowancePeriod.period_label || 'Current allowance period'}
          </p>
          <p className="mt-1 text-[12px] font-body leading-5 text-[rgba(238,234,248,0.46)]">
            {allowanceCard.completed_counts.total_blocks || 0}/{allowanceCard.required_counts.total_blocks || 0} required blocks completed
            {allowanceCard.include_routines ? ' including routine days.' : '.'}
          </p>
        </div>

        <div className="min-w-[140px] border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
          <p className="op-eyebrow">Remaining</p>
          <p className="mt-2 text-[18px] font-display text-white">{formatCurrency(allowanceCard.remaining_amount)}</p>
          <p className="mt-1 text-[12px] font-body leading-5 text-[rgba(238,234,248,0.5)]">
            {allowanceCard.paid_at ? `Paid at ${allowanceCard.paid_at.toLocaleString()}` : 'No payout timestamp yet'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
          <p className="op-eyebrow">Base Earned</p>
          <p className="mt-2 text-[15px] font-display text-white">{formatCurrency(allowanceCard.calculated_earned_amount)}</p>
        </div>
        <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
          <p className="op-eyebrow">Adjusted Total</p>
          <p className="mt-2 text-[15px] font-display text-white">{formatCurrency(allowanceCard.adjusted_earned_amount)}</p>
        </div>
        <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
          <p className="op-eyebrow">Paid</p>
          <p className="mt-2 text-[15px] font-display text-white">{formatCurrency(allowanceCard.paid_amount)}</p>
        </div>
        <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
          <p className="op-eyebrow">Completion</p>
          <p className="mt-2 text-[15px] font-display text-white">
            {Math.round((allowanceCard.completion_ratio || 0) * 100)}%
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <label className={labelClassName}>Parent Adjustment</label>
          <input
            type="number"
            step="0.01"
            className={inputClassName}
            style={{ border: '1px solid rgba(238,234,248,0.18)' }}
            value={allowanceAdjustmentDrafts[allowanceCard.student_id] ?? ''}
            disabled={isReadOnly || allowanceBusyStudentId === allowanceCard.student_id}
            onChange={(event) => setAllowanceAdjustmentDrafts((prev) => ({
              ...prev,
              [allowanceCard.student_id]: event.target.value,
            }))}
          />
          <p className="op-subtle mt-1 text-[12px] font-body leading-5">
            Positive or negative bookkeeping adjustments are allowed, but the student balance will not drop below zero.
          </p>
        </div>
        <div>
          <label className={labelClassName}>Paid Out Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputClassName}
            style={{ border: '1px solid rgba(238,234,248,0.18)' }}
            value={allowancePaidDrafts[allowanceCard.student_id] ?? ''}
            disabled={isReadOnly || allowanceBusyStudentId === allowanceCard.student_id}
            onChange={(event) => setAllowancePaidDrafts((prev) => ({
              ...prev,
              [allowanceCard.student_id]: event.target.value,
            }))}
          />
          <p className="op-subtle mt-1 text-[12px] font-body leading-5">
            Record the amount sent outside the app. This updates bookkeeping only and never moves money.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ActionButton
          tone="light"
          disabled={isReadOnly || allowanceBusyStudentId === allowanceCard.student_id}
          onClick={() => handleAllowanceBookkeeping(allowanceCard.student_id, false)}
        >
          {allowanceBusyStudentId === allowanceCard.student_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Bookkeeping
        </ActionButton>
        <ActionButton
          disabled={isReadOnly || allowanceBusyStudentId === allowanceCard.student_id}
          onClick={() => handleAllowanceBookkeeping(allowanceCard.student_id, true)}
        >
          {allowanceBusyStudentId === allowanceCard.student_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Record Paid Out
        </ActionButton>
      </div>
    </div>
  );

  const renderRewardCard = (reward) => (
    <div
      key={reward.id}
      className="op-surface p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[17px] font-display text-white">{reward.title}</h4>
            <span className="op-pill">
              {reward.redemption_requires_approval ? 'Needs approval' : 'Auto-approved request'}
            </span>
            <span className="op-pill">
              {reward.available_quantity}/{reward.stock_quantity} in stock
            </span>
          </div>
          <p className="op-subtle mt-2 text-[13px] font-body leading-5">
            {reward.point_cost} points • {reward.eligible_student_label}
          </p>
          {reward.description ? (
            <p className="op-subtle mt-2 text-[13px] font-body leading-5">{reward.description}</p>
          ) : null}
          {reward.fulfillment_terms ? (
            <p className="mt-2 text-[12px] font-body leading-5 text-[rgba(238,234,248,0.46)]">
              Fulfillment terms: {reward.fulfillment_terms}
            </p>
          ) : null}
          <p className="mt-2 text-[12px] font-body leading-5 text-[rgba(238,234,248,0.46)]">
            {reward.updated_at ? `Last updated ${formatDateTime(reward.updated_at)}` : 'Not yet updated after creation.'}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:min-w-[180px]">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              step="1"
              className={inputClassName}
              style={{ border: '1px solid rgba(238,234,248,0.18)' }}
              value={rewardRestockDrafts[reward.id] ?? ''}
              disabled={isRewardReadOnly || rewardBusyId === reward.id}
              onChange={(event) => setRewardRestockDrafts((prev) => ({
                ...prev,
                [reward.id]: event.target.value,
              }))}
              placeholder="Restock"
            />
            <ActionButton
              tone="light"
              disabled={isRewardReadOnly || rewardBusyId === reward.id}
              onClick={() => handleRestockReward(reward)}
            >
              {rewardBusyId === reward.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Restock
            </ActionButton>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton
              tone="light"
              disabled={isRewardReadOnly || rewardBusyId === reward.id}
              onClick={() => {
                setRewardDraft(buildRewardCatalogDraft(reward));
                setShowRewardEditor(true);
              }}
            >
              <Edit className="h-4 w-4" />
              Edit
            </ActionButton>
            <ActionButton
              tone="light"
              disabled={isRewardReadOnly || rewardBusyId === reward.id}
              onClick={() => handleArchiveReward(reward, !reward.is_active)}
            >
              {rewardBusyId === reward.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : reward.is_active ? (
                <Archive className="h-4 w-4" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {reward.is_active ? 'Archive' : 'Restore'}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRewardRedemptionCard = (rewardRedemption) => (
    <div
      key={rewardRedemption.id}
      className="op-surface p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[17px] font-display text-white">{rewardRedemption.title_snapshot}</h4>
            <span className="op-pill">
              {rewardRedemption.status.replace('_', ' ')}
            </span>
            {rewardRedemption.reward_type_snapshot === RewardCatalogItemTypes.BUILT_IN ? (
              <span className="op-pill">
                Built-in unlock
              </span>
            ) : null}
          </div>
          <p className="op-subtle mt-2 text-[13px] font-body leading-5">
            {rewardRedemption.student_name} spent {rewardRedemption.point_cost_snapshot} points
            {rewardRedemption.requested_at_date ? ` on ${formatDateTime(rewardRedemption.requested_at_date)}` : ''}.
          </p>
          {rewardRedemption.fulfillment_terms_snapshot ? (
            <p className="mt-2 text-[12px] font-body leading-5 text-[rgba(238,234,248,0.46)]">
              Snapshot: {rewardRedemption.fulfillment_terms_snapshot}
            </p>
          ) : null}
          {rewardRedemption.reward_type_snapshot !== RewardCatalogItemTypes.BUILT_IN ? (
            <p className="mt-2 text-[12px] font-body leading-5 text-[rgba(238,234,248,0.46)]">
              Stock snapshot: {rewardRedemption.available_quantity_snapshot}/{rewardRedemption.stock_quantity_snapshot} available when requested.
            </p>
          ) : null}
        </div>

        {(rewardRedemption.status === RewardRedemptionStatuses.REQUESTED || rewardRedemption.status === RewardRedemptionStatuses.APPROVED) ? (
          <div className="flex flex-wrap items-center gap-3">
            {rewardRedemption.status === RewardRedemptionStatuses.REQUESTED ? (
              <>
                <ActionButton
                  tone="light"
                  disabled={isRewardReadOnly || reviewingRewardId === rewardRedemption.id}
                  onClick={() => handleRewardRedemptionAction(rewardRedemption.id, 'reject')}
                >
                  {reviewingRewardId === rewardRedemption.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  Reject
                </ActionButton>
                <ActionButton
                  tone="light"
                  disabled={isRewardReadOnly || reviewingRewardId === rewardRedemption.id}
                  onClick={() => handleRewardRedemptionAction(rewardRedemption.id, 'approve')}
                >
                  {reviewingRewardId === rewardRedemption.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Approve
                </ActionButton>
              </>
            ) : null}
            <ActionButton
              tone="light"
              disabled={isRewardReadOnly || reviewingRewardId === rewardRedemption.id}
              onClick={() => handleRewardRedemptionAction(rewardRedemption.id, 'cancel')}
            >
              {reviewingRewardId === rewardRedemption.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Cancel
            </ActionButton>
            <ActionButton
              disabled={isRewardReadOnly || reviewingRewardId === rewardRedemption.id}
              onClick={() => handleRewardRedemptionAction(rewardRedemption.id, 'fulfill')}
            >
              {reviewingRewardId === rewardRedemption.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              Fulfill
            </ActionButton>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="op-page">
        <div className="op-shell flex min-h-[360px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#cbb7fb]" />
        </div>
      </div>
    );
  }

  return (
    <div className="op-page">
      <div className="op-proto-shell op-chores-shell">
        <div className="op-proto-topbar">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[14px] font-label text-white">
              <ListTodo className="h-3.5 w-3.5 text-[#b8adff]" />
              Chores
              <span className="text-[10px] font-normal text-[rgba(238,234,248,0.42)]">
                {isSectionDashboard ? 'Overview' : (resolvedDashboardFeaturesById?.[activeChoresFeatureId]?.label || 'Detail')}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Link to={`/dashboard/${dashboardFeaturesById[DASHBOARD_CHORES_CHILD_FEATURE_IDS.WEEKLY_CHORES].path}`} className="op-proto-btn">
              <Plus className="h-3.5 w-3.5" />
              Add chore
            </Link>
            <Link to={`/dashboard/${dashboardFeaturesById[DASHBOARD_CHORES_CHILD_FEATURE_IDS.ALLOWANCE].path}`} className="op-proto-btn">
              <CheckCircle2 className="h-3.5 w-3.5" />
              View allowance
            </Link>
            <Link to={`/dashboard/${dashboardFeaturesById[DASHBOARD_CHORES_CHILD_FEATURE_IDS.REWARDS].path}`} className="op-proto-btn op-proto-btn-primary">
              <Gift className="h-3.5 w-3.5" />
              Rewards
            </Link>
          </div>
        </div>
        <div className="op-chores-subbar">
          <div className="op-report-chip-row">
            <Link
              to={`/dashboard/${dashboardFeaturesById.chores.path}`}
              className={`op-report-chip ${isSectionDashboard ? 'is-active' : ''}`}
            >
              Overview
            </Link>
            {choresDashboardLaunchCards.map((card) => {
              const feature = resolvedChoresChildFeaturesById[card.featureId];

              return (
                <Link
                  key={card.featureId}
                  to={`/dashboard/${feature?.path || dashboardFeaturesById[card.featureId].path}`}
                  className={`op-report-chip ${activeChoresFeatureId === card.featureId ? 'is-active' : ''}`}
                >
                  {feature?.label || card.featureId}
                </Link>
              );
            })}
          </div>
          <span className="op-chores-notice">
            Household chore status at a glance
          </span>
        </div>
      <div className="op-chores-body">
        {(isReadOnly || isRoutineReadOnly || isRewardReadOnly) ? (
          <div
            className="op-panel-muted px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#cbb7fb]" />
              <div>
                <p className="op-eyebrow">
                  Read-Only Entitlement State
                </p>
                <p className="op-subtle mt-1 text-[13px] font-body leading-5">
                  {isRoutineReadOnly ? readOnlyMessage : isPaidModuleLocked ? paidModuleReadOnlyMessage : readOnlyMessage}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            className="op-panel-muted px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#cbb7fb]" />
              <div>
                <p className="op-eyebrow">
                  Data Load Warning
                </p>
                <p className="op-subtle mt-1 text-[13px] font-body leading-5">
                  Some chores data did not load cleanly. Existing records remain visible where available, but refresh before making large edits.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {isSectionDashboard ? (
          <>
            <section className="op-chores-stats-grid">
              {[
                ...summaryCards,
                {
                  label: 'Rewards',
                  value: openRewardRequestCards.length,
                  detail: `${activeParentRewardCards.length} active parent reward${activeParentRewardCards.length === 1 ? '' : 's'}.`,
                },
              ].map((card, index) => (
                <button
                  key={card.label}
                  type="button"
                  className="op-chores-stat-card"
                  style={{
                    borderLeftColor: ['#7c6fd4', '#0f9e7a', '#185fa5', '#f59e0b', '#993556'][index] || '#7c6fd4',
                  }}
                >
                  <span className="op-chores-stat-label">{card.label}</span>
                  <span className="op-chores-stat-value">{card.value}</span>
                  <span className="op-chores-stat-sub">{card.detail}</span>
                </button>
              ))}
            </section>

            <section className="op-chores-actions-grid">
              {choresDashboardLaunchCards.map((card, index) => {
                const feature = resolvedChoresChildFeaturesById[card.featureId];
                const Icon = card.icon;

                return (
                  <Link
                    key={card.featureId}
                    to={`/dashboard/${feature?.path || dashboardFeaturesById[card.featureId].path}`}
                    className="op-chores-nav-card"
                    style={{
                      borderLeftColor: ['#ba7517', '#0f9e7a', '#185fa5', '#3b8c11', '#993556'][index] || '#7c6fd4',
                    }}
                  >
                    <span className="op-chores-nav-top">
                      <span className="op-chores-nav-icon"><Icon className="h-3.5 w-3.5" /></span>
                      <span className="op-chores-nav-name">{feature?.label || card.featureId}</span>
                      {feature?.isLocked ? <Lock className="h-3 w-3 text-[rgba(238,234,248,0.42)]" /> : null}
                    </span>
                    <span className="op-chores-nav-sub">{card.description}</span>
                    <span className="op-chores-nav-foot">
                      {card.statValue}
                      <ArrowRight className="ml-auto h-3.5 w-3.5 text-[#b8adff]" />
                    </span>
                  </Link>
                );
              })}
            </section>

            <section className="op-chores-main-grid">
              <div className="op-chores-panel">
                <div className="op-chores-panel-head">
                  <p className="op-chores-panel-title">
                    <Users className="h-3.5 w-3.5" />
                    Student snapshot
                  </p>
                  <p className="op-chores-panel-meta">Household totals</p>
                </div>
                <div className="op-chores-student-list">
                  {progressCards.length === 0 ? (
                    <div className="px-3 py-8 text-center text-[11px] text-[rgba(238,234,248,0.42)]">
                      Add students to see chores progress.
                    </div>
                  ) : progressCards.map((progressCard) => {
                    const routineTotal = Number(progressCard.quotas?.required_routine_days || 0);
                    const weeklyTotal = Number(progressCard.quotas?.required_weekly_chore_blocks || 0);
                    const monthlyTotal = Number(progressCard.quotas?.required_monthly_chore_blocks || 0);
                    const completed = Number(progressCard.progress?.routine_days_completed || 0)
                      + Number(progressCard.progress?.weekly_blocks_completed || 0)
                      + Number(progressCard.progress?.monthly_blocks_completed || 0);
                    const target = routineTotal + weeklyTotal + monthlyTotal;
                    const pct = target > 0 ? Math.round((completed / target) * 100) : 0;

                    return (
                      <button
                        key={progressCard.student_id}
                        type="button"
                        className={`op-chores-student-row ${selectedChoresOverviewStudent?.student_id === progressCard.student_id ? 'is-selected' : ''}`}
                        onClick={() => setSelectedChoresOverviewStudentId(progressCard.student_id)}
                      >
                        <span className="op-chores-student-main">
                          <span className="op-chores-student-top">
                            <span className="op-chores-dot" />
                            <span className="op-chores-student-name">{progressCard.student_name}</span>
                            <span className="op-report-chip is-static">{progressCard.pending_review_count || 0} review</span>
                          </span>
                          <span className="op-chores-student-meta">
                            <span>{progressCard.active_routine_count || 0} routines</span>
                            <span>{progressCard.available_counts?.weekly || 0} weekly</span>
                            <span>{progressCard.available_counts?.monthly || 0} monthly</span>
                          </span>
                          <span className="op-chores-line"><span style={{ width: `${Math.min(100, pct)}%` }} /></span>
                        </span>
                        <span className="op-chores-score">
                          <strong>{pct}%</strong>
                          <span>target</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="op-chores-panel">
                <div className="op-chores-panel-head">
                  <p className="op-chores-panel-title">
                    <ListTodo className="h-3.5 w-3.5" />
                    Focused student
                  </p>
                  <p className="op-chores-panel-meta">Live summary</p>
                </div>
                <div className="op-chores-focus-top">
                  <p className="op-chores-focus-name">
                    <span className="op-chores-dot" />
                    {selectedChoresStudentName}
                  </p>
                  <p className="op-chores-focus-sub">
                    Review routines, pool availability, allowance status, and reward requests from one compact household surface.
                  </p>
                  <div className="op-chores-focus-stats">
                    <div><span>Routines</span><strong>{selectedChoresOverviewStudent?.active_routine_count || 0}</strong></div>
                    <div><span>Weekly</span><strong>{selectedChoresOverviewStudent?.available_counts?.weekly || 0}</strong></div>
                    <div><span>Monthly</span><strong>{selectedChoresOverviewStudent?.available_counts?.monthly || 0}</strong></div>
                    <div><span>Review</span><strong>{selectedChoresOverviewStudent?.pending_review_count || 0}</strong></div>
                  </div>
                </div>
                <div className="op-chores-focus-strip">
                  <span className="op-report-chip is-active">All</span>
                  <span className="op-report-chip is-static">Approvals</span>
                  <span className="op-report-chip is-static">Allowance</span>
                  <span className="op-report-chip is-static">Rewards</span>
                </div>
                <div className="op-chores-activity">
                  {overviewActivityCards.length === 0 ? (
                    <div className="px-3 py-8 text-center text-[11px] text-[rgba(238,234,248,0.42)]">
                      No chores activity is waiting for review.
                    </div>
                  ) : overviewActivityCards.map((activity) => (
                    <div key={activity.id} className={`op-chores-activity-row ${activity.tone}`}>
                      <span className="op-chores-activity-icon">
                        {activity.tone === 'reward' ? <Gift className="h-3.5 w-3.5" /> : activity.tone === 'money' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="op-chores-activity-title">{activity.title}</span>
                        <span className="op-chores-activity-detail">{activity.detail}</span>
                        <span className="op-chores-activity-meta">{activity.meta}</span>
                      </span>
                      <span className="op-chores-activity-action">{activity.action}</span>
                    </div>
                  ))}
                </div>
                <div className="op-chores-focus-footer">
                  <span>{filteredPendingReview.length} approval item{filteredPendingReview.length === 1 ? '' : 's'} and {openRewardRequestCards.length} reward request{openRewardRequestCards.length === 1 ? '' : 's'} are open.</span>
                  <span className="op-report-chip is-warn">{allowanceSummary.unpaid_count || 0} unpaid</span>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {isDailyRoutinesRoute ? (
        <SectionCard colors={colors}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            {buildSectionTitle(
              'Daily Routines',
              'Grouped routine templates stay household-wide by default and can still be narrowed to specific students.',
              Sparkles,
              colors
            )}
            <ActionButton
              disabled={isRoutineReadOnly}
              onClick={() => {
                setRoutineDraft(createDefaultRoutineTemplateDraft());
                setShowRoutineEditor(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Routine
            </ActionButton>
          </div>

          {showRoutineEditor ? (
            <form
              className="op-surface mt-6 p-5"
              onSubmit={handleSaveRoutine}
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-4">
                  <div>
                    <label className={labelClassName}>Routine Title</label>
                    <input
                      className={inputClassName}
                      style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                      value={routineDraft.title}
                      disabled={isRoutineReadOnly || savingRoutine}
                      onChange={(event) => setRoutineDraft((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Morning Routine"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label className={labelClassName}>All Students</label>
                      <Toggle
                        checked={routineDraft.assign_to_all_students}
                        disabled={isRoutineReadOnly || savingRoutine}
                        onChange={(checked) => setRoutineDraft((prev) => ({
                          ...prev,
                          assign_to_all_students: checked,
                          student_ids: checked ? [] : prev.student_ids,
                        }))}
                      />
                    </div>
                    <p className="op-subtle text-[12px] font-body leading-5">
                      New routines default to all students. Turn this off to assign specific students only.
                    </p>
                  </div>

                  {!routineDraft.assign_to_all_students ? (
                    <div>
                      <label className={labelClassName}>Assigned Students</label>
                      <div className="space-y-2 border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] p-3">
                        {students.length === 0 ? (
                          <p className="op-subtle text-[13px] font-body">Add students first to narrow assignments.</p>
                        ) : (
                          students.map((student) => (
                            <label key={student.id} className="flex items-center gap-3 text-[13px] font-body text-[rgba(238,234,248,0.76)]">
                              <input
                                type="checkbox"
                                checked={routineDraft.student_ids.includes(student.id)}
                                disabled={isRoutineReadOnly || savingRoutine}
                                onChange={(event) => setRoutineDraft((prev) => ({
                                  ...prev,
                                  student_ids: event.target.checked
                                    ? [...prev.student_ids, student.id]
                                    : prev.student_ids.filter((studentId) => studentId !== student.id),
                                }))}
                              />
                              <span>{student.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelClassName}>Checklist</label>
                    <div className="space-y-2">
                      {routineDraft.checklist_items.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <input
                            className={inputClassName}
                            style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                            value={item.label}
                            disabled={isRoutineReadOnly || savingRoutine}
                            onChange={(event) => handleRoutineChecklistChange(index, event.target.value)}
                            placeholder={`Checklist item ${index + 1}`}
                          />
                          <button
                            type="button"
                            disabled={isRoutineReadOnly || savingRoutine || routineDraft.checklist_items.length === 1}
                            className="op-button op-button-secondary min-h-[40px] px-3 py-2 text-[12px] disabled:cursor-not-allowed"
                            onClick={() => setRoutineDraft((prev) => ({
                              ...prev,
                              checklist_items: prev.checklist_items.filter((_, itemIndex) => itemIndex !== index),
                            }))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={isRoutineReadOnly || savingRoutine}
                      className="mt-3 text-[12px] font-label text-[#cbb7fb]"
                      onClick={() => setRoutineDraft((prev) => ({
                        ...prev,
                        checklist_items: [
                          ...prev.checklist_items,
                          { id: `item_${prev.checklist_items.length + 1}`, label: '' },
                        ],
                      }))}
                    >
                      + Add checklist item
                    </button>
                  </div>

                  <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="op-eyebrow">
                          Allowance Eligible
                        </p>
                        <p className="op-subtle mt-2 text-[13px] font-body leading-5">
                          Count this routine toward allowance only when the household allowance policy also includes routines.
                        </p>
                      </div>
                      <Toggle
                        checked={routineDraft.counts_toward_allowance}
                        disabled={isReadOnly || savingRoutine}
                        onChange={(checked) => setRoutineDraft((prev) => ({
                          ...prev,
                          counts_toward_allowance: checked,
                        }))}
                      />
                    </div>
                  </div>

                  <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="op-eyebrow">
                          Point Eligible
                        </p>
                        <p className="op-subtle mt-2 text-[13px] font-body leading-5">
                          This routine can award points only when household routine point settings are also enabled.
                        </p>
                      </div>
                      <Toggle
                        checked={routineDraft.counts_toward_points}
                        disabled={isReadOnly || savingRoutine}
                        onChange={(checked) => setRoutineDraft((prev) => ({
                          ...prev,
                          counts_toward_points: checked,
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                <ActionButton tone="light" disabled={savingRoutine} onClick={resetRoutineEditor}>
                  Cancel
                </ActionButton>
                <ActionButton type="submit" disabled={savingRoutine || isRoutineReadOnly}>
                  {savingRoutine ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Routine
                </ActionButton>
              </div>
            </form>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {activeRoutineCards.length > 0 ? (
              activeRoutineCards.map(renderRoutineCard)
            ) : (
              <div className="lg:col-span-2">
                <EmptyState
                  colors={colors}
                  icon={Sparkles}
                  title="No daily routines yet"
                  detail="Create grouped routines like morning or evening checklists without turning every repeated task into a separate chore."
                />
              </div>
            )}
          </div>

          {archivedRoutineCards.length > 0 ? (
            <div className="mt-6">
              <p className="op-eyebrow mb-3">
                Archived Routines
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                {archivedRoutineCards.map(renderRoutineCard)}
              </div>
            </div>
          ) : null}
        </SectionCard>
        ) : null}

        {visibleChorePoolSections.map((section) => (
          <SectionCard key={section.pool} colors={colors}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              {buildSectionTitle(section.title, section.description, ListTodo, colors)}
              <ActionButton
                disabled={isReadOnly}
                onClick={() => {
                  setChoreDraft(createDefaultChoreDefinitionDraft(section.pool));
                  setShowChoreEditor(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add {section.pool === ChoreFrequencyPools.MONTHLY ? 'Monthly' : 'Weekly'} Chore
              </ActionButton>
            </div>

            {showChoreEditor && choreDraft.frequency_pool === section.pool ? (
              <form
                className="op-surface mt-6 p-5"
                onSubmit={handleSaveChore}
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className={labelClassName}>Chore Title</label>
                      <input
                        className={inputClassName}
                        style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                        value={choreDraft.title}
                        disabled={isReadOnly || savingChore}
                        onChange={(event) => setChoreDraft((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="Wipe counters"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <label className={labelClassName}>All Students Eligible</label>
                        <Toggle
                          checked={choreDraft.all_students_eligible}
                          disabled={isReadOnly || savingChore}
                          onChange={(checked) => setChoreDraft((prev) => ({
                            ...prev,
                            all_students_eligible: checked,
                            eligible_student_ids: checked ? [] : prev.eligible_student_ids,
                          }))}
                        />
                      </div>
                      <p className="op-subtle text-[12px] font-body leading-5">
                        Leave chores shared across the household, or narrow them to selected students only.
                      </p>
                    </div>

                    {!choreDraft.all_students_eligible ? (
                      <div>
                        <label className={labelClassName}>Eligible Students</label>
                        <div className="space-y-2 border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] p-3">
                          {students.length === 0 ? (
                            <p className="op-subtle text-[13px] font-body">Add students first to assign eligibility.</p>
                          ) : (
                            students.map((student) => (
                              <label key={student.id} className="flex items-center gap-3 text-[13px] font-body text-[rgba(238,234,248,0.76)]">
                                <input
                                  type="checkbox"
                                  checked={choreDraft.eligible_student_ids.includes(student.id)}
                                  disabled={isReadOnly || savingChore}
                                  onChange={(event) => setChoreDraft((prev) => ({
                                    ...prev,
                                    eligible_student_ids: event.target.checked
                                      ? [...prev.eligible_student_ids, student.id]
                                      : prev.eligible_student_ids.filter((studentId) => studentId !== student.id),
                                  }))}
                                />
                                <span>{student.name}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClassName}>Cooldown (Days)</label>
                        <input
                          type="number"
                          min="0"
                          max="365"
                          className={inputClassName}
                          style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                          value={choreDraft.minimum_cooldown_days}
                          disabled={isReadOnly || savingChore}
                          onChange={(event) => setChoreDraft((prev) => ({
                            ...prev,
                            minimum_cooldown_days: event.target.value,
                          }))}
                        />
                      </div>
                      <div>
                        <label className={labelClassName}>Effort Label</label>
                        <input
                          className={inputClassName}
                          style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                          value={choreDraft.effort_label}
                          disabled={isReadOnly || savingChore}
                          onChange={(event) => setChoreDraft((prev) => ({ ...prev, effort_label: event.target.value }))}
                          placeholder="Quick, Medium, Deep Clean"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-4 py-3">
                      <div>
                        <p className="op-eyebrow">
                          Parent Review
                        </p>
                        <p className="op-subtle mt-2 text-[13px] font-body leading-5">
                          Keep auto-approval for routine chores, or require manual review for anything that needs inspection.
                        </p>
                      </div>
                      <Toggle
                        checked={choreDraft.requires_parent_approval}
                        disabled={isReadOnly || savingChore}
                        onChange={(checked) => setChoreDraft((prev) => ({
                          ...prev,
                          requires_parent_approval: checked,
                        }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={labelClassName}>Instructions</label>
                      <textarea
                        className={textareaClassName}
                        style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                        value={choreDraft.instructions}
                        disabled={isReadOnly || savingChore}
                        onChange={(event) => setChoreDraft((prev) => ({ ...prev, instructions: event.target.value }))}
                        placeholder="What should the student do?"
                      />
                    </div>

                    <div>
                      <label className={labelClassName}>Definition Of Done</label>
                      <textarea
                        className={textareaClassName}
                        style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                        value={choreDraft.definition_of_done}
                        disabled={isReadOnly || savingChore}
                        onChange={(event) => setChoreDraft((prev) => ({ ...prev, definition_of_done: event.target.value }))}
                        placeholder="What counts as complete?"
                      />
                    </div>

                    <div>
                      <label className={labelClassName}>Proof Requirement</label>
                      <textarea
                        className={`${inputClassName} min-h-[72px] resize-y`}
                        style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                        value={choreDraft.proof_requirement}
                        disabled={isReadOnly || savingChore}
                        onChange={(event) => setChoreDraft((prev) => ({ ...prev, proof_requirement: event.target.value }))}
                        placeholder="Optional note for future photo or written proof."
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                  <ActionButton tone="light" disabled={savingChore} onClick={resetChoreEditor}>
                    Cancel
                  </ActionButton>
                  <ActionButton type="submit" disabled={savingChore || isReadOnly}>
                    {savingChore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Chore
                  </ActionButton>
                </div>
              </form>
            ) : null}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {section.cards.length > 0 ? (
                section.cards.map(renderChoreCard)
              ) : (
                <div className="lg:col-span-2">
                  <EmptyState
                    colors={colors}
                    icon={ListTodo}
                    title={`No ${section.pool} chores yet`}
                    detail={`Add ${section.pool} chores to build a shared pool students can claim from without fixed day-by-day assignments.`}
                  />
                </div>
              )}
            </div>

            {section.archivedCards.length > 0 ? (
              <div className="mt-6">
                <p className="op-eyebrow mb-3">
                  Archived {section.title}
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  {section.archivedCards.map(renderChoreCard)}
                </div>
              </div>
            ) : null}
          </SectionCard>
        ))}

        {isAllowanceRoute ? (
        <SectionCard colors={colors}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            {buildSectionTitle(
              'Quotas And Allowance',
              'Configure claim timing, per-student quota targets, and the allowance policy that turns completed blocks into bookkeeping totals.',
              Settings2,
              colors
            )}
            <ActionButton type="submit" disabled={savingSettings || isReadOnly} onClick={handleSaveSettings}>
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </ActionButton>
          </div>

          <form className="mt-6 space-y-6" onSubmit={handleSaveSettings}>
            <div className="grid gap-4 lg:grid-cols-4">
              <div>
                <label className={labelClassName}>Claim Window (Hours)</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  className={inputClassName}
                  style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                  value={settingsDraft.claim_expiration_hours}
                  disabled={isReadOnly || savingSettings}
                  onChange={(event) => setSettingsDraft((prev) => ({
                    ...prev,
                    claim_expiration_hours: event.target.value,
                  }))}
                />
              </div>
              <div>
                <label className={labelClassName}>Week Reset Day</label>
                <select
                  className={inputClassName}
                  style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                  value={settingsDraft.week_reset_day}
                  disabled={isReadOnly || savingSettings}
                  onChange={(event) => setSettingsDraft((prev) => ({
                    ...prev,
                    week_reset_day: event.target.value,
                  }))}
                >
                  {RESET_DAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>Reset Hour</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  className={inputClassName}
                  style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                  value={settingsDraft.week_reset_hour}
                  disabled={isReadOnly || savingSettings}
                  onChange={(event) => setSettingsDraft((prev) => ({
                    ...prev,
                    week_reset_hour: event.target.value,
                  }))}
                />
              </div>
              <div>
                <label className={labelClassName}>Reset Minute</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  className={inputClassName}
                  style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                  value={settingsDraft.week_reset_minute}
                  disabled={isReadOnly || savingSettings}
                  onChange={(event) => setSettingsDraft((prev) => ({
                    ...prev,
                    week_reset_minute: event.target.value,
                  }))}
                />
              </div>
            </div>

            <div>
              <label className={labelClassName}>Timezone</label>
              <input
                className={inputClassName}
                style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                value={settingsDraft.timezone}
                disabled={isReadOnly || savingSettings}
                onChange={(event) => setSettingsDraft((prev) => ({
                  ...prev,
                  timezone: event.target.value,
                }))}
                placeholder="America/Chicago"
              />
            </div>

            <div className="op-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="op-eyebrow">
                    Allowance Policy
                  </p>
                  <p className="op-subtle mt-2 text-[13px] font-body leading-5">
                    Base allowance is capped at 100% of the configured amount in this phase. No bonus or overage behavior is added yet.
                  </p>
                </div>
                <div className="op-pill">
                  Trusted ledger
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div>
                  <label className={labelClassName}>Period</label>
                  <select
                    className={inputClassName}
                    style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                    value={settingsDraft.allowance_policy?.period_type || 'weekly'}
                    disabled={isReadOnly || savingSettings}
                    onChange={(event) => setSettingsDraft((prev) => ({
                      ...prev,
                      allowance_policy: {
                        ...prev.allowance_policy,
                        period_type: event.target.value,
                      },
                    }))}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className={labelClassName}>Allowance Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClassName}
                    style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                    value={settingsDraft.allowance_policy?.allowance_amount ?? 0}
                    disabled={isReadOnly || savingSettings}
                    onChange={(event) => setSettingsDraft((prev) => ({
                      ...prev,
                      allowance_policy: {
                        ...prev.allowance_policy,
                        allowance_amount: event.target.value,
                      },
                    }))}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Completion Policy</label>
                  <select
                    className={inputClassName}
                    style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                    value={settingsDraft.allowance_policy?.completion_policy || 'all_or_nothing'}
                    disabled={isReadOnly || savingSettings}
                    onChange={(event) => setSettingsDraft((prev) => ({
                      ...prev,
                      allowance_policy: {
                        ...prev.allowance_policy,
                        completion_policy: event.target.value,
                      },
                    }))}
                  >
                    <option value="all_or_nothing">All-or-nothing</option>
                    <option value="prorated">Prorated</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-4 py-3">
                <div>
                  <p className="op-eyebrow">
                    Include Routine Days
                  </p>
                  <p className="op-subtle mt-2 text-[13px] font-body leading-5">
                    Only routine completions on templates marked allowance-eligible will count here.
                  </p>
                </div>
                <Toggle
                  checked={settingsDraft.allowance_policy?.include_routines === true}
                  disabled={isReadOnly || savingSettings}
                  onChange={(checked) => setSettingsDraft((prev) => ({
                    ...prev,
                    allowance_policy: {
                      ...prev.allowance_policy,
                      include_routines: checked,
                    },
                  }))}
                />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {progressCards.length > 0 ? (
                progressCards.map((progressCard) => {
                  const draftQuota = settingsDraft.quotas?.[progressCard.student_id] || {
                    required_routine_days: 0,
                    required_weekly_chore_blocks: 0,
                    required_monthly_chore_blocks: 0,
                  };

                  return (
                    <div
                      key={progressCard.student_id}
                      className="op-surface p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-[17px] font-display text-white">{progressCard.student_name}</h4>
                          <p className="op-subtle mt-1 text-[13px] font-body leading-5">
                            {progressCard.active_routine_count} active routine{progressCard.active_routine_count === 1 ? '' : 's'} • {progressCard.pending_review_count} pending review
                          </p>
                        </div>
                        <div className="op-pill">
                          Available now: {progressCard.available_counts.weekly} weekly / {progressCard.available_counts.monthly} monthly
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className={labelClassName}>Routine Days</label>
                          <input
                            type="number"
                            min="0"
                            className={inputClassName}
                            style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                            value={draftQuota.required_routine_days}
                            disabled={isReadOnly || savingSettings}
                            onChange={(event) => setSettingsDraft((prev) => ({
                              ...prev,
                              quotas: {
                                ...prev.quotas,
                                [progressCard.student_id]: {
                                  ...prev.quotas?.[progressCard.student_id],
                                  required_routine_days: event.target.value,
                                },
                              },
                            }))}
                          />
                        </div>
                        <div>
                          <label className={labelClassName}>Weekly Blocks</label>
                          <input
                            type="number"
                            min="0"
                            className={inputClassName}
                            style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                            value={draftQuota.required_weekly_chore_blocks}
                            disabled={isReadOnly || savingSettings}
                            onChange={(event) => setSettingsDraft((prev) => ({
                              ...prev,
                              quotas: {
                                ...prev.quotas,
                                [progressCard.student_id]: {
                                  ...prev.quotas?.[progressCard.student_id],
                                  required_weekly_chore_blocks: event.target.value,
                                },
                              },
                            }))}
                          />
                        </div>
                        <div>
                          <label className={labelClassName}>Monthly Blocks</label>
                          <input
                            type="number"
                            min="0"
                            className={inputClassName}
                            style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                            value={draftQuota.required_monthly_chore_blocks}
                            disabled={isReadOnly || savingSettings}
                            onChange={(event) => setSettingsDraft((prev) => ({
                              ...prev,
                              quotas: {
                                ...prev.quotas,
                                [progressCard.student_id]: {
                                  ...prev.quotas?.[progressCard.student_id],
                                  required_monthly_chore_blocks: event.target.value,
                                },
                              },
                            }))}
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
                          <p className="op-eyebrow">This Week</p>
                          <p className="mt-2 text-[15px] font-display text-white">
                            {progressCard.progress.routine_days_completed}/{progressCard.quotas.required_routine_days}
                          </p>
                          <p className="op-subtle mt-1 text-[12px] font-body leading-5">Routine days completed</p>
                        </div>
                        <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
                          <p className="op-eyebrow">Weekly Pool</p>
                          <p className="mt-2 text-[15px] font-display text-white">
                            {progressCard.progress.weekly_blocks_completed}/{progressCard.quotas.required_weekly_chore_blocks}
                          </p>
                          <p className="op-subtle mt-1 text-[12px] font-body leading-5">Blocks completed this week</p>
                        </div>
                        <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
                          <p className="op-eyebrow">Monthly Pool</p>
                          <p className="mt-2 text-[15px] font-display text-white">
                            {progressCard.progress.monthly_blocks_completed}/{progressCard.quotas.required_monthly_chore_blocks}
                          </p>
                          <p className="op-subtle mt-1 text-[12px] font-body leading-5">Blocks completed this month</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="xl:col-span-2">
                  <EmptyState
                    colors={colors}
                    icon={Users}
                    title="No students available yet"
                    detail="Add students to configure per-student quotas and see progress summaries."
                  />
                </div>
              )}
            </div>

            <div
              className="op-panel-muted px-4 py-4"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#cbb7fb]" />
                <div className="min-w-0 flex-1">
                  <p className="op-eyebrow">
                    Advisory Capacity Warnings
                  </p>
                  <p className="op-subtle mt-2 text-[13px] font-body leading-5">
                    Quota warnings do not block saving in this MVP. They flag when the current active pool cannot fully satisfy configured weekly or monthly demand.
                  </p>
                  {quotaWarnings.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {quotaWarnings.map((warning) => (
                        <div key={warning.id} className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
                          <p className="text-[13px] font-display text-white">{warning.title}</p>
                          <p className="op-subtle mt-1 text-[12px] font-body leading-5">{warning.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="op-subtle mt-3 text-[12px] font-body leading-5">
                      The current active chore pools can satisfy the configured quota demand for all visible students.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </form>
        </SectionCard>
        ) : null}

        {isAllowanceRoute ? (
        <SectionCard colors={colors}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            {buildSectionTitle(
              'Allowance Ledger',
              'Trusted current-period totals, manual parent adjustments, and paid-out bookkeeping live here. Money movement still happens outside the app.',
              Settings2,
              colors
            )}
            <ActionButton
              tone="light"
              disabled={isReadOnly || syncingAllowance}
              onClick={handleSyncAllowance}
            >
              {syncingAllowance ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Refresh Ledger
            </ActionButton>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <SummaryCard
              colors={colors}
              label="Period"
              value={allowancePeriod.period_type ? allowancePeriod.period_type.replace('_', ' ') : 'Not set'}
              detail={allowancePeriod.period_label || 'Save allowance settings to start tracking a current period.'}
            />
            <SummaryCard
              colors={colors}
              label="Adjusted Owed"
              value={formatCurrency(allowanceSummary.remaining_total || 0)}
              detail={`${allowanceSummary.unpaid_count || 0} student allowance balance${allowanceSummary.unpaid_count === 1 ? '' : 's'} still open.`}
            />
            <SummaryCard
              colors={colors}
              label="Recorded Paid"
              value={formatCurrency(allowanceSummary.paid_total || 0)}
              detail={`${allowanceSummary.paid_count || 0} student period${allowanceSummary.paid_count === 1 ? '' : 's'} currently settled.`}
            />
            <SummaryCard
              colors={colors}
              label="Sync Status"
              value={`${allowanceSummary.synced_count || 0}/${allowanceSummary.student_count || 0}`}
              detail={allowanceSummary.unsynced_count
                ? `${allowanceSummary.unsynced_count} student record${allowanceSummary.unsynced_count === 1 ? '' : 's'} still need a trusted sync.`
                : 'Current-period allowance entries are synced for all visible students.'}
            />
          </div>

          <div className="mt-6 space-y-4">
            {allowanceCards.length > 0 ? (
              allowanceCards.map(renderAllowanceCard)
            ) : (
              <EmptyState
                colors={colors}
                icon={Clock3}
                title="No allowance records yet"
                detail="Add an allowance policy and refresh the ledger after students have chores or routines to track."
              />
            )}
          </div>
        </SectionCard>
        ) : null}

        {isRewardsRoute ? (
        <SectionCard colors={colors}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            {buildSectionTitle(
              'Points And Wallet',
              'Keep point economics explicit and conservative. Trusted server logic writes append-only ledger entries and keeps one shared wallet per student. Automatic school-block awards stay deferred until school completion moves onto a trusted path.',
              Sparkles,
              colors
            )}
            <ActionButton type="submit" disabled={savingPointSettings || isRewardReadOnly} onClick={handleSavePointSettings}>
              {savingPointSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Point Settings
            </ActionButton>
          </div>

          <form className="mt-6 space-y-6" onSubmit={handleSavePointSettings}>
            <div className="grid gap-4 lg:grid-cols-4">
              <div>
                <label className={labelClassName}>School Block Points</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClassName}
                  style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                  value={pointSettingsDraft.school_block_points}
                  disabled={isRewardReadOnly || savingPointSettings}
                  onChange={(event) => setPointSettingsDraft((prev) => ({
                    ...prev,
                    school_block_points: event.target.value,
                  }))}
                />
                <p className="op-subtle mt-1 text-[12px] font-body leading-5">
                  Saved now for future trusted school completion awards. Public submission writes do not mint points.
                </p>
              </div>
              <div>
                <label className={labelClassName}>Chore Block Points</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClassName}
                  style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                  value={pointSettingsDraft.chore_block_points}
                  disabled={isRewardReadOnly || savingPointSettings}
                  onChange={(event) => setPointSettingsDraft((prev) => ({
                    ...prev,
                    chore_block_points: event.target.value,
                  }))}
                />
              </div>
              <div>
                <label className={labelClassName}>Routine Day Points</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClassName}
                  style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                  value={pointSettingsDraft.routine_day_points}
                  disabled={isRewardReadOnly || savingPointSettings || pointSettingsDraft.routine_points_enabled !== true}
                  onChange={(event) => setPointSettingsDraft((prev) => ({
                    ...prev,
                    routine_day_points: event.target.value,
                  }))}
                />
              </div>
              <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="op-eyebrow">
                      Routine Point Awards
                    </p>
                    <p className="op-subtle mt-2 text-[13px] font-body leading-5">
                      Routine days only award points when this is on and the routine template is marked point-eligible.
                    </p>
                  </div>
                  <Toggle
                    checked={pointSettingsDraft.routine_points_enabled === true}
                    disabled={isRewardReadOnly || savingPointSettings}
                    onChange={(checked) => setPointSettingsDraft((prev) => ({
                      ...prev,
                      routine_points_enabled: checked,
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              <SummaryCard
                colors={colors}
                label="School Award"
                value={pointSettingsDraft.school_block_points || 0}
                detail="Applied once per completed school block source event."
              />
              <SummaryCard
                colors={colors}
                label="Chore Award"
                value={pointSettingsDraft.chore_block_points || 0}
                detail="Applied once when a chore completion reaches its final approved state."
              />
              <SummaryCard
                colors={colors}
                label="Routine Award"
                value={pointSettingsDraft.routine_points_enabled ? pointSettingsDraft.routine_day_points || 0 : 0}
                detail={pointSettingsDraft.routine_points_enabled ? 'Enabled for point-eligible routines only.' : 'Disabled until you turn on routine point awards.'}
              />
              <SummaryCard
                colors={colors}
                label="Visible Wallets"
                value={totalVisibleWalletPoints}
                detail={`${pointWalletCards.length} student wallet${pointWalletCards.length === 1 ? '' : 's'} in the current household view.`}
              />
            </div>
          </form>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {pointWalletCards.length > 0 ? (
              pointWalletCards.map((walletCard) => (
                <div
                  key={walletCard.student_id}
                  className="op-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-[17px] font-display text-white">{walletCard.student_name}</h4>
                      <p className="op-subtle mt-1 text-[13px] font-body leading-5">
                        {walletCard.updated_at ? `Wallet updated ${walletCard.updated_at.toLocaleString()}` : 'No trusted point awards or adjustments have been saved yet.'}
                      </p>
                    </div>
                    <div className="op-pill">
                      Append-only ledger
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
                      <p className="op-eyebrow">Current Balance</p>
                      <p className="mt-2 text-[18px] font-display text-white">{walletCard.total_points}</p>
                    </div>
                    <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
                      <p className="op-eyebrow">Lifetime Earned</p>
                      <p className="mt-2 text-[18px] font-display text-white">{walletCard.lifetime_points}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                    <div>
                      <label className={labelClassName}>Manual Adjustment</label>
                      <input
                        type="number"
                        step="1"
                        className={inputClassName}
                        style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                        value={pointAdjustmentDrafts[walletCard.student_id] ?? ''}
                        disabled={isRewardReadOnly || pointBusyStudentId === walletCard.student_id}
                        onChange={(event) => setPointAdjustmentDrafts((prev) => ({
                          ...prev,
                          [walletCard.student_id]: event.target.value,
                        }))}
                        placeholder="+5 or -5"
                      />
                      <p className="op-subtle mt-1 text-[12px] font-body leading-5">
                        Saved as a separate ledger entry. Negative entries cannot push the wallet below zero.
                      </p>
                    </div>
                    <div>
                      <label className={labelClassName}>Adjustment Note</label>
                      <textarea
                        className={`${inputClassName} min-h-[72px] resize-y`}
                        style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                        value={pointAdjustmentNotes[walletCard.student_id] ?? ''}
                        disabled={isRewardReadOnly || pointBusyStudentId === walletCard.student_id}
                        onChange={(event) => setPointAdjustmentNotes((prev) => ({
                          ...prev,
                          [walletCard.student_id]: event.target.value,
                        }))}
                        placeholder="Optional note for this manual adjustment."
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="op-pill">
                      Pending entry: {formatSignedPoints(pointAdjustmentDrafts[walletCard.student_id])}
                    </div>
                    <ActionButton
                      disabled={isRewardReadOnly || pointBusyStudentId === walletCard.student_id}
                      onClick={() => handleAdjustPoints(walletCard.student_id)}
                    >
                      {pointBusyStudentId === walletCard.student_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Adjustment
                    </ActionButton>
                  </div>
                </div>
              ))
            ) : (
              <div className="xl:col-span-2">
                <EmptyState
                  colors={colors}
                  icon={Users}
                  title="No students available yet"
                  detail="Add students before configuring point wallets or saving manual adjustments."
                />
              </div>
            )}
          </div>
        </SectionCard>
        ) : null}

        {isRewardsRoute ? (
        <SectionCard colors={colors}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            {buildSectionTitle(
              'Reward Store',
              'Create parent-managed rewards, restock limited inventory, and keep built-in cosmetic placeholders visible without storing final assets or fulfillment secrets.',
              Gift,
              colors
            )}
            <ActionButton
              disabled={isRewardReadOnly}
              onClick={() => {
                setRewardDraft(createDefaultRewardDraft());
                setShowRewardEditor(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Reward
            </ActionButton>
          </div>

          {showRewardEditor ? (
            <form
              className="op-surface mt-6 p-5"
              onSubmit={handleSaveReward}
            >
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className={labelClassName}>Reward Title</label>
                    <input
                      className={inputClassName}
                      style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                      value={rewardDraft.title}
                      disabled={isRewardReadOnly || savingReward}
                      onChange={(event) => setRewardDraft((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Movie night pick"
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>Description</label>
                    <textarea
                      className={textareaClassName}
                      style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                      value={rewardDraft.description}
                      disabled={isRewardReadOnly || savingReward}
                      onChange={(event) => setRewardDraft((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="What the student is redeeming."
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClassName}>Point Cost</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className={inputClassName}
                        style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                        value={rewardDraft.point_cost}
                        disabled={isRewardReadOnly || savingReward}
                        onChange={(event) => setRewardDraft((prev) => ({ ...prev, point_cost: event.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={labelClassName}>{rewardDraft.id ? 'Restock Quantity' : 'Starting Stock'}</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className={inputClassName}
                        style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                        value={rewardDraft.id ? rewardDraft.restock_quantity : rewardDraft.stock_quantity}
                        disabled={isRewardReadOnly || savingReward}
                        onChange={(event) => setRewardDraft((prev) => (
                          rewardDraft.id
                            ? { ...prev, restock_quantity: event.target.value }
                            : { ...prev, stock_quantity: event.target.value }
                        ))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="op-eyebrow">
                          All Students
                        </p>
                        <p className="op-subtle mt-2 text-[13px] font-body leading-5">
                          Leave the reward open household-wide or narrow it to specific students.
                        </p>
                      </div>
                      <Toggle
                        checked={rewardDraft.assign_to_all_students}
                        disabled={isRewardReadOnly || savingReward}
                        onChange={(checked) => setRewardDraft((prev) => ({
                          ...prev,
                          assign_to_all_students: checked,
                          eligible_student_ids: checked ? [] : prev.eligible_student_ids,
                        }))}
                      />
                    </div>
                  </div>

                  {!rewardDraft.assign_to_all_students ? (
                    <div>
                      <label className={labelClassName}>Eligible Students</label>
                      <div className="space-y-2 border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] p-3">
                        {students.map((student) => (
                          <label key={student.id} className="flex items-center gap-3 text-[13px] font-body text-[rgba(238,234,248,0.76)]">
                            <input
                              type="checkbox"
                              checked={rewardDraft.eligible_student_ids.includes(student.id)}
                              disabled={isRewardReadOnly || savingReward}
                              onChange={(event) => setRewardDraft((prev) => ({
                                ...prev,
                                eligible_student_ids: event.target.checked
                                  ? [...prev.eligible_student_ids, student.id]
                                  : prev.eligible_student_ids.filter((studentId) => studentId !== student.id),
                              }))}
                            />
                            <span>{student.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="op-eyebrow">
                          Approval Required
                        </p>
                        <p className="op-subtle mt-2 text-[13px] font-body leading-5">
                          Parent-created requests always reserve points immediately. This toggle only changes whether the request stops in an approval state before fulfillment.
                        </p>
                      </div>
                      <Toggle
                        checked={rewardDraft.redemption_requires_approval}
                        disabled={isRewardReadOnly || savingReward}
                        onChange={(checked) => setRewardDraft((prev) => ({
                          ...prev,
                          redemption_requires_approval: checked,
                        }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClassName}>Fulfillment Terms</label>
                    <textarea
                      className={textareaClassName}
                      style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                      value={rewardDraft.fulfillment_terms}
                      disabled={isRewardReadOnly || savingReward}
                      onChange={(event) => setRewardDraft((prev) => ({ ...prev, fulfillment_terms: event.target.value }))}
                      placeholder="Example: Fulfilled during Friday family time. Do not store gift card codes or payment details."
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                <ActionButton tone="light" disabled={savingReward} onClick={resetRewardEditor}>
                  Cancel
                </ActionButton>
                <ActionButton type="submit" disabled={savingReward || isRewardReadOnly}>
                  {savingReward ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Reward
                </ActionButton>
              </div>
            </form>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <SummaryCard
              colors={colors}
              label="Active Rewards"
              value={activeParentRewardCards.length}
              detail={`${archivedParentRewardCards.length} archived parent-created reward${archivedParentRewardCards.length === 1 ? '' : 's'} kept in catalog history.`}
            />
            <SummaryCard
              colors={colors}
              label="Open Requests"
              value={openRewardRequestCards.length}
              detail="Requested and approved rewards stay here until they are fulfilled, rejected, or canceled."
            />
            <SummaryCard
              colors={colors}
              label="Built-In Unlocks"
              value={builtInRewardCards.length}
              detail="Placeholder avatar, badge, and profile-theme rewards redeem immediately without a parent fulfillment state."
            />
            <SummaryCard
              colors={colors}
              label="Stock Ready"
              value={activeParentRewardCards.reduce((sum, reward) => sum + reward.available_quantity, 0)}
              detail="Available parent-created stock after current reservations."
            />
          </div>

          <div className="op-panel-muted mt-6 px-4 py-4">
            <div className="flex items-start gap-3">
              <Palette className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#cbb7fb]" />
              <div>
                <p className="op-eyebrow">
                  Built-In Placeholder Set
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {builtInRewardCards.map((reward) => (
                    <div key={reward.id} className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
                      <div className="flex items-center gap-2">
                        {reward.unlock_type === 'avatar' ? (
                          <Sparkles className="h-4 w-4 text-[#cbb7fb]" />
                        ) : reward.unlock_type === 'badge' ? (
                          <ShieldCheck className="h-4 w-4 text-[#cbb7fb]" />
                        ) : (
                          <Palette className="h-4 w-4 text-[#cbb7fb]" />
                        )}
                        <p className="text-[13px] font-display text-white">{reward.title}</p>
                      </div>
                      <p className="op-subtle mt-2 text-[12px] font-body leading-5">
                        {reward.point_cost} points • {reward.fulfillment_terms}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {activeParentRewardCards.length > 0 ? (
              activeParentRewardCards.map(renderRewardCard)
            ) : (
              <EmptyState
                colors={colors}
                icon={Gift}
                title="No parent-created rewards yet"
                detail="Add stocked rewards like extra screen time, a store item, or a family privilege without storing gift card codes or payment data."
              />
            )}
          </div>

          {archivedParentRewardCards.length > 0 ? (
            <div className="mt-6">
              <p className="op-eyebrow mb-3">
                Archived Rewards
              </p>
              <div className="space-y-4">
                {archivedParentRewardCards.map(renderRewardCard)}
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <p className="op-eyebrow mb-3">
              Redemption Queue
            </p>
            <div className="space-y-4">
              {openRewardRequestCards.length > 0 ? (
                openRewardRequestCards.map(renderRewardRedemptionCard)
              ) : (
                <EmptyState
                  colors={colors}
                  icon={CheckCircle2}
                  title="No reward requests are waiting"
                  detail="Students will land here after a reward request reserves points or an auto-approved reward is waiting for fulfillment."
                />
              )}
            </div>
          </div>

          {closedRewardRequestCards.length > 0 ? (
            <div className="mt-6">
              <p className="op-eyebrow mb-3">
                Recent Reward History
              </p>
              <div className="space-y-4">
                {closedRewardRequestCards.slice(0, 8).map(renderRewardRedemptionCard)}
              </div>
            </div>
          ) : null}
        </SectionCard>
        ) : null}

        {(isWeeklyChoresRoute || isMonthlyChoresRoute) ? (
        <SectionCard colors={colors}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            {buildSectionTitle(
              pendingReviewSectionTitle,
              pendingReviewSectionDescription,
              ShieldAlert,
              colors
            )}
            <div
              className="op-pill"
            >
              {filteredPendingReview.length} pending
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {filteredPendingReview.length > 0 ? (
              filteredPendingReview.map((record) => (
                <div
                  key={record.id}
                  className="op-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-[17px] font-display text-white">{record.chore_title}</h4>
                        <span className="op-pill">
                          {record.frequency_pool}
                        </span>
                        {record.chore_is_archived ? (
                          <span className="op-pill">
                            Archived definition
                          </span>
                        ) : null}
                      </div>
                      <p className="op-subtle mt-2 text-[13px] font-body leading-5">
                        {record.student_name} completed this chore{record.completed_at ? ` on ${record.completed_at.toLocaleString()}` : ''}.
                      </p>
                      {record.proof_note ? (
                        <div className="mt-3 border border-[rgba(238,234,248,0.1)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
                          <p className="op-eyebrow">Proof Note</p>
                          <p className="op-subtle mt-2 text-[13px] font-body leading-5">{record.proof_note}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="border border-[rgba(238,234,248,0.1)] bg-[rgba(238,234,248,0.04)] px-3 py-3">
                      <p className="op-eyebrow">Quota Blocks</p>
                      <p className="mt-2 text-[18px] font-display text-white">{record.quota_blocks}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={labelClassName}>Review Note</label>
                    <textarea
                      className={`${inputClassName} min-h-[72px] resize-y`}
                      style={{ border: '1px solid rgba(238,234,248,0.18)' }}
                      value={reviewNotes[record.id] || ''}
                      disabled={isReadOnly || reviewingId === record.id}
                      onChange={(event) => setReviewNotes((prev) => ({
                        ...prev,
                        [record.id]: event.target.value,
                      }))}
                      placeholder="Optional note for approval, rejection, or return."
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <ActionButton
                      tone="light"
                      disabled={isReadOnly || reviewingId === record.id}
                      onClick={() => handleReviewAction(record.id, 'return')}
                    >
                      {reviewingId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Return
                    </ActionButton>
                    <ActionButton
                      tone="light"
                      disabled={isReadOnly || reviewingId === record.id}
                      onClick={() => handleReviewAction(record.id, 'reject')}
                    >
                      {reviewingId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                      Reject
                    </ActionButton>
                    <ActionButton
                      disabled={isReadOnly || reviewingId === record.id}
                      onClick={() => handleReviewAction(record.id, 'approve')}
                    >
                      {reviewingId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve
                    </ActionButton>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                colors={colors}
                icon={CheckCircle2}
                title="Nothing waiting on review"
                detail="Approval-required chores will land here after students complete them."
              />
            )}
          </div>
        </SectionCard>
        ) : null}

        <div className="op-panel-muted px-4 py-3">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#cbb7fb]" />
            <div>
              <p className="op-eyebrow">
                Phase Boundary
              </p>
              <p className="op-subtle mt-1 text-[13px] font-body leading-5">
                This parent surface now covers setup, quota warnings, allowance bookkeeping, point settings, reward catalog management, and trusted reward redemptions. Billing, packaging decisions, school-block point hardening, achievements, and final cosmetic assets remain out of scope.
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ChoresRoute;
