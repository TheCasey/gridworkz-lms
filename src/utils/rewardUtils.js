import {
  PointSourceTypes,
  RewardCatalogItemTypes,
  RewardRedemptionStatuses,
} from '../constants/schema.js';

const BUILT_IN_UNLOCK_TYPES = Object.freeze({
  AVATAR: 'avatar',
  BADGE: 'badge',
  PROFILE_THEME: 'profile_theme',
});

const ACTIVE_REDEMPTION_STATUSES = new Set([
  RewardRedemptionStatuses.REQUESTED,
  RewardRedemptionStatuses.APPROVED,
  RewardRedemptionStatuses.FULFILLED,
]);

const OPEN_REDEMPTION_STATUSES = new Set([
  RewardRedemptionStatuses.REQUESTED,
  RewardRedemptionStatuses.APPROVED,
]);

export const BUILT_IN_REWARD_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'builtin_avatar_stargazer',
    built_in_key: 'avatar_stargazer',
    unlock_type: BUILT_IN_UNLOCK_TYPES.AVATAR,
    unlock_key: 'stargazer',
    type: RewardCatalogItemTypes.BUILT_IN,
    title: 'Avatar: Stargazer',
    description: 'Unlock a placeholder night-sky avatar style for the student portal profile shell.',
    point_cost: 120,
    fulfillment_terms: 'Unlocks immediately. This is a placeholder avatar style without final art assets.',
    redemption_requires_approval: false,
    is_active: true,
    sort_order: 10,
  }),
  Object.freeze({
    id: 'builtin_avatar_trailblazer',
    built_in_key: 'avatar_trailblazer',
    unlock_type: BUILT_IN_UNLOCK_TYPES.AVATAR,
    unlock_key: 'trailblazer',
    type: RewardCatalogItemTypes.BUILT_IN,
    title: 'Avatar: Trailblazer',
    description: 'Unlock a placeholder explorer avatar style for the student portal profile shell.',
    point_cost: 120,
    fulfillment_terms: 'Unlocks immediately. This is a placeholder avatar style without final art assets.',
    redemption_requires_approval: false,
    is_active: true,
    sort_order: 20,
  }),
  Object.freeze({
    id: 'builtin_badge_comet',
    built_in_key: 'badge_comet',
    unlock_type: BUILT_IN_UNLOCK_TYPES.BADGE,
    unlock_key: 'comet',
    type: RewardCatalogItemTypes.BUILT_IN,
    title: 'Badge: Comet',
    description: 'Unlock a placeholder comet badge for future profile and progress surfaces.',
    point_cost: 80,
    fulfillment_terms: 'Unlocks immediately. This is a placeholder badge without final image assets.',
    redemption_requires_approval: false,
    is_active: true,
    sort_order: 30,
  }),
  Object.freeze({
    id: 'builtin_badge_steward',
    built_in_key: 'badge_steward',
    unlock_type: BUILT_IN_UNLOCK_TYPES.BADGE,
    unlock_key: 'steward',
    type: RewardCatalogItemTypes.BUILT_IN,
    title: 'Badge: Steward',
    description: 'Unlock a placeholder stewardship badge for future profile and progress surfaces.',
    point_cost: 80,
    fulfillment_terms: 'Unlocks immediately. This is a placeholder badge without final image assets.',
    redemption_requires_approval: false,
    is_active: true,
    sort_order: 40,
  }),
  Object.freeze({
    id: 'builtin_theme_sunrise',
    built_in_key: 'profile_theme_sunrise',
    unlock_type: BUILT_IN_UNLOCK_TYPES.PROFILE_THEME,
    unlock_key: 'sunrise',
    type: RewardCatalogItemTypes.BUILT_IN,
    title: 'Profile Theme: Sunrise',
    description: 'Unlock a placeholder warm-light profile theme for future student personalization.',
    point_cost: 140,
    fulfillment_terms: 'Unlocks immediately. This is a placeholder profile theme without final visual polish.',
    redemption_requires_approval: false,
    is_active: true,
    sort_order: 50,
  }),
  Object.freeze({
    id: 'builtin_theme_twilight',
    built_in_key: 'profile_theme_twilight',
    unlock_type: BUILT_IN_UNLOCK_TYPES.PROFILE_THEME,
    unlock_key: 'twilight',
    type: RewardCatalogItemTypes.BUILT_IN,
    title: 'Profile Theme: Twilight',
    description: 'Unlock a placeholder dusk profile theme for future student personalization.',
    point_cost: 140,
    fulfillment_terms: 'Unlocks immediately. This is a placeholder profile theme without final visual polish.',
    redemption_requires_approval: false,
    is_active: true,
    sort_order: 60,
  }),
]);

const toNonNegativeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
};

const toString = (value, fallback = '') => (
  typeof value === 'string' ? value.trim() : fallback
);

const clonePlainObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {}
);

const clonePlainArray = (value) => (
  Array.isArray(value)
    ? value.map((entry) => (
        entry && typeof entry === 'object' && !Array.isArray(entry)
          ? { ...entry }
          : entry
      ))
    : []
);

const normalizeEligibleStudentIds = (value) => (
  Array.isArray(value)
    ? Array.from(new Set(
      value
        .filter((studentId) => typeof studentId === 'string' && studentId.trim().length > 0)
        .map((studentId) => studentId.trim())
    ))
    : []
);

const isStudentEligibleForReward = (rewardCatalogItem, studentId) => {
  const eligibleStudentIds = normalizeEligibleStudentIds(rewardCatalogItem?.eligible_student_ids);
  return eligibleStudentIds.length === 0 || eligibleStudentIds.includes(studentId);
};

const isRewardCatalogItemActive = (rewardCatalogItem) => (
  rewardCatalogItem?.is_active !== false
);

const compareBySortOrderThenTitle = (left, right) => {
  const leftOrder = toNonNegativeInteger(left?.sort_order, Number.MAX_SAFE_INTEGER);
  const rightOrder = toNonNegativeInteger(right?.sort_order, Number.MAX_SAFE_INTEGER);

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return toString(left?.title).localeCompare(toString(right?.title));
};

const compareRedemptionsByTimestampDesc = (left, right) => {
  const leftTime = new Date(
    left?.fulfilled_at
    || left?.approved_at
    || left?.requested_at
    || left?.created_at
    || 0
  ).getTime() || 0;
  const rightTime = new Date(
    right?.fulfilled_at
    || right?.approved_at
    || right?.requested_at
    || right?.created_at
    || 0
  ).getTime() || 0;

  return rightTime - leftTime;
};

const resolveBuiltInOwnedKeys = ({
  rewardRedemptions = [],
  studentId = '',
} = {}) => new Set(
  (Array.isArray(rewardRedemptions) ? rewardRedemptions : [])
    .filter((rewardRedemption) => (
      rewardRedemption?.student_id === studentId
      && ACTIVE_REDEMPTION_STATUSES.has(
        rewardRedemption?.status || RewardRedemptionStatuses.REQUESTED
      )
    ))
    .map((rewardRedemption) => (
      toString(rewardRedemption?.built_in_key_snapshot)
      || toString(rewardRedemption?.built_in_key)
      || toString(rewardRedemption?.reward_catalog_item_id)
    ))
    .filter(Boolean)
);

export const DEFAULT_POINT_SETTINGS = Object.freeze({
  school_block_points: 0,
  chore_block_points: 0,
  routine_day_points: 0,
  routine_points_enabled: false,
});

export const DEFAULT_REWARD_SETTINGS = Object.freeze({
  ...DEFAULT_POINT_SETTINGS,
});

export const createDefaultRewardDraft = () => ({
  id: '',
  title: '',
  description: '',
  point_cost: 250,
  stock_quantity: 1,
  eligible_student_ids: [],
  assign_to_all_students: true,
  redemption_requires_approval: true,
  fulfillment_terms: '',
  is_active: true,
  restock_quantity: 0,
});

