import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppProviders } from '@/providers/AppProviders';
import { SITE_NAME } from '@/lib/constants';
import '@/styles/globals.css';

// next/font: self-hosted at build time, zero layout shift. One LOCAL font (Inter variable) and one GOOGLE font (mono, for PNRs/references).
const inter = localFont({ src: '../assets/fonts/inter-latin-wght-normal.woff2', variable: '--font-inter', display: 'swap', weight: '100 900' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
/** Root metadata: every page inherits it; pages override pieces via `metadata` / `generateMetadata`. */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${SITE_NAME} - Book train tickets online`, template: `%s · ${SITE_NAME}` },
  description: 'Search trains, pick your seats, pay and get your PNR in minutes. A learning-oriented Train Ticket Booking application.',
  applicationName: SITE_NAME, alternates: { canonical: '/' }, robots: { index: true, follow: true },
  openGraph: { type: 'website', siteName: SITE_NAME, title: `${SITE_NAME} - Book train tickets online`, description: 'Search trains, pick seats and get your PNR.', url: siteUrl, images: [{ url: '/images/hero-train.jpg', width: 1600, height: 640, alt: 'A passenger train at dusk' }] },
  twitter: { card: 'summary_large_image', title: `${SITE_NAME} - Book train tickets online`, description: 'Search trains, pick seats and get your PNR.', images: ['/images/hero-train.jpg'] },
};
export const viewport: Viewport = { themeColor: '#4f46e5', width: 'device-width', initialScale: 1 };

// Runs before first paint so a returning dark-mode user never sees a white flash (hence suppressHydrationWarning on <html>).
const themeScript = `try{if(JSON.parse(localStorage.getItem('ttb.theme')||'"light"')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

/** Root layout (Server Component, static). `modal` is a PARALLEL ROUTE slot rendered beside `children` (login dialog via intercepting route). */
export default function RootLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="font-sans antialiased"><AppProviders>{children}{modal}</AppProviders></body>
    </html>
  );
}
