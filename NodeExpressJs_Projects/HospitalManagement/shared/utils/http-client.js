import CircuitBreaker from 'opossum';
import { currentContext } from '../logging/index.js';
import { CORRELATION_HEADER } from '../constants/index.js';
import { DownstreamClientError, NotFoundError, ServiceUnavailableError, AppError } from './errors.js';

class HttpStatusError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/**
 * Reusable HTTP client for service-to-service REST calls (native fetch):
 *  - request timeout (AbortSignal), JWT + correlation-id propagation from the current request context
 *  - Opossum circuit breaker (4xx answers are business answers and are NOT counted as failures)
 *  - retries ONLY for idempotent GETs (never for POST/PUT/PATCH/DELETE)
 *  - optional last-known fallback for GETs (degraded answer instead of an error)
 */
export function createHttpClient({ name, baseUrl, logger, timeoutMs = 4000, breaker = {}, getRetries = 2, lastKnownFallback = false }) {
  const lastKnown = new Map();
  const doFetch = async (method, path, { body, headers } = {}) => {
    const ctx = currentContext();
    let res;
    try {
      res = await fetch(baseUrl + path, {
        method,
        headers: { 'content-type': 'application/json', accept: 'application/json', ...(ctx.authorization ? { authorization: ctx.authorization } : {}), ...(ctx.correlationId ? { [CORRELATION_HEADER]: ctx.correlationId } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) { throw new HttpStatusError(0, e.name === 'TimeoutError' ? `${name} timed out` : `${name} unreachable: ${e.cause?.code ?? e.message}`); }
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
    if (!res.ok) throw new HttpStatusError(res.status, json?.message ?? `${name} answered HTTP ${res.status}`);
    return json;
  };

  const cb = new CircuitBreaker(doFetch, {
    name: `http:${name}`, timeout: timeoutMs + 1000, errorThresholdPercentage: 50, volumeThreshold: 5, rollingCountTimeout: 30000, resetTimeout: 15000,
    errorFilter: (err) => err.status >= 400 && err.status < 500, ...breaker,
  });
  cb.on('open', () => logger.warn({ breaker: cb.name }, 'Circuit breaker OPEN'));
  cb.on('halfOpen', () => logger.info({ breaker: cb.name }, 'Circuit breaker HALF-OPEN'));
  cb.on('close', () => logger.info({ breaker: cb.name }, 'Circuit breaker CLOSED'));

  const mapError = (e) => {
    if (e instanceof AppError) return e;
    if (e.code === 'EOPENBREAKER') return new ServiceUnavailableError(`${name} circuit is open`);
    if (e.code === 'ETIMEDOUT') return new ServiceUnavailableError(`${name} timed out`);
    if (e.status === 404) return new NotFoundError(e.message);
    if (e.status >= 400 && e.status < 500) return new DownstreamClientError(e.status, e.message);
    return new ServiceUnavailableError(e.message);
  };

  async function request(method, path, opts) {
    const attempts = method === 'GET' ? getRetries + 1 : 1;
    let lastErr;
    for (let i = 1; i <= attempts; i += 1) {
      try {
        const out = await cb.fire(method, path, opts);
        if (method === 'GET' && lastKnownFallback) lastKnown.set(path, out);
        return out;
      } catch (e) {
        lastErr = e;
        const retryable = !(e.code === 'EOPENBREAKER') && !(e.status >= 400 && e.status < 500);
        if (!retryable || i === attempts) break;
        await new Promise((r) => setTimeout(r, 150 * 2 ** (i - 1) + Math.random() * 100));
      }
    }
    if (method === 'GET' && lastKnownFallback && lastKnown.has(path) && !(lastErr.status >= 400 && lastErr.status < 500)) {
      logger.warn({ service: name, path }, 'Downstream unavailable; serving last-known response (degraded)');
      return lastKnown.get(path);
    }
    if (!(lastErr instanceof HttpStatusError) && lastErr.code !== 'EOPENBREAKER' && lastErr.code !== 'ETIMEDOUT') throw lastErr;
    if (lastErr.status === 0 || lastErr.status >= 500 || lastErr.code) logger.warn({ service: name, method, path, err: lastErr.message }, 'HTTP call to downstream service failed');
    throw mapError(lastErr);
  }

  return { get: (p, o) => request('GET', p, o), post: (p, body, o) => request('POST', p, { ...o, body }), put: (p, body, o) => request('PUT', p, { ...o, body }), breaker: cb };
}
