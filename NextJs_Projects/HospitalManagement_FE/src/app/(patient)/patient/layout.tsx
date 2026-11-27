import { RoleLayout } from '@/components/layout/RoleLayout';
/** Route group "(patient)" - server-side role gate + shell for /patient/**. */
export default function Layout({ children }: { children: React.ReactNode }) { return <RoleLayout roles={['PATIENT']}>{children}</RoleLayout>; }
