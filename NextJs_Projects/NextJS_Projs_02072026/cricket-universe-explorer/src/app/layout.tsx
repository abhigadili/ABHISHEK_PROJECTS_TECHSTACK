/**
 * ============================================================
 * app/layout.tsx — Root Layout (Next.js App Router)
 * ============================================================
 *
 * WHAT IS THE ROOT LAYOUT?
 *   The root layout is the top-most shared UI that wraps every
 *   page in your application. It:
 *   - Must define <html> and <body> tags (only the root layout can).
 *   - Is NEVER unmounted or re-rendered during navigation — it
 *     persists across all route changes. This is ideal for:
 *       • Global navigation (Navbar)
 *       • Global footer
 *       • Font loading
 *       • Analytics providers
 *       • Theme/global CSS
 *
 * WHY DOES IT PERSIST ACROSS NAVIGATION?
 *   Next.js App Router uses React Server Components and partial
 *   hydration. When navigating between pages, only the changed
 *   route SEGMENT (the `page.tsx`) re-renders — the shared layout
 *   shell is preserved in the DOM, resulting in faster transitions
 *   (no full-page reload, no re-mounting of Navbar/Footer).
 *
 * METADATA API:
 *   Exporting `metadata` from a layout/page sets the <head> tags
 *   for that segment. The root layout's metadata is the fallback
 *   for all pages that don't export their own.
 *
 *   In Next.js 15+, metadata uses a typed API:
 *     export const metadata: Metadata = { title: '...', description: '...' }
 *
 *   Or use `generateMetadata()` for dynamic metadata based on params.
 *   Child page metadata MERGES with (and can override) parent metadata.
 *
 * FONTS (Geist):
 *   next/font/google automatically:
 *   - Downloads the font at build time (no runtime network request).
 *   - Self-hosts the font files.
 *   - Applies font-display: swap by default (text visible before font loads).
 *   - Injects a CSS variable (--font-geist-sans) for Tailwind or inline use.
 *
 * SERVER COMPONENT:
 *   Root layouts are always Server Components. You cannot add 'use client'
 *   to the root layout. Wrap individual interactive sections in Client
 *   Components instead.
 * ============================================================
 */

import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Providers } from './providers'

// ─── Font setup ───────────────────────────────────────────────────────────────
// next/font/google downloads and self-hosts the font at build time.
// The `variable` option creates a CSS custom property we can reference
// in Tailwind or global CSS: `font-family: var(--font-geist-sans)`.

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// ─── Metadata ─────────────────────────────────────────────────────────────────
// This is the fallback metadata for all pages. Individual pages can export
// their own `metadata` or `generateMetadata()` to override these values.
//
// NEXT_PUBLIC_ env vars are safe to expose to the browser (they're embedded
// at build time). Server-only secrets should NOT use the NEXT_PUBLIC_ prefix.
//
// Interview tip: Use process.env for build-time config (SSG/SSR). Use
// runtime config (unstable_noStore + env vars) for values that change
// between deployments without a rebuild.

export const metadata: Metadata = {
  title: 'Cricket Universe Explorer',
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ??
    'Explore cricket countries, leagues, teams and players worldwide.',
}

// ─── Root Layout Component ────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // lang="en" is important for accessibility — screen readers use this to
    // determine which language to use for pronunciation.
    //
    // Font CSS variables are applied to the <html> element so they cascade
    // to all children. Tailwind's `antialiased` makes fonts render smoother
    // on macOS/high-DPI screens.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        Body structure: dark cricket green background, full min-height,
        flex column so Footer is pushed to the bottom on short pages.

        bg-gray-950: near-black background (slightly warmer than pure black).
        text-white: default text colour for all content.
        min-h-screen: ensures the body fills the viewport even on short pages.
        flex flex-col: stacks Navbar → main content → Footer vertically.
      */}
      <body className="bg-gray-950 text-white min-h-screen flex flex-col">
        {/*
          Navbar persists across ALL page navigations because it lives in
          the root layout. No re-mount flicker, no scroll-to-top on nav.
        */}
        <Navbar />

        {/*
          flex-1 makes <main> expand to fill all available vertical space
          between Navbar and Footer. This prevents Footer from floating up
          on pages with little content (the "sticky footer" pattern).
        */}
        <Providers>
          <main className="flex-1">
            {children}
          </main>
        </Providers>

        {/* Footer also persists across all navigations. */}
        <Footer />
      </body>
    </html>
  )
}
