import Link from 'next/link';
import { Cross } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { APP_NAME } from '@/lib/config/public';

/** Route Group "(auth)": its own centred layout shared by /login and /register. */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-br from-primary/10 via-bg to-accent/10 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between"><Link href="/" className="flex items-center gap-2 text-lg font-semibold"><span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-fg"><Cross className="size-5" /></span>{APP_NAME}</Link><ThemeToggle /></div>
        {children}
      </div>
    </div>
  );
}
