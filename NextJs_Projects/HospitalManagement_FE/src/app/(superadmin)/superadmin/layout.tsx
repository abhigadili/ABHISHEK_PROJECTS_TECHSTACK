import { RoleLayout } from '@/components/layout/RoleLayout';
export default function Layout({ children }: { children: React.ReactNode }) { return <RoleLayout roles={['SUPER_ADMIN']} mui>{children}</RoleLayout>; }
