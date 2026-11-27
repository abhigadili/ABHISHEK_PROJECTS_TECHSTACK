import { RoleLayout } from '@/components/layout/RoleLayout';
/** Route group "(billing)" - server-side role gate + shell for /billing/**. */
export default function Layout({ children }: { children: React.ReactNode }) { return <RoleLayout roles={['BILLING_STAFF']}>{children}</RoleLayout>; }
