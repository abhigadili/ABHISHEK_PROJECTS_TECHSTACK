import { ChevronDown, LayoutDashboard, LogOut, Moon, Sun, Ticket, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { DropdownMenu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { useAuth } from '@/hooks';
import { useThemeMode } from '@/providers/ThemeMode';
import { useAppDispatch } from '@/store';
import { logoutThunk } from '@/store/authSlice';
import { queryClient } from '@/providers/AppProviders';

export function UserMenu() {
  const { user, isStaff } = useAuth(); const nav = useNavigate(); const dispatch = useAppDispatch(); const { mode, toggle } = useThemeMode();
  if (!user) return null;
  return (
    <DropdownMenu trigger={<Button variant="ghost" className="gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</span><span className="hidden sm:inline">{user.name.split(' ')[0]}</span><ChevronDown size={14} /></Button>}>
      <MenuLabel>{user.email}</MenuLabel>
      <MenuItem onSelect={() => nav('/account')}><Ticket size={16} />My account</MenuItem>
      <MenuItem onSelect={() => nav('/account/profile')}><UserRound size={16} />Profile & security</MenuItem>
      {isStaff && <MenuItem onSelect={() => nav('/admin')}><LayoutDashboard size={16} />Admin console</MenuItem>}
      <MenuItem onSelect={toggle}>{mode === 'light' ? <Moon size={16} /> : <Sun size={16} />}{mode === 'light' ? 'Dark mode' : 'Light mode'}</MenuItem>
      <MenuSeparator />
      <MenuItem danger onSelect={async () => { await dispatch(logoutThunk()); queryClient.clear(); nav('/'); }}><LogOut size={16} />Sign out</MenuItem>
    </DropdownMenu>
  );
}