export const buildRewardCatalogDraft = (rewardCatalogItem = {}) => {
  const eligibleStudentIds = normalizeEligibleStudentIds(rewardCatalogItem?.eligible_student_ids);

  return {
    id: toString(rewardCatalogItem?.id),
    title: toString(rewardCatalogItem?.title),
    description: toString(rewardCatalogItem?.description),
    point_cost: toNonNegativeInteger(rewardCatalogItem?.point_cost, 0),
    stock_quantity: toNonNegativeInteger(rewardCatalogItem?.stock_quantity, 0),
    eligible_student_ids: eligibleStudentIds,
    assign_to_all_students: eligibleStudentIds.length === 0,
    redemption_requires_approval: rewardCatalogItem?.redemption_requires_approval !== false,
    fulfillment_terms: toString(rewardCatalogItem?.fulfillment_terms),
    is_active: rewardCatalogItem?.is_active !== false,
    restock_quantity: 0,
  };
};

export const normalizeRewardCatalogDraft = (draft = {}) => {
  const assignToAllStudents = draft?.assign_to_all_students !== false;
  const stockQuantity = toNonNegativeInteger(draft?.stock_quantity, 0);

  return {
    id: toString(draft?.id),
    title: toString(draft?.title),
    description: toString(draft?.description),
    point_cost: toNonNegativeInteger(draft?.point_cost, 0),
    stock_quantity: stockQuantity,
    available_quantity: stockQuantity,
    eligible_student_ids: assignToAllStudents
      ? []
      : normalizeEligibleStudentIds(draft?.eligible_student_ids),
    redemption_requires_approval: toBoolean(draft?.redemption_requires_approval, true),
    fulfillment_terms: toString(draft?.fulfillment_terms),
    is_active: draft?.is_active !== false,
    restock_quantity: toNonNegativeInteger(draft?.restock_quantity, 0),
  };
};

export const normalizePointSettings = (value = {}) => ({
  school_block_points: toNonNegativeInteger(
    value.school_block_points,
    DEFAULT_POINT_SETTINGS.school_block_points
  ),
  chore_block_points: toNonNegativeInteger(
    value.chore_block_points,
    DEFAULT_POINT_SETTINGS.chore_block_points
  ),
  routine_day_points: toNonNegativeInteger(
    value.routine_day_points,
    DEFAULT_POINT_SETTINGS.routine_day_points
  ),
  routine_points_enabled: toBoolean(
    value.routine_points_enabled,
    DEFAULT_POINT_SETTINGS.routine_points_enabled
  ),
});

export const buildDefaultPointSettings = (overrides = {}) => (
  normalizePointSettings({
    ...DEFAULT_POINT_SETTINGS,
    ...clonePlainObject(overrides),
  })
);

export const normalizeRewardSettings = (value = {}) => ({
  ...DEFAULT_REWARD_SETTINGS,
  ...normalizePointSettings(value),
});

export const buildDefaultRewardSettings = (overrides = {}) => (
  normalizeRewardSettings({
    ...DEFAULT_REWARD_SETTINGS,
    ...clonePlainObject(overrides),
  })
);

export const getPointValueForSource = (sourceType, settings = {}) => {
  const normalizedSettings = normalizePointSettings(settings);

  switch (sourceType) {
    case PointSourceTypes.SCHOOL_BLOCK:
      return normalizedSettings.school_block_points;
    case PointSourceTypes.CHORE_COMPLETION:
      return normalizedSettings.chore_block_points;
    case PointSourceTypes.ROUTINE_COMPLETION:
      return normalizedSettings.routine_points_enabled
        ? normalizedSettings.routine_day_points
        : 0;
    default:
      return 0;
  }
};

