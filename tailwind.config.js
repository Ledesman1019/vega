/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Arial', 'Helvetica', '"Helvetica Neue"', 'sans-serif'],
      },
      colors: {
        vega: {
          red: '#e20514',
          'red-dark': '#b40410',
          ink: '#16171a',
        },
      },
    },
  },
  plugins: [],
}