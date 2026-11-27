'use client'

/**
 * ============================================================
 * ThemeContext — Dark / Light mode state with localStorage
 * ============================================================
 *
 * WHY USE CONTEXT HERE?
 * ─────────────────────
 * React Context is ideal for "ambient" state that many
 * components in the tree read but rarely write:
 *   • Theme (dark/light)         ← this file
 *   • Current locale / language
 *   • Auth user object
 *   • Feature flags
 *
 * Context is NOT ideal for high-frequency state updates
 * (e.g., form field values, hover states, search queries).
 * Every time the Context value changes, ALL consumers
 * re-render — even if they only use an unrelated slice.
 * Use Zustand or local useState for high-frequency updates.
 *
 * CONTEXT vs ZUSTAND — Quick Decision Guide
 * ──────────────────────────────────────────
 * Use Context when:
 *   • The value changes rarely (once per user action, not per keystroke)
 *   • You want zero extra dependencies
 *   • The state is truly "global ambient" (theme, auth, i18n)
 *
 * Use Zustand when:
 *   • You need fine-grained subscriptions (component re-renders
 *     only when its specific slice changes)
 *   • State is updated frequently (search queries, filters)
 *   • You need actions/middleware (persist, devtools, immer)
 *   • You want to access state outside React components (utility fns)
 *
 * THE CONTEXT RE-RENDER PROBLEM
 * ─────────────────────────────
 * If you store { theme, toggleTheme } directly as the context
 * value object literal, a new object is created on every render,
 * causing all consumers to re-render even if theme didn't change.
 *
 * Solution: wrap the value in useMemo so React can bail out when
 * the dependencies haven't changed:
 *
 *   const value = useMemo(
 *     () => ({ theme, toggleTheme }),
 *     [theme]            // toggleTheme is stable via useCallback
 *   )
 *
 * WHEN TO USE useMemo FOR CONTEXT VALUE
 * ──────────────────────────────────────
 * Always use useMemo for context values that are objects or arrays.
 * Skip it when the value is a primitive (string/number/boolean),
 * because primitives already use reference equality in React.
 * In this file theme is a string — but we bundle it with
 * toggleTheme (a function), so useMemo is the right call.
 *
 * PROVIDER PATTERN
 * ────────────────
 * The Provider Pattern wraps a subtree (or the whole app) with a
 * Context.Provider so any descendant can read the value without
 * threading props through every intermediate component.
 *
 * Recommended structure:
 *   1.  Create the context (createContext)
 *   2.  Build a <Provider> component that owns the state
 *   3.  Export a custom hook (useTheme) for clean consumption
 *       — the hook checks the context is used inside the Provider
 *         and throws a helpful error if it isn't
 * ============================================================
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  /** The active theme string */
  theme: Theme
  /**
   * Flips the theme between 'dark' and 'light' and persists
   * the new value to localStorage.
   */
  toggleTheme: () => void
}

// ─────────────────────────────────────────────
// Context creation
// ─────────────────────────────────────────────

/**
 * We initialise the context with `undefined` so the custom
 * hook can detect when it is used outside the Provider and
 * throw a clear developer error.
 *
 * Interview tip: Always type the context as `T | undefined`
 * and assert inside the custom hook — avoids silent bugs where
 * a consumer gets stale default values instead of the real state.
 */
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// localStorage key — centralised so it's easy to change
const STORAGE_KEY = 'cricket-universe-theme'

// ─────────────────────────────────────────────
// Helper — read persisted theme on first load
// ─────────────────────────────────────────────

/**
 * Reads the stored theme from localStorage, falling back to the
 * OS preference via the `prefers-color-scheme` media query.
 *
 * This runs once on mount so we never show the wrong theme on
 * first paint (avoids the dreaded "flash of wrong theme").
 *
 * SSR note: localStorage and window are undefined on the server.
 * The `typeof window` guard prevents a ReferenceError during
 * Next.js server-side rendering.
 */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark' // SSR fallback

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored

  // Respect the operating system's color-scheme preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

// ─────────────────────────────────────────────
// ThemeProvider component
// ─────────────────────────────────────────────

interface ThemeProviderProps {
  children: ReactNode
}

/**
 * Wrap your application (or a subtree) with <ThemeProvider> to
 * give all descendants access to the theme value.
 *
 * Usage in app/providers.tsx:
 *   <ThemeProvider>
 *     {children}
 *   </ThemeProvider>
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  /**
   * Lazy initialiser: useState accepts a function as its argument.
   * React calls it only once on mount — perfect for reading
   * localStorage without running on every render.
   */
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  /**
   * Sync the <html> element's class whenever theme changes.
   * Tailwind CSS reads `dark` on the <html> tag to activate
   * dark-mode utility classes (darkMode: 'class' in tailwind.config).
   *
   * useEffect fires after paint, so this won't block hydration.
   */
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    // Persist the user's choice so it survives page refresh
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  /**
   * useCallback ensures the function reference stays stable
   * across re-renders of ThemeProvider, so useMemo (below)
   * only invalidates when `theme` actually changes.
   *
   * Interview tip: Functions defined inline in the component body
   * are recreated on every render. useCallback memoises them.
   */
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  /**
   * useMemo prevents a new object from being created on every
   * render, which would cause all Context consumers to re-render
   * needlessly (the "Context re-render problem" described above).
   *
   * The dependency array [theme] means the memo only recomputes
   * when the theme value changes — toggleTheme is stable because
   * it's wrapped in useCallback with an empty dependency array.
   */
  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// ─────────────────────────────────────────────
// Custom hook
// ─────────────────────────────────────────────

/**
 * useTheme — consume the ThemeContext safely.
 *
 * Why a custom hook instead of calling useContext(ThemeContext)
 * directly?
 *   1.  It guards against usage outside the Provider tree.
 *   2.  It hides the raw context object — consumers only see a
 *       clean { theme, toggleTheme } interface.
 *   3.  It makes refactoring easier: if you ever swap Context for
 *       Zustand, only this one function needs to change.
 *
 * Usage:
 *   const { theme, toggleTheme } = useTheme()
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx === undefined) {
    throw new Error(
      '`useTheme` must be called inside a <ThemeProvider>.\n' +
        'Wrap your component tree (or app root) with <ThemeProvider>.',
    )
  }
  return ctx
}