export const getAwardablePointValueForSource = ({
  sourceType,
  settings = {},
  routineTemplate = null,
} = {}) => {
  const baseValue = getPointValueForSource(sourceType, settings);

  if (sourceType === PointSourceTypes.ROUTINE_COMPLETION) {
    return routineTemplate?.counts_toward_points === true ? baseValue : 0;
  }

  return baseValue;
};

export const buildSchoolPointSourceId = ({
  studentId = '',
  subjectId = '',
  blockIndex = 0,
  weekKey = '',
} = {}) => (
  [
    'school_block',
    String(studentId || '').trim(),
    String(subjectId || '').trim(),
    toNonNegativeInteger(blockIndex, 0),
    String(weekKey || '').trim(),
  ].join(':')
);

export const normalizeStudentPointWallet = (value = {}, fallbackStudentId = '') => ({
  id: value.id || value.wallet_id || fallbackStudentId,
  parent_id: value.parent_id || '',
  student_id: value.student_id || fallbackStudentId,
  total_points: toNonNegativeInteger(value.total_points),
  lifetime_points: toNonNegativeInteger(value.lifetime_points),
  updated_at: value.updated_at || null,
});

export const normalizePointLedgerEntry = (value = {}) => ({
  id: value.id || '',
  parent_id: value.parent_id || '',
  student_id: value.student_id || '',
  wallet_id: value.wallet_id || value.student_id || '',
  source_type: value.source_type || PointSourceTypes.ADJUSTMENT,
  source_id: value.source_id || '',
  delta_points: toInteger(value.delta_points, 0),
  balance_after: toInteger(value.balance_after, 0),
  description: value.description || '',
  metadata: clonePlainObject(value.metadata),
  created_at: value.created_at || null,
});

export const sumPointLedgerEntriesForStudent = ({
  studentId,
  pointLedgerEntries = [],
} = {}) => (
  (Array.isArray(pointLedgerEntries) ? pointLedgerEntries : [])
    .filter((entry) => entry?.student_id === studentId)
    .reduce((total, entry) => total + toInteger(entry?.delta_points, 0), 0)
);

export const applyPointLedgerEntry = ({
  pointWallets = [],
  pointLedgerEntries = [],
  parentId = '',
  studentId = '',
  sourceType = PointSourceTypes.ADJUSTMENT,
  sourceId = '',
  deltaPoints = 0,
  description = '',
  metadata = {},
  entryId = '',
  createdAt = null,
} = {}) => {
  const normalizedStudentId = String(studentId || '').trim();
  const normalizedSourceId = String(sourceId || '').trim();
  const normalizedDelta = toInteger(deltaPoints, 0);

  if (!normalizedStudentId || !normalizedSourceId || !sourceType || normalizedDelta === 0) {
    return {
      applied: false,
      code: 'invalid_entry',
      pointWallets: Array.isArray(pointWallets) ? pointWallets : [],
      pointLedgerEntries: Array.isArray(pointLedgerEntries) ? pointLedgerEntries : [],
      wallet: null,
      entry: null,
    };
  }

  const existingEntry = (Array.isArray(pointLedgerEntries) ? pointLedgerEntries : []).find(
    (entry) => (
      entry?.student_id === normalizedStudentId &&
      entry?.source_type === sourceType &&
      entry?.source_id === normalizedSourceId
    )
  );

  if (existingEntry) {
    return {
      applied: false,
      code: 'already_awarded',
      pointWallets: Array.isArray(pointWallets) ? pointWallets : [],
      pointLedgerEntries: Array.isArray(pointLedgerEntries) ? pointLedgerEntries : [],
      wallet: normalizeStudentPointWallet(
        (Array.isArray(pointWallets) ? pointWallets : []).find(
          (entry) => entry?.student_id === normalizedStudentId
        ) || {},
        normalizedStudentId
      ),
      entry: normalizePointLedgerEntry(existingEntry),
    };
  }

  const existingWallet = normalizeStudentPointWallet(
    (Array.isArray(pointWallets) ? pointWallets : []).find(
      (entry) => entry?.student_id === normalizedStudentId
    ) || {},
    normalizedStudentId
  );
  const nextTotalPoints = existingWallet.total_points + normalizedDelta;

  if (nextTotalPoints < 0) {
    return {
      applied: false,
      code: 'insufficient_points',
      pointWallets: Array.isArray(pointWallets) ? pointWallets : [],
      pointLedgerEntries: Array.isArray(pointLedgerEntries) ? pointLedgerEntries : [],
      wallet: existingWallet,
      entry: null,
    };
  }

  const nextWallet = normalizeStudentPointWallet({
    ...existingWallet,
    parent_id: parentId || existingWallet.parent_id || '',
    student_id: normalizedStudentId,
    total_points: nextTotalPoints,
    lifetime_points: existingWallet.lifetime_points + (normalizedDelta > 0 ? normalizedDelta : 0),
    updated_at: createdAt,
  }, normalizedStudentId);
  const nextEntry = normalizePointLedgerEntry({
    id: entryId || normalizedSourceId,
    parent_id: parentId || '',
    student_id: normalizedStudentId,
    wallet_id: nextWallet.id || normalizedStudentId,
    source_type: sourceType,
    source_id: normalizedSourceId,
    delta_points: normalizedDelta,
    balance_after: nextWallet.total_points,
    description,
    metadata,
    created_at: createdAt,
  });

  return {
    applied: true,
    code: 'applied',
    pointWallets: [
      ...(Array.isArray(pointWallets) ? pointWallets : []).filter(
        (entry) => entry?.student_id !== normalizedStudentId
      ),
      nextWallet,
    ],
    pointLedgerEntries: [
      ...(Array.isArray(pointLedgerEntries) ? pointLedgerEntries : []),
      nextEntry,
    ],
    wallet: nextWallet,
    entry: nextEntry,
  };
};

