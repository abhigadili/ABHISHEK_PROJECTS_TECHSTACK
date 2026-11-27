'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

interface NavLink {
  label: string
  href: string
  requiresAuth?: boolean
}

const NAV_LINKS: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Countries', href: '/countries' },
  { label: 'About', href: '/about' },
  { label: 'Dashboard', href: '/dashboard', requiresAuth: true },
  { label: 'Profile', href: '/profile', requiresAuth: true },
  { label: 'API Docs', href: '/api-docs' },
]

interface NavbarProps {
  isLoggedIn?: boolean
  userName?: string
}

export default function Navbar({ isLoggedIn = false, userName }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const isActive = (href: string): boolean => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const linkClass = (href: string) =>
    [
      'flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200',
      isActive(href)
        ? 'bg-emerald-700 text-white'
        : 'text-emerald-100 hover:bg-emerald-800 hover:text-white',
    ].join(' ')

  const mobileLinkClass = (href: string) =>
    [
      'flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200',
      isActive(href)
        ? 'bg-emerald-700 text-white'
        : 'text-emerald-100 hover:bg-emerald-800 hover:text-white',
    ].join(' ')

  const lockIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  )

  return (
    <nav className="bg-emerald-900 border-b border-emerald-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 text-white font-bold text-lg hover:text-emerald-300 transition-colors duration-200"
          >
            <span className="text-2xl" aria-hidden="true">🏏</span>
            <span className="hidden sm:block">Cricket Universe Explorer</span>
            <span className="block sm:hidden">CUE</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.requiresAuth && !isLoggedIn && lockIcon}
                {link.label}
              </Link>
            ))}

            {isLoggedIn ? (
              <div className="flex items-center gap-2 ml-2">
                {userName && (
                  <span className="text-sm text-emerald-300 font-medium px-2">
                    {userName.split(' ')[0]}
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-md text-sm font-medium text-red-300 hover:bg-red-900 hover:text-red-100 transition-colors duration-200"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="ml-2 px-4 py-2 rounded-md text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors duration-200"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-emerald-200 hover:text-white hover:bg-emerald-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400"
            aria-controls="mobile-menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            <span className="sr-only">
              {isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}
            </span>
            {isMobileMenuOpen ? (
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden bg-emerald-900 border-t border-emerald-700 px-2 pt-2 pb-3 space-y-1"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={mobileLinkClass(link.href)}
            >
              {link.requiresAuth && !isLoggedIn && lockIcon}
              {link.label}
            </Link>
          ))}

          {isLoggedIn ? (
            <>
              {userName && (
                <div className="px-3 py-2 text-sm text-emerald-400">
                  Signed in as <strong className="text-emerald-200">{userName}</strong>
                </div>
              )}
              <button
                onClick={() => { setIsMobileMenuOpen(false); handleLogout() }}
                className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-300 hover:bg-red-900 hover:text-red-100 transition-colors duration-200"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors duration-200"
            >
              Sign in
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
