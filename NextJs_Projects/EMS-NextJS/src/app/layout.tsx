import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ConfigProvider } from '@/contexts/ConfigContext';

/**
 * next/font self-hosts and subsets fonts at BUILD time (no runtime request to Google, no layout shift via size-adjust).
 *  - Inter: LOCAL variable font file (app/fonts) → exposed as the CSS variable --font-inter used by Tailwind's `font-sans`
 *  - Geist Mono: GOOGLE font, downloaded at build and self-hosted → `font-mono`
 */
const inter = localFont({ src: './fonts/Inter-Variable.woff2', variable: '--font-inter', weight: '100 900', display: 'swap' });
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: 'EMS — Employee Management System', template: '%s · EMS' },
  description: 'Employee directory, attendance, leave, organization chart and HR reports in one secure workspace.',
  keywords: ['employee management', 'HR', 'attendance', 'leave management', 'organization chart'],
  applicationName: 'EMS',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'EMS', title: 'EMS — Employee Management System', description: 'Employee directory, attendance, leave and HR reports.', url: appUrl, images: [{ url: '/images/hero.png', width: 1200, height: 630, alt: 'EMS dashboard illustration' }] },
  twitter: { card: 'summary_large_image', title: 'EMS — Employee Management System', description: 'Employee directory, attendance, leave and HR reports.', images: ['/images/hero.png'] },
  robots: { index: true, follow: true }, // overridden to noindex for everything behind login (see (dashboard)/layout.tsx)
};
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: light)', color: '#1d4ed8' }, { media: '(prefers-color-scheme: dark)', color: '#0d1220' }], width: 'device-width', initialScale: 1 };

/**
 * ROOT LAYOUT — a Server Component. Only the three small providers below are Client Components; `children` stays a server-rendered
 * slot, so wrapping the app in client providers does NOT turn the pages into client code. It reads no cookies/headers, so the
 * html/body shell is part of the static (prerendered) shell of every route.
 */
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ConfigProvider appName={process.env.NEXT_PUBLIC_APP_NAME ?? 'EMS'}>
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
