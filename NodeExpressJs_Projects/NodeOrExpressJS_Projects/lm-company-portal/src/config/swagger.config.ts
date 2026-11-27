import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './env.config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LM Company Portal API',
      version: '1.0.0',
      description: `
## LM Company Portal Backend API

Enterprise Node.js + Express.js + MongoDB + Redis + JWT learning project.

### Auth
Use **POST /api/auth/login** to get an access token, then click **Authorize** and enter: \`Bearer <token>\`

### Modules
- Auth (JWT + OAuth2)
- Company, Department, Employee, Room management
- MongoDB learning endpoints
- Dashboard analytics
      `,
    },
    servers: [{ url: `http://localhost:${config.port}`, description: 'Development' }],
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        RegisterRequest: {
          type: 'object',
          required: ['firstName','lastName','email','password'],
          properties: {
            firstName: { type: 'string', example: 'John' },
            lastName:  { type: 'string', example: 'Doe' },
            email:     { type: 'string', format: 'email', example: 'john@lm.com' },
            password:  { type: 'string', minLength: 8, example: 'Secret123!' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email','password'],
          properties: {
            email:    { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data:    { type: 'object' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
