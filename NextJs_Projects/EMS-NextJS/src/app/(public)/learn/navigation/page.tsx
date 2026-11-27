import type { Metadata } from 'next';
import { DemoBanner } from '../_components/DemoBanner';
import { NavDemo, demoLinks } from './NavDemo';
export const metadata: Metadata = { title: 'Navigation functions' };
export default function NavigationPage() { return <><DemoBanner>The real EMS uses these in the sidebar, filters, login redirect and modals.</DemoBanner><h1 className="mb-4 text-2xl font-bold">Navigation functions</h1><NavDemo /><h2 className="mt-6 mb-2 font-semibold">Server-side navigation</h2>{demoLinks}</>; }
