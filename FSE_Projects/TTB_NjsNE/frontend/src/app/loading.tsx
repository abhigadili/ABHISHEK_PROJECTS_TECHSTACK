import { Spinner } from '@/components/ui/Feedback';
/** Root loading UI: wraps the page in <Suspense> automatically and streams as soon as data is ready. */
export default function Loading() { return <div className="flex min-h-[50vh] items-center justify-center"><Spinner className="h-8 w-8" /></div>; }
