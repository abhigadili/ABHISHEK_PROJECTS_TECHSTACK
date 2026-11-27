import type { OpenAPIV3 } from 'openapi-types'

const teamResponse: OpenAPIV3.ResponseObject = {
  description: 'Success',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/Team' },
          message: { type: 'string' },
        },
      },
    },
  },
}

const notFoundResponse: OpenAPIV3.ResponseObject = {
  description: 'Not found',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
      example: { error: 'Team not found' },
    },
  },
}

export const teamPaths: OpenAPIV3.PathsObject = {
  '/api/teams': {
    get: {
      tags: ['Teams'],
      summary: 'List all teams',
      description: 'Returns all teams, optionally filtered by league.',
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: 'leagueId',
          in: 'query',
          required: false,
          description: 'Filter by league ID.',
          schema: { type: 'string', example: 'ipl' },
        },
      ],
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: '#/components/schemas/Team' } },
                  total: { type: 'number', example: 10 },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Teams'],
      summary: 'Create a team',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/Team' },
                { required: ['name', 'leagueId'] },
              ],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Team created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Team' },
                  message: { type: 'string', example: 'Team created' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    },
  },

  '/api/teams/{id}': {
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Team ID (slug)',
        schema: { type: 'string', example: 'mi' },
      },
    ],
    get: {
      tags: ['Teams'],
      summary: 'Get a team by ID',
      security: [{ cookieAuth: [] }],
      responses: {
        '200': teamResponse,
        '404': notFoundResponse,
      },
    },
    put: {
      tags: ['Teams'],
      summary: 'Replace a team (full update)',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Team' },
          },
        },
      },
      responses: {
        '200': { ...teamResponse, description: 'Team updated' },
        '404': notFoundResponse,
      },
    },
    patch: {
      tags: ['Teams'],
      summary: 'Partially update a team',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Team' },
          },
        },
      },
      responses: {
        '200': { ...teamResponse, description: 'Team updated' },
        '404': notFoundResponse,
      },
    },
    delete: {
      tags: ['Teams'],
      summary: 'Delete a team',
      security: [{ cookieAuth: [] }],
      responses: {
        '204': { description: 'Deleted successfully — no content.' },
        '404': notFoundResponse,
      },
    },
  },
}
