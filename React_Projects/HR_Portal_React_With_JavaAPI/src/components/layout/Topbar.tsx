import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Menu, MenuItem, ListItemIcon, Divider, Tooltip } from '@mui/material';
import { HelpCircle, LogOut, Menu as MenuIcon, UserCircle, Zap, CalendarPlus, LogIn, Home as HomeIcon, MessageSquare, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { GlobalSearch } from './GlobalSearch';
import { NotificationCenter } from './NotificationCenter';
import { LanguageSwitcher, ThemeSwitcher } from './Switchers';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { OpDialog } from '@/components/op/OpDialog';
import { useUiStore } from '@/store/zustand/uiStore';
import { useAppSelector } from '@/store/redux';
import { performLogout } from '@/features/authentication/authService';
import { initials } from '@/utils/format';
import { useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';

const QUICK = [
  { op: 'leave.apply', icon: CalendarPlus, key: 'applyLeave' }, { op: 'attendance.checkIn', icon: LogIn, key: 'checkIn' },
  { op: 'attendance.requestWfh', icon: HomeIcon, key: 'requestWfh' }, { op: 'performance.give', icon: MessageSquare, key: 'giveFeedback' },
];
const QL: Record<string, string> = { applyLeave: 'Apply for leave', checkIn: 'Check in', requestWfh: 'Request work from home', giveFeedback: 'Give feedback' };

export function Topbar() {
  const { t } = useTranslation(); const nav = useNavigate(); const qc = useQueryClient();
  const setMobile = useUiStore((s) => s.setMobileNav); const user = useAppSelector((s) => s.auth.user);
  const [um, setUm] = useState<HTMLElement | null>(null); const [qm, setQm] = useState<HTMLElement | null>(null);
  const [dlg, setDlg] = useState<string | null>(null); const [help, setHelp] = useState(false); const { canCall } = usePermissions(); const quick = QUICK.filter((q) => canCall(q.op));
  const logout = async () => { await performLogout(); qc.clear(); toast.info(t('auth.loggedOut'), { toastId: 'lo' }); nav('/login', { replace: true }); };
  return (
    <header className="no-print sticky-top d-flex align-items-center gap-2 border-bottom bg-surface px-3" style={{ height: 'var(--hr-topbar)', zIndex: 1050, borderColor: 'var(--hr-border)' }}>
      <Button variant="ghost" size="icon" className="d-lg-none" onClick={() => setMobile(true)} aria-label="Open menu"><MenuIcon size={19} /></Button>
      <GlobalSearch />
      <div className="ms-auto d-flex align-items-center gap-1">
        {quick.length > 0 && <Tooltip title={t('common.quickActions')}><Button variant="soft" size="sm" onClick={(e) => setQm(e.currentTarget)}><Zap size={15} /><span className="d-none d-md-inline">{t('common.quickActions')}</span></Button></Tooltip>}
        <Menu anchorEl={qm} open={!!qm} onClose={() => setQm(null)}>
          {quick.map((q) => <MenuItem key={q.op} onClick={() => { setQm(null); setDlg(q.op); }}><ListItemIcon><q.icon size={16} /></ListItemIcon>{QL[q.key]}</MenuItem>)}
        </Menu>
        <Tooltip title={t('common.help')}><Button variant="ghost" size="icon" onClick={() => setHelp(true)} aria-label={t('common.help')}><HelpCircle size={17} /></Button></Tooltip>
        <span className="d-none d-sm-inline-flex"><LanguageSwitcher /></span>
        <ThemeSwitcher />
        <NotificationCenter />
        <button className="border-0 bg-transparent p-0 ms-1" onClick={(e) => setUm(e.currentTarget)} aria-label="User menu"><Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'primary.main' }}>{initials(user?.username)}</Avatar></button>
        <Menu anchorEl={um} open={!!um} onClose={() => setUm(null)}>
          <div className="px-3 py-2"><div className="fw-semibold">{user?.username}</div><div className="text-muted" style={{ fontSize: 12 }}>{user?.email}</div><div className="mt-1 text-muted" style={{ fontSize: 11 }}>{user?.roles?.join(', ')}</div></div>
          <Divider />
          <MenuItem component={Link} to="/profile" onClick={() => setUm(null)}><ListItemIcon><UserCircle size={16} /></ListItemIcon>{t('nav.profile')}</MenuItem>
          <MenuItem component={Link} to="/profile?tab=security" onClick={() => setUm(null)}><ListItemIcon><KeyRound size={16} /></ListItemIcon>{t('auth.changeTitle')}</MenuItem>
          <MenuItem onClick={logout}><ListItemIcon><LogOut size={16} /></ListItemIcon>{t('nav.signOut')}</MenuItem>
        </Menu>
      </div>
      {dlg && <OpDialog open op={dlg} onClose={() => setDlg(null)} title={QL[QUICK.find((q) => q.op === dlg)!.key]} />}
      <Modal open={help} onOpenChange={setHelp} title={t('common.help')} size="md">
        <ul className="m-0 space-y-2 ps-3 text-[13px]">
          <li><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> — {t('nav.search')}</li>
          <li>{t('common.quickActions')}: {Object.values(QL).join(' · ')}</li>
          <li>{t('nav.apiExplorer')} / {t('nav.coverage')}: HR admins</li>
          <li><Link to="/help" onClick={() => setHelp(false)}>{t('nav.help')} →</Link></li>
        </ul>
      </Modal>
    </header>
  );
}
