/**
 * Timer Utilities
 * Provides background-stable timer functionality using Target End Time logic
 */

/**
 * Create a timer configuration with target end time
 * @param {number} durationMinutes - Timer duration in minutes
 * @returns {Object} Timer configuration
 */
export const createTimerConfig = (durationMinutes) => {
  const startTime = Date.now();
  const durationMs = durationMinutes * 60 * 1000;
  const targetEndTime = startTime + durationMs;
  
  return {
    startTime,
    durationMs,
    targetEndTime,
    durationMinutes,
    initialDurationMs: durationMs,
    remainingTime: durationMs
  };
};

/**
 * Calculate remaining time based on target end time
 * @param {number} targetEndTime - Target end time timestamp
 * @returns {number} Remaining time in milliseconds
 */
export const getRemainingTime = (targetEndTime) => {
  const now = Date.now();
  const remaining = targetEndTime - now;
  return Math.max(0, remaining);
};

/**
 * Check if timer is completed
 * @param {number} targetEndTime - Target end time timestamp
 * @returns {boolean} True if timer is completed
 */
export const isTimerCompleted = (targetEndTime) => {
  return getRemainingTime(targetEndTime) === 0;
};

/**
 * Save timer configuration to localStorage
 * @param {string} key - Storage key
 * @param {Object} timerConfig - Timer configuration
 * @param {string} studentId - Student ID
 * @param {string} subjectId - Subject ID
 * @param {number} blockIndex - Block index
 */
export const saveTimerToStorage = (key, timerConfig, studentId, subjectId, blockIndex) => {
  try {
    const data = {
      ...timerConfig,
      studentId,
      subjectId,
      blockIndex,
      savedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving timer to localStorage:', error);
  }
};

/**
 * Load timer configuration from localStorage
 * @param {string} key - Storage key
 * @returns {Object|null} Timer configuration or null if invalid
 */
export const loadTimerFromStorage = (key) => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    
    // Check if timer is still valid (not too old)
    const now = Date.now();
    const age = now - data.savedAt;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (age > maxAge) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error loading timer from localStorage:', error);
    return null;
  }
};

/**
 * Remove timer from localStorage
 * @param {string} key - Storage key
 */
export const clearTimerFromStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing timer from localStorage:', error);
  }
};

/**
 * Generate timer storage key
 * @param {string} studentId - Student ID
 * @param {string} subjectId - Subject ID
 * @returns {string} Storage key
 */
export const getTimerKey = (studentId, subjectId) => {
  return `timer_${studentId}_${subjectId}`;
};

/**
 * Generate timer session document id
 * @param {string} studentId - Student ID
 * @param {string} subjectId - Subject ID
 * @returns {string} Firestore document id
 */
export const getTimerSessionDocId = (studentId, subjectId) => {
  return `${studentId}_${subjectId}`;
};

/**
 * Format remaining time for display
 * @param {number} remainingMs - Remaining time in milliseconds
 * @returns {string} Formatted time string (MM:SS)
 */
export const formatRemainingTime = (remainingMs) => {
  // Handle NaN, undefined, null, or negative values
  if (isNaN(remainingMs) || remainingMs === null || remainingMs === undefined || remainingMs < 0) {
    return "00:00";
  }
  
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Get timer progress percentage
 * @param {number} targetEndTime - Target end time timestamp
 * @param {number} initialDurationMs - Initial duration in milliseconds
 * @returns {number} Progress percentage (0-100)
 */
export const getTimerProgress = (targetEndTime, initialDurationMs) => {
  const remaining = getRemainingTime(targetEndTime);
  const elapsed = initialDurationMs - remaining;
  return Math.min(100, Math.max(0, (elapsed / initialDurationMs) * 100));
};

/**
 * Resume timer from storage with updated target end time
 * @param {Object} storedData - Stored timer data
 * @returns {Object} Updated timer configuration
 */
export const resumeTimerFromStorage = (storedData) => {
  return hydrateStoredTimer(storedData);
};

/**
 * Normalize timer data from localStorage or Firestore into UI state
 * @param {Object} storedData - Raw timer data
 * @returns {Object|null} Hydrated timer state
 */
export const hydrateStoredTimer = (storedData) => {
  if (!storedData) return null;

  const startTime = storedData.startTime ?? storedData.start_time ?? Date.now();
  const durationMs = storedData.durationMs ?? storedData.duration_ms ?? 0;
  const targetEndTime = storedData.targetEndTime ?? storedData.target_end_time ?? startTime + durationMs;
  const durationMinutes = storedData.durationMinutes ?? storedData.duration_minutes ?? Math.round(durationMs / 60000);
  const initialDurationMs = storedData.initialDurationMs ?? storedData.initial_duration_ms ?? durationMs;
  const blockIndex = storedData.blockIndex ?? storedData.block_index ?? null;
  const pausedAt = storedData.pausedAt ?? storedData.paused_at ?? null;
  const resumedAt = storedData.resumedAt ?? storedData.resumed_at ?? null;
  const completedAt = storedData.completedAt ?? storedData.completed_at ?? null;
  const savedAt = storedData.savedAt ?? storedData.saved_at ?? null;
  const isRunning = storedData.isRunning ?? storedData.is_running ?? false;
  const savedRemaining = storedData.remainingTime ?? storedData.remaining_time ?? null;
  const computedRemaining = getRemainingTime(targetEndTime);
  const remainingTime = pausedAt && !isRunning
    ? Math.max(0, savedRemaining ?? computedRemaining)
    : computedRemaining;

  return {
    ...storedData,
    startTime,
    durationMs,
    targetEndTime,
    durationMinutes,
    initialDurationMs,
    blockIndex,
    pausedAt,
    resumedAt,
    completedAt,
    savedAt,
    isRunning: remainingTime > 0 ? isRunning : false,
    remainingTime
  };
};
