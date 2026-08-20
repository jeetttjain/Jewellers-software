/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/shared/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FDFBF4',
          100: '#FBF6E4',
          200: '#F5EAC4',
          300: '#EED999',
          400: '#E4C365',
          500: '#D4AF37', // Primary Showroom Gold Accent
          600: '#B8860B', // Darker Gold for high-contrast borders & text
          700: '#916B09',
          800: '#73550D',
          900: '#5F460E'
        },
        surface: {
          50: '#F8F9FA',  // Clean showroom page background
          100: '#F1F3F5', // Card and panel backgrounds
          200: '#E9ECEF', // Borders & dividers
          300: '#DEE2E6',
          700: '#343A40',
          800: '#212529',
          900: '#111827'  // High-contrast slate text
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Roboto Mono', 'monospace']
      }
    }
  },
  plugins: []
};
