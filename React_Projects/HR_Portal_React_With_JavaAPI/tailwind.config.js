/** Tailwind: preflight is OFF so Bootstrap's reboot + MUI's baseline own the resets (see src/styles/README in docs). */
export default {
  important: true,
  darkMode: ['class', '[data-theme="dark"]'],
  corePlugins: { preflight: false },
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--hr-bg-rgb) / <alpha-value>)', surface: 'rgb(var(--hr-surface-rgb) / <alpha-value>)', 'surface-2': 'rgb(var(--hr-surface-2-rgb) / <alpha-value>)',
        border: 'rgb(var(--hr-border-rgb) / <alpha-value>)', foreground: 'rgb(var(--hr-text-rgb) / <alpha-value>)', muted: 'rgb(var(--hr-muted-rgb) / <alpha-value>)',
        primary: { DEFAULT: 'rgb(var(--hr-primary-rgb) / <alpha-value>)', foreground: '#fff', soft: 'rgb(var(--hr-primary-soft-rgb) / <alpha-value>)' },
        success: 'rgb(var(--hr-success-rgb) / <alpha-value>)', warning: 'rgb(var(--hr-warning-rgb) / <alpha-value>)', danger: 'rgb(var(--hr-danger-rgb) / <alpha-value>)', info: 'rgb(var(--hr-info-rgb) / <alpha-value>)',
      },
      borderRadius: { lg: '12px', md: '8px', sm: '6px' },
      boxShadow: { card: 'var(--hr-shadow)' },
      fontFamily: { sans: ['Inter', 'Noto Sans Telugu', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
