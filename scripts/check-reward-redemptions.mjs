#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  PointSourceTypes,
  RewardCatalogItemTypes,
  RewardRedemptionStatuses,
} from '../src/constants/schema.js';
import {
  BUILT_IN_REWARD_DEFINITIONS,
  applyPointLedgerEntry,
  buildStudentSafeRewardState,
} from '../src/utils/rewardUtils.js';
import {
  BUILT_IN_REWARD_CATALOG,
  buildRewardCatalogItemUpdate,
  buildRewardRedemptionWrite,
  buildRewardRequestDecision,
  buildRewardStatusTransition,
} from '../functions/src/rewardRedemptionUtils.js';

const parentReward = {
  id: 'reward_movie_night',
  parent_id: 'parent_1',
  type: RewardCatalogItemTypes.PARENT_CREATED,
  title: 'Movie night pick',
  description: 'Choose the Friday movie.',
  point_cost: 150,
  stock_quantity: 1,
  available_quantity: 1,
  eligible_student_ids: ['student_a'],
  redemption_requires_approval: true,
  fulfillment_terms: 'Fulfilled during family movie night.',
  is_active: true,
};

const baseWallet = {
  id: 'student_a',
  parent_id: 'parent_1',
  student_id: 'student_a',
  total_points: 300,
  lifetime_points: 300,
};

const requestDecision = buildRewardRequestDecision({
  rewardCatalogItems: [parentReward],
  rewardRedemptions: [],
  studentId: 'student_a',
  rewardCatalogItemId: parentReward.id,
  walletPoints: baseWallet.total_points,
});

assert.equal(requestDecision.ok, true);
assert.equal(requestDecision.status, RewardRedemptionStatuses.REQUESTED);
assert.equal(requestDecision.ledger_source_type, PointSourceTypes.REWARD_REDEMPTION_RESERVATION);

const reservedState = applyPointLedgerEntry({
  pointWallets: [baseWallet],
  pointLedgerEntries: [],
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: requestDecision.ledger_source_type,
  sourceId: 'redemption_parent_1',
  deltaPoints: parentReward.point_cost * -1,
  description: 'Reward reservation',
});

assert.equal(reservedState.applied, true);
assert.equal(reservedState.wallet.total_points, 150, 'parent reward reservation should spend immediately from the available wallet');

const soldOutRewardState = buildStudentSafeRewardState({
  studentId: 'student_a',
  pointWallets: [reservedState.wallet],
  rewardCatalogItems: [{
    ...parentReward,
    available_quantity: 0,
  }],
  rewardRedemptions: [],
});

assert.equal(soldOutRewardState.catalog[0].can_redeem, false);
assert.equal(soldOutRewardState.catalog[0].unavailable_reason, 'Out of stock');

const insufficientDecision = buildRewardRequestDecision({
  rewardCatalogItems: [parentReward],
  rewardRedemptions: [],
  studentId: 'student_a',
  rewardCatalogItemId: parentReward.id,
  walletPoints: 100,
});

assert.equal(insufficientDecision.ok, false);
assert.equal(insufficientDecision.code, 'insufficient_points');

const rejectTransition = buildRewardStatusTransition({
  redemption: {
    id: 'redemption_parent_1',
    status: RewardRedemptionStatuses.REQUESTED,
  },
  action: 'reject',
});
assert.equal(rejectTransition.ok, true);
assert.equal(rejectTransition.refund_points, true);
assert.equal(rejectTransition.restore_stock, true);

const refundedState = applyPointLedgerEntry({
  pointWallets: [reservedState.wallet],
  pointLedgerEntries: [reservedState.entry],
  parentId: 'parent_1',
  studentId: 'student_a',
  sourceType: PointSourceTypes.REWARD_REDEMPTION_REFUND,
  sourceId: 'redemption_parent_1',
  deltaPoints: parentReward.point_cost,
  description: 'Reward refund',
});

assert.equal(refundedState.applied, true);
assert.equal(refundedState.wallet.total_points, baseWallet.total_points, 'rejected reward should restore reserved points');

const canceledTransition = buildRewardStatusTransition({
  redemption: {
    id: 'redemption_parent_2',
    status: RewardRedemptionStatuses.APPROVED,
  },
  action: 'cancel',
});
assert.equal(canceledTransition.ok, true);
assert.equal(canceledTransition.refund_points, true);
assert.equal(canceledTransition.restore_stock, true);

const approveTransition = buildRewardStatusTransition({
  redemption: {
    id: 'redemption_parent_1',
    status: RewardRedemptionStatuses.REQUESTED,
  },
  action: 'approve',
});
const fulfillTransition = buildRewardStatusTransition({
  redemption: {
    id: 'redemption_parent_1',
    status: RewardRedemptionStatuses.APPROVED,
  },
  action: 'fulfill',
});

