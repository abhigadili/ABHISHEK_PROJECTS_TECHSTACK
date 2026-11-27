'use client'

/**
 * ============================================================
 * providers.tsx — single file that composes all Context providers
 * ============================================================
 *
 * WHY PROVIDERS NEED 'use client'
 * ────────────────────────────────
 * React Context relies on `createContext`, `useState`, and
 * `useEffect` — all of which are client-side React APIs.
 *
 * In Next.js App Router, components are Server Components by
 * default.  Server Components cannot:
 *   • Call React hooks
 *   • Use the Context API (createContext / useContext)
 *   • Access browser globals (window, localStorage, document)
 *
 * Adding 'use client' at the top of providers.tsx marks this
 * file (and everything imported into it) as part of the
 * CLIENT COMPONENT subtree.  The providers themselves run
 * in the browser and can safely use hooks and Context.
 *
 * WHY A SINGLE providers.tsx FILE?
 * ──────────────────────────────────
 * Without this file, you'd have to import every provider in
 * layout.tsx and nest them manually:
 *
 *   // app/layout.tsx — gets messy fast
 *   <ThemeProvider>
 *     <AuthProvider>
 *       <CountryProvider>
 *         <SearchProvider>
 *           {children}
 *         </SearchProvider>
 *       </CountryProvider>
 *     </AuthProvider>
 *   </ThemeProvider>
 *
 * Extracting all providers into one <Providers> component:
 *   • Keeps layout.tsx clean and readable
 *   • Makes it trivial to add/remove providers without touching layout
 *   • The 'use client' boundary is contained to this one file —
 *     layout.tsx remains a Server Component (better performance)
 *
 * PROVIDER PATTERN — AVOIDING PROP DRILLING
 * ───────────────────────────────────────────
 * Prop drilling = passing a value through multiple intermediate
 * components that don't use it, just to reach a deep descendant:
 *
 *   App → Layout → Sidebar → NavItem → ThemeToggle
 *                 ↑                    ↑
 *            doesn't use theme     needs theme
 *
 * With the Provider Pattern + Context, ThemeToggle calls
 * `useTheme()` directly — no intermediate components involved.
 *
 * PROVIDER ORDERING
 * ──────────────────
 * Providers are nested innermost-to-outermost here.
 * If a provider CONSUMES another provider's context, it must be
 * INSIDE (nested deeper than) the provider it consumes.
 *
 * Current order:
 *   ThemeProvider (outermost — available to all descendants)
 *     CountryProvider (can access ThemeContext if needed)
 *       {children}
 *
 * ZUSTAND STORES DO NOT NEED PROVIDERS
 * ──────────────────────────────────────
 * Notice that favoritesStore and searchStore are NOT listed here.
 * Zustand stores live outside the React tree — they're just
 * module-level objects created with `create()`.
 *
 * Any component can import and use a Zustand store without being
 * wrapped in a Provider.  This is one of Zustand's key advantages
 * over Redux (which requires a <Provider store={store}> wrapper).
 * ============================================================
 */

import type { ReactNode } from 'react'
import { ThemeProvider } from '@/context/ThemeContext'
import { CountryProvider } from '@/context/CountryContext'

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface ProvidersProps {
  children: ReactNode
}

// ─────────────────────────────────────────────
// Providers component
// ─────────────────────────────────────────────

/**
 * Providers — wraps the entire application with all React Context
 * providers.
 *
 * Used in app/layout.tsx:
 *
 *   import { Providers } from '@/app/providers'
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html>
 *         <body>
 *           <Providers>{children}</Providers>
 *         </body>
 *       </html>
 *     )
 *   }
 *
 * IMPORTANT: The <html> and <body> tags must stay in layout.tsx
 * (a Server Component) — they cannot move inside a 'use client'
 * component because Next.js requires them to be server-rendered.
 * Only the <body>'s children are wrapped by <Providers>.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    /**
     * ThemeProvider is outermost so every component in the tree —
     * including CountryProvider itself — can call useTheme().
     *
     * If CountryProvider needed to read the theme (e.g., to apply
     * different default countries for dark/light mode), placing it
     * inside ThemeProvider ensures ThemeContext is already available.
     */
    <ThemeProvider>
      {/**
       * CountryProvider gives all pages access to `selectedCountry`
       * without prop drilling.
       *
       * It's inside ThemeProvider so it can optionally consume
       * ThemeContext via useTheme() if needed in the future.
       */}
      <CountryProvider>{children}</CountryProvider>
    </ThemeProvider>
  )
}
