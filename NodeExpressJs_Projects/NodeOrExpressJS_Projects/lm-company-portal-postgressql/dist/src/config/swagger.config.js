"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const env_config_1 = require("./env.config");
const options = {
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
        servers: [{ url: `http://localhost:${env_config_1.config.port}`, description: 'Development' }],
        components: {
            securitySchemes: {
                BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
            schemas: {
                RegisterRequest: {
                    type: 'object',
                    required: ['firstName', 'lastName', 'email', 'password'],
                    properties: {
                        firstName: { type: 'string', example: 'John' },
                        lastName: { type: 'string', example: 'Doe' },
                        email: { type: 'string', format: 'email', example: 'john@lm.com' },
                        password: { type: 'string', minLength: 8, example: 'Secret123!' },
                    },
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string' },
                    },
                },
                ApiResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: { type: 'object' },
                    },
                },
            },
        },
        security: [{ BearerAuth: [] }],
    },
    apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};
exports.swaggerSpec = (0, swagger_jsdoc_1.default)(options);
