import { MuiProvider } from '@/components/providers/MuiProvider';
export default function DoctorsLayout({ children }: { children: React.ReactNode }) { return <MuiProvider>{children}</MuiProvider>; }
