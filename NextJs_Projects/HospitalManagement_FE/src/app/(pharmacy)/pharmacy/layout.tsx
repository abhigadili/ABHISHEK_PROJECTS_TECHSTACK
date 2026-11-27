import { RoleLayout } from '@/components/layout/RoleLayout';
/** Route group "(pharmacy)" - server-side role gate + shell for /pharmacy/**. */
export default function Layout({ children }: { children: React.ReactNode }) { return <RoleLayout roles={['PHARMACIST']}>{children}</RoleLayout>; }
