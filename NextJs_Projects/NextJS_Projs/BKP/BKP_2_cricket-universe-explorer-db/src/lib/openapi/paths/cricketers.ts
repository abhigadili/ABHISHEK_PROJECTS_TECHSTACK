import type { OpenAPIV3 } from 'openapi-types'

const cricketerResponse: OpenAPIV3.ResponseObject = {
  description: 'Success',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/Cricketer' },
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
      example: { error: 'Cricketer not found' },
    },
  },
}

export const cricketerPaths: OpenAPIV3.PathsObject = {
  '/api/cricketers': {
    get: {
      tags: ['Cricketers'],
      summary: 'List all cricketers',
      description: 'Returns all cricketers, optionally filtered by team and/or role.',
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: 'teamId',
          in: 'query',
          required: false,
          description: 'Filter by team ID.',
          schema: { type: 'string', example: 'mi' },
        },
        {
          name: 'role',
          in: 'query',
          required: false,
          description: 'Filter by player role.',
          schema: {
            type: 'string',
            enum: ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper-Batsman', 'Wicketkeeper'],
          },
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
                  data: { type: 'array', items: { $ref: '#/components/schemas/Cricketer' } },
                  total: { type: 'number', example: 50 },
                },
              },
            },
          },
        },
        '400': {
          description: 'Invalid role value',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { error: 'Invalid role.' },
            },
          },
        },
      },
    },
    post: {
      tags: ['Cricketers'],
      summary: 'Create a cricketer',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/Cricketer' },
                { required: ['name', 'teamId', 'role'] },
              ],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Cricketer created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Cricketer' },
                  message: { type: 'string', example: 'Cricketer created' },
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

  '/api/cricketers/{id}': {
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Cricketer ID (slug)',
        schema: { type: 'string', example: 'rohit-sharma' },
      },
    ],
    get: {
      tags: ['Cricketers'],
      summary: 'Get a cricketer by ID',
      security: [{ cookieAuth: [] }],
      responses: {
        '200': cricketerResponse,
        '404': notFoundResponse,
      },
    },
    put: {
      tags: ['Cricketers'],
      summary: 'Replace a cricketer (full update)',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Cricketer' },
          },
        },
      },
      responses: {
        '200': { ...cricketerResponse, description: 'Cricketer updated' },
        '404': notFoundResponse,
      },
    },
    patch: {
      tags: ['Cricketers'],
      summary: 'Partially update a cricketer',
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Cricketer' },
          },
        },
      },
      responses: {
        '200': { ...cricketerResponse, description: 'Cricketer updated' },
        '404': notFoundResponse,
      },
    },
    delete: {
      tags: ['Cricketers'],
      summary: 'Delete a cricketer',
      security: [{ cookieAuth: [] }],
      responses: {
        '204': { description: 'Deleted successfully — no content.' },
        '404': notFoundResponse,
      },
    },
  },
}
