'use client';
/** Catches errors thrown in the ROOT layout itself, so it must render its own <html>/<body> (no providers, no Tailwind classes guaranteed). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
        <main role="alert" style={{ textAlign: 'center', padding: 24 }}>
          <h1>EMS is temporarily unavailable</h1>
          <p>Please try again in a moment.</p>
          <button onClick={reset} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer' }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
