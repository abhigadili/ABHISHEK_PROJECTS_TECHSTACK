import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import CircuitBreaker from 'opossum';
import path from 'node:path';
import { repoRoot } from '../config/index.js';
import { bearer, verifyAccessToken } from '../utils/auth.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError, ServiceUnavailableError, UnauthorizedError } from '../utils/errors.js';
import { context, currentContext } from '../logging/index.js';
import { CORRELATION_HEADER } from '../constants/index.js';

const C = grpc.status;

/** Loads a .proto from the repo's proto/ folder (strongly defined request/response contracts). */
export function loadProto(file) {
  const def = protoLoader.loadSync(path.join(repoRoot, 'proto', file), { keepCase: false, longs: Number, enums: String, defaults: true, oneofs: true });
  return grpc.loadPackageDefinition(def);
}

const toGrpcCode = (e) => (e instanceof NotFoundError ? C.NOT_FOUND : e instanceof UnauthorizedError ? C.UNAUTHENTICATED : e instanceof ForbiddenError ? C.PERMISSION_DENIED
  : e instanceof BadRequestError ? C.INVALID_ARGUMENT : e instanceof ServiceUnavailableError ? C.UNAVAILABLE : C.INTERNAL);

/**
 * gRPC server: every method requires a valid JWT in the "authorization" metadata (same validation as HTTP) and runs inside the
 * caller's correlation context. Business errors are mapped to gRPC status codes.
 * services: [{ service: <ServiceDefinition>, impl: { Method: async (request, ctx) => reply }, roles?: [...] }]
 */
export async function startGrpcServer({ port, services, logger, host = '0.0.0.0' }) {
  const server = new grpc.Server();
  for (const { service, impl, roles } of services) {
    const wrapped = {};
    for (const [name, fn] of Object.entries(impl)) {
      wrapped[name] = async (call, callback) => {
        const correlationId = call.metadata.get(CORRELATION_HEADER)[0] ?? undefined;
        try {
          const token = bearer(call.metadata.get('authorization')[0]);
          if (!token) throw new UnauthorizedError();
          let user;
          try { user = await verifyAccessToken(token); } catch { throw new UnauthorizedError(); }
          if (roles?.length && !roles.some((r) => user.roles.includes(r))) throw new ForbiddenError();
          const reply = await context.run({ correlationId, authorization: `Bearer ${token}` }, () => fn(call.request, { user, correlationId }));
          callback(null, reply);
        } catch (e) {
          if (!(e instanceof AppError)) logger.error({ err: e, method: name }, 'gRPC handler error');
          callback({ code: toGrpcCode(e), details: e.message });
        }
      };
    }
    server.addService(service, wrapped);
  }
  await new Promise((resolve, reject) => server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err) => (err ? reject(err) : resolve())));
  logger.info({ port }, 'gRPC server listening');
  return { server, async stop() { await new Promise((r) => server.tryShutdown(() => r())); } };
}

/**
 * Reusable gRPC client: promise-based methods, per-call deadline, JWT + correlation propagation, Opossum circuit breaker.
 * NOT_FOUND / PERMISSION_DENIED / INVALID_ARGUMENT / UNAUTHENTICATED are business answers and do not count as failures.
 */
export function createGrpcClient({ name, Service, address, logger, deadlineMs = 3000, breaker = {} }) {
  const client = new Service(address, grpc.credentials.createInsecure());
  const BUSINESS = new Set([C.NOT_FOUND, C.PERMISSION_DENIED, C.INVALID_ARGUMENT, C.UNAUTHENTICATED]);
  const wrap = (method) => new CircuitBreaker((request) => new Promise((resolve, reject) => {
    const ctx = currentContext();
    const md = new grpc.Metadata();
    if (ctx.authorization) md.set('authorization', ctx.authorization);
    if (ctx.correlationId) md.set(CORRELATION_HEADER, ctx.correlationId);
    client[method](request, md, { deadline: Date.now() + deadlineMs }, (err, reply) => (err ? reject(err) : resolve(reply)));
  }), {
    name: `grpc:${name}.${method}`, timeout: deadlineMs + 500, errorThresholdPercentage: 50, volumeThreshold: 5, rollingCountTimeout: 30000, resetTimeout: 15000,
    errorFilter: (err) => BUSINESS.has(err?.code), ...breaker,
  });
  const api = {};
  for (const method of Object.keys(Service.service)) {
    const name1 = method.charAt(0).toLowerCase() + method.slice(1);
    const cb = wrap(method.charAt(0).toLowerCase() + method.slice(1));
    cb.on('open', () => logger.warn({ breaker: cb.name }, 'Circuit breaker OPEN'));
    cb.on('halfOpen', () => logger.info({ breaker: cb.name }, 'Circuit breaker HALF-OPEN'));
    cb.on('close', () => logger.info({ breaker: cb.name }, 'Circuit breaker CLOSED'));
    api[name1] = async (request) => {
      try { return await cb.fire(request); } catch (e) {
        if (e.code === 'EOPENBREAKER') throw new ServiceUnavailableError(`${name} circuit is open`);
        if (e.code === C.NOT_FOUND) throw new NotFoundError(e.details || e.message);
        if (e.code === C.PERMISSION_DENIED) throw new ForbiddenError(e.details);
        if (e.code === C.UNAUTHENTICATED) throw new UnauthorizedError(e.details);
        if (e.code === C.INVALID_ARGUMENT) throw new BadRequestError(e.details);
        logger.warn({ service: name, method, code: e.code, err: e.details ?? e.message }, 'gRPC call failed');
        throw new ServiceUnavailableError(`${name} is unavailable`);
      }
    };
  }
  // alias the original PascalCase method names must exist on the client object for wrap(): map lowerCamel -> client[Pascal]
  api.close = () => client.close();
  return api;
}
