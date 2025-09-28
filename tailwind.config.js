/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: '#FF7A1A',
        ink: {
          900: '#111111',
          700: '#3A3A3A',
          400: '#777777',
          200: '#EAEAEA'
        }
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px'
      },
      spacing: {
        8: '8px',
        12: '12px',
        16: '16px'
      }
    },
  },
  plugins: [],
}