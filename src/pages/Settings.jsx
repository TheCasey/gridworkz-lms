import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, GraduationCap, Save } from 'lucide-react';
import {
  RESET_DAY_OPTIONS,
  calculateQuarterRanges,
  formatResetSchedule,
  formatTimeInputValue,
  parseTimeInputValue,
} from '../utils/schoolSettingsUtils';
import { formatWeekRange } from '../utils/weekUtils';

const C = {
  lavender: '#cbb7fb',
  charcoal: '#292827',
  amethyst: '#714cb6',
  cream: '#e9e5dd',
  parchment: '#dcd7d3',
  lavenderTint: '#f0eaff',
};

const inputClassName = 'w-full px-3 py-2.5 rounded-lg bg-white text-[14px] focus:outline-none';

const Settings = ({ settings, onSave, saving }) => {
  const [formData, setFormData] = useState(settings);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const quarters = useMemo(
    () => calculateQuarterRanges(formData.school_year_start, formData.school_year_end),
    [formData.school_year_start, formData.school_year_end]
  );

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { hour, minute } = parseTimeInputValue(formData.reset_time);

    await onSave({
      ...formData,
      week_reset_day: Number(formData.week_reset_day),
      week_reset_hour: hour,
      week_reset_minute: minute,
    });
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-[26px] font-display text-charcoal-ink" style={{ lineHeight: 1.1, letterSpacing: '-0.5px' }}>Settings</h2>
        <p className="text-[14px] text-charcoal-ink/50 font-body mt-1">Control your school calendar and weekly rollover schedule.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${C.parchment}` }}>
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-4 h-4" style={{ color: C.amethyst }} />
            <h3 className="text-[17px] font-display text-charcoal-ink">School Year</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">School Name</label>
              <input
                value={formData.school_name || ''}
                onChange={event => handleChange('school_name', event.target.value)}
                placeholder="Casey Academy"
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">Start Date</label>
              <input
                type="date"
                value={formData.school_year_start || ''}
                onChange={event => handleChange('school_year_start', event.target.value)}
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">End Date</label>
              <input
                type="date"
                value={formData.school_year_end || ''}
                onChange={event => handleChange('school_year_end', event.target.value)}
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">Timezone</label>
              <input
                value={formData.timezone || ''}
                onChange={event => handleChange('timezone', event.target.value)}
                placeholder="America/Chicago"
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              />
            </div>
          </div>

          <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: `${C.lavenderTint}70`, border: `1px solid rgba(203,183,251,0.55)` }}>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4" style={{ color: C.amethyst }} />
              <p className="text-[12px] uppercase tracking-wider font-label" style={{ color: C.amethyst }}>Quarter Calendar</p>
            </div>

            {quarters.length === 0 ? (
              <p className="text-[13px] font-body text-charcoal-ink/45">
                Add a valid school-year start and end date to generate quarter ranges automatically.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quarters.map(quarter => (
                  <div key={quarter.label} className="rounded-xl p-4 bg-white" style={{ border: `1px solid ${C.parchment}` }}>
                    <p className="text-[11px] uppercase tracking-wider font-label mb-1" style={{ color: C.amethyst }}>{quarter.label}</p>
                    <p className="text-[14px] font-display text-charcoal-ink">{formatWeekRange(quarter.start, quarter.end)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${C.parchment}` }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock3 className="w-4 h-4" style={{ color: C.amethyst }} />
            <h3 className="text-[17px] font-display text-charcoal-ink">Weekly Reset</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">Reset Day</label>
              <select
                value={formData.week_reset_day}
                onChange={event => handleChange('week_reset_day', event.target.value)}
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              >
                {RESET_DAY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-label mb-1.5 text-charcoal-ink/40">Reset Time</label>
              <input
                type="time"
                value={formData.reset_time}
                onChange={event => handleChange('reset_time', event.target.value)}
                className={inputClassName}
                style={{ border: `1px solid ${C.parchment}` }}
              />
            </div>
          </div>

          <div className="mt-5 rounded-xl px-4 py-3" style={{ backgroundColor: C.cream }}>
            <p className="text-[11px] uppercase tracking-wider font-label mb-1 text-charcoal-ink/40">Current Schedule</p>
            <p className="text-[14px] font-body text-charcoal-ink">{formatResetSchedule(formData)}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: C.charcoal, color: '#fff', fontSize: 14, fontWeight: 700 }}
            onMouseEnter={event => { if (!saving) event.currentTarget.style.backgroundColor = '#3a3937'; }}
            onMouseLeave={event => event.currentTarget.style.backgroundColor = C.charcoal}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const buildSettingsFormState = (settings) => ({
  ...settings,
  reset_time: formatTimeInputValue(settings.week_reset_hour, settings.week_reset_minute),
});

export default Settings;
