/**
 * template.tsx vs layout.tsx: a TEMPLATE is re-mounted on every navigation (layouts persist). Here that gives each page a fresh
 * fade-in; it would also reset client state/effects per navigation (e.g. page-view logging).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