const normalizeRedemptionRecord = (rewardRedemption = {}) => ({
  id: rewardRedemption.id || '',
  reward_catalog_item_id: rewardRedemption.reward_catalog_item_id || '',
  status: rewardRedemption.status || RewardRedemptionStatuses.REQUESTED,
  reward_type_snapshot: rewardRedemption.reward_type_snapshot
    || rewardRedemption.type
    || RewardCatalogItemTypes.PARENT_CREATED,
  title_snapshot: rewardRedemption.title_snapshot || '',
  point_cost_snapshot: toNonNegativeInteger(rewardRedemption.point_cost_snapshot),
  stock_quantity_snapshot: toNonNegativeInteger(rewardRedemption.stock_quantity_snapshot),
  available_quantity_snapshot: toNonNegativeInteger(rewardRedemption.available_quantity_snapshot),
  fulfillment_terms_snapshot: toString(rewardRedemption.fulfillment_terms_snapshot),
  built_in_key_snapshot: toString(rewardRedemption.built_in_key_snapshot || rewardRedemption.built_in_key),
  unlock_type_snapshot: toString(rewardRedemption.unlock_type_snapshot || rewardRedemption.unlock_type),
  unlock_key_snapshot: toString(rewardRedemption.unlock_key_snapshot || rewardRedemption.unlock_key),
  requested_at: rewardRedemption.requested_at || null,
  approved_at: rewardRedemption.approved_at || null,
  fulfilled_at: rewardRedemption.fulfilled_at || null,
  rejected_at: rewardRedemption.rejected_at || null,
  canceled_at: rewardRedemption.canceled_at || null,
});

