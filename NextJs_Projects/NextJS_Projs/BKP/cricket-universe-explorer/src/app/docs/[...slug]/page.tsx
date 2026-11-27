/**
 * ============================================================
 * app/docs/[...slug]/page.tsx — Documentation Catch-All Route
 * ============================================================
 *
 * CATCH-ALL ROUTES ([...slug]):
 *   The [...slug] convention matches any number of path segments:
 *     /docs/routing              → slug = ['routing']
 *     /docs/api/handlers         → slug = ['api', 'handlers']
 *     /docs/auth/cookies/httponly → slug = ['auth', 'cookies', 'httponly']
 *
 *   Useful for: documentation trees, file browser UIs, CMS pages
 *   where the URL depth is dynamic.
 *
 * REQUIRED vs OPTIONAL CATCH-ALL:
 *   [...slug]  — REQUIRED: does NOT match /docs (the root).
 *                /docs would need its own page.tsx.
 *   [[...slug]] — OPTIONAL: also matches /docs (slug is undefined).
 *                Used in app/examples/[[...slug]] in this project.
 *
 *   Interview tip: Use [[...slug]] when you want a single file to
 *   handle both the index route AND sub-routes. Use [...slug] when
 *   the root route has its own separate page.tsx.
 *
 * generateStaticParams FOR CATCH-ALL ROUTES:
 *   Each { slug } is an array. Pre-render specific paths:
 *     { slug: ['routing'] }  → /docs/routing
 *     { slug: ['api'] }      → /docs/api
 *   Unknown slugs at runtime return 404 (unless dynamic = 'force-dynamic').
 *
 * PARAMS TYPE IN NEXT.JS 16+:
 *   params: Promise<{ slug: string[] }>
 *   Always await before accessing.
 * ============================================================
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

// ─── Pre-render these specific doc pages at build time ───────────────────────

export function generateStaticParams() {
  return [
    { slug: ['routing'] },
    { slug: ['api'] },
    { slug: ['auth'] },
    { slug: ['state'] },
  ]
}

// ── Dynamic metadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>
}): Promise<Metadata> {
  const { slug } = await params
  const topic = slug[0]

  const titles: Record<string, string> = {
    routing: 'Routing',
    api: 'API Routes',
    auth: 'Authentication',
    state: 'State Management',
  }

  const title = titles[topic] ?? 'Documentation'

  return {
    title: `${title} | Docs | Cricket Universe Explorer`,
    description: `Next.js documentation: ${title}`,
  }
}

// ─── Content data (per topic) ────────────────────────────────────────────────

type DocContent = {
  title: string
  intro: string
  sections: { heading: string; body: string; code?: string }[]
}

function getDocContent(slug: string[]): DocContent | null {
  const topic = slug[0]

  switch (topic) {
    case 'routing':
      return {
        title: 'App Router & Routing',
        intro:
          'The Next.js App Router uses a file-system based routing convention where folders define routes and special files define UI.',
        sections: [
          {
            heading: 'File Conventions',
            body: 'Key special files: page.tsx (route UI), layout.tsx (shared wrapper), loading.tsx (Suspense fallback), error.tsx (error boundary), not-found.tsx (404 UI), route.ts (API handler).',
          },
          {
            heading: 'Dynamic Routes',
            body: 'Folders wrapped in [brackets] are dynamic segments. In Next.js 16+, params is a Promise — you must await it.',
            code: `// app/countries/[countryId]/page.tsx
export default async function Page({
  params,
}: {
  params: Promise<{ countryId: string }>
}) {
  const { countryId } = await params
  // ...
}`,
          },
          {
            heading: 'Catch-all Routes',
            body: '[...slug] matches one or more segments. [[...slug]] also matches the root (optional). params.slug is string[].',
            code: `// app/docs/[...slug]/page.tsx
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  // slug = ['routing'] for /docs/routing
}`,
          },
          {
            heading: 'Route Groups',
            body: 'Folders wrapped in (parentheses) group routes without affecting the URL. Used to apply different layouts to sections: (auth)/login maps to /login.',
          },
          {
            heading: 'generateStaticParams',
            body: 'Pre-render dynamic pages at build time by returning an array of param objects. Each object becomes one static HTML page.',
            code: `export function generateStaticParams() {
  return getAllCountries().map(c => ({ countryId: c.id }))
}`,
          },
        ],
      }

    case 'api':
      return {
        title: 'API Route Handlers',
        intro:
          'Route Handlers (route.ts) replace the pages/api directory from the Pages Router. They live alongside page files and handle HTTP requests.',
        sections: [
          {
            heading: 'Basic Route Handler',
            body: 'Export named functions for each HTTP method. The function name IS the HTTP method.',
            code: `// app/api/countries/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  const countries = getAllCountries()
  return NextResponse.json({ data: countries, success: true })
}

export async function POST(request: Request) {
  const body = await request.json()
  // ... handle POST
  return NextResponse.json({ success: true }, { status: 201 })
}`,
          },
          {
            heading: 'When to use Route Handlers vs Server Components',
            body: 'Use Server Components for fetching data to display in UI (no API needed). Use Route Handlers for: external API consumers, webhooks, form submissions, auth cookie management, file uploads.',
          },
          {
            heading: 'Reading Cookies in Route Handlers',
            body: 'Use cookies() from next/headers (async). Set HttpOnly cookies via response.cookies.set().',
            code: `import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const response = NextResponse.json({ success: true })
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 86400, // 24 hours
  })
  return response
}`,
          },
        ],
      }

    case 'auth':
      return {
        title: 'Authentication with Cookies',
        intro:
          'This project implements auth using HttpOnly cookies and server-side session validation. No client-side token storage.',
        sections: [
          {
            heading: 'Why HttpOnly Cookies?',
            body: 'HttpOnly cookies cannot be read by JavaScript (document.cookie). This prevents XSS attacks from stealing auth tokens. Always combine with: Secure (HTTPS only), SameSite: lax (CSRF protection), short maxAge.',
          },
          {
            heading: 'Async cookies() in Next.js 15+',
            body: 'The cookies() function from next/headers became async. Always await it before calling .get(), .has(), etc.',
            code: `import { cookies } from 'next/headers'

// In a Server Component or Route Handler:
const cookieStore = await cookies()
const user = getCurrentUser(cookieStore)
if (!user) redirect('/login')`,
          },
          {
            heading: 'Middleware for Route Protection',
            body: 'middleware.ts runs before every matching request. Ideal for protecting entire route prefixes (/dashboard/*, /admin/*).',
            code: `// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*'],
}`,
          },
          {
            heading: 'Never Use localStorage for Tokens',
            body: 'localStorage is readable by any JavaScript on the page — including injected scripts (XSS). Use HttpOnly cookies for auth tokens. You can use localStorage for non-sensitive user preferences.',
          },
        ],
      }

    case 'state':
      return {
        title: 'State Management',
        intro:
          'Next.js 15+ blurs the line between server and client state. Choose the right tool for each type of state.',
        sections: [
          {
            heading: 'Server State (Server Components)',
            body: 'Data fetched and rendered on the server — no useState needed. Best for: database queries, API calls, any data that does not require client interaction. Zero client JS.',
          },
          {
            heading: 'Local Client State (useState)',
            body: 'Component-local state for UI interactions: form inputs, toggles, modals. Use useState in Client Components (use client). Avoid for data that should persist across navigation.',
          },
          {
            heading: 'Global Client State (Zustand)',
            body: 'Cross-component state that must survive navigation and be accessible from any Client Component. This project uses Zustand v5. Define a store, read with useStore().',
            code: `// store/useCountryStore.ts
import { create } from 'zustand'

interface CountryStore {
  selected: string | null
  setSelected: (id: string) => void
}

export const useCountryStore = create<CountryStore>((set) => ({
  selected: null,
  setSelected: (id) => set({ selected: id }),
}))`,
          },
          {
            heading: 'URL State (searchParams)',
            body: 'Filters, search queries, pagination — state that should be shareable via URL. Use Next.js Link/router with query params, or useSearchParams() in Client Components.',
          },
          {
            heading: 'When NOT to use useState',
            body: 'If data comes from a server call → use Server Components. If state is derived from props → compute it inline. If state is shared across many components → use Zustand or URL state. useState is for truly local, transient UI state only.',
          },
        ],
      }

    default:
      return null
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const content = getDocContent(slug)

  // Only pre-rendered slugs are valid — show 404 for unknown paths.
  // generateStaticParams pre-renders: routing, api, auth, state.
  if (!content) {
    notFound()
  }

  const docLinks = [
    { label: 'Routing', href: '/docs/routing' },
    { label: 'API Routes', href: '/docs/api' },
    { label: 'Authentication', href: '/docs/auth' },
    { label: 'State', href: '/docs/state' },
  ]

  const currentTopic = slug[0]

  return (
    <div className="bg-gray-950 min-h-full">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-950 to-gray-950 border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-emerald-500 text-sm font-semibold uppercase tracking-widest mb-2">
            Documentation
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            {content.title}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── Sidebar nav ──────────────────────────────────────────────── */}
          <aside className="lg:w-48 flex-shrink-0">
            <nav aria-label="Documentation navigation">
              <h2 className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-3">
                Topics
              </h2>
              <ul className="space-y-1">
                {docLinks.map((link) => {
                  const isActive = link.href.endsWith(currentTopic)
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={[
                          'block text-sm px-3 py-2 rounded-lg transition-colors duration-150',
                          isActive
                            ? 'bg-emerald-800 text-white font-semibold'
                            : 'text-emerald-400 hover:text-white hover:bg-emerald-900/50',
                        ].join(' ')}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {link.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </aside>

          {/* ── Main doc content ─────────────────────────────────────────── */}
          <main className="flex-1 min-w-0 space-y-6">
            {/* Intro */}
            <p className="text-emerald-200 text-base leading-relaxed">
              {content.intro}
            </p>

            {/* Sections */}
            {content.sections.map((section) => (
              <section
                key={section.heading}
                className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6"
              >
                <h2 className="text-lg font-bold text-white mb-2">
                  {section.heading}
                </h2>
                <p className="text-emerald-300 text-sm leading-relaxed mb-3">
                  {section.body}
                </p>
                {section.code && (
                  <pre className="bg-gray-900 border border-emerald-900/50 rounded-lg p-4 overflow-x-auto text-xs text-emerald-200 leading-relaxed">
                    <code>{section.code}</code>
                  </pre>
                )}
              </section>
            ))}
          </main>
        </div>
      </div>
    </div>
  )
}
