import { PublicChrome } from '@/components/layout/PublicChrome';
/** (public) route group: marketing/help pages share the public header & footer; the group is invisible in URLs. */
export default function PublicLayout({ children }: LayoutProps<'/'>) { return <PublicChrome><main className="mx-auto max-w-3xl px-4 py-10">{children}</main></PublicChrome>; }
