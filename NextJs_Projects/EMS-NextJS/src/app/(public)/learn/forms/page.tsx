import type { Metadata } from 'next';
import { DemoBanner } from '../_components/DemoBanner';
import { FormsLab } from './FormsLab';
export const metadata: Metadata = { title: 'React Hook Form lab' };
export default function FormsPage() { return <><DemoBanner>React Hook Form features the employee form does not need: <code>Controller</code>, <code>FormProvider</code>/<code>useFormContext</code>, <code>useWatch</code>, nested fields, async validation. (The real employee form uses <code>register</code>, <code>useFieldArray</code>, <code>watch</code> and a zod resolver.)</DemoBanner><h1 className="mb-4 text-2xl font-bold">React Hook Form lab</h1><FormsLab /></>; }