const normalizeCatalogReward = (rewardCatalogItem = {}) => ({
  id: toString(rewardCatalogItem.id),
  type: rewardCatalogItem.type || RewardCatalogItemTypes.PARENT_CREATED,
  title: rewardCatalogItem.title || '',
  description: rewardCatalogItem.description || '',
  point_cost: toNonNegativeInteger(rewardCatalogItem.point_cost),
  stock_quantity: toNonNegativeInteger(rewardCatalogItem.stock_quantity),
  available_quantity: toNonNegativeInteger(
    rewardCatalogItem.available_quantity,
    toNonNegativeInteger(rewardCatalogItem.stock_quantity)
  ),
  redemption_requires_approval: toBoolean(
    rewardCatalogItem.redemption_requires_approval,
    rewardCatalogItem.type !== RewardCatalogItemTypes.BUILT_IN
  ),
  fulfillment_terms: toString(rewardCatalogItem.fulfillment_terms),
  built_in_key: toString(rewardCatalogItem.built_in_key),
  unlock_type: toString(rewardCatalogItem.unlock_type),
  unlock_key: toString(rewardCatalogItem.unlock_key),
  eligible_student_ids: normalizeEligibleStudentIds(rewardCatalogItem.eligible_student_ids),
  is_active: rewardCatalogItem.is_active !== false,
  sort_order: toNonNegativeInteger(rewardCatalogItem.sort_order, 0),
});

export const buildRewardCatalogItemsForStudent = ({
  studentId = '',
  rewardCatalogItems = [],
  rewardRedemptions = [],
  walletPoints = 0,
} = {}) => {
  const ownedBuiltInKeys = resolveBuiltInOwnedKeys({
    rewardRedemptions,
    studentId,
  });
  const customCatalog = (Array.isArray(rewardCatalogItems) ? rewardCatalogItems : [])
    .filter((rewardCatalogItem) => (
      isRewardCatalogItemActive(rewardCatalogItem)
      && isStudentEligibleForReward(rewardCatalogItem, studentId)
    ))
    .map((rewardCatalogItem) => normalizeCatalogReward(rewardCatalogItem));

  const builtInCatalog = BUILT_IN_REWARD_DEFINITIONS.map((definition) => {
    const isUnlocked = ownedBuiltInKeys.has(definition.built_in_key) || ownedBuiltInKeys.has(definition.id);
    const normalizedDefinition = normalizeCatalogReward(definition);

    return {
      ...normalizedDefinition,
      stock_quantity: 1,
      available_quantity: isUnlocked ? 0 : 1,
      is_unlocked: isUnlocked,
      unavailable_reason: isUnlocked ? 'Already unlocked' : '',
    };
  });

  return [...customCatalog, ...builtInCatalog]
    .map((rewardCatalogItem) => {
      const isBuiltIn = rewardCatalogItem.type === RewardCatalogItemTypes.BUILT_IN;
      const isUnlocked = isBuiltIn
        ? rewardCatalogItem.is_unlocked === true
        : false;
      const isOutOfStock = rewardCatalogItem.available_quantity <= 0;
      const canAfford = walletPoints >= rewardCatalogItem.point_cost;
      let unavailableReason = rewardCatalogItem.unavailable_reason || '';

      if (!unavailableReason) {
        if (isUnlocked) {
          unavailableReason = 'Already unlocked';
        } else if (isOutOfStock) {
          unavailableReason = isBuiltIn ? 'Already unlocked' : 'Out of stock';
        } else if (!canAfford) {
          unavailableReason = 'Not enough points';
        }
      }

      return {
        ...rewardCatalogItem,
        is_built_in: isBuiltIn,
        is_unlocked: isUnlocked,
        can_afford: canAfford,
        can_redeem: !isUnlocked && !isOutOfStock && canAfford,
        unavailable_reason: unavailableReason,
      };
    })
    .sort(compareBySortOrderThenTitle);
};

