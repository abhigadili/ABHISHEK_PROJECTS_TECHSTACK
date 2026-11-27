'use client';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LayoutDashboard, LogOut, Moon, Sun, Ticket, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { DropdownMenu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { logoutAction } from '@/features/auth/actions';
import { useAuth } from '@/hooks';
import { useThemeMode } from '@/providers/ThemeProvider';

export function UserMenu() {
  const { user, isStaff } = useAuth(); const router = useRouter(); const { mode, toggle } = useThemeMode(); const qc = useQueryClient(); const [pending, start] = useTransition();
  if (!user) return null;
  return (
    <DropdownMenu trigger={<Button variant="ghost" className="gap-2" disabled={pending}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</span><span className="hidden sm:inline">{user.name.split(' ')[0]}</span><ChevronDown size={14} /></Button>}>
      <MenuLabel>{user.email}</MenuLabel>
      <MenuItem onSelect={() => router.push('/account')}><Ticket size={16} />My account</MenuItem>
      <MenuItem onSelect={() => router.push('/account/profile')}><UserRound size={16} />Profile &amp; security</MenuItem>
      {isStaff && <MenuItem onSelect={() => router.push('/admin')}><LayoutDashboard size={16} />Admin console</MenuItem>}
      <MenuItem onSelect={toggle}>{mode === 'light' ? <Moon size={16} /> : <Sun size={16} />}{mode === 'light' ? 'Dark mode' : 'Light mode'}</MenuItem>
      <MenuSeparator />
      <MenuItem danger onSelect={() => start(async () => { qc.clear(); await logoutAction(); })}><LogOut size={16} />Sign out</MenuItem>
    </DropdownMenu>
  );
}
