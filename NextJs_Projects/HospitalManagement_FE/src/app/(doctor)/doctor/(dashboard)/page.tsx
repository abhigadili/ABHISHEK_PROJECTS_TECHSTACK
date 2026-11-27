import Link from 'next/link';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Doctor dashboard', robots: { index: false } };
export default function Page() { return <div className="mb-6 flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link href="/doctor/availability">Manage availability</Link></Button><Button asChild variant="outline" size="sm"><Link href="/doctor/prescriptions/new">New prescription</Link></Button><Button asChild variant="outline" size="sm"><Link href="/doctor/lab/new">Request lab test</Link></Button></div>; }
