import type { ReactNode } from 'react';
import { DemoBanner } from '@/app/(public)/learn/_components/DemoBanner';
/** Renders the page AND the `@modal` parallel slot — intercepting routes drop their content into that slot. */
export default function DeepLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return <><DemoBanner>Four intercepting-route conventions, each wired to a real route that also works on direct navigation.</DemoBanner>{children}{modal}</>;
}
