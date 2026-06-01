/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0D12',
        surface: '#14181F',
        'surface-2': '#1A1F29',
        'surface-3': '#222836',
        gold: '#F7A50A',
        'gold-bright': '#FFC23D',
        green: '#3FD07A',
        pink: '#FF4D74',
        text: '#F4F1EA',
        muted: '#98A0AD',
        faint: '#6A7280',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        sunset: 'linear-gradient(115deg, #FF4D74 0%, #FF7A2F 46%, #F7A50A 100%)',
      },
    },
  },
  plugins: [],
}
