import { POINT_SOURCE_TYPES } from './pointLedgerUtils.js';

export const REWARD_CATALOG_ITEM_TYPES = Object.freeze({
  BUILT_IN: 'built_in',
  PARENT_CREATED: 'parent_created',
});

export const REWARD_REDEMPTION_STATUSES = Object.freeze({
  REQUESTED: 'requested',
  APPROVED: 'approved',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
  CANCELED: 'canceled',
});

const BUILT_IN_UNLOCK_TYPES = Object.freeze({
  AVATAR: 'avatar',
  BADGE: 'badge',
  PROFILE_THEME: 'profile_theme',
});

const ACTIVE_REDEMPTION_STATUSES = new Set([
  REWARD_REDEMPTION_STATUSES.REQUESTED,
  REWARD_REDEMPTION_STATUSES.APPROVED,
  REWARD_REDEMPTION_STATUSES.FULFILLED,
]);

export const BUILT_IN_REWARD_CATALOG = Object.freeze([
  Object.freeze({
    id: 'builtin_avatar_stargazer',
    built_in_key: 'avatar_stargazer',
    unlock_type: BUILT_IN_UNLOCK_TYPES.AVATAR,
    unlock_key: 'stargazer',
    type: REWARD_CATALOG_ITEM_TYPES.BUILT_IN,
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
    type: REWARD_CATALOG_ITEM_TYPES.BUILT_IN,
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
    type: REWARD_CATALOG_ITEM_TYPES.BUILT_IN,
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
    type: REWARD_CATALOG_ITEM_TYPES.BUILT_IN,
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
    type: REWARD_CATALOG_ITEM_TYPES.BUILT_IN,
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
    type: REWARD_CATALOG_ITEM_TYPES.BUILT_IN,
    title: 'Profile Theme: Twilight',
    description: 'Unlock a placeholder dusk profile theme for future student personalization.',
    point_cost: 140,
    fulfillment_terms: 'Unlocks immediately. This is a placeholder profile theme without final visual polish.',
    redemption_requires_approval: false,
    is_active: true,
    sort_order: 60,
  }),
]);

const trimString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const toBoolean = (value, fallback = false) => (
  typeof value === 'boolean' ? value : fallback
);

const toNonNegativeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const normalizeEligibleStudentIds = (value) => (
  Array.isArray(value)
    ? Array.from(new Set(value.map((entry) => trimString(entry)).filter(Boolean)))
    : []
);

const isStudentEligibleForReward = (rewardCatalogItem, studentId) => {
  const eligibleStudentIds = normalizeEligibleStudentIds(rewardCatalogItem?.eligible_student_ids);
  return eligibleStudentIds.length === 0 || eligibleStudentIds.includes(studentId);
};

export const normalizeRewardCatalogItemRecord = (rewardCatalogItem = {}) => ({
  id: trimString(rewardCatalogItem.id),
  type: rewardCatalogItem.type || REWARD_CATALOG_ITEM_TYPES.PARENT_CREATED,
  title: trimString(rewardCatalogItem.title),
  description: trimString(rewardCatalogItem.description),
  point_cost: toNonNegativeInteger(rewardCatalogItem.point_cost, 0),
  stock_quantity: toNonNegativeInteger(rewardCatalogItem.stock_quantity, 0),
  available_quantity: toNonNegativeInteger(
    rewardCatalogItem.available_quantity,
    toNonNegativeInteger(rewardCatalogItem.stock_quantity, 0)
  ),
  eligible_student_ids: normalizeEligibleStudentIds(rewardCatalogItem.eligible_student_ids),
  redemption_requires_approval: toBoolean(
    rewardCatalogItem.redemption_requires_approval,
    rewardCatalogItem.type !== REWARD_CATALOG_ITEM_TYPES.BUILT_IN
  ),
  fulfillment_terms: trimString(rewardCatalogItem.fulfillment_terms),
  built_in_key: trimString(rewardCatalogItem.built_in_key),
  unlock_type: trimString(rewardCatalogItem.unlock_type),
  unlock_key: trimString(rewardCatalogItem.unlock_key),
  is_active: rewardCatalogItem.is_active !== false,
  sort_order: toNonNegativeInteger(rewardCatalogItem.sort_order, 0),
});

