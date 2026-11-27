/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: ['class', '.dark'],
  theme: { extend: { colors: { brand: { 50: '#eef8ff', 100: '#d9efff', 500: '#3395fc', 600: '#1d76f1', 700: '#165fde', 800: '#184ecc' } } } },
  plugins: [],
};
