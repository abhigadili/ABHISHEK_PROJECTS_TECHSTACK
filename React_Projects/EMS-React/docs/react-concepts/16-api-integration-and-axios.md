# 16 · API integration and Axios

## 1. Concept explanation
All server communication goes through a **layered API architecture** so screens never build URLs or parse envelopes themselves:

```
 screen ─▶ hook (useEmployees, useAttendance …)
            ├─▶ RTK Query endpoints   (store/api/emsApi.ts)     ← request/response server state (fetchBaseQuery)
            └─▶ service modules       (services/*Api.ts)        ← Axios: commands, files, cancellable one-offs
                         └─▶ shared Axios instance (api/httpClient.ts: interceptors, timeout, errors)
                                       └─▶ /api/v1  ──(Vite proxy)──▶  Express backend
```
Both transports share the *same* token store and the *same* single-flight refresh (doc 17). The browser **never** touches MySQL — it only
speaks HTTP to the Express API, which remains the source of truth for business logic.

## 2. Syntax
```ts
export const http = axios.create({ baseURL: env.apiBaseUrl, timeout: 15000 });
const { data } = await http.get<Envelope<Employee[]>>('/employees', { params: { q, page }, signal });   // GET + query + cancellation
await http.post('/employees', body);  await http.put(url, body);  await http.patch(url, partial);  await http.delete(url);
await http.put(url, formData, { onUploadProgress });                                                     // multipart
const blob = (await http.get<Blob>(url, { responseType: 'blob' })).data;                                // download
```

## 3. Actual EMS implementation
| Required service | File | Notes |
|---|---|---|
| `authApi` | `services/authApi.ts` | login, logout, logoutAll, me, forgot/reset/change password |
| `employeeApi` | `services/employeeApi.ts` | list (+`clean()` query builder), get, create (POST), update (PUT), patch (PATCH), deactivate, job history, accounts/roles, **picture upload/download/delete** |
| `departmentApi` | `services/departmentApi.ts` | list/get/create/update/deactivate/activate/teams |
| `designationApi` | `services/designationApi.ts` | list/create/update |
| `attendanceApi` | `services/attendanceApi.ts` | check-in/out, mine, correct |
| `leaveApi` | `services/leaveApi.ts` | apply, decide, cancel, **document upload/download** |
| `organizationApi` | `services/organizationApi.ts` | chart, search, direct reports, reporting chain (all take an `AbortSignal`) |
| `notificationApi` | `services/notificationApi.ts` | unread count |
| `dashboardApi` | `services/dashboardApi.ts` | dashboard (cancellable) |
| `reportApi` | `services/reportApi.ts` | `downloadCsv` (server-side CSV as Blob) + `saveBlob` |
| `profileApi` | `services/profileApi.ts` | get/patch own profile |
Types for every request/response are in `types/api.ts` (no `any`; `@typescript-eslint/no-explicit-any` is an **error** in `eslint.config.js`).

| Capability | Where |
|---|---|
| GET / POST / PUT / PATCH / DELETE | `employeeApi` (all five), `departmentApi.deactivate` (DELETE) |
| Query parameters | `employeeApi.list(params: clean(query))` — drops empty values so no `?q=` noise |
| Request headers / bodies | `Authorization` + `X-Request-Id` by the interceptor; JSON bodies from typed payloads |
| **Multipart + file uploads** | `employeeApi.uploadPicture` (field name `file`, with `onUploadProgress`), `leaveApi.uploadDocument`; validated client-side by `FileUpload.tsx` and again (type + magic bytes + 2 MB) by the backend |
| **File downloads** | `leaveApi.downloadDocument`, `reportApi.downloadCsv` → `saveBlob` (object URL + hidden anchor; no HTML injection) |
| **Authenticated images** | `employeeApi.picture` returns a `Blob` (an `<img src>` can't send `Authorization`) → `hooks/useProfilePicture.ts` object-URL cache |
| Error handling | `api/errors.ts` (`ApiError`, `toApiError`, `fieldErrors`, `errorMessage`) — one error type for both transports |
| Request cancellation | `AbortSignal` params; `hooks/useApi.ts` aborts on unmount/new run; `dashboardSlice` thunk uses the thunk `signal` |
| Timeout | `env.requestTimeoutMs = 15000`; a timeout becomes "The request timed out." |
| Authentication + token refresh | doc 17 |

## 4. Relevant file paths
`src/api/httpClient.ts`, `src/api/errors.ts`, `src/api/tokenStore.ts`, `src/services/*.ts`, `src/store/api/*.ts`, `src/types/api.ts`, `src/constants/env.ts`, `vite.config.ts` (proxy).

## 5. Practical implementation
Download + progress + errors in one flow (`features/profile/PictureManager.tsx`):
```ts
const upload = async (file: File) => {
  setBusy(true); setProgress(0);
  try { await employeeApi.uploadPicture(employeeId, file, setProgress); notify.success('Profile picture updated'); afterChange(); }
  catch (e) { notify.error(errorMessage(e)); }             // ApiError message comes from the backend envelope
  finally { setBusy(false); setProgress(null); uploadRef.current?.clear(); }
};
```
Backend quirk handled in one place: `clean()` never sends `null` for `workLocation` (the backend answers HTTP 500).
Live-verified in `e2e/ems.spec.ts` ("profile picture upload (multipart) shows the new avatar") against the real backend; unit-tested with msw in `httpClient.test.ts`.

## 6. Why the concept is used
Centralising HTTP gives one place to add auth, timeouts, correlation ids, error normalisation and retries. Typed service modules make
the API a documented, refactorable surface instead of strings scattered through components.

## 7. Advantages and limitations
**+** uniform error handling, typed contracts, testable with msw (no real network), cancellation avoids races. **−** two transports (Axios + `fetchBaseQuery`) must be kept consistent (hence the shared refresh and `ApiError`); the backend's CORS allow-list forbids custom headers cross-origin, so the app relies on a same-origin proxy (`X-Request-Id` is sent only same-origin); the refresh token must live in `localStorage` because the backend returns it in the body (documented XSS trade-off — HttpOnly cookies would be better).

## 8. Interview-related considerations
* Axios vs `fetch` (interceptors, automatic JSON, timeout, upload progress, cancellation via `AbortController`).
* How do you cancel a request on unmount? Why is that important? (race conditions, leaked state updates.)
* How do you upload files (`FormData`, never set `Content-Type` manually) and download them (`responseType: 'blob'`)?
* Where do you store tokens and what are the trade-offs? (memory vs `localStorage` vs HttpOnly cookie + CSRF.)
* Service layer vs calling Axios in components; why a typed envelope; how to avoid `any`.
