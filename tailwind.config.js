/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0a0a0f',
        'dark-card': '#1a1a2e',
        'dark-border': '#2a2a3e',
        'primary': '#6C3CE1',
        'secondary': '#E93E9B',
        'accent': '#F5A623'
      }
    },
  },
  plugins: [],
}