import Link from 'next/link';
import type { Metadata } from 'next';
import { DemoBanner } from './_components/DemoBanner';

export const metadata: Metadata = { title: 'Next.js learning demos', description: 'Isolated, clearly-labelled demonstrations of Next.js and React features that don’t belong in the production EMS workflow.' };
export default function LearnIndex() {
  return (
    <>
      <DemoBanner>Everything under /learn is an isolated demonstration using no EMS data.</DemoBanner>
      <h1 className="mb-4 text-3xl font-bold">Learning demos</h1>
      <ul className="list-disc space-y-2 pl-5">
        <li><Link className="text-primary hover:underline" href="/learn/hooks">React Hooks lab</Link> — useReducer, useMemo, useCallback, useLayoutEffect, useImperativeHandle, useDeferredValue, useDebugValue, useOptimistic, useId.</li>
        <li><Link className="text-primary hover:underline" href="/learn/react">React patterns lab</Link> — HOC, render props, compound components, error boundary, memo, keys, lifting state, prop drilling vs context.</li>
        <li><Link className="text-primary hover:underline" href="/learn/forms">React Hook Form lab</Link> — Controller, FormProvider/useFormContext, useWatch, nested fields, async validation.</li>
        <li><Link className="text-primary hover:underline" href="/learn/navigation">Navigation functions</Link> — useRouter, usePathname, useSearchParams, useParams, useSelectedLayoutSegment(s), redirect, permanentRedirect, notFound.</li>
        <li><Link className="text-primary hover:underline" href="/learn/deep">Intercepting-route conventions</Link> — <code>(.)</code>, <code>(..)</code>, <code>(..)(..)</code>, <code>(...)</code>.</li>
      </ul>
    </>
  );
}
