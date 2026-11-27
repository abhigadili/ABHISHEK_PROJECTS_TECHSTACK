import Link from 'next/link';
import { Cross } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/configuration/public';
export function PublicHeader() {
  const links = [['Hospitals', '/hospitals'], ['Doctors', '/doctors'], ['Departments', '/departments'], ['About', '/about'], ['Contact', '/contact'], ['Help', '/help']] as const;
  return <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur"><div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4"><Link href="/" className="flex items-center gap-2 font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-fg"><Cross className="size-5" /></span>{APP_NAME}</Link><nav aria-label="Public" className="hidden gap-5 text-sm md:flex">{links.map(([l, h]) => <Link key={h} href={h} className="text-muted hover:text-fg">{l}</Link>)}</nav><div className="ml-auto flex items-center gap-2"><ThemeToggle /><Button asChild variant="outline" size="sm"><Link href="/login">Sign in</Link></Button><Button asChild size="sm" className="hidden sm:inline-flex"><Link href="/register">Register</Link></Button></div></div></header>;
}
export const PublicFooter = () => <footer className="mt-16 border-t border-line py-8 text-center text-sm text-muted">© {new Date().getFullYear()} {APP_NAME}. Public information is cached and refreshed regularly; personal health data is only available after sign-in.</footer>;
