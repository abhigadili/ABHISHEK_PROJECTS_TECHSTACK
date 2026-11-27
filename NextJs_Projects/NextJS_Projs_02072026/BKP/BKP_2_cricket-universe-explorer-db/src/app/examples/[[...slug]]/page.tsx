/**
 * ============================================================
 * app/examples/[[...slug]]/page.tsx — Optional Catch-all Route
 * ============================================================
 *
 * [[...slug]] — OPTIONAL CATCH-ALL:
 *   The double-bracket syntax [[...slug]] makes the catch-all
 *   OPTIONAL. This means it matches:
 *     /examples             → slug = undefined (root)
 *     /examples/server-component → slug = ['server-component']
 *     /examples/client-component → slug = ['client-component']
 *     /examples/caching          → slug = ['caching']
 *
 *   Compare with REQUIRED catch-all [...slug]:
 *     Would NOT match /examples (no segments) — you'd need a
 *     separate page.tsx for /examples.
 *
 * WHEN TO USE [[...slug]] vs [...slug]:
 *   Use [[...slug]] when you want ONE file to handle both the
 *   index route (no slug) AND all sub-routes.
 *   Use [...slug] when the index route has distinct content that
 *   warrants its own page.tsx (like /docs which has its own file).
 *
 * INTERVIEW TIP:
 *   "The difference between [...slug] and [[...slug]] is whether
 *    the root path (with no extra segments) matches the pattern.
 *    Optional catch-all [[...slug]] handles it — required [...slug] does not."
 *
 * PARAMS TYPE:
 *   params: Promise<{ slug?: string[] }>
 *   Note the optional (?) because slug may be undefined at /examples.
 * ============================================================
 */

import type { Metadata } from 'next'
import Link from 'next/link'

// ─── Pre-render specific example paths ───────────────────────────────────────

export function generateStaticParams() {
  return [
    { slug: ['server-component'] },
    { slug: ['client-component'] },
    { slug: ['caching'] },
    // Note: the root /examples path (slug = undefined) is also pre-rendered
    // automatically for optional catch-all routes.
  ]
}

// ── Dynamic metadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}): Promise<Metadata> {
  const { slug } = await params
  const topic = slug?.[0]

  const titles: Record<string, string> = {
    'server-component': 'Server Components',
    'client-component': 'Client Components',
    'caching': 'Caching Strategies',
  }

  const title = topic ? (titles[topic] ?? 'Examples') : 'Examples'

  return {
    title: `${title} | Examples | Cricket Universe Explorer`,
  }
}

// ─── Example content ──────────────────────────────────────────────────────────

type ExampleContent = {
  title: string
  intro: string
  sections: { heading: string; body: string; code?: string }[]
}

function getExampleContent(slug: string[] | undefined): ExampleContent | null {
  const topic = slug?.[0]

  // Root /examples page
  if (!topic) {
    return null // handled as the index below
  }

  switch (topic) {
    case 'server-component':
      return {
        title: 'Server Components',
        intro:
          'Server Components run only on the server. They can fetch data directly, access server-only APIs, and ship zero JavaScript to the browser.',
        sections: [
          {
            heading: 'A basic Server Component',
            body: 'No "use client" directive. The component is async and can await data directly. The data is embedded in the HTML — no client-side fetch needed.',
            code: `// app/countries/page.tsx (Server Component)
// No 'use client' — runs only on the server

import { getAllCountries } from '@/utils'
import CountryCard from '@/components/ui/CountryCard'

export default async function CountriesPage() {
  // Direct data access — no useEffect, no loading state
  const countries = getAllCountries()

  return (
    <div>
      {countries.map(country => (
        <CountryCard key={country.id} country={country} />
      ))}
    </div>
  )
}`,
          },
          {
            heading: 'What Server Components cannot do',
            body: 'Server Components cannot: use useState/useEffect/useRef, attach event handlers (onClick), access browser APIs (window, document), use React Context directly.',
          },
          {
            heading: 'Passing data from Server to Client Component',
            body: 'Server Components can render Client Components as children and pass serializable data as props. The data crosses the server→client boundary as JSON.',
            code: `// Server Component (parent)
import MyClientButton from './MyClientButton' // 'use client'

export default async function Page() {
  const data = await fetchData() // server-only fetch
  return <MyClientButton initialData={data} />
  //                      ^^^^^^^^^^^^^^^^
  //        Serializable prop — crosses the wire as JSON
}`,
          },
        ],
      }

    case 'client-component':
      return {
        title: 'Client Components',
        intro:
          'Client Components are created with the "use client" directive. They hydrate in the browser and can use React hooks and browser APIs.',
        sections: [
          {
            heading: 'A basic Client Component',
            body: '"use client" at the top of the file creates a client boundary. All imports of this component become client-side as well.',
            code: `// components/ui/SearchBar.tsx
'use client'  // ← this directive makes it a Client Component

import { useState } from 'react'

export default function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [query, setQuery] = useState('')

  return (
    <input
      value={query}
      onChange={(e) => {
        setQuery(e.target.value)
        onSearch(e.target.value)
      }}
      placeholder="Search..."
    />
  )
}`,
          },
          {
            heading: 'Client Component capabilities',
            body: 'Client Components can: use React hooks (useState, useEffect, useRef), attach DOM event handlers, use browser APIs (localStorage, window), use React Context, animate with CSS/framer-motion.',
          },
          {
            heading: 'Minimise Client Component size',
            body: 'Push "use client" as far down the component tree as possible. The less code that runs on the client, the faster the page loads. Use Server Components for layout/structure and Client Components only for interactive "islands".',
          },
        ],
      }

    case 'caching':
      return {
        title: 'Next.js Caching Strategies',
        intro:
          'Next.js has multiple layers of caching. Understanding them is key to building fast, correctly-updated applications.',
        sections: [
          {
            heading: 'Static Generation (build-time cache)',
            body: 'Default behaviour when no dynamic APIs are used. HTML is generated once at build time and served from CDN. Use for: marketing pages, blog posts, country/league detail pages in this project.',
          },
          {
            heading: 'ISR — Incremental Static Regeneration',
            body: 'Revalidate static pages in the background at an interval. The page serves stale content instantly while regenerating.',
            code: `// In any page.tsx or layout.tsx:
export const revalidate = 3600 // regenerate every 1 hour

// Or for individual fetch calls:
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 60 } // revalidate every 60s
})`,
          },
          {
            heading: 'Force dynamic rendering',
            body: 'Opt a page out of caching so it runs on every request (SSR). Use when data changes per-request.',
            code: `// Force this page to SSR (no caching):
export const dynamic = 'force-dynamic'

// OR: using any dynamic API auto-opts in:
const cookieStore = await cookies()  // → forces dynamic
const headersList = await headers()  // → forces dynamic`,
          },
          {
            heading: 'On-demand revalidation',
            body: 'Trigger cache invalidation from a Route Handler or Server Function — useful after a CMS update.',
            code: `// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache'

export async function POST(request: Request) {
  const { path } = await request.json()
  revalidatePath(path)      // by URL path
  // OR
  revalidateTag('countries') // by cache tag
  return Response.json({ revalidated: true })
}`,
          },
        ],
      }

    default:
      return null
  }
}