export const buildStudentSafeRewardState = ({
  studentId,
  pointWallets = [],
  rewardCatalogItems = [],
  rewardRedemptions = [],
} = {}) => {
  const wallet = normalizeStudentPointWallet(
    (Array.isArray(pointWallets) ? pointWallets : []).find(
      (entry) => entry?.student_id === studentId
    ) || {},
    studentId
  );
  const myRedemptions = (Array.isArray(rewardRedemptions) ? rewardRedemptions : [])
    .filter((rewardRedemption) => rewardRedemption?.student_id === studentId)
    .map((rewardRedemption) => normalizeRedemptionRecord(rewardRedemption))
    .sort(compareRedemptionsByTimestampDesc);

  return {
    wallet: {
      id: wallet.id || studentId,
      student_id: wallet.student_id || studentId,
      total_points: toNonNegativeInteger(wallet.total_points),
      lifetime_points: toNonNegativeInteger(wallet.lifetime_points),
      updated_at: wallet.updated_at || null,
    },
    catalog: buildRewardCatalogItemsForStudent({
      studentId,
      rewardCatalogItems,
      rewardRedemptions,
      walletPoints: toNonNegativeInteger(wallet.total_points),
    }),
    myRedemptions,
  };
};

export const buildStudentRewardStoreModel = ({
  rewardState = null,
  enabled = true,
  hasStudentContext = true,
} = {}) => {
  const wallet = rewardState?.wallet || {
    total_points: 0,
    lifetime_points: 0,
    updated_at: null,
  };
  const walletPoints = toNonNegativeInteger(wallet.total_points, 0);
  const catalog = (Array.isArray(rewardState?.catalog) ? rewardState.catalog : []).map((reward) => {
    const isUnlocked = reward?.is_unlocked === true;
    const isOutOfStock = toNonNegativeInteger(reward?.available_quantity, 0) <= 0;
    const canAfford = walletPoints >= toNonNegativeInteger(reward?.point_cost, 0);
    let unavailableReason = toString(reward?.unavailable_reason);

    if (!unavailableReason) {
      if (isUnlocked) unavailableReason = 'Already unlocked';
      else if (isOutOfStock) unavailableReason = 'Out of stock';
      else if (!canAfford) unavailableReason = 'Not enough points';
    }

    return {
      ...reward,
      can_afford: typeof reward?.can_afford === 'boolean' ? reward.can_afford : canAfford,
      can_redeem: typeof reward?.can_redeem === 'boolean'
        ? reward.can_redeem
        : !isUnlocked && !isOutOfStock && canAfford,
      unavailable_reason: unavailableReason,
    };
  });
  const myRedemptions = Array.isArray(rewardState?.myRedemptions) ? rewardState.myRedemptions : [];
  const canShowArea = Boolean(enabled);
  const hasContent = catalog.length > 0 || myRedemptions.length > 0;

  let accessState = 'ready';
  if (!enabled) {
    accessState = 'hidden';
  } else if (!hasStudentContext) {
    accessState = 'locked';
  } else if (!hasContent) {
    accessState = 'empty';
  }

  return {
    accessState,
    canShowArea,
    canInteract: enabled && hasStudentContext,
    wallet,
    catalog,
    availableRewards: catalog.filter((rewardCatalogItem) => rewardCatalogItem.can_redeem),
    unavailableRewards: catalog.filter((rewardCatalogItem) => !rewardCatalogItem.can_redeem),
    pendingRedemptions: myRedemptions.filter((rewardRedemption) => (
      OPEN_REDEMPTION_STATUSES.has(rewardRedemption.status)
    )),
    completedRedemptions: myRedemptions.filter((rewardRedemption) => (
      rewardRedemption.status === RewardRedemptionStatuses.FULFILLED
    )),
    refundedRedemptions: myRedemptions.filter((rewardRedemption) => (
      rewardRedemption.status === RewardRedemptionStatuses.REJECTED
      || rewardRedemption.status === RewardRedemptionStatuses.CANCELED
    )),
    unlockedBuiltIns: myRedemptions.filter((rewardRedemption) => (
      rewardRedemption.status === RewardRedemptionStatuses.FULFILLED
      && rewardRedemption.reward_type_snapshot === RewardCatalogItemTypes.BUILT_IN
    )),
  };
};

export const cloneRewardLedgerMetadata = (value) => clonePlainObject(value);

export const cloneRewardCatalogItems = (value) => clonePlainArray(value);
