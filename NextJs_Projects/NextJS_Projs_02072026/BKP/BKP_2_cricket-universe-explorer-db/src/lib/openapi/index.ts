/**
 * OpenAPI spec assembler.
 *
 * HOW TO ADD A NEW API:
 *   1. Create src/lib/openapi/paths/your-resource.ts
 *      — export `yourResourcePaths: OpenAPIV3.PathsObject`
 *   2. Import it below and spread it into `paths`.
 *   That's it — the /api/openapi endpoint and Swagger UI reflect it automatically.
 */

import type { OpenAPIV3 } from 'openapi-types'
import { schemas, securitySchemes } from './schemas'

// ── Path modules — add one import + one spread per new resource ──────────────
import { authPaths } from './paths/auth'
import { countryPaths } from './paths/countries'
import { leaguePaths } from './paths/leagues'
import { teamPaths } from './paths/teams'
import { cricketerPaths } from './paths/cricketers'

export function getOpenAPISpec(): OpenAPIV3.Document {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Cricket Universe Explorer API',
      version: '1.0.0',
      description: `
REST API for the Cricket Universe Explorer application.

## Authentication
All protected endpoints require an **access_token** HttpOnly cookie (15-min JWT).
Obtain it via \`POST /api/auth/login\` or \`POST /api/auth/register\`.
When the access token expires, call \`POST /api/auth/refresh\` — the browser sends the
**refresh_token** cookie (7-day, path-restricted to \`/api/auth\`) automatically.

## Adding new APIs
Create \`src/lib/openapi/paths/your-resource.ts\`, export a \`PathsObject\`,
then add one import + one spread in \`src/lib/openapi/index.ts\`.
      `.trim(),
      contact: {
        name: 'Cricket Universe Explorer',
        email: 'agadili@loyaltymethods.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication — register, login, logout, refresh, me' },
      { name: 'Countries', description: 'Cricket nations' },
      { name: 'Leagues', description: 'Cricket leagues within countries' },
      { name: 'Teams', description: 'Teams within leagues' },
      { name: 'Cricketers', description: 'Players within teams' },
    ],
    paths: {
      ...authPaths,
      ...countryPaths,
      ...leaguePaths,
      ...teamPaths,
      ...cricketerPaths,
    },
    components: {
      schemas,
      securitySchemes,
    },
  }
}
