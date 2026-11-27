import { MuiProvider } from '@/components/providers/MuiProvider';
/** Layout for the whole Patient module: provides MUI (Emotion SSR + theme + date pickers) to every /patients/** page. */
export default function PatientsLayout({ children }: { children: React.ReactNode }) { return <MuiProvider>{children}</MuiProvider>; }
