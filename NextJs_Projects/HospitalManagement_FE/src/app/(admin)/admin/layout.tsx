import { RoleLayout } from '@/components/layout/RoleLayout';
/** Hospital Admin + Receptionist area (uses MUI for data-heavy forms/tables). */
export default function Layout({ children }: { children: React.ReactNode }) { return <RoleLayout roles={['HOSPITAL_ADMIN', 'RECEPTIONIST']} mui>{children}</RoleLayout>; }
