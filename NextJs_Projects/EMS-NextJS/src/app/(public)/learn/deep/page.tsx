import Link from 'next/link';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Intercepting routes' };
export default function Deep() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Intercepting-route conventions</h1>
      <p className="mb-4 text-sm text-muted">Click a link → soft navigation → the modal. Open the same URL directly (or refresh) → the full page.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li><code>(.)</code> same level: <Link className="text-primary hover:underline" href="/learn/deep/photos/1" data-testid="l-dot">/learn/deep/photos/1</Link></li>
        <li><code>(..)</code> one level up (from /learn/deep/nested): <Link className="text-primary hover:underline" href="/learn/deep/nested">open the nested page</Link></li>
        <li><code>(..)(..)</code> two levels up (from /learn/deep/a/b): <Link className="text-primary hover:underline" href="/learn/deep/a/b">open the a/b page</Link></li>
        <li><code>(...)</code> from the app root: <Link className="text-primary hover:underline" href="/learn/root-demo/9" data-testid="l-root">/learn/root-demo/9</Link></li>
      </ul>
    </>
  );
}
