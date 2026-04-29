/**
 * Week Utility Functions
 * Provides calendar-based week calculations using a configurable weekly reset.
 */

const DEFAULT_RESET_DAY = 1;
const DEFAULT_RESET_HOUR = 0;
const DEFAULT_RESET_MINUTE = 0;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const normalizeWeekConfig = (config = {}) => ({
  resetDay: Number.isInteger(config.week_reset_day) ? config.week_reset_day : DEFAULT_RESET_DAY,
  resetHour: Number.isInteger(config.week_reset_hour) ? config.week_reset_hour : DEFAULT_RESET_HOUR,
  resetMinute: Number.isInteger(config.week_reset_minute) ? config.week_reset_minute : DEFAULT_RESET_MINUTE,
});

const getWeekBoundaryForDate = (date, config = {}) => {
  const { resetDay, resetHour, resetMinute } = normalizeWeekConfig(config);
  const boundary = new Date(date);
  const daysSinceReset = (boundary.getDay() - resetDay + 7) % 7;

  boundary.setDate(boundary.getDate() - daysSinceReset);
  boundary.setHours(resetHour, resetMinute, 0, 0);

  if (date < boundary) {
    boundary.setDate(boundary.getDate() - 7);
  }

  return boundary;
};

export const getWeekConfig = (config = {}) => normalizeWeekConfig(config);

/**
 * Get the start and end dates of the current week based on the configured reset.
 * @param {Date} date - Reference date (defaults to now)
 * @param {Object} config - Week reset config
 * @returns {Object} { weekStart, weekEnd } - Monday 00:00 and Sunday 23:59
 */
export const getCurrentWeekRange = (date = new Date(), config = {}) => {
  const weekStart = getWeekBoundaryForDate(date, config);
  const weekEnd = new Date(weekStart);
  weekEnd.setTime(weekStart.getTime() + WEEK_MS - 1);

  return { weekStart, weekEnd };
};

/**
 * Get the start and end dates of a specific week by week offset
 * @param {number} weekOffset - Number of weeks from current week (0 = current, -1 = last week, 1 = next week)
 * @param {Object} config - Week reset config
 * @returns {Object} { weekStart, weekEnd }
 */
export const getWeekRangeByOffset = (weekOffset, config = {}) => {
  const { weekStart: currentWeekStart } = getCurrentWeekRange(new Date(), config);
  const weekStart = new Date(currentWeekStart);
  weekStart.setTime(currentWeekStart.getTime() + (weekOffset * WEEK_MS));
  const weekEnd = new Date(weekStart);
  weekEnd.setTime(weekStart.getTime() + WEEK_MS - 1);
  return { weekStart, weekEnd };
};

/**
 * Get the start and end dates for a specific date's week
 * @param {Date} date - Any date within the target week
 * @param {Object} config - Week reset config
 * @returns {Object} { weekStart, weekEnd }
 */
export const getWeekRangeForDate = (date, config = {}) => {
  return getCurrentWeekRange(new Date(date), config);
};

/**
 * Format week range for display
 * @param {Date} weekStart 
 * @param {Date} weekEnd 
 * @returns {string} Formatted string like "Mon, Jan 1 - Sun, Jan 7, 2024"
 */
export const formatWeekRange = (weekStart, weekEnd) => {
  const options = { month: 'short', day: 'numeric' };
  const yearOptions = { year: 'numeric' };
  
  const startFormatted = weekStart.toLocaleDateString('en-US', options);
  const endFormatted = weekEnd.toLocaleDateString('en-US', options);
  const year = weekStart.toLocaleDateString('en-US', yearOptions);
  
  // If same year, don't repeat it
  if (weekStart.getFullYear() === weekEnd.getFullYear()) {
    return `${startFormatted} - ${endFormatted}, ${year}`;
  }
  
  return `${startFormatted}, ${weekStart.getFullYear()} - ${endFormatted}, ${weekEnd.getFullYear()}`;
};

/**
 * Get a human-readable label for a week offset
 * @param {number} weekOffset 
 * @returns {string} Label like "Current Week", "Last Week", "Next Week", "2 Weeks Ago"
 */
export const getWeekLabel = (weekOffset) => {
  if (weekOffset === 0) return 'Current Week';
  if (weekOffset === -1) return 'Last Week';
  if (weekOffset === 1) return 'Next Week';
  if (weekOffset === -2) return '2 Weeks Ago';
  if (weekOffset === -3) return '3 Weeks Ago';
  if (weekOffset === 2) return '2 Weeks Ahead';
  if (weekOffset === 3) return '3 Weeks Ahead';
  
  if (weekOffset < 0) return `${Math.abs(weekOffset)} Weeks Ago`;
  return `${weekOffset} Weeks Ahead`;
};

/**
 * Check if a timestamp falls within a given week range
 * @param {Date|Timestamp} timestamp 
 * @param {Date} weekStart 
 * @param {Date} weekEnd 
 * @returns {boolean}
 */
export const isTimestampInWeek = (timestamp, weekStart, weekEnd) => {
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date >= weekStart && date <= weekEnd;
};

/**
 * Get available week options for a week picker (past 12 weeks + current + next 4 weeks)
 * @returns {Array} Array of { value, label, weekStart, weekEnd } objects
 */
export const getWeekPickerOptions = (config = {}) => {
  const options = [];
  
  // Past 12 weeks
  for (let i = -12; i <= 4; i++) {
    const { weekStart, weekEnd } = getWeekRangeByOffset(i, config);
    options.push({
      value: i,
      label: getWeekLabel(i),
      weekStart,
      weekEnd,
      displayText: formatWeekRange(weekStart, weekEnd)
    });
  }
  
  return options;
};

/**
 * Calculate if it's a new week (for auto-reset logic)
 * @param {Date} lastCheckDate - When we last checked for week change
 * @param {Object} config - Week reset config
 * @returns {boolean} True if we've crossed into a new week
 */
export const hasWeekChanged = (lastCheckDate, config = {}) => {
  if (!lastCheckDate) return true;
  
  const lastWeek = getCurrentWeekRange(lastCheckDate, config);
  const currentWeek = getCurrentWeekRange(new Date(), config);
  
  return lastWeek.weekStart.getTime() !== currentWeek.weekStart.getTime();
};

/**
 * Get the week number within the year (1-52)
 * @param {Date} date 
 * @returns {number} Week number
 */
export const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
};

/**
 * Check if a given week is the current week
 * @param {Date} weekStart 
 * @param {Object} config - Week reset config
 * @returns {boolean}
 */
export const isCurrentWeek = (weekStart, config = {}) => {
  const { weekStart: currentWeekStart } = getCurrentWeekRange(new Date(), config);
  return weekStart.getTime() === currentWeekStart.getTime();
};
