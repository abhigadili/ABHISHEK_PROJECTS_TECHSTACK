import type { ReactNode } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
/** Doctor area. Server-side role gate + shell. */
export default function Layout({ children }: { children: ReactNode }) { return <RoleLayout roles={['DOCTOR']}>{children}</RoleLayout>; }
