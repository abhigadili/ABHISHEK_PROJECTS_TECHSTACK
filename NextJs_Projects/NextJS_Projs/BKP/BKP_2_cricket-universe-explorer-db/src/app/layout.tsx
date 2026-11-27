import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Providers } from './providers'
import { cookies } from 'next/headers'
import { verifyAccessToken, ACCESS_TOKEN_COOKIE } from '@/lib/auth'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Cricket Universe Explorer',
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ??
    'Explore cricket countries, leagues, teams and players worldwide.',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read auth state server-side so Navbar renders correctly on initial load.
  // Using cookies() makes this layout dynamic (opt-out of static rendering),
  // which is acceptable since the app already queries a live DB on most routes.
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value
  const user = accessToken ? await verifyAccessToken(accessToken) : null

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-gray-950 text-white min-h-screen flex flex-col">
        <Navbar isLoggedIn={!!user} userName={user?.name} />
        <Providers>
          <main className="flex-1">{children}</main>
        </Providers>
        <Footer />
      </body>
    </html>
  )
}
