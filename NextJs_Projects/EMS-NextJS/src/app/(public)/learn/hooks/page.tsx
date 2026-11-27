import type { Metadata } from 'next';
import { DemoBanner } from '../_components/DemoBanner';
import { HooksLab } from './HooksLab';
export const metadata: Metadata = { title: 'React Hooks lab' };
export default function HooksPage() { return <><DemoBanner>Hooks that don’t occur naturally in the EMS screens (the real ones use useState, useEffect, useActionState, useFormStatus, useTransition, useId, useRef, useSyncExternalStore…).</DemoBanner><h1 className="mb-4 text-2xl font-bold">React Hooks lab</h1><HooksLab /></>; }
