/**
 * ============================================================
 * SearchBar.tsx — Debounced search input component
 * ============================================================
 *
 * WHY 'use client'?
 *   This component uses three client-only hooks:
 *   1. `useState` — tracks the current input value.
 *   2. `useEffect` — sets up the debounce timer.
 *   3. Event handlers (onChange, onClick) — DOM interactions.
 *
 * WHY DEBOUNCE?
 *   Without debounce, `onSearch` would be called on every single
 *   keystroke. If `onSearch` triggers an API call or expensive
 *   filter operation, that means one request per character typed.
 *   For "Australia" that's 9 API calls when you only need 1.
 *
 *   Debouncing waits until the user *stops* typing for 300ms before
 *   calling `onSearch`. This dramatically reduces unnecessary work.
 *
 *   Implementation: `useEffect` runs after every `query` state
 *   change. It registers a setTimeout for 300ms. The *cleanup
 *   function* (returned from useEffect) clears that timer. If the
 *   user types again before 300ms elapses, the cleanup fires,
 *   the old timer is cancelled, and a new 300ms timer starts.
 *   Only when 300ms pass with no new keystrokes does the callback run.
 *
 * CONTROLLED vs UNCONTROLLED INPUTS
 *   - Controlled: React state drives `value`. Every keystroke calls
 *     setState → re-renders → input reflects new value. You have
 *     full control over the value at all times. Use when you need
 *     to validate, transform, or read the value in React.
 *   - Uncontrolled: the DOM manages the value; you read it via a
 *     `ref` (ref.current.value). Use for simple forms where you
 *     only need the value on submit, or when integrating with
 *     non-React form libraries.
 *
 *   We use controlled here because we need the value to:
 *   1. Drive the debounce effect.
 *   2. Conditionally show/hide the clear button.
 *   3. Clear programmatically when the clear button is clicked.
 * ============================================================
 */

'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SearchBarProps {
  /** Called with the current search string after the debounce delay. */
  onSearch: (query: string) => void
  /** Placeholder text for the input. Defaults to 'Search…' */
  placeholder?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Milliseconds to wait after the last keystroke before firing onSearch. */
const DEBOUNCE_DELAY_MS = 300

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchBar({
  onSearch,
  placeholder = 'Search…',
}: SearchBarProps) {
  // Controlled input state — tracks the raw text the user has typed.
  const [query, setQuery] = useState<string>('')

  // Ref for the input element — used to re-focus after clearing, improving UX.
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Debounce effect ───────────────────────────────────────────────────────
  // This effect re-runs every time `query` changes.
  // It schedules `onSearch` to run after DEBOUNCE_DELAY_MS ms.
  // The cleanup function cancels the pending timer if `query` changes again
  // before the delay expires — that's the core of debouncing.
  useEffect(() => {
    // Schedule the callback
    const timerId = setTimeout(() => {
      onSearch(query.trim())
    }, DEBOUNCE_DELAY_MS)

    // Cleanup: cancel the previous timer when query changes or component unmounts.
    // Without this cleanup, rapid typing would queue up many onSearch calls.
    return () => {
      clearTimeout(timerId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // `onSearch` is intentionally omitted — if it's an inline arrow function in
    // the parent it would change on every render and re-trigger this effect
    // constantly. If the parent needs to change the handler, they should use
    // useCallback to stabilise it.
  }, [query])

  // ── Clear handler ─────────────────────────────────────────────────────────
  const handleClear = () => {
    setQuery('')
    // Immediately call onSearch with empty string — don't wait for debounce
    // because "clear" is an explicit action, not typing noise.
    onSearch('')
    // Return focus to the input so the user can start typing immediately.
    inputRef.current?.focus()
  }

  return (
    <div
      className="relative flex items-center w-full"
      role="search"
    >
      {/* ── Search icon ───────────────────────────────────────────────── */}
      {/* Positioned absolutely inside the input padding zone */}
      <div
        className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none"
        aria-hidden="true"
      >
        {/* Inline SVG magnifying glass — no external icon library needed */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z"
          />
        </svg>
      </div>

      {/* ── Controlled text input ─────────────────────────────────────── */}
      <input
        ref={inputRef}
        type="search"
        value={query}                                     // controlled: value from state
        onChange={(e) => setQuery(e.target.value)}        // update state on each keystroke
        placeholder={placeholder}
        aria-label="Search"
        className={[
          // Full width, with left padding for the search icon
          'w-full bg-emerald-950 border border-emerald-700 rounded-lg',
          'pl-9 pr-10 py-2.5 text-sm text-white placeholder-emerald-500',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
          'transition-colors duration-200',
          // Slightly brighter border on hover (before focus)
          'hover:border-emerald-600',
        ].join(' ')}
      />

      {/* ── Clear button — only shown when there is a query ───────────── */}
      {/* Conditional rendering removes it from the DOM (not just invisible),
          so screen readers won't announce it when there's nothing to clear. */}
      {query.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className={[
            'absolute right-3 top-1/2 -translate-y-1/2',
            'text-emerald-400 hover:text-white',
            'transition-colors duration-200',
            // Use a slightly larger hit target than the visual icon for usability
            'p-0.5 rounded-full hover:bg-emerald-700',
          ].join(' ')}
        >
          {/* × close icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
