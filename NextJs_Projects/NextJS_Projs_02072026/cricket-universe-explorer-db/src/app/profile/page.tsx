import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getUserById } from '@/lib/auth-db'

export const metadata: Metadata = {
  title: 'Profile | Cricket Universe Explorer',
  description: 'Your Cricket Universe Explorer account profile.',
}

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const user = await getCurrentUser(cookieStore)

  if (!user) {
    redirect('/login')
  }

  // Fetch full DB record for timestamps not in the JWT
  const dbUser = await getUserById(parseInt(user.id))

  const memberSince = dbUser?.created_at
    ? new Date(dbUser.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown'

  const lastLogin = dbUser?.last_login
    ? new Date(dbUser.last_login).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'This is your first session'

  return (
    <div className="bg-gray-950 min-h-full">

      <div className="bg-gradient-to-br from-emerald-950 to-gray-950 border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-5 mb-4">
            <div
              className="h-16 w-16 rounded-full bg-emerald-700 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
              aria-hidden="true"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{user.name}</h1>
              <p className="text-emerald-300 text-sm mt-1">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-5">Account Information</h2>
          <dl className="space-y-4">
            {[
              { label: 'Full Name', value: user.name, mono: false },
              { label: 'Email Address', value: user.email, mono: false },
              { label: 'User ID', value: `#${user.id}`, mono: true },
              { label: 'Member Since', value: memberSince, mono: false },
              { label: 'Last Login', value: lastLogin, mono: false },
            ].map(({ label, value, mono }) => (
              <div
                key={label}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-emerald-900/30 border border-emerald-800/50 px-4 py-3"
              >
                <dt className="text-emerald-400 text-sm font-medium">{label}</dt>
                <dd className={mono ? 'text-emerald-300 font-mono text-sm' : 'text-white font-semibold'}>
                  {value}
                </dd>
              </div>
            ))}

            {/* Role badge row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-emerald-900/30 border border-emerald-800/50 px-4 py-3">
              <dt className="text-emerald-400 text-sm font-medium">Account Role</dt>
              <dd>
                <span
                  className={[
                    'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize',
                    user.role === 'admin'
                      ? 'bg-purple-900 text-purple-300 border border-purple-700'
                      : 'bg-emerald-900 text-emerald-300 border border-emerald-700',
                  ].join(' ')}
                >
                  {user.role === 'admin' ? '⚙️ Admin' : '🏏 User'}
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-6">
          <h2 className="text-xl font-bold text-white mb-3">Session Info</h2>
          <p className="text-emerald-400 text-sm leading-relaxed mb-4">
            Your session uses two httpOnly cookies — an access token (15 min) and a
            refresh token (7 days). The access token is verified on every protected
            request; the refresh token silently issues a new access token when the
            old one expires, keeping you logged in seamlessly.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              'HttpOnly cookie',
              '15 min access token',
              '7 day refresh token',
              'Token rotation on refresh',
            ].map((label) => (
              <div key={label} className="flex items-center gap-2 text-xs text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden="true" />
                {label}
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            ← Dashboard
          </Link>
          <Link
            href="/countries"
            className="inline-flex items-center gap-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200"
          >
            Explore Countries →
          </Link>
        </div>

      </div>
    </div>
  )
}