const buildBuiltInCatalogForStudent = ({
  rewardRedemptions = [],
  studentId = '',
} = {}) => {
  const ownedKeys = new Set(
    (Array.isArray(rewardRedemptions) ? rewardRedemptions : [])
      .filter((rewardRedemption) => (
        rewardRedemption?.student_id === studentId
        && ACTIVE_REDEMPTION_STATUSES.has(
          rewardRedemption?.status || REWARD_REDEMPTION_STATUSES.REQUESTED
        )
      ))
      .map((rewardRedemption) => (
        trimString(rewardRedemption?.built_in_key_snapshot)
        || trimString(rewardRedemption?.built_in_key)
        || trimString(rewardRedemption?.reward_catalog_item_id)
      ))
      .filter(Boolean)
  );

  return BUILT_IN_REWARD_CATALOG.map((rewardCatalogItem) => {
    const normalizedReward = normalizeRewardCatalogItemRecord(rewardCatalogItem);
    const isUnlocked = ownedKeys.has(normalizedReward.built_in_key) || ownedKeys.has(normalizedReward.id);

    return {
      ...normalizedReward,
      stock_quantity: 1,
      available_quantity: isUnlocked ? 0 : 1,
      is_unlocked: isUnlocked,
    };
  });
};

export const buildResolvedRewardCatalogForStudent = ({
  rewardCatalogItems = [],
  rewardRedemptions = [],
  studentId = '',
} = {}) => {
  const customCatalog = (Array.isArray(rewardCatalogItems) ? rewardCatalogItems : [])
    .filter((rewardCatalogItem) => (
      rewardCatalogItem?.is_active !== false
      && isStudentEligibleForReward(rewardCatalogItem, studentId)
    ))
    .map((rewardCatalogItem) => normalizeRewardCatalogItemRecord(rewardCatalogItem));

  return [
    ...customCatalog,
    ...buildBuiltInCatalogForStudent({
      rewardRedemptions,
      studentId,
    }),
  ];
};

export const buildRewardCatalogItemUpdate = ({
  existingItem = null,
  payload = {},
} = {}) => {
  const normalizedPayload = normalizeRewardCatalogItemRecord(payload);
  const restockQuantity = toNonNegativeInteger(payload?.restock_quantity, 0);

  if (!existingItem) {
    return {
      ...normalizedPayload,
      type: REWARD_CATALOG_ITEM_TYPES.PARENT_CREATED,
      available_quantity: normalizedPayload.stock_quantity,
    };
  }

  const normalizedExisting = normalizeRewardCatalogItemRecord(existingItem);
  const nextStockQuantity = normalizedExisting.stock_quantity + restockQuantity;
  const nextAvailableQuantity = Math.min(
    normalizedExisting.available_quantity + restockQuantity,
    nextStockQuantity
  );

  return {
    ...normalizedExisting,
    ...normalizedPayload,
    type: REWARD_CATALOG_ITEM_TYPES.PARENT_CREATED,
    stock_quantity: nextStockQuantity,
    available_quantity: nextAvailableQuantity,
  };
};

export const buildRewardRedemptionSnapshot = (rewardCatalogItem = {}) => {
  const normalizedReward = normalizeRewardCatalogItemRecord(rewardCatalogItem);

  return {
    reward_type_snapshot: normalizedReward.type,
    title_snapshot: normalizedReward.title,
    point_cost_snapshot: normalizedReward.point_cost,
    stock_quantity_snapshot: normalizedReward.stock_quantity,
    available_quantity_snapshot: normalizedReward.available_quantity,
    fulfillment_terms_snapshot: normalizedReward.fulfillment_terms,
    built_in_key_snapshot: normalizedReward.built_in_key,
    unlock_type_snapshot: normalizedReward.unlock_type,
    unlock_key_snapshot: normalizedReward.unlock_key,
  };
};

