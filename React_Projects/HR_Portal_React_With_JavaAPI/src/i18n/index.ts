import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en';
import te from './locales/te';
import hi from './locales/hi';
import uiEn from './locales/en/ui';
import uiTe from './locales/te/ui';
import uiHi from './locales/hi/ui';

export const LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-IN' },
  { code: 'te', label: 'తెలుగు', locale: 'te-IN' },
  { code: 'hi', label: 'हिन्दी', locale: 'hi-IN' },
] as const;

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: { en: { translation: en, ui: uiEn }, te: { translation: te, ui: uiTe }, hi: { translation: hi, ui: uiHi } },
  fallbackLng: 'en',
  supportedLngs: ['en', 'te', 'hi'],
  nonExplicitSupportedLngs: true,
  load: 'languageOnly',
  interpolation: { escapeValue: false },
  detection: { order: ['localStorage'], lookupLocalStorage: 'hr.lang', caches: ['localStorage'] },
  lng: undefined,
});
if (!localStorage.getItem('hr.lang')) i18n.changeLanguage('en'); // English is the default (never browser-detected)
export default i18n;

/** Translate a literal English UI phrase through the flat `ui` namespace (falls back to the phrase itself). */
export const tr = (s: string): string => i18n.t(s, { ns: 'ui', defaultValue: s, keySeparator: false, nsSeparator: false }) as string;
