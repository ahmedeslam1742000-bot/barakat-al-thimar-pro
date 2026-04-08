/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F2747', // Deep Navy
          light: '#1E3A5F',
          dark: '#0A1A31',
        },
        secondary: {
          DEFAULT: '#334155', // Slate
          light: '#475569',
          dark: '#1E293B',
        },
        accent: {
          DEFAULT: '#10B981', // Emerald
          light: '#34D399',
          dark: '#059669',
        },
        background: {
          light: '#F8FAFC',
          dark: '#0B1220',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1F2937',
          header: '#111827',
          elevated: '#243244',
        },
        border: {
          light: '#E2E8F0',
          dark: '#334155',
        },
        text: {
          primary: {
            light: '#0F172A',
            dark: '#F8FAFC',
          },
          secondary: {
            light: '#64748B',
            dark: '#CBD5E1',
          },
          muted: {
            light: '#94A3B8',
            dark: '#94A3B8',
          },
        },
        status: {
          success: '#16A34A',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
      },
      fontFamily: {
        tajawal: ['Tajawal', 'sans-serif'],
        readex: ['Readex Pro', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'button': '11px',
      },
    },
  },
  plugins: [],
}

