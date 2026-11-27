'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams, useSelectedLayoutSegment, useSelectedLayoutSegments } from 'next/navigation';

function Readout() {
  const router = useRouter(); const pathname = usePathname(); const params = useParams(); const sp = useSearchParams();
  const seg = useSelectedLayoutSegment(); const segs = useSelectedLayoutSegments();
  const btn = 'rounded border border-border px-3 py-1 text-sm';
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[10rem_1fr] gap-1 text-sm" data-testid="nav-readout">
        <dt>usePathname()</dt><dd><code>{pathname}</code></dd><dt>useParams()</dt><dd><code>{JSON.stringify(params)}</code></dd>
        <dt>useSearchParams()</dt><dd><code>{sp.toString() || '(none)'}</code></dd><dt>useSelectedLayoutSegment()</dt><dd><code>{String(seg)}</code></dd><dt>useSelectedLayoutSegments()</dt><dd><code>{JSON.stringify(segs)}</code></dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={() => router.push('/learn/navigation/push-demo?x=1')}>router.push</button>
        <button className={btn} onClick={() => router.replace('/learn/navigation/replace-demo?x=2')}>router.replace</button>
        <button className={btn} onClick={() => router.back()}>router.back</button>
        <button className={btn} onClick={() => router.refresh()}>router.refresh</button>
        <button className={btn} onClick={() => router.prefetch('/learn/hooks')}>router.prefetch</button>
      </div>
    </div>
  );
}
export function NavDemo() { return <Suspense fallback={<p>Loading…</p>}><Readout /></Suspense>; } // useSearchParams needs a Suspense boundary
export const demoLinks = (
  <ul className="list-disc space-y-1 pl-5 text-sm">
    <li><Link href="/learn/navigation/go" className="text-primary hover:underline">/learn/navigation/go</Link> — a Server Component calling <code>redirect()</code> (307) to the topic page</li>
    <li><Link href="/learn/navigation/old-path" className="text-primary hover:underline">/learn/navigation/old-path</Link> — <code>permanentRedirect()</code> (308) to the topic page</li>
    <li><Link href="/learn/navigation/does-not-exist" className="text-primary hover:underline">/learn/navigation/does-not-exist</Link> — <code>notFound()</code></li>
  </ul>
);
