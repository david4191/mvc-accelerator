/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Open Sans', 'system-ui', 'sans-serif'],
        'display': ['Futura PT', 'Open Sans', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f5f7f2',
          100: '#e8ede0',
          200: '#d1dbc1',
          300: '#b3c29b',
          400: '#95a975',
          500: '#4A5C3A', // Your army green
          600: '#3d4c30',
          700: '#303d26',
          800: '#232e1c',
          900: '#161f12',
        }
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 12px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}