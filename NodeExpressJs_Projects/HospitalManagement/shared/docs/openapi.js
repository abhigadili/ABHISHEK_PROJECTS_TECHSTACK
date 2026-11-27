import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import { authenticate, requireRoles } from '../utils/auth.js';
import { validate } from '../utils/validate.js';

/**
 * Route declaration helper: ONE declaration registers the Express route (authentication, role check, Zod validation) AND
 * its OpenAPI description, so documentation can never drift from behaviour.
 *   const api = defineApi(registry); api.post('/x', { summary, roles, body, query, public }, handler)
 */
export function defineApi(router, registry) {
  const add = (method) => (path, meta, ...handlers) => {
    const mw = [];
    if (!meta.public) { mw.push(authenticate); if (meta.roles?.length) mw.push(requireRoles(...meta.roles)); }
    if (meta.body || meta.query || meta.params) mw.push(validate({ body: meta.body, query: meta.query, params: meta.params }));
    router[method](path, ...mw, ...handlers);
    registry.push({ method, path, ...meta });
  };
  return { get: add('get'), post: add('post'), put: add('put'), patch: add('patch'), delete: add('delete') };
}

const schemaOf = (s) => { try { return z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' }); } catch { return { type: 'object' }; } };

export function buildOpenApi({ title, version = '1.0.0', registry, tag }) {
  const paths = {};
  for (const r of registry) {
    const p = r.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    const params = [...(r.path.match(/:([A-Za-z0-9_]+)/g) ?? [])].map((x) => ({ name: x.slice(1), in: 'path', required: true, schema: { type: 'string' } }));
    if (r.query) {
      const js = schemaOf(r.query);
      for (const [name, sch] of Object.entries(js.properties ?? {})) params.push({ name, in: 'query', required: (js.required ?? []).includes(name), schema: sch });
    }
    paths[p] ??= {};
    paths[p][r.method] = {
      tags: [tag ?? title],
      summary: r.summary ?? '',
      description: r.roles?.length ? `Roles: ${r.roles.join(', ')}` : r.public ? 'Public' : 'Any authenticated user',
      security: r.public ? [] : [{ bearerAuth: [] }],
      parameters: params,
      ...(r.body ? { requestBody: { required: true, content: { 'application/json': { schema: schemaOf(r.body) } } } } : {}),
      responses: { 200: { description: 'OK' }, 400: { description: 'Validation failed' }, 401: { description: 'Unauthorized' }, 403: { description: 'Forbidden' }, 404: { description: 'Not found' }, 409: { description: 'Conflict' } },
    };
  }
  return { openapi: '3.0.3', info: { title, version }, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }, paths };
}

/** Serves /openapi.json (consumed by the gateway's aggregated Swagger UI) and a per-service /docs UI. */
export function mountDocs(app, { title, registry }) {
  const spec = () => buildOpenApi({ title, registry });
  app.get('/openapi.json', (req, res) => res.json(spec()));
  app.use('/docs', swaggerUi.serve, (req, res, next) => swaggerUi.setup(spec())(req, res, next));
}
export { express };
