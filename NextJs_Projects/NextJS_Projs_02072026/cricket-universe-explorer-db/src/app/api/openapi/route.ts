import { NextResponse } from 'next/server'
import { getOpenAPISpec } from '@/lib/openapi'

export const dynamic = 'force-dynamic'

export function GET() {
  const spec = getOpenAPISpec()
  return NextResponse.json(spec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  })
}