// ─── Root examples index content ─────────────────────────────────────────────

const EXAMPLE_LINKS = [
  {
    slug: 'server-component',
    title: 'Server Components',
    description: 'Data fetching, zero JS, async components',
    icon: '🖥️',
  },
  {
    slug: 'client-component',
    title: 'Client Components',
    description: 'useState, event handlers, browser APIs',
    icon: '⚛️',
  },
  {
    slug: 'caching',
    title: 'Caching Strategies',
    description: 'SSG, ISR, on-demand revalidation',
    icon: '⚡',
  },
]

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function ExamplesPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const topic = slug?.[0]
  const content = getExampleContent(slug)

  // Root /examples page — no slug
  if (!topic) {
    return (
      <div className="bg-gray-950 min-h-full">
        <div className="bg-gradient-to-br from-emerald-950 to-gray-950 border-b border-emerald-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <p className="text-emerald-500 text-sm font-semibold uppercase tracking-widest mb-2">
              Code Examples
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
              Next.js Pattern Examples
            </h1>
            <p className="text-emerald-300 text-base mt-2 max-w-2xl">
              Practical code examples demonstrating the core Next.js 16 patterns
              used in this Cricket Universe Explorer project.
            </p>

            {/*
              Why [[...slug]] instead of [...slug]?
              This page (/examples) is the ROOT. With [...slug] (required
              catch-all), this root path would NOT match — you'd need a
              separate page.tsx here. With [[...slug]] (optional), this
              single file handles both /examples AND /examples/anything.
            */}
            <p className="text-emerald-600 text-xs mt-2 italic">
              This page uses [[...slug]] — an optional catch-all that handles both /examples and /examples/topic
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {EXAMPLE_LINKS.map((link) => (
              <Link
                key={link.slug}
                href={`/examples/${link.slug}`}
                className="group rounded-xl border border-emerald-800 bg-emerald-950/50 p-6 hover:border-emerald-600 hover:bg-emerald-950 transition-all duration-200"
              >
                <div className="text-4xl mb-3" aria-hidden="true">{link.icon}</div>
                <h2 className="text-white font-bold text-base mb-1 group-hover:text-emerald-300 transition-colors">
                  {link.title}
                </h2>
                <p className="text-emerald-500 text-sm">{link.description}</p>
                <div className="mt-4 text-emerald-600 text-xs flex items-center gap-1 group-hover:text-emerald-400 transition-colors">
                  View example
                  <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Unknown slug → 404
  if (!content) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <p className="text-emerald-400">Example not found.</p>
        <Link href="/examples" className="text-emerald-300 hover:text-white mt-4 inline-block">
          ← Back to examples
        </Link>
      </div>
    )
  }

  // Sub-route: /examples/[topic]
  return (
    <div className="bg-gray-950 min-h-full">
      <div className="bg-gradient-to-br from-emerald-950 to-gray-950 border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link
            href="/examples"
            className="text-emerald-400 hover:text-emerald-300 text-sm mb-3 inline-flex items-center gap-1"
          >
            ← All Examples
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
            {content.title}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <p className="text-emerald-200 text-base leading-relaxed">{content.intro}</p>

        {content.sections.map((section) => (
          <section
            key={section.heading}
            className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6"
          >
            <h2 className="text-lg font-bold text-white mb-2">{section.heading}</h2>
            <p className="text-emerald-300 text-sm leading-relaxed mb-3">{section.body}</p>
            {section.code && (
              <pre className="bg-gray-900 border border-emerald-900/50 rounded-lg p-4 overflow-x-auto text-xs text-emerald-200 leading-relaxed">
                <code>{section.code}</code>
              </pre>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
