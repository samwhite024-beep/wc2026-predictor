/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#C62828', light: '#EF5350', dark: '#8B0000' },
      },
    },
  },
  plugins: [],
}
