/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cherry: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        dark: {
          950: '#0a0204',
          900: '#120407',
          850: '#1a060a',
          800: '#240a10',
          700: '#351119',
          600: '#4a1924',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'cherry-glow': '0 0 25px -5px rgba(225, 29, 72, 0.35)',
        'cherry-glow-lg': '0 0 45px -10px rgba(225, 29, 72, 0.45)',
        'cherry-card': '0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(244, 63, 94, 0.12)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'doomed-pulse': 'doomedPulse 2s ease-in-out infinite',
      },
      keyframes: {
        doomedPulse: {
          '0%, 100%': { boxShadow: '0 0 20px 2px rgba(225, 29, 72, 0.4)' },
          '50%': { boxShadow: '0 0 35px 8px rgba(225, 29, 72, 0.75)' },
        }
      }
    },
  },
  plugins: [],
}
