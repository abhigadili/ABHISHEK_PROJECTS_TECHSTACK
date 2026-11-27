import { PublicFooter, PublicHeader } from '@/components/public/PublicHeader';
/** Route group "(public)": marketing + directory layout (the group name is not part of the URL). */
export default function PublicLayout({ children }: LayoutProps<'/'>) { return <><PublicHeader /><main className="mx-auto max-w-6xl px-4 py-8">{children}</main><PublicFooter /></>; }
