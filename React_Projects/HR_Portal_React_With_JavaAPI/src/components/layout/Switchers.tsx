import { useState } from 'react';
import { Menu, MenuItem, ListItemIcon, Tooltip } from '@mui/material';
import { Languages, Moon, Sun, Monitor, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LANGUAGES } from '@/i18n';
import { useFormat } from '@/contexts/LanguageContext';
import { useThemeMode, type ThemeMode } from '@/contexts/ThemeContext';

export function LanguageSwitcher() {
  const { t } = useTranslation(); const { lang, setLang } = useFormat(); const [a, setA] = useState<HTMLElement | null>(null);
  return (<>
    <Tooltip title={t('common.language')}><Button variant="ghost" size="sm" onClick={(e) => setA(e.currentTarget)} aria-label={t('common.language')}><Languages size={16} />{LANGUAGES.find((l) => l.code === lang)?.label}</Button></Tooltip>
    <Menu anchorEl={a} open={!!a} onClose={() => setA(null)}>
      {LANGUAGES.map((l) => <MenuItem key={l.code} selected={l.code === lang} onClick={() => { setLang(l.code); setA(null); }}>{l.label}</MenuItem>)}
    </Menu>
  </>);
}
export function ThemeSwitcher() {
  const { t } = useTranslation(); const { mode, resolved, setMode } = useThemeMode(); const [a, setA] = useState<HTMLElement | null>(null);
  const opts: { m: ThemeMode; icon: any; label: string }[] = [{ m: 'light', icon: Sun, label: t('common.light') }, { m: 'dark', icon: Moon, label: t('common.dark') }, { m: 'system', icon: Monitor, label: t('common.system') }];
  return (<>
    <Tooltip title={t('common.theme')}><Button variant="ghost" size="icon" onClick={(e) => setA(e.currentTarget)} aria-label={t('common.theme')}>{resolved === 'dark' ? <Moon size={17} /> : <Sun size={17} />}</Button></Tooltip>
    <Menu anchorEl={a} open={!!a} onClose={() => setA(null)}>
      {opts.map(({ m, icon: I, label }) => <MenuItem key={m} onClick={() => { setMode(m); setA(null); }}><ListItemIcon><I size={16} /></ListItemIcon>{label}{mode === m && <Check size={14} className="ml-2" />}</MenuItem>)}
    </Menu>
  </>);
}
