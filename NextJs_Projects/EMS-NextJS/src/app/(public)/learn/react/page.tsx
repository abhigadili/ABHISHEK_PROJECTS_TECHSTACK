import type { Metadata } from 'next';
import { DemoBanner } from '../_components/DemoBanner';
import { PatternsLab } from './PatternsLab';
export const metadata: Metadata = { title: 'React patterns lab' };
export default function ReactPatternsPage() { return <><DemoBanner>Classic React patterns shown in isolation (the real EMS code uses memo, context, error.tsx boundaries, portals and generics — see docs/nextjs-concepts/48-react-concepts-in-nextjs.md).</DemoBanner><h1 className="mb-4 text-2xl font-bold">React patterns lab</h1><PatternsLab /></>; }
