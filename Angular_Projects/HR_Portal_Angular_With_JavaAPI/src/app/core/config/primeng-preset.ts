import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

/** PrimeNG (advanced tables, tree table, organisation chart) on the same indigo palette as the design tokens. */
export const HrPreset = definePreset(Aura, {
  semantic: {
    primary: { 50: '{indigo.50}', 100: '{indigo.100}', 200: '{indigo.200}', 300: '{indigo.300}', 400: '{indigo.400}', 500: '{indigo.500}', 600: '{indigo.600}', 700: '{indigo.700}', 800: '{indigo.800}', 900: '{indigo.900}', 950: '{indigo.950}' },
    colorScheme: {
      light: { surface: { 0: '#ffffff', 50: '#f5f6fa', 100: '#f0f2f8', 200: '#e4e7ee', 300: '#d1d5e0', 400: '#9aa4c0', 500: '#667085', 600: '#475467', 700: '#344054', 800: '#1b2133', 900: '#121828', 950: '#0b1020' } },
      dark: { surface: { 0: '#ffffff', 50: '#e6e9f5', 100: '#c9cfe6', 200: '#9aa4c0', 300: '#6b7599', 400: '#454e75', 500: '#2a3150', 600: '#1f2540', 700: '#171c2e', 800: '#0f1320', 900: '#0b0e18', 950: '#070910' } },
    },
  },
});
