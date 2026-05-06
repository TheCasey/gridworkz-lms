const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';

export const RESET_DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const DEFAULT_PARENT_SETTINGS = {
  school_name: '',
  school_year_start: '',
  school_year_end: '',
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: DEFAULT_TIMEZONE,
  last_rollover_week_key: '',
  last_rollover_at: null,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const mergeParentSettings = (settings = {}, currentUser = null) => ({
  uid: currentUser?.uid || settings.uid || '',
  email: currentUser?.email || settings.email || '',
  ...DEFAULT_PARENT_SETTINGS,
  ...settings,
  timezone: settings.timezone || DEFAULT_TIMEZONE,
});

export const buildDefaultParentProfile = (currentUser) => ({
  uid: currentUser.uid,
  email: currentUser.email || '',
  ...DEFAULT_PARENT_SETTINGS,
});

export const formatTimeInputValue = (hour = 0, minute = 0) => (
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
);

export const buildSettingsFormState = (settings = {}) => ({
  ...settings,
  reset_time: formatTimeInputValue(settings.week_reset_hour, settings.week_reset_minute),
});

export const parseTimeInputValue = (value) => {
  const [rawHour = '0', rawMinute = '0'] = String(value || '').split(':');
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);

  return {
    hour: Number.isInteger(hour) ? hour : 0,
    minute: Number.isInteger(minute) ? minute : 0,
  };
};

export const formatResetSchedule = (settings = {}) => {
  const day = RESET_DAY_OPTIONS.find(option => option.value === settings.week_reset_day)?.label || 'Monday';
  const time = formatTimeInputValue(settings.week_reset_hour, settings.week_reset_minute);
  return `${day} at ${time}`;
};

export const normalizeDateString = (value) => {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toISOString().slice(0, 10);
};

export const parseDateString = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
};

export const getSchoolYearLabel = (startDate, endDate) => {
  if (!startDate || !endDate) return 'Unscheduled School Year';
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  return startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`;
};

export const calculateQuarterRanges = (startValue, endValue) => {
  const schoolYearStart = parseDateString(startValue);
  const schoolYearEnd = parseDateString(endValue, true);

  if (!schoolYearStart || !schoolYearEnd || schoolYearEnd < schoolYearStart) {
    return [];
  }

  const totalDays = Math.floor((schoolYearEnd.getTime() - schoolYearStart.getTime()) / DAY_MS) + 1;
  const baseSize = Math.floor(totalDays / 4);
  const remainder = totalDays % 4;
  const quarters = [];
  let cursor = new Date(schoolYearStart);

  for (let index = 0; index < 4; index += 1) {
    const quarterLength = baseSize + (index < remainder ? 1 : 0);
    const quarterStart = new Date(cursor);
    const quarterEnd = new Date(cursor);
    quarterEnd.setDate(quarterEnd.getDate() + quarterLength - 1);
    quarterEnd.setHours(23, 59, 59, 999);

    quarters.push({
      index: index + 1,
      label: `Q${index + 1}`,
      start: quarterStart,
      end: quarterEnd,
    });

    cursor = new Date(quarterEnd);
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return quarters;
};

export const getSchoolYearMetadataForDate = (dateInput, settings = {}) => {
  const schoolYearStart = parseDateString(settings.school_year_start);
  const schoolYearEnd = parseDateString(settings.school_year_end, true);
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  if (
    !schoolYearStart ||
    !schoolYearEnd ||
    Number.isNaN(date.getTime()) ||
    date < schoolYearStart ||
    date > schoolYearEnd
  ) {
    return null;
  }

  const quarters = calculateQuarterRanges(settings.school_year_start, settings.school_year_end);
  const quarter = quarters.find(item => date >= item.start && date <= item.end) || null;

  return {
    schoolYearLabel: getSchoolYearLabel(schoolYearStart, schoolYearEnd),
    schoolYearStart,
    schoolYearEnd,
    quarter,
  };
};

export const getSchoolYearOptionsFromReports = (weeklyReports = []) => {
  const options = weeklyReports.reduce((acc, report) => {
    const label = report.school_year_label;
    if (label && !acc.includes(label)) acc.push(label);
    return acc;
  }, []);

  return options.sort((a, b) => b.localeCompare(a));
};
