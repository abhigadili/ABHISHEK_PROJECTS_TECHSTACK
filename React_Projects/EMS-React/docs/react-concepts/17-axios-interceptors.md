# 17 · Axios interceptors (auth, refresh, error handling)

## 1. Concept explanation
Interceptors are middleware for HTTP: a **request** interceptor can modify every outgoing request; a **response** interceptor can
inspect, transform, retry or reject every response. This app uses them for: attaching the Bearer token, a correlation id,
**silent token refresh on 401 with a replay of the original request**, normalising errors to `ApiError`, global toasts for systemic
failures and logout when the session can't be recovered.

**Matching the backend** (inspected, documented in `docs/backend-api-integration.md`): JWT access token (15 min) + **rotating**
opaque refresh token in the JSON body; re-using a rotated refresh token revokes the *whole token family*. There are no cookies, so no
CSRF handling is needed and "HttpOnly" does not apply. Consequence: **two simultaneous refreshes would log the user out**, so refresh
must be *single-flight*.

## 2. Syntax
```ts
http.interceptors.request.use((config) => { config.headers.set('Authorization', `Bearer ${token}`); return config; });
http.interceptors.response.use((r) => r, async (error) => { /* refresh + retry, or throw a normalised ApiError */ });
```

## 3. Actual EMS implementation (`src/api/httpClient.ts`)
| Requirement | Implementation |
|---|---|
| Authentication request interceptor | attaches `Authorization: Bearer <access>` |
| **Only to appropriate backend requests** | `isBackendRequest` (relative URL or configured base URL — never a foreign origin) and `isAuthPath` — an **exact** set (`/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`) is exempt. *(A prefix match once swallowed `/auth/logout-all`; found by the live E2E and now covered by unit tests.)* |
| Request ID / correlation id | `X-Request-Id` (`crypto.randomUUID`) — sent **only same-origin**, because the backend's CORS allow-list permits just `Content-Type, Authorization`; the backend returns its own `requestId` in error bodies and `ApiError.requestId` carries it |
| Access-token refresh | on a 401 (not on auth paths, not already retried, a refresh token exists) → `refreshSession()` → replay `http.request(config)` |
| **Prevent multiple simultaneous refresh requests** | module-level `refreshInFlight` promise; every caller awaits the same one (the RTK Query base query uses it too) |
| **Avoid infinite refresh loops** | `config._retried = true` before replay; a bare Axios instance (`bare`) performs the refresh call so it can't recurse |
| Preserve the original request | the same `config` object is replayed; the request interceptor re-attaches the *new* token |
| Handle refresh failure | `handleSessionExpired()` → clears tokens → Redux `sessionExpired()` → guards redirect to `/login` with a message |
| Logout when unrecoverable | same path; `logout` thunk also clears everything locally even if the network call fails |
| 401 / 403 / 404 / 409 / 422 / 500 | `toApiError` maps each status + the backend envelope (`error.code/message/details/requestId`) to one `ApiError` |
| Global error handling | systemic failures (**403, 429, 5xx, network/timeout**) → one global toast; expected business outcomes (**400/404/409/422**) are *not* toasted — the calling screen presents them (field errors, banners) |
| **Avoid duplicate notifications** | `toastOnce` de-duplicates identical messages for 3 s (5 parallel failures → 2 toasts, tested); `skipGlobalError: true` per request |
| Cancellation | `axios.isCancel` is re-thrown untouched — aborting is not an error and never toasts |
| RTK Query | `store/api/baseQuery.ts`: `fetchBaseQuery` + the same refresh promise + envelope unwrapping + serialisable `QueryError` |

## 4. Relevant file paths
`src/api/httpClient.ts`, `src/api/tokenStore.ts`, `src/api/errors.ts`, `src/store/api/baseQuery.ts`,
`src/api/httpClient.test.ts`, `src/store/api/emsApi.test.tsx`, `e2e/refresh.spec.ts`.

## 5. Practical implementation — single-flight refresh
```ts
let refreshInFlight: Promise<string> | null = null;
export function refreshSession(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = tokenStore.getRefresh();
      if (!refreshToken) throw new ApiError({ status: 401, code: 'NO_REFRESH_TOKEN', message: 'Not signed in' });
      const { data } = await bare.post<{ data: TokenPair }>('/auth/refresh', { refreshToken });
      tokenStore.setTokens(data.data);                       // rotation: store the NEW refresh token
      return data.data.accessToken;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}
```
**Proof, three ways**
1. *Unit* (`httpClient.test.ts`): four parallel 401s → `refreshCalls === 1`, all four succeed; a failing refresh logs out once; a still-401 request is replayed **exactly once**; a failing *login* never triggers refresh/logout; the token never goes to a foreign origin.
2. *RTK* (`emsApi.test.tsx`): a 401 on `getProfile` refreshes once and replays.
3. *Live* (`e2e/refresh.spec.ts`, backend started with `JWT_ACCESS_TTL=4s`): after the token expires, several parallel requests produce only `200` refreshes; after a hard reload the router loader and the bootstrap thunk **share** one refresh; revoking all sessions from another device logs this one out cleanly. The *entire* 20-test suite also passes under 4-second tokens.

**Token storage trade-off:** access token in module memory only; refresh token in `localStorage` (the backend gives no cookie). An XSS bug could read it — mitigated by React's escaping, no `dangerouslySetInnerHTML`, rotation + reuse detection on the server, and a restrictive CSP from helmet on the API. Moving to an HttpOnly cookie requires a backend change (proposed, not made).

## 6. Why the concept is used
Without interceptors every call site would repeat token handling and 401 logic; with rotating refresh tokens, *scattered* refresh logic
would eventually race and revoke the user's session.

## 7. Advantages and limitations
**+** one implementation of auth + errors, transparent to screens; testable with msw; prevents the rotation-race logout. **−** global behaviour can surprise (hence documented `skipGlobalError`); replaying non-idempotent requests after a refresh is safe here only because the *first* attempt was rejected before reaching the handler (a 401 means nothing was executed); interceptors don't cover `fetch` calls (the RTK base query re-implements the same steps); refresh token in `localStorage` is weaker than an HttpOnly cookie.

## 8. Interview-related considerations
* Walk through a 401 → refresh → retry flow; how do you stop N parallel requests from firing N refreshes? (shared promise/queue.)
* How do you avoid refresh loops? (retry flag, bare client, exclude auth endpoints.)
* HttpOnly cookie vs `localStorage` vs memory; CSRF when using cookies; why `SameSite`/`withCredentials` matter.
* Why attach tokens only to your own origin? (token leakage to third parties.)
* Interceptor order (request: last-registered first; response: in registration order); eject; `skip` flags per request.
