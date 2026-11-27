import Link from 'next/link';
import { buttonClass } from '@/components/common/ui';
/** Boundary for every route under /employees: it must live ABOVE [id]/layout.tsx, because a not-found.tsx beside a layout cannot catch notFound() thrown by that layout (loadEmployee() runs in the layout header). */
export default function EmployeeNotFound() {
  return <div className="py-16 text-center" data-testid="employee-not-found"><h1 className="text-2xl font-bold">Employee not found</h1><p className="mt-2 text-muted">That employee doesn&apos;t exist or you can&apos;t see them.</p><Link href="/employees" className={buttonClass('primary', 'mt-5')}>Back to the list</Link></div>;
}
