'use client'

import dynamic from 'next/dynamic'
import 'swagger-ui-react/swagger-ui.css'

const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-gray-400 text-sm">Loading API documentation...</p>
    </div>
  ),
})

export default function SwaggerClient() {
  return (
    <SwaggerUI
      url="/api/openapi"
      docExpansion="list"
      defaultModelsExpandDepth={1}
      persistAuthorization
      tryItOutEnabled
    />
  )
}
