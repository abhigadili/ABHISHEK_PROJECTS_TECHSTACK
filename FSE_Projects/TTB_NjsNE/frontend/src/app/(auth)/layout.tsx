import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Card, CardBody } from '@/components/ui/Card';

/** Layout for the auth screens: header + a centred card. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-lg px-4 py-12"><Card><CardBody className="space-y-4 p-6">{children}</CardBody></Card></main></div>;
}
