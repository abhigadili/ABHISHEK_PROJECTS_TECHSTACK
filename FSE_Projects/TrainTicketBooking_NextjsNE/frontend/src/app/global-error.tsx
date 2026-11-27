'use client';
/** Last-resort boundary: replaces the ROOT layout when it (or a provider) throws, so it must render its own <html>/<body>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en"><body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
      <div style={{ textAlign: 'center' }}><h1>TrainTicket is having trouble</h1><p>Please try again in a moment.</p><button onClick={reset} style={{ padding: '8px 16px', borderRadius: 8, border: 0, background: '#4f46e5', color: '#fff' }}>Reload</button></div>
    </body></html>
  );
}
