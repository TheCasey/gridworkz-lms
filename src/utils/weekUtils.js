/**
 * Week Utility Functions
 * Provides calendar-based week calculations for Monday-Sunday weeks
 */

/**
 * Get the start and end dates of the current week (Monday-Sunday)
 * @param {Date} date - Reference date (defaults to now)
 * @returns {Object} { weekStart, weekEnd } - Monday 00:00 and Sunday 23:59
 */
export const getCurrentWeekRange = (date = new Date()) => {
  const weekStart = new Date(date);
  const dayOfWeek = weekStart.getDay();
  
  // Adjust to Monday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  // If it's Sunday (0), go back 6 days to get to Monday
  // If it's Monday (1), stay on the same day
  // Otherwise, go back (dayOfWeek - 1) days
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0); // Monday 00:00
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Sunday
  weekEnd.setHours(23, 59, 59, 999); // Sunday 23:59:59
  
  return { weekStart, weekEnd };
};

/**
 * Get the start and end dates of a specific week by week offset
 * @param {number} weekOffset - Number of weeks from current week (0 = current, -1 = last week, 1 = next week)
 * @returns {Object} { weekStart, weekEnd }
 */
export const getWeekRangeByOffset = (weekOffset) => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + (weekOffset * 7));
  return getCurrentWeekRange(targetDate);
};

/**
 * Get the start and end dates for a specific date's week
 * @param {Date} date - Any date within the target week
 * @returns {Object} { weekStart, weekEnd }
 */
export const getWeekRangeForDate = (date) => {
  return getCurrentWeekRange(new Date(date));
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
export const getWeekPickerOptions = () => {
  const options = [];
  
  // Past 12 weeks
  for (let i = -12; i <= 4; i++) {
    const { weekStart, weekEnd } = getWeekRangeByOffset(i);
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
 * @returns {boolean} True if we've crossed into a new week
 */
export const hasWeekChanged = (lastCheckDate) => {
  if (!lastCheckDate) return true;
  
  const lastWeek = getCurrentWeekRange(lastCheckDate);
  const currentWeek = getCurrentWeekRange();
  
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
 * @returns {boolean}
 */
export const isCurrentWeek = (weekStart) => {
  const { weekStart: currentWeekStart } = getCurrentWeekRange();
  return weekStart.getTime() === currentWeekStart.getTime();
};
