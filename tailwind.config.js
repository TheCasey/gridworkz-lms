/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Super Sans VF', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      },
      fontWeight: {
        body: '460',
        display: '540',
        ui: '600',
        label: '700',
      },
      colors: {
        // Legacy colors (used by pages not yet refactored)
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Superhuman design system
        'mysteria':      '#1b1938',
        'lavender-glow': '#cbb7fb',
        'charcoal-ink':  '#292827',
        'amethyst-link': '#714cb6',
        'warm-cream':    '#e9e5dd',
        'parchment':     '#dcd7d3',
      },
    },
  },
  plugins: [],
}
