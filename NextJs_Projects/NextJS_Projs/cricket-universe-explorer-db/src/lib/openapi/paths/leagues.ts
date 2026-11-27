import type { OpenAPIV3 } from 'openapi-types'

const leagueResponse: OpenAPIV3.ResponseObject = {
  description: 'Success',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/League' },
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
      example: { error: 'League not found' },
    },
  },
}

export const leaguePaths: OpenAPIV3.PathsObject = {
  '/api/leagues': {
    get: {
      tags: ['Leagues'],
      summary: 'List all leagues',
      description: 'Returns leagues, optionally filtered by country and/or search term.',
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: 'countryId',
          in: 'query',
          required: false,
          description: 'Filter by country ID.',
          schema: { type: 'string', example: 'india' },
        },
        {
          name: 'search',
          in: 'query',
          required: false,
          description: 'Search leagues by name.',
          schema: { type: 'string', example: 'premier' },
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
                  data: { type: 'array', items: { $ref: '#/components/schemas/League' } },
                  total: { type: 'number', example: 4 },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Leagues'],
      summary: 'Create a league',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/League' },
                { required: ['name', 'countryId'] },
              ],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'League created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/League' },
                  message: { type: 'string', example: 'League created' },
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

  '/api/leagues/{id}': {
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'League ID (slug)',
        schema: { type: 'string', example: 'ipl' },
      },
    ],
    get: {
      tags: ['Leagues'],
      summary: 'Get a league by ID',
      security: [{ cookieAuth: [] }],
      responses: {
        '200': leagueResponse,
        '404': notFoundResponse,
      },
    },
    put: {
      tags: ['Leagues'],
      summary: 'Replace a league (full update)',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/League' },
          },
        },
      },
      responses: {
        '200': { ...leagueResponse, description: 'League updated' },
        '404': notFoundResponse,
      },
    },
    patch: {
      tags: ['Leagues'],
      summary: 'Partially update a league',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/League' },
          },
        },
      },
      responses: {
        '200': { ...leagueResponse, description: 'League updated' },
        '404': notFoundResponse,
      },
    },
    delete: {
      tags: ['Leagues'],
      summary: 'Delete a league',
      description: 'Cascades: invalidates teams and cricketers cache tags.',
      security: [{ cookieAuth: [] }],
      responses: {
        '204': { description: 'Deleted successfully — no content.' },
        '404': notFoundResponse,
      },
    },
  },
}
