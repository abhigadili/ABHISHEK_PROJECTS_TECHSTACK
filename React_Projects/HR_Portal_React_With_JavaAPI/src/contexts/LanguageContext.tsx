import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import 'dayjs/locale/hi';
import 'dayjs/locale/te';
import { LANGUAGES } from '@/i18n';
import { useAppSelector } from '@/store/redux';

interface Fmt {
  lang: string; locale: string; setLang: (l: string) => void;
  date: (v?: string | Date | null) => string; dateTime: (v?: string | Date | null) => string; time: (v?: string | null) => string;
  number: (v?: number | null, o?: Intl.NumberFormatOptions) => string; money: (v?: number | string | null, cur?: string) => string;
}
const Ctx = createContext<Fmt>(null as unknown as Fmt);
export const useFormat = () => useContext(Ctx);

/** Language context: i18next language + locale-aware date / number / currency / time formatters (Intl). */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const currency = useAppSelector((s) => s.settings.currency);
  const lang = (i18n.resolvedLanguage || 'en').slice(0, 2);
  const locale = LANGUAGES.find((l) => l.code === lang)?.locale ?? 'en-IN';
  useEffect(() => { document.documentElement.lang = lang; dayjs.locale(lang); }, [lang]);
  const setLang = useCallback((l: string) => { i18n.changeLanguage(l); }, [i18n]);
  const value = useMemo<Fmt>(() => ({
    lang, locale, setLang,
    date: (v) => (v ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(String(v).length === 10 ? v + 'T00:00:00' : (v as string))) : '—'),
    dateTime: (v) => (v ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '—'),
    time: (v) => (v ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(v.length <= 8 ? `1970-01-01T${v}` : v)) : '—'),
    number: (v, o) => (v == null ? '—' : new Intl.NumberFormat(locale, o).format(v)),
    money: (v, cur) => (v == null || v === '' ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: cur || currency, maximumFractionDigits: 2 }).format(Number(v))),
  }), [lang, locale, setLang, currency]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
