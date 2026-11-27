/** Root loading UI: the Suspense fallback for the whole app while a top-level route segment streams in. */
export default function Loading() {
  return <div role="status" aria-label="Loading" className="grid flex-1 place-items-center p-10"><div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
}
