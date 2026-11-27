"use strict";
// ============================================================
// TYPE 2 & 3: Express.js Application setup
// ============================================================
// WHAT: The Express application — registers all middleware and routes.
// WHY:  Separating app config from server startup makes testing easier.
//       Tests can import `app` without binding to a port.
// HOW:  Express is a minimal HTTP framework that adds:
//       - Routing (app.get, app.post, router)
//       - Middleware pipeline (app.use)
//       - Error handling (4-arg middleware)
//       on top of Node.js's raw http.createServer().
// Interview Tip: express() creates an application object that IS a
//               valid Node.js request handler — you can pass it directly
//               to http.createServer(app) (that's what app.listen does internally).
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors")); // Cross-Origin Resource Sharing
const helmet_1 = __importDefault(require("helmet")); // Security HTTP headers
const morgan_1 = __importDefault(require("morgan")); // HTTP request logger
const compression_1 = __importDefault(require("compression")); // gzip response compression
const cookie_parser_1 = __importDefault(require("cookie-parser")); // parse Cookie header
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const passport_1 = __importDefault(require("passport"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const env_config_1 = require("../config/env.config");
const logger_1 = require("../utils/logger");
const swagger_config_1 = require("../config/swagger.config");
const requestId_middleware_1 = require("../middlewares/requestId.middleware");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
// Routes
const auth_routes_1 = __importDefault(require("../routes/auth.routes"));
const company_routes_1 = __importDefault(require("../routes/company.routes"));
const department_routes_1 = __importDefault(require("../routes/department.routes"));
const employee_routes_1 = __importDefault(require("../routes/employee.routes"));
const room_routes_1 = __importDefault(require("../routes/room.routes"));
const postgresql_routes_1 = __importDefault(require("../routes/postgresql.routes"));
const dashboard_routes_1 = __importDefault(require("../routes/dashboard.routes"));
const createApp = () => {
    const app = (0, express_1.default)();
    // ---- Security Headers (Helmet) ----
    // WHAT: Sets ~15 security-related HTTP headers automatically.
    // WHY:  Prevents clickjacking (X-Frame-Options), MIME sniffing
    //       (X-Content-Type-Options), XSS (Content-Security-Policy), etc.
    // Interview Tip: Always use Helmet in production. It's a single line
    //               that fixes many OWASP Top 10 vulnerabilities.
    app.use((0, helmet_1.default)());
    // ---- CORS ----
    // WHAT: Cross-Origin Resource Sharing — controls which origins
    //       can call your API from a browser.
    // WHY:  Browsers block cross-origin requests by default (same-origin policy).
    //       CORS headers tell the browser to allow specific origins.
    // When to allow *: Never in production! Only in development.
    // Interview Tip: CORS is enforced by BROWSERS, not servers.
    //               curl / Postman ignore CORS — only browsers check it.
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            // Allow requests with no origin (Postman, mobile apps, server-to-server)
            if (!origin)
                return callback(null, true);
            if (env_config_1.config.cors.origins.includes(origin))
                return callback(null, true);
            callback(new Error(`CORS: origin "${origin}" not allowed`));
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id'],
        credentials: true, // allow cookies/Authorization headers cross-origin
        maxAge: 86400, // preflight cache: 24h (reduces OPTIONS requests)
    }));
    // ---- Rate Limiting ----
    // WHAT: Limits how many requests a single IP can make in a time window.
    // WHY:  Prevents brute-force attacks, DDoS, API scraping.
    // Performance Consideration: In a multi-instance deployment, use
    //   store: new RedisStore(...) to share rate limit counts across pods.
    app.use((0, express_rate_limit_1.default)({
        windowMs: env_config_1.config.rateLimit.windowMs, // e.g. 15 minutes
        max: env_config_1.config.rateLimit.max, // e.g. 100 requests per window
        message: { success: false, message: 'Too many requests, please try again later.' },
        standardHeaders: true, // return RateLimit-* headers
        legacyHeaders: false,
    }));
    // ---- Body Parsers ----
    // WHAT: Parse incoming request bodies into req.body.
    // WHY:  Raw HTTP requests are byte streams. Parsers decode them.
    // Interview Tip: express.json() replaces the old body-parser package
    //               (merged into Express 4.16+).
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    app.use((0, cookie_parser_1.default)());
    // ---- Compression ----
    // WHAT: gzip response bodies before sending.
    // WHY:  Reduces response size by 60-80%, improving network performance.
    // When NOT to use: for already-compressed data (images, videos, PDFs).
    app.use((0, compression_1.default)());
    // ---- HTTP Request Logging (Morgan → Winston) ----
    // 'combined' format includes IP, method, URL, status, size, referrer, user-agent
    // Interview Tip: Morgan logs EVERY request. Winston logs app events.
    //               Both are needed in production.
    app.use((0, morgan_1.default)('combined', { stream: logger_1.morganStream }));
    // ---- Request ID ----
    app.use(requestId_middleware_1.requestIdMiddleware);
    // ---- Passport (OAuth2) ----
    app.use(passport_1.default.initialize());
    // ---- Swagger UI ----
    // Available at /api-docs
    app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_config_1.swaggerSpec, {
        customSiteTitle: 'LM Company Portal API',
    }));
    // ---- API Routes ----
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/companies', company_routes_1.default);
    app.use('/api/departments', department_routes_1.default);
    app.use('/api/employees', employee_routes_1.default);
    app.use('/api/rooms', room_routes_1.default);
    app.use('/api/postgresql', postgresql_routes_1.default); // Learning module
    app.use('/api/dashboard', dashboard_routes_1.default); // TYPE 3: Node.js + Express combined
    // ---- Root ----
    app.get('/', (_req, res) => {
        res.json({
            message: 'LM Company Portal API',
            docs: '/api-docs',
            health: '/api/health',
            version: '1.0.0',
        });
    });
    app.get('/api/health', (_req, res) => {
        res.json({ success: true, status: 'OK', uptime: process.uptime() });
    });
    // ---- 404 handler — must be AFTER all routes ----
    app.use(errorHandler_middleware_1.notFoundHandler);
    // ---- Global Error Handler — must be LAST middleware ----
    // Express identifies it by its 4 arguments (err, req, res, next)
    app.use(errorHandler_middleware_1.globalErrorHandler);
    return app;
};
exports.createApp = createApp;
