import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Moon, Sun, UserRound } from 'lucide-react';
import { useAuth, useAuthActions } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotificationCenter } from '@/contexts/NotificationsContext';
import { useAppDispatch } from '@/store/redux/hooks';
import { layoutActions } from '@/store/slices/layoutSlice';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LazyAvatar } from '@/components/common/LazyAvatar';
import { humanize } from '@/utils/format';

export function Header() {
  const { user } = useAuth();
  const { logout } = useAuthActions();
  const { mode, toggle } = useTheme();
  const { unreadCount } = useNotificationCenter();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => dispatch(layoutActions.mobileNavSet(true))}>
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex-1" />
      <Button variant="ghost" size="icon" onClick={toggle} aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`} title="Toggle theme">
        {mode === 'light' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
      </Button>
      <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unreadCount} unread)`} onClick={() => navigate('/notifications')}>
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex items-center gap-2 rounded-full p-1 pr-3 hover:bg-black/5 dark:hover:bg-white/10" aria-label="User menu">
            <LazyAvatar name={user?.username ?? '?'} size={30} />
            <span className="hidden text-left text-xs leading-tight sm:block">
              <span className="block font-semibold">{user?.username}</span>
              <span className="block text-muted">{user ? humanize(user.role) : ''}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
          <DropdownMenuItem asChild><Link to="/profile"><UserRound className="h-4 w-4" /> My profile</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/notifications"><Bell className="h-4 w-4" /> Notifications</Link></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => { void logout('logout').then(() => navigate('/login', { replace: true })); }}><LogOut className="h-4 w-4" /> Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
