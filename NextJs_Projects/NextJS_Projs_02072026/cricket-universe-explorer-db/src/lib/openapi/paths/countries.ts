import type { OpenAPIV3 } from 'openapi-types'

const countryResponse: OpenAPIV3.ResponseObject = {
  description: 'Success',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/Country' },
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
      example: { error: 'Country not found' },
    },
  },
}

export const countryPaths: OpenAPIV3.PathsObject = {
  '/api/countries': {
    get: {
      tags: ['Countries'],
      summary: 'List all countries',
      description: 'Returns all countries, optionally filtered by a search term.',
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: 'search',
          in: 'query',
          description: 'Filter countries by name (case-insensitive).',
          required: false,
          schema: { type: 'string', example: 'india' },
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
                  data: { type: 'array', items: { $ref: '#/components/schemas/Country' } },
                  total: { type: 'number', example: 6 },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Countries'],
      summary: 'Create a country',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/Country' },
                { required: ['name', 'shortName'] },
              ],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Country created',
          headers: {
            Location: {
              description: 'URL of the new resource',
              schema: { type: 'string', example: '/api/countries/india' },
            },
          },
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Country' },
                  message: { type: 'string', example: 'Country created' },
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

  '/api/countries/{id}': {
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Country ID (slug)',
        schema: { type: 'string', example: 'india' },
      },
    ],
    get: {
      tags: ['Countries'],
      summary: 'Get a country by ID',
      security: [{ cookieAuth: [] }],
      responses: {
        '200': countryResponse,
        '404': notFoundResponse,
      },
    },
    put: {
      tags: ['Countries'],
      summary: 'Replace a country (full update)',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Country' },
          },
        },
      },
      responses: {
        '200': { ...countryResponse, description: 'Country updated' },
        '404': notFoundResponse,
      },
    },
    patch: {
      tags: ['Countries'],
      summary: 'Partially update a country',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Country' },
          },
        },
      },
      responses: {
        '200': { ...countryResponse, description: 'Country updated' },
        '404': notFoundResponse,
      },
    },
    delete: {
      tags: ['Countries'],
      summary: 'Delete a country',
      description: 'Cascades: invalidates leagues, teams, and cricketers cache tags.',
      security: [{ cookieAuth: [] }],
      responses: {
        '204': { description: 'Deleted successfully — no content.' },
        '404': notFoundResponse,
      },
    },
  },
}
