import Link from 'next/link';
export default function Nested() { return <><h1 className="mb-3 text-2xl font-bold">/learn/deep/nested</h1><p className="mb-2 text-sm">Interceptor lives at <code>@modal/nested/(..)tools/[id]</code> → targets <code>/learn/deep/tools/[id]</code>.</p><Link className="text-primary hover:underline" href="/learn/deep/tools/3" data-testid="l-up1">Open tool 3</Link></>; }