assert.equal(approveTransition.ok, true);
assert.equal(approveTransition.refund_points, false);
assert.equal(fulfillTransition.ok, true);
assert.equal(fulfillTransition.refund_points, false);
assert.equal(reservedState.pointLedgerEntries.length, 1, 'approval and fulfillment should not create extra spend entries');

const originalSnapshot = buildRewardRedemptionWrite({
  parentId: 'parent_1',
  studentId: 'student_a',
  rewardCatalogItem: parentReward,
  status: RewardRedemptionStatuses.FULFILLED,
  requestedAt: '2026-05-26T15:00:00.000Z',
});

const editedReward = buildRewardCatalogItemUpdate({
  existingItem: parentReward,
  payload: {
    ...parentReward,
    title: 'Movie night pick (edited)',
    point_cost: 500,
    fulfillment_terms: 'Edited terms.',
    restock_quantity: 2,
  },
});

assert.equal(originalSnapshot.title_snapshot, 'Movie night pick');
assert.equal(originalSnapshot.point_cost_snapshot, 150);
assert.equal(originalSnapshot.fulfillment_terms_snapshot, 'Fulfilled during family movie night.');
assert.equal(editedReward.title, 'Movie night pick (edited)');
assert.equal(editedReward.point_cost, 500);
assert.equal(editedReward.stock_quantity, 3);
assert.equal(originalSnapshot.title_snapshot !== editedReward.title, true, 'redemption snapshots should remain stable after catalog edits');

const builtInKinds = new Set(['avatar', 'badge', 'profile_theme']);
const approvedBuiltInCostsByUnlockType = {
  avatar: 120,
  badge: 80,
  profile_theme: 140,
};

assert.deepEqual(
  new Set(BUILT_IN_REWARD_DEFINITIONS.map((reward) => reward.unlock_type)),
  builtInKinds,
  'placeholder built-in rewards should cover avatars, badges, and profile themes'
);

for (const builtInReward of BUILT_IN_REWARD_DEFINITIONS) {
  assert.equal(
    builtInReward.point_cost,
    approvedBuiltInCostsByUnlockType[builtInReward.unlock_type],
    `frontend built-in ${builtInReward.unlock_type} placeholders should keep the PM-approved point cost`
  );
}

for (const builtInReward of BUILT_IN_REWARD_CATALOG) {
  assert.equal(
    builtInReward.point_cost,
    approvedBuiltInCostsByUnlockType[builtInReward.unlock_type],
    `trusted built-in ${builtInReward.unlock_type} placeholders should keep the PM-approved point cost`
  );
}

for (const builtInReward of BUILT_IN_REWARD_CATALOG) {
  const builtInDecision = buildRewardRequestDecision({
    rewardCatalogItems: [],
    rewardRedemptions: [],
    studentId: 'student_a',
    rewardCatalogItemId: builtInReward.id,
    walletPoints: 500,
  });

  assert.equal(builtInDecision.ok, true);
  assert.equal(
    builtInDecision.status,
    RewardRedemptionStatuses.FULFILLED,
    `built-in ${builtInReward.unlock_type} rewards should fulfill immediately`
  );
  assert.equal(
    builtInDecision.ledger_source_type,
    PointSourceTypes.REWARD_BUILT_IN_UNLOCK,
    `built-in ${builtInReward.unlock_type} rewards should spend immediately`
  );

  const builtInSpendState = applyPointLedgerEntry({
    pointWallets: [baseWallet],
    pointLedgerEntries: [],
    parentId: 'parent_1',
    studentId: 'student_a',
    sourceType: builtInDecision.ledger_source_type,
    sourceId: `unlock_${builtInReward.id}`,
    deltaPoints: builtInReward.point_cost * -1,
    description: 'Built-in unlock',
  });

  assert.equal(builtInSpendState.applied, true);

  const builtInRedemption = buildRewardRedemptionWrite({
    parentId: 'parent_1',
    studentId: 'student_a',
    rewardCatalogItem: builtInReward,
    status: RewardRedemptionStatuses.FULFILLED,
    requestedAt: '2026-05-26T15:00:00.000Z',
  });

  const builtInRewardState = buildStudentSafeRewardState({
    studentId: 'student_a',
    pointWallets: [builtInSpendState.wallet],
    rewardCatalogItems: [],
    rewardRedemptions: [{
      id: `unlock_${builtInReward.id}`,
      student_id: 'student_a',
      reward_catalog_item_id: builtInReward.id,
      status: RewardRedemptionStatuses.FULFILLED,
      ...builtInRedemption,
    }],
  });

  const matchingCatalogItem = builtInRewardState.catalog.find((rewardCatalogItem) => (
    rewardCatalogItem.id === builtInReward.id
  ));
  assert.equal(matchingCatalogItem.is_unlocked, true);
  assert.equal(matchingCatalogItem.can_redeem, false);
}

console.log('check-reward-redemptions: pass');
