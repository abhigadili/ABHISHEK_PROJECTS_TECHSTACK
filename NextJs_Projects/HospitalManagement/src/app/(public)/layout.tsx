import { PublicFooter, PublicHeader } from '@/components/layouts/PublicHeader';

/** Route Group layout "(public)": a separate layout (header/footer) for the marketing + catalogue pages; the group name is not part of the URL. */
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return <><PublicHeader /><main className="mx-auto max-w-6xl px-4 py-8">{children}</main><PublicFooter /></>;
}
