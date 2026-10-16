// Browser-safe shared vocabulary. Server authority owns prices and grants.
export const PRODUCT_DIRECTION_VERSION = 1;
export const ROUTINE_REWARD_MIGRATION_VERSION = 1;
export const ROUTINE_REWARD_CONTRACT = 'routine_rewards_v1';
export const ROUTINE_REWARD_DEFAULTS = Object.freeze({ routine_day_points: 10, routine_points_enabled: true });
export const ROUTINE_REWARD_COLLECTIONS = Object.freeze({
  DAY_SNAPSHOTS: 'routineDaySnapshots',
  DAY_POINTERS: 'routineDayPointers',
  COSMETIC_STATES: 'studentCosmeticStates',
  HISTORY_EVENTS: 'householdHistoryEvents',
});
export const ROUTINE_REWARD_CATALOG = Object.freeze([
  Object.freeze({ id: 'builtin_avatar_seedling', type: 'built_in', title: 'Seedling', description: 'A fresh start for your daily routine.', unlock_type: 'avatar', unlock_key: 'seedling', point_cost: 0, is_active: true }),
  Object.freeze({ id: 'builtin_avatar_stargazer', type: 'built_in', title: 'Stargazer', description: 'A curious explorer beneath the stars.', unlock_type: 'avatar', unlock_key: 'stargazer', point_cost: 20, is_active: true }),
  Object.freeze({ id: 'builtin_badge_comet', type: 'built_in', title: 'Comet', description: 'A bright comet for your profile.', unlock_type: 'badge', unlock_key: 'comet', point_cost: 10, is_active: true }),
  Object.freeze({ id: 'builtin_theme_twilight', type: 'built_in', title: 'Twilight', description: 'Soft violet colors for your routine space.', unlock_type: 'profile_theme', unlock_key: 'twilight', point_cost: 30, is_active: true }),
]);
export const ROUTINE_REWARD_BASE_COSMETIC_ID = 'builtin_avatar_seedling';
export const ROUTINE_REWARD_SLOTS = Object.freeze(['avatar', 'badge', 'profile_theme']);
