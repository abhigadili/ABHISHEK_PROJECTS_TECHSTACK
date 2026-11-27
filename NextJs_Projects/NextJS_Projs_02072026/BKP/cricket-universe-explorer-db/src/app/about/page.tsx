/**
 * ============================================================
 * app/about/page.tsx — About Page (Static Server Component)
 * ============================================================
 *
 * This is a purely static page — it never needs to fetch data.
 * Next.js pre-renders it to HTML at build time (SSG).
 *
 * METADATA:
 *   Exporting a `metadata` const from a page sets <title> and
 *   <meta name="description"> for that specific page. This
 *   overrides/merges with the root layout's metadata.
 *   For static metadata, use `export const metadata = {...}`.
 *   For dynamic metadata (based on params), use `generateMetadata()`.
 * ============================================================
 */

import type { Metadata } from 'next'
import Link from 'next/link'

// ── Static metadata for this page ────────────────────────────────────────────
// Next.js uses this to populate the <head> of the HTML document.
// The `title` here overrides the root layout title for this page only.

export const metadata: Metadata = {
  title: 'About | Cricket Universe Explorer',
  description:
    'Learn about the Cricket Universe Explorer project — a Next.js 16 learning app covering SSR, SSG, ISR, Server Components, auth, and more.',
}

// ─── Concept list data ────────────────────────────────────────────────────────
// Defined outside the component so it's a module-level constant —
// no recreation on every render.

const CONCEPTS = [
  {
    name: 'Server Components',
    description:
      'React components that run only on the server — zero JS shipped to the browser. They can fetch data directly and access server-only APIs.',
  },
  {
    name: 'Client Components',
    description:
      'Components with interactivity (useState, useEffect, event handlers). Created with the "use client" directive. Hydrated in the browser.',
  },
  {
    name: 'SSG (Static Site Generation)',
    description:
      'Pages pre-rendered to HTML at build time. Served from CDN — fastest possible load. Default for pages with no dynamic APIs.',
  },
  {
    name: 'SSR (Server-Side Rendering)',
    description:
      'HTML generated fresh on every request. Used when data changes per-request (user-specific content, live scores).',
  },
  {
    name: 'ISR (Incremental Static Regeneration)',
    description:
      'Static pages that revalidate in the background after a time interval. Enable with: export const revalidate = 60.',
  },
  {
    name: 'generateStaticParams',
    description:
      'Tells Next.js which dynamic route values to pre-render at build time. E.g., all /countries/[id] pages.',
  },
  {
    name: 'generateMetadata',
    description:
      'Async function for dynamic <head> metadata. Receives params (as a Promise in Next.js 16) to build per-page titles and descriptions.',
  },
  {
    name: 'Route Handlers (API routes)',
    description:
      'Server-side functions in route.ts files. Handle HTTP methods (GET, POST, etc.). Used for form submissions, auth, webhooks.',
  },
  {
    name: 'Middleware',
    description:
      'Code that runs before every request. Used for auth redirects, A/B testing, locale detection. Defined in middleware.ts at the project root.',
  },
  {
    name: 'Auth with HttpOnly Cookies',
    description:
      'Secure authentication using HttpOnly cookies (not readable by JS). Prevents XSS token theft. Combined with middleware for protected routes.',
  },
  {
    name: 'Dynamic Routes',
    description:
      'Routes with variable segments: [id], [slug]. The segment value is passed as params (a Promise in Next.js 16+) to the page component.',
  },
  {
    name: 'Catch-all Routes ([...slug])',
    description:
      'Routes that match any number of segments: /docs/a/b/c. Params arrive as string[]. [[...slug]] is the optional variant (also matches /).',
  },
  {
    name: 'Error Boundaries (error.tsx)',
    description:
      'Client Components that catch render errors within a route segment. Use unstable_retry() (not reset) in Next.js 16+ to retry.',
  },
  {
    name: 'Loading UI (loading.tsx)',
    description:
      'Placed next to a page, this file\'s content is shown instantly in a Suspense boundary while the async page resolves.',
  },
  {
    name: 'Route Groups ((folder))',
    description:
      'Folders wrapped in parentheses that group routes without affecting the URL. Used to apply different layouts to different sections.',
  },
]

const TECH_STACK = [
  { name: 'Next.js 16.2.9', role: 'Full-stack React framework' },
  { name: 'React 19.2.4', role: 'UI component library' },
  { name: 'TypeScript 5', role: 'Type-safe JavaScript' },
  { name: 'Tailwind CSS 4', role: 'Utility-first CSS framework' },
  { name: 'Zustand 5', role: 'Client-side state management' },
  { name: 'Jest + Testing Library', role: 'Unit and component testing' },
]

// ─── Page Component ───────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="bg-gray-950 min-h-full">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-950 to-gray-950 border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-5xl mb-4" aria-hidden="true">📖</div>
          <h1 className="text-4xl font-extrabold text-white mb-3">
            About This Project
          </h1>
          <p className="text-emerald-300 text-lg max-w-2xl">
            A comprehensive Next.js 16 learning application demonstrating
            modern full-stack patterns through a cricket-themed explorer.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">

        {/* ── Project Description ───────────────────────────────────────── */}
        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-2xl font-bold text-white mb-4">
            What is Cricket Universe Explorer?
          </h2>
          <div className="space-y-3 text-emerald-200 leading-relaxed">
            <p>
              Cricket Universe Explorer is a Next.js 16 demonstration project
              that uses cricket data as a vehicle to explore the full breadth
              of modern web development patterns. It covers server-side
              rendering, static generation, authentication, protected routes,
              dynamic routing, error handling, and much more.
            </p>
            <p>
              The project is intentionally structured as a teaching tool — each
              file contains thorough comments explaining why design decisions
              were made, what alternatives exist, and how the patterns relate
              to interview questions.
            </p>
          </div>
        </section>

        {/* ── Next.js Concepts ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Next.js Concepts Covered
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CONCEPTS.map((concept, index) => (
              <div
                key={concept.name}
                className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-5"
              >
                {/* Index badge */}
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-800 text-emerald-300 text-xs font-bold flex items-center justify-center mt-0.5">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-emerald-300 font-semibold text-sm mb-1">
                      {concept.name}
                    </h3>
                    <p className="text-emerald-500 text-xs leading-relaxed">
                      {concept.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tech Stack ────────────────────────────────────────────────── */}
        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Tech Stack</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TECH_STACK.map((tech) => (
              <div
                key={tech.name}
                className="flex items-center gap-3 rounded-lg bg-emerald-900/30 border border-emerald-800/50 p-4"
              >
                <span className="text-emerald-400 text-lg" aria-hidden="true">⚙️</span>
                <div>
                  <div className="text-white font-semibold text-sm">{tech.name}</div>
                  <div className="text-emerald-500 text-xs">{tech.role}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Navigation links ──────────────────────────────────────────── */}
        <section className="flex flex-wrap gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            ← Back to Home
          </Link>
          <Link
            href="/docs/routing"
            className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-emerald-100 font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            Read the Docs →
          </Link>
          <Link
            href="/examples"
            className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-emerald-100 font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            View Examples →
          </Link>
        </section>

      </div>
    </div>
  )
}
