import type { Metadata, Viewport } from 'next';
import './globals.css';
import { inter, monoLocal } from '@/styles/fonts';
import { ThemeProvider, themeInitScript } from '@/providers/ThemeProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/radix-extras';
import { APP_NAME, APP_URL } from '@/lib/configuration/public';

/** Root layout + root metadata (title template, Open Graph, Twitter, canonical, robots) and viewport. */
export const metadata: Metadata = {
  metadataBase: new URL(APP_URL), title: { default: `${APP_NAME} - Hospital & Healthcare Management`, template: `%s · ${APP_NAME}` },
  description: 'Find hospitals and doctors, book appointments and manage your care online.', keywords: ['hospital', 'doctor', 'appointment', 'laboratory', 'pharmacy'],
  applicationName: APP_NAME, alternates: { canonical: '/' }, robots: { index: true, follow: true },
  openGraph: { type: 'website', siteName: APP_NAME, title: APP_NAME, description: 'Book appointments and manage your care online.', url: APP_URL, images: [{ url: '/images/hero-banner.jpg', width: 1600, height: 520 }] },
  twitter: { card: 'summary_large_image', title: APP_NAME, description: 'Book appointments and manage your care online.', images: ['/images/hero-banner.jpg'] },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ media: '(prefers-color-scheme: light)', color: '#0f766e' }, { media: '(prefers-color-scheme: dark)', color: '#0b1220' }] };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${monoLocal.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body className="min-h-dvh"><ThemeProvider><QueryProvider><TooltipProvider>{children}</TooltipProvider><Toaster /></QueryProvider></ThemeProvider></body>
    </html>
  );
}
