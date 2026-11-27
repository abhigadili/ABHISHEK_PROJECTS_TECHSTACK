/** Tailwind is used for utility styling only: preflight is off (Bootstrap reboot + Material own the base) and every colour comes from the design-token CSS variables. */
const rgb = (n) => `rgb(var(--hr-${n}-rgb) / <alpha-value>)`;
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  corePlugins: { preflight: false },
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: { primary: rgb('primary'), 'primary-fg': rgb('primary-fg'), surface: rgb('surface'), 'surface-2': rgb('surface-2'), bg: rgb('bg'), border: rgb('border'), text: rgb('text'), muted: rgb('muted'), success: rgb('success'), warning: rgb('warning'), danger: rgb('danger'), info: rgb('info') },
      fontFamily: { sans: ['Inter', 'Noto Sans Telugu', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'] },
    },
  },
};
