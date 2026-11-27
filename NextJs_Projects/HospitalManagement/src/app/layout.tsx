import type { Metadata, Viewport } from 'next';
import './globals.css';
import { inter, monoLocal } from '@/styles/fonts';
import { ThemeProvider, themeInitScript } from '@/components/providers/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from '@/components/ui/toast';
import { APP_NAME, APP_URL } from '@/lib/config/public';

/** Root Layout: the single entry point that wraps every route. Static Metadata with a title template (inherited by all pages). */
export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: `${APP_NAME} - Hospital & Healthcare Management`, template: `%s · ${APP_NAME}` },
  description: 'Find hospitals, browse our doctors, book appointments and manage your care online.',
  keywords: ['hospital', 'doctors', 'appointments', 'healthcare', 'laboratory', 'pharmacy'],
  applicationName: APP_NAME,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: APP_NAME, title: `${APP_NAME} - Hospital & Healthcare Management`, description: 'Book appointments and manage your care online.', url: APP_URL, images: [{ url: '/images/hero-banner.jpg', width: 1600, height: 520, alt: 'Care you can trust' }] },
  twitter: { card: 'summary_large_image', title: APP_NAME, description: 'Book appointments and manage your care online.', images: ['/images/hero-banner.jpg'] },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ media: '(prefers-color-scheme: light)', color: '#0f766e' }, { media: '(prefers-color-scheme: dark)', color: '#0b1220' }] };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${monoLocal.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body className="min-h-dvh">
        <ThemeProvider>
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
