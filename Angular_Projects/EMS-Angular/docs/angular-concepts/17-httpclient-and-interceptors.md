# 17 · `HttpClient` and interceptors

## 1. Concept explanation
`HttpClient` returns cold Observables for HTTP calls. **Interceptors** are middleware around every request/response: add headers, show loading, normalise errors, refresh tokens. In Angular 19 they are plain functions (`HttpInterceptorFn`) registered with `provideHttpClient(withInterceptors([...]))`.

## 2. Angular API / syntax
```ts
provideHttpClient(withInterceptors([correlationIdInterceptor, loadingInterceptor, errorInterceptor, authInterceptor, refreshInterceptor]))

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getAccessToken();
  if (!token || req.context.get(SKIP_AUTH) || !isApiRequest(req.url, inject(API_BASE_URL))) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
```
Per-request opt-outs use `HttpContextToken`s (`core/interceptors/http-context.ts`): `SKIP_LOADING`, `SKIP_AUTH`, `SKIP_REFRESH`, `SKIP_ERROR_TOAST`.

## 3. Where it is implemented — `core/interceptors/interceptors.ts` (+ `core/services/api.service.ts`)
| Required item | Implementation |
|---|---|
| Authentication token interceptor | `authInterceptor` — Bearer token, **only for requests to `API_BASE_URL`** (exact base or `base/…`; a look-alike prefix like `…/api/v1-evil` and third-party URLs get nothing) |
| Refresh-token handling | `refreshInterceptor` + `AuthService.refreshAccessToken()` — matches the backend's body-based, **rotating** refresh tokens |
| Global error handling | `errorInterceptor` — normalises to `AppError`, shows exactly one toast per failed request with status-specific text |
| Loading indicator | `loadingInterceptor` → `LoadingService` counter signal → `<mat-progress-bar>` in the shell; `SKIP_LOADING` for polling/background calls |
| Request/correlation id | `correlationIdInterceptor` — `X-Request-Id`, **same-origin API only** (see below) |
| Timeouts / safe retries | `ApiService`: `timeout(apiTimeoutMs)` + `retry({count:2, delay})` for transient **GET** failures only |
| Provider wiring | `app.config.ts` |

### Behaviour checklist from the brief (all covered in `interceptors.spec.ts`)
| Requirement | How it is met |
|---|---|
| Attach tokens only to backend requests | `isApiRequest()`; spec: third-party URL and look-alike prefix get no `Authorization` |
| Handle expired access tokens | 401 → refresh → replay original request with the new token |
| **Prevent multiple simultaneous refresh requests** | one in-flight `shareReplay`ed observable shared by all callers; spec: 3 parallel 401s → exactly **1** `/auth/refresh`, all 3 replayed |
| **Avoid infinite refresh loops** | requests flagged `SKIP_REFRESH`/`SKIP_AUTH` (login, refresh itself) are never refreshed; the replay goes through `next` *after* the refresh interceptor and is attempted once |
| Handle refresh failure and logout | 401/400 from `/auth/refresh` (or no refresh token) → `AuthService.expireSession(returnUrl)` → clears state, navigates to `/login?returnUrl=`; network error (status 0) keeps the session |
| Preserve the original request where safe | `req.clone({ setHeaders })` replays method, body and params unchanged |
| 401 / 403 / 404 / 409 / 422 / 500 | 401: silent (refresh/login screen decides); 403: “no permission” toast; 404: toast for writes only (pages render their own empty state for GET); 409/422: backend message; 400: toast only when there are no field `details` (forms show those); ≥500: generic text with the backend `requestId` |
| Avoid duplicate notifications | one toast per failed request + `ToastService` suppresses an identical message within 2 s |
| Requests may opt out of global loading | `SKIP_LOADING` |
| Functional interceptors | `HttpInterceptorFn`, `provideHttpClient(withInterceptors([...]))` |
| Matches the backend auth design | body-token JWT + rotation + family revocation (see `docs/backend-api-integration.md` §2) |

### Interceptor order matters
`[correlationId, loading, error, auth, refresh]`: requests flow left→right, **responses right→left**, so `refresh` sees the raw 401 first and can transparently recover; `error` sees only what survived and toasts once; `loading` wraps everything.

## 4. Relevant file paths
`src/app/core/interceptors/{interceptors.ts,http-context.ts}`, `src/app/core/services/{api,auth,token-storage,loading,toast}.service.ts`, `src/app/core/errors/app-error.ts`, `src/app/app.config.ts`.

## 5. Practical implementation explanation
* **Why one shared refresh matters.** The backend rotates the refresh token on every refresh and treats re-use of an old token as theft (revokes the family). Two parallel refreshes with the same token would log the user out of every device; hence the single in-flight observable (`finalize` clears it afterwards).
* **Cross-origin safety.** The backend CORS allow-list is only `Content-Type, Authorization`, so a custom *request* header would break the preflight in a cross-origin deployment. `X-Request-Id` is therefore added only when the API base URL is relative (dev proxy / reverse proxy); the backend creates its own id and returns it in `error.requestId`, which the UI shows on 5xx.
* **No unwrap duplication.** `ApiService` turns `{success,data,meta}` into `T` / `Paged<T>`; services stay one-liners (`this.api.get<Employee>('/employees/4')`).
* **Binary downloads** (profile pictures, CSV, leave documents) also go through `HttpClient` (`responseType:'blob'`) so the token is attached — a plain `<img src>` or `<a href>` could not send the header.
* **Token storage.** Access token in memory only; refresh token in `sessionStorage` (see backend doc). With HttpOnly cookies the code would use `withCredentials` + CSRF protection instead — the backend doesn't, so this isn't used.

## 6. Why this concept was selected
The backend's security model (short-lived JWT + rotating refresh) is stateful in a way naive “retry on 401” code gets wrong; interceptors are the one place to implement it once, correctly and testably.

## 7. Interview-related considerations
* *Class-based vs functional interceptors:* functional are tree-shakable and use `inject()`; class-based are legacy (`HTTP_INTERCEPTORS`).
* *Why does order matter?* Each interceptor wraps the next; put token refresh closest to the network and error normalisation outside it.
* *How do you avoid refresh stampedes?* Share one in-flight refresh (`shareReplay` / BehaviorSubject lock); queue others until it resolves.
* *Where to store JWTs?* Trade-offs: memory (safe from XSS persistence, lost on reload) vs sessionStorage/localStorage (survive reload, readable by XSS) vs HttpOnly cookie (needs CSRF). The refresh token here is the *only* thing persisted, in sessionStorage.
* *Idempotency:* only GET is auto-retried; POST/PUT/DELETE are never retried by the app.
* *`HttpContext` vs custom headers for per-request flags* — context never reaches the wire.