export const buildRewardRequestDecision = ({
  rewardCatalogItems = [],
  rewardRedemptions = [],
  studentId = '',
  rewardCatalogItemId = '',
  walletPoints = 0,
} = {}) => {
  const normalizedRewardCatalogItemId = trimString(rewardCatalogItemId);
  const rewardCatalogItem = buildResolvedRewardCatalogForStudent({
    rewardCatalogItems,
    rewardRedemptions,
    studentId,
  }).find((catalogItem) => catalogItem.id === normalizedRewardCatalogItemId);

  if (!rewardCatalogItem || rewardCatalogItem.is_active === false) {
    return {
      ok: false,
      code: 'not_found',
    };
  }

  if (rewardCatalogItem.type === REWARD_CATALOG_ITEM_TYPES.BUILT_IN && rewardCatalogItem.is_unlocked) {
    return {
      ok: false,
      code: 'already_unlocked',
    };
  }

  if (rewardCatalogItem.available_quantity <= 0) {
    return {
      ok: false,
      code: 'out_of_stock',
    };
  }

  if (toNonNegativeInteger(walletPoints, 0) < rewardCatalogItem.point_cost) {
    return {
      ok: false,
      code: 'insufficient_points',
    };
  }

  const status = rewardCatalogItem.type === REWARD_CATALOG_ITEM_TYPES.BUILT_IN
    ? REWARD_REDEMPTION_STATUSES.FULFILLED
    : rewardCatalogItem.redemption_requires_approval
      ? REWARD_REDEMPTION_STATUSES.REQUESTED
      : REWARD_REDEMPTION_STATUSES.APPROVED;

  return {
    ok: true,
    code: 'request_allowed',
    status,
    rewardCatalogItem,
    ledger_source_type: rewardCatalogItem.type === REWARD_CATALOG_ITEM_TYPES.BUILT_IN
      ? POINT_SOURCE_TYPES.REWARD_BUILT_IN_UNLOCK
      : POINT_SOURCE_TYPES.REWARD_REDEMPTION_RESERVATION,
  };
};

export const buildRewardRedemptionWrite = ({
  parentId = '',
  studentId = '',
  rewardCatalogItem = {},
  status = REWARD_REDEMPTION_STATUSES.REQUESTED,
  requestedAt = null,
} = {}) => {
  const normalizedReward = normalizeRewardCatalogItemRecord(rewardCatalogItem);
  const snapshot = buildRewardRedemptionSnapshot(normalizedReward);

  return {
    parent_id: trimString(parentId),
    student_id: trimString(studentId),
    reward_catalog_item_id: normalizedReward.id,
    status,
    ...snapshot,
    requested_at: requestedAt,
    approved_at: status === REWARD_REDEMPTION_STATUSES.APPROVED
      || status === REWARD_REDEMPTION_STATUSES.FULFILLED
      ? requestedAt
      : null,
    fulfilled_at: status === REWARD_REDEMPTION_STATUSES.FULFILLED ? requestedAt : null,
    rejected_at: null,
    canceled_at: null,
  };
};

export const buildRewardStatusTransition = ({
  redemption = {},
  action = '',
} = {}) => {
  const normalizedAction = trimString(action).toLowerCase();
  const currentStatus = redemption?.status || REWARD_REDEMPTION_STATUSES.REQUESTED;

  if (normalizedAction === 'approve') {
    if (currentStatus !== REWARD_REDEMPTION_STATUSES.REQUESTED) {
      return { ok: false, code: 'invalid_transition' };
    }

    return {
      ok: true,
      code: 'approved',
      status: REWARD_REDEMPTION_STATUSES.APPROVED,
      refund_points: false,
      restore_stock: false,
    };
  }

  if (normalizedAction === 'fulfill') {
    if (
      currentStatus !== REWARD_REDEMPTION_STATUSES.REQUESTED
      && currentStatus !== REWARD_REDEMPTION_STATUSES.APPROVED
    ) {
      return { ok: false, code: 'invalid_transition' };
    }

    return {
      ok: true,
      code: 'fulfilled',
      status: REWARD_REDEMPTION_STATUSES.FULFILLED,
      refund_points: false,
      restore_stock: false,
    };
  }

  if (normalizedAction === 'reject') {
    if (
      currentStatus !== REWARD_REDEMPTION_STATUSES.REQUESTED
      && currentStatus !== REWARD_REDEMPTION_STATUSES.APPROVED
    ) {
      return { ok: false, code: 'invalid_transition' };
    }

    return {
      ok: true,
      code: 'rejected',
      status: REWARD_REDEMPTION_STATUSES.REJECTED,
      refund_points: true,
      restore_stock: true,
    };
  }

  if (normalizedAction === 'cancel') {
    if (
      currentStatus !== REWARD_REDEMPTION_STATUSES.REQUESTED
      && currentStatus !== REWARD_REDEMPTION_STATUSES.APPROVED
    ) {
      return { ok: false, code: 'invalid_transition' };
    }

    return {
      ok: true,
      code: 'canceled',
      status: REWARD_REDEMPTION_STATUSES.CANCELED,
      refund_points: true,
      restore_stock: true,
    };
  }

  return {
    ok: false,
    code: 'unknown_action',
  };
};
