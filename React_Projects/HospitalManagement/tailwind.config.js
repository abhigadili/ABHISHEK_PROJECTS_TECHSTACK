/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  // Preflight is disabled because MUI ships its own CssBaseline; src/styles/global.css provides a small shared reset.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef8ff', 100: '#d9efff', 200: '#bce3ff', 300: '#8ed1ff', 400: '#59b6ff', 500: '#3395fc', 600: '#1d76f1', 700: '#165fde', 800: '#184ecc', 900: '#1a459f' },
        surface: 'var(--hms-surface)',
        'surface-alt': 'var(--hms-surface-alt)',
        fg: 'var(--hms-fg)',
        muted: 'var(--hms-muted)',
        line: 'var(--hms-border)',
      },
    },
  },
  plugins: [],
};
