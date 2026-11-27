import type { OpenAPIV3 } from 'openapi-types'

const authUserResponse: OpenAPIV3.ResponseObject = {
  description: 'Success',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          user: { $ref: '#/components/schemas/AuthUser' },
        },
      },
    },
  },
}

const unauthorizedResponse: OpenAPIV3.ResponseObject = {
  description: 'Unauthorized',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
      example: { error: 'Unauthorized — please log in.' },
    },
  },
}

export const authPaths: OpenAPIV3.PathsObject = {
  '/api/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new user',
      description: 'Creates an account and immediately issues access + refresh token cookies.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'email', 'password', 'confirmPassword'],
              properties: {
                name: { type: 'string', minLength: 2, maxLength: 100, example: 'Sachin Tendulkar' },
                email: { type: 'string', format: 'email', example: 'sachin@cricket.com' },
                password: {
                  type: 'string',
                  minLength: 8,
                  description: 'Min 8 characters, at least one uppercase letter and one digit.',
                  example: 'Cricket@123',
                },
                confirmPassword: { type: 'string', example: 'Cricket@123' },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Account created. Sets access_token and refresh_token cookies.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  user: { $ref: '#/components/schemas/AuthUser' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { error: 'Password must be at least 8 characters.' },
            },
          },
        },
        '409': {
          description: 'Email already registered',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { error: 'Email already exists.' },
            },
          },
        },
      },
    },
  },

  '/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Log in with credentials',
      description:
        'Verifies email and password (bcrypt), issues a 15-min access token and a 7-day refresh token as HttpOnly cookies.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email', example: 'admin@cricket.com' },
                password: { type: 'string', example: 'Cricket@123' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Logged in. Sets access_token and refresh_token cookies.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  user: { $ref: '#/components/schemas/AuthUser' },
                },
              },
            },
          },
        },
        '401': {
          description: 'Invalid credentials (generic to prevent user enumeration)',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { error: 'Invalid email or password.' },
            },
          },
        },
      },
    },
  },

  '/api/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Log out',
      description:
        'Revokes the refresh token in the database and deletes both auth cookies from the browser.',
      security: [{ cookieAuth: [] }],
      responses: {
        '200': {
          description: 'Logged out successfully.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessMessage' },
            },
          },
        },
      },
    },
  },

  '/api/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      description:
        'Uses the refresh_token cookie (7-day) to issue a new access token and rotate the refresh token. Called silently by the client when a 401 is encountered.',
      responses: {
        '200': {
          ...authUserResponse,
          description: 'New tokens issued. Rotated refresh_token cookie is also set.',
        },
        '401': {
          ...unauthorizedResponse,
          description: 'Missing, invalid, expired, or already-revoked refresh token.',
        },
      },
    },
  },

  '/api/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Get current user',
      description: 'Returns the authenticated user decoded from the access_token cookie.',
      security: [{ cookieAuth: [] }],
      responses: {
        '200': authUserResponse,
        '401': unauthorizedResponse,
      },
    },
  },
}
