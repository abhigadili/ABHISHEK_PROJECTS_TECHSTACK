import { RoleLayout } from '@/components/layout/RoleLayout';
/** Route group "(lab)" - server-side role gate + shell for /lab/**. */
export default function Layout({ children }: { children: React.ReactNode }) { return <RoleLayout roles={['LAB_STAFF']}>{children}</RoleLayout>; }
