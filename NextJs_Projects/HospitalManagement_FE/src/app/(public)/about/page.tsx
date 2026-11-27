import type { Metadata } from 'next';
import { APP_NAME } from '@/lib/configuration/public';
export const metadata: Metadata = { title: 'About', description: 'About our hospital network.' };
/** Fully static page (no dynamic data): pre-rendered at build time. */
export default function About() { return <article className="mx-auto max-w-3xl space-y-4"><h1 className="text-3xl font-bold">About {APP_NAME}</h1><p>{APP_NAME} is a multi-hospital care network. Our digital platform lets patients book appointments, view records, prescriptions, laboratory reports and pay invoices safely, while clinicians, laboratory, pharmacy and billing teams work from one connected system.</p><p className="text-muted">Clinical data is only visible to the patient and the clinicians treating them; every administrative access is audited.</p></article>; }
