'use client';
/** Replaces the ROOT layout when it crashes, so it renders its own <html>/<body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body style={{ fontFamily: 'system-ui', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}><div style={{ textAlign: 'center', maxWidth: 420 }}><h1>Something went seriously wrong</h1>{error.digest && <p style={{ color: '#888', fontSize: 12 }}>Reference: {error.digest}</p>}<button onClick={reset} style={{ padding: '10px 18px', borderRadius: 8, border: 0, background: '#0f766e', color: '#fff', cursor: 'pointer' }}>Reload</button></div></body></html>;
}
