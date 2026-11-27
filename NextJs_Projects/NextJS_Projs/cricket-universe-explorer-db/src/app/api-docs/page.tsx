import type { Metadata } from 'next'
import SwaggerClient from './SwaggerClient'

export const metadata: Metadata = {
  title: 'API Docs | Cricket Universe Explorer',
  description: 'Interactive OpenAPI 3.0 documentation for all Cricket Universe Explorer endpoints.',
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">🏏</span>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">
                Cricket Universe Explorer — API Docs
              </h1>
              <p className="text-gray-400 text-xs">
                OpenAPI 3.0 &bull; 25 endpoints &bull; JSON spec at{' '}
                <a
                  href="/api/openapi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                >
                  /api/openapi
                </a>
              </p>
            </div>
          </div>
          <a
            href="/dashboard"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Dashboard
          </a>
        </div>
      </div>

      <SwaggerClient />
    </div>
  )
}
