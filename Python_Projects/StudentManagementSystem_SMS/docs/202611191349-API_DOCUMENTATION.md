# API Documentation

All client traffic goes through the **gateway** (`http://localhost:8000`). Interactive docs:

| URL | What |
|---|---|
| `http://localhost:8000/docs` | Swagger UI — **merged** API of all services (use *Authorize*: username = e-mail, password, tick scopes) |
| `http://localhost:8000/redoc` | ReDoc, same merged document |
| `http://localhost:8000/openapi.json` | merged OpenAPI 3.1 (schema names are namespaced per service, e.g. `Student.FileRead` vs `Course.FileRead`) |
| `http://localhost:800{1..5}/docs` | each service's own Swagger UI (development) |

Total: **79 operations** (counted from the live OpenAPI), plus health endpoints.

## 1. Conventions

| Topic | Rule |
|---|---|
| Versioning | URL prefix `/api/v1` (`API_PREFIX`). Health probes (`/health`, `/health/ready`, `/health/services`) are unversioned. |
| Auth | `Authorization: Bearer <access token>`. Obtain it from `POST /api/v1/auth/token` (OAuth2 form) or `/auth/login` (JSON). |
| Content types | JSON bodies; `application/x-www-form-urlencoded` for `/auth/token`; `multipart/form-data` for uploads. |
| Naming | plural nouns (`/students`), sub-resources (`/students/{id}/contacts`), actions as sub-paths only when not CRUD (`/enrollments/{id}/cancel`). |
| Pagination | `?page=1&size=20` (size ≤ 100) → `{"items": [...], "total": n, "page": 1, "size": 20, "pages": k}` |
| Sorting | `?sort=<field>&order=asc|desc` — **whitelisted** per resource; an unknown field → `400` listing the allowed ones. |
| Filtering/search | per resource (see tables); `q=` is a partial match over the documented fields. |
| Correlation | send `X-Correlation-ID` to trace a journey across services (generated if absent). Responses always carry `X-Request-ID`, `X-Correlation-ID`, `X-Process-Time-ms`. |
| Rate limit headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; on `429` also `Retry-After`. |

### HTTP methods used

`GET` (read), `POST` (create / actions), `PUT` (full replacement: students, courses, roles of a user, interests, profile picture), `PATCH` (partial update), `DELETE`. Parameter kinds covered: path (`/students/{student_id}`), query (filters, pagination), request body (JSON/form/multipart), request headers (`Authorization`, `X-Correlation-ID`, `Origin`).

### Status codes

| Code | Used for |
|---|---|
| 200 OK | reads, updates, login, cancel |
| 201 Created | register, create student/course/category/department/user/enrollment/contact/document, bulk import |
| 202 Accepted | `POST /auth/forgot-password`, `POST /notifications` (queued), `POST /notifications/{id}/retry` — work continues asynchronously |
| 204 No Content | deletes, logout, change-password |
| 400 Bad Request | unusable request: unknown sort field, invalid reset token, invalid OAuth2 scope, empty upload, student_id missing for staff enrollment |
| 401 Unauthorized | missing/invalid/expired/revoked token, wrong credentials, forged state (OIDC) |
| 403 Forbidden | role/scope/ownership violation |
| 404 Not Found | unknown resource (also propagated from downstream services) |
| 405 | wrong method for a path |
| 409 Conflict | duplicate e-mail/code/enrollment, course full or unavailable, deleting something still referenced, last-admin guard |
| 413 | upload larger than the endpoint's limit |
| 415 | disallowed or spoofed file type |
| 422 Unprocessable Entity | body/query/path validation failure (field-level `details`) |
| 429 Too Many Requests | rate limit, or account lock-out (`Retry-After`) |
| 500 | unexpected error (standard envelope, details only in logs) |
| 501 | OIDC endpoints when no provider is configured |
| 503 / 504 | a downstream service or the database is down / timed out |

### Error envelope

```json
{"error": {"code": "VALIDATION_ERROR", "message": "Request validation failed",
           "details": [{"field": "body.password", "message": "Value error, Password must contain …", "type": "value_error"}],
           "request_id": "4e53…", "correlation_id": "3a97…", "timestamp": "2026-11-19T08:18:47+00:00",
           "path": "/api/v1/auth/register"}}
```

Codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `UNPROCESSABLE_ENTITY`, `VALIDATION_ERROR`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, `GATEWAY_TIMEOUT`, `BAD_GATEWAY`, `OIDC_NOT_CONFIGURED`, `INTERNAL_ERROR`. Submitted password/token values are never echoed in `details`.

### Roles and scopes (summary — see AUTHENTICATION.md)

| Role | Scopes granted by default |
|---|---|
| `ADMIN` | all 12 scopes |
| `TEACHER` | `profile:self students:read students:write courses:read courses:write enrollments:read enrollments:write files:read files:write notifications:read` |
| `STUDENT` | `profile:self courses:read enrollments:read enrollments:write files:read files:write` |

A token carries `scope` = (requested scopes) ∩ (scopes of the user's roles). An endpoint requires its **scope** *and*, where listed, its **role**; some also apply an **ownership** rule (a student only sees their own record/files/enrollments; a teacher only edits courses they created or teach).

### Filters per list endpoint

| Endpoint | Filters | Sortable |
|---|---|---|
| `GET /users` | `q`, `role`, `is_active` | `id, email, full_name, created_at` |
| `GET /students` | `q`, `department`, `status`, `gender`, `admitted_year`, `min_gpa`, `max_gpa`, `has_enrollments` | `id, student_number, first_name, last_name, email, gpa, admission_date, created_at, enrolled_courses_count` |
| `GET /courses` | `q`, `category_id`, `status`, `teacher_id`, `min_credits`, `max_credits`, `available_only`, `starts_after` | `id, code, title, credits, duration_weeks, capacity, enrolled_count, start_date, created_at` |
| `GET /enrollments`, `/enrollments/courses/{id}`, `/enrollments/me` | `student_id`, `course_id`, `status` | `id, enrolled_at, student_name, course_code, status, grade` |
| `GET /notifications` | `status`, `template`, `recipient` | `id, created_at, status, recipient_email, template` |

## 2. Endpoint reference (generated from the live OpenAPI)

Regenerate with `python scripts/gen_docs_data.py`. The **Access** column is the curated authorisation matrix; the table below each group is the OpenAPI contract (expand a row for parameters, request fields and the response model).


### Authentication

| Method | Path | Summary | Access |
|---|---|---|---|
| `POST` | `/api/v1/auth/change-password` | Change my password (revokes all refresh tokens) | Any authenticated user |
| `POST` | `/api/v1/auth/forgot-password` | Request a password-reset e-mail (always 202) | Public |
| `POST` | `/api/v1/auth/login` | JSON login (public) | Public |
| `POST` | `/api/v1/auth/logout` | Revoke the refresh token and the current access token | Any authenticated user |
| `GET` | `/api/v1/auth/me` | Current user | Any authenticated user |
| `POST` | `/api/v1/auth/refresh` | Exchange a refresh token for a new pair (rotation) | Public |
| `POST` | `/api/v1/auth/register` | Self-register a STUDENT account (public) | Public |
| `POST` | `/api/v1/auth/reset-password` | Set a new password using the e-mailed token | Public |
| `POST` | `/api/v1/auth/token` | OAuth2 password grant (form-encoded, supports `scope`) | Public |

<details><summary><code>POST /api/v1/auth/change-password</code> - Change my password (revokes all refresh tokens)</summary>

*Access*: Any authenticated user  
*Success/other documented codes*: 204, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `current_password` | string min1 max128 | yes |
| `new_password` | string min1 max128 | yes |


</details>

<details><summary><code>POST /api/v1/auth/forgot-password</code> - Request a password-reset e-mail (always 202)</summary>

*Access*: Public  
*Success/other documented codes*: 202, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `email` | string (email) | yes |


*Response 202*: `MessageResponse`


</details>

<details><summary><code>POST /api/v1/auth/login</code> - JSON login (public)</summary>

*Access*: Public  
*Success/other documented codes*: 200, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `email` | string (email) | yes |
| `password` | string min1 max128 | yes |


*Response 200*: `TokenResponse`


</details>

<details><summary><code>POST /api/v1/auth/logout</code> - Revoke the refresh token and the current access token</summary>

*Access*: Any authenticated user  
*Success/other documented codes*: 204, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `refresh_token` | string? | no |


</details>

<details><summary><code>GET /api/v1/auth/me</code> - Current user</summary>

*Access*: Any authenticated user  
*Success/other documented codes*: 200  



*Response 200*: `UserRead`


</details>

<details><summary><code>POST /api/v1/auth/refresh</code> - Exchange a refresh token for a new pair (rotation)</summary>

*Access*: Public  
*Success/other documented codes*: 200, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `refresh_token` | string | yes |


*Response 200*: `TokenResponse`


</details>

<details><summary><code>POST /api/v1/auth/register</code> - Self-register a STUDENT account (public)</summary>

*Access*: Public  
*Success/other documented codes*: 201, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `email` | string (email) | yes |
| `full_name` | string min2 max120 | yes |
| `password` | string min1 max128 | yes |


*Response 201*: `UserRead`


</details>

<details><summary><code>POST /api/v1/auth/reset-password</code> - Set a new password using the e-mailed token</summary>

*Access*: Public  
*Success/other documented codes*: 200, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `token` | string min20 max200 | yes |
| `new_password` | string min1 max128 | yes |


*Response 200*: `MessageResponse`


</details>

<details><summary><code>POST /api/v1/auth/token</code> - OAuth2 password grant (form-encoded, supports `scope`)</summary>

*Access*: Public  
*Success/other documented codes*: 200, 422  


*Request body* (`application/x-www-form-urlencoded`):

| Field | Type | Required |
|---|---|---|
| `grant_type` | string? | no |
| `username` | string | yes |
| `password` | string (password) | yes |
| `scope` | string | no |
| `client_id` | string? | no |
| `client_secret` | string? | no |


*Response 200*: `TokenResponse`


</details>


### OpenID Connect (optional)

| Method | Path | Summary | Access |
|---|---|---|---|
| `GET` | `/api/v1/auth/oidc/callback` | Provider redirects back here | Public (501 unless OIDC is configured) |
| `GET` | `/api/v1/auth/oidc/login` | Redirect the browser to the identity provider | Public (501 unless OIDC is configured) |

<details><summary><code>GET /api/v1/auth/oidc/callback</code> - Provider redirects back here</summary>

*Access*: Public (501 unless OIDC is configured)  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `code` | query | string | yes |
| `state` | query | string | yes |


*Response 200*: `TokenResponse`


</details>

<details><summary><code>GET /api/v1/auth/oidc/login</code> - Redirect the browser to the identity provider</summary>

*Access*: Public (501 unless OIDC is configured)  
*Success/other documented codes*: 200  



*Response 200*: `any`


</details>


### Users (admin)

| Method | Path | Summary | Access |
|---|---|---|---|
| `GET` | `/api/v1/users` | List/search users | ADMIN - scope `users:manage` |
| `POST` | `/api/v1/users` | Create a user with explicit roles | ADMIN - scope `users:manage` |
| `DELETE` | `/api/v1/users/{user_id}` | Delete a user | ADMIN - scope `users:manage` |
| `GET` | `/api/v1/users/{user_id}` | Get a user | ADMIN - scope `users:manage` |
| `PATCH` | `/api/v1/users/{user_id}` | Update name / activation | ADMIN - scope `users:manage` |
| `PUT` | `/api/v1/users/{user_id}/roles` | Replace the user's roles | ADMIN - scope `users:manage` |

<details><summary><code>GET /api/v1/users</code> - List/search users</summary>

*Access*: ADMIN - scope `users:manage`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `q` | query | string? | no |
| `role` | query | string? | no |
| `is_active` | query | boolean? | no |
| `page` | query | integer ≥1 | no |
| `size` | query | integer ≥1 ≤100 | no |
| `sort` | query | string? | no |
| `order` | query | enum(asc/desc) | no |


*Response 200*: `Page_UserRead_`


</details>

<details><summary><code>POST /api/v1/users</code> - Create a user with explicit roles</summary>

*Access*: ADMIN - scope `users:manage`  
*Success/other documented codes*: 201, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `email` | string (email) | yes |
| `full_name` | string min2 max120 | yes |
| `password` | string min1 max128 | yes |
| `roles` | Role[] | no |


*Response 201*: `UserRead`


</details>

<details><summary><code>DELETE /api/v1/users/{user_id}</code> - Delete a user</summary>

*Access*: ADMIN - scope `users:manage`  
*Success/other documented codes*: 204, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `user_id` | path | integer | yes |


</details>

<details><summary><code>GET /api/v1/users/{user_id}</code> - Get a user</summary>

*Access*: ADMIN - scope `users:manage`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `user_id` | path | integer | yes |


*Response 200*: `UserRead`


</details>

<details><summary><code>PATCH /api/v1/users/{user_id}</code> - Update name / activation</summary>

*Access*: ADMIN - scope `users:manage`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `user_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `full_name` | string min2 max120? | no |
| `is_active` | boolean? | no |


*Response 200*: `UserRead`


</details>

<details><summary><code>PUT /api/v1/users/{user_id}/roles</code> - Replace the user's roles</summary>

*Access*: ADMIN - scope `users:manage`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `user_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `roles` | Role[] | yes |


*Response 200*: `UserRead`


</details>


### Roles (admin)

| Method | Path | Summary | Access |
|---|---|---|---|
| `GET` | `/api/v1/roles` | Roles with their OAuth2 scopes and user counts | ADMIN - scope `users:manage` |

<details><summary><code>GET /api/v1/roles</code> - Roles with their OAuth2 scopes and user counts</summary>

*Access*: ADMIN - scope `users:manage`  
*Success/other documented codes*: 200  



*Response 200*: `RoleRead[]`


</details>


### Departments

| Method | Path | Summary | Access |
|---|---|---|---|
| `GET` | `/api/v1/departments` | List departments | Any authenticated user |
| `POST` | `/api/v1/departments` | Create a department | ADMIN - scope `students:write` |
| `DELETE` | `/api/v1/departments/{dept_id}` | Delete an empty department | ADMIN - scope `students:write` |

<details><summary><code>GET /api/v1/departments</code> - List departments</summary>

*Access*: Any authenticated user  
*Success/other documented codes*: 200  



*Response 200*: `DepartmentRead[]`


</details>

<details><summary><code>POST /api/v1/departments</code> - Create a department</summary>

*Access*: ADMIN - scope `students:write`  
*Success/other documented codes*: 201, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `code` | string min2 max10 | yes |
| `name` | string min2 max100 | yes |


*Response 201*: `DepartmentRead`


</details>

<details><summary><code>DELETE /api/v1/departments/{dept_id}</code> - Delete an empty department</summary>

*Access*: ADMIN - scope `students:write`  
*Success/other documented codes*: 204, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `dept_id` | path | integer | yes |


</details>


### Students

| Method | Path | Summary | Access |
|---|---|---|---|
| `GET` | `/api/v1/students` | List/search students (paginated) | ADMIN, TEACHER - scope `students:read` |
| `POST` | `/api/v1/students` | Create a student (with profile, contacts, interests) | ADMIN, TEACHER - scope `students:write` |
| `POST` | `/api/v1/students/bulk` | Bulk import (single transaction, all-or-nothing) | ADMIN - scope `students:write` |
| `PATCH` | `/api/v1/students/bulk/status` | Bulk status change (one UPDATE) | ADMIN - scope `students:write` |
| `GET` | `/api/v1/students/me` | My own student record | Any authenticated user - scope `profile:self` |
| `PATCH` | `/api/v1/students/me` | Update my own profile (limited fields) | Any authenticated user - scope `profile:self` |
| `GET` | `/api/v1/students/stats` | Aggregate report (synchronous endpoint + sync SQLAlchemy session) | ADMIN, TEACHER - scope `students:read` |
| `DELETE` | `/api/v1/students/{student_id}` | Delete a student | ADMIN - scope `students:write` |
| `GET` | `/api/v1/students/{student_id}` | Get a student | ADMIN/TEACHER, or the student themself |
| `PATCH` | `/api/v1/students/{student_id}` | Partially update a student | ADMIN, TEACHER - scope `students:write` |
| `PUT` | `/api/v1/students/{student_id}` | Replace a student (full update) | ADMIN, TEACHER - scope `students:write` |
| `POST` | `/api/v1/students/{student_id}/contacts` | Add a contact | ADMIN, TEACHER - scope `students:write` |
| `DELETE` | `/api/v1/students/{student_id}/contacts/{contact_id}` | Remove a contact | ADMIN, TEACHER - scope `students:write` |
| `PUT` | `/api/v1/students/{student_id}/interests` | Replace interests (many-to-many) | ADMIN, TEACHER - scope `students:write` |

<details><summary><code>GET /api/v1/students</code> - List/search students (paginated)</summary>

*Access*: ADMIN, TEACHER - scope `students:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `q` | query | string? | no |
| `department` | query | string? | no |
| `status` | query | StudentStatus? | no |
| `gender` | query | string? | no |
| `admitted_year` | query | integer ≥1950 ≤2100? | no |
| `min_gpa` | query | number ≥0.0 ≤4.0 | string? | no |
| `max_gpa` | query | number ≥0.0 ≤4.0 | string? | no |
| `has_enrollments` | query | boolean? | no |
| `page` | query | integer ≥1 | no |
| `size` | query | integer ≥1 ≤100 | no |
| `sort` | query | string? | no |
| `order` | query | enum(asc/desc) | no |


*Response 200*: `Page_StudentSummary_`


</details>

<details><summary><code>POST /api/v1/students</code> - Create a student (with profile, contacts, interests)</summary>

*Access*: ADMIN, TEACHER - scope `students:write`  
*Success/other documented codes*: 201, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `first_name` | string min1 max60 | yes |
| `last_name` | string min1 max60 | yes |
| `email` | string (email) | yes |
| `date_of_birth` | string (date)? | no |
| `gender` | Gender? | no |
| `department_code` | string max10? | no |
| `gpa` | number ≥0.0 ≤4.0 | string? | no |
| `status` | StudentStatus | no |
| `user_id` | integer ≥1.0? | no |
| `admission_date` | string (date)? | no |
| `profile` | ProfileIn? | no |
| `contacts` | ContactIn[] | no |
| `interests` | string min2 max60[] | no |


*Response 201*: `StudentRead`


</details>

<details><summary><code>POST /api/v1/students/bulk</code> - Bulk import (single transaction, all-or-nothing)</summary>

*Access*: ADMIN - scope `students:write`  
*Success/other documented codes*: 201, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `students` | StudentCreate[] | yes |


*Response 201*: `StudentSummary[]`


</details>

<details><summary><code>PATCH /api/v1/students/bulk/status</code> - Bulk status change (one UPDATE)</summary>

*Access*: ADMIN - scope `students:write`  
*Success/other documented codes*: 200, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `ids` | integer[] | yes |
| `status` | StudentStatus | yes |


*Response 200*: `BulkResult`


</details>

<details><summary><code>GET /api/v1/students/me</code> - My own student record</summary>

*Access*: Any authenticated user - scope `profile:self`  
*Success/other documented codes*: 200  



*Response 200*: `StudentRead`


</details>

<details><summary><code>PATCH /api/v1/students/me</code> - Update my own profile (limited fields)</summary>

*Access*: Any authenticated user - scope `profile:self`  
*Success/other documented codes*: 200, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `first_name` | string min1 max60? | no |
| `last_name` | string min1 max60? | no |
| `date_of_birth` | string (date)? | no |
| `profile` | ProfileIn? | no |


*Response 200*: `StudentRead`


</details>

<details><summary><code>GET /api/v1/students/stats</code> - Aggregate report (synchronous endpoint + sync SQLAlchemy session)</summary>

*Access*: ADMIN, TEACHER - scope `students:read`  
*Success/other documented codes*: 200  



*Response 200*: `StudentStats`


</details>

<details><summary><code>DELETE /api/v1/students/{student_id}</code> - Delete a student</summary>

*Access*: ADMIN - scope `students:write`  
*Success/other documented codes*: 204, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |


</details>

<details><summary><code>GET /api/v1/students/{student_id}</code> - Get a student</summary>

*Access*: ADMIN/TEACHER, or the student themself  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |


*Response 200*: `StudentRead`


</details>

<details><summary><code>PATCH /api/v1/students/{student_id}</code> - Partially update a student</summary>

*Access*: ADMIN, TEACHER - scope `students:write`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `first_name` | string min1 max60? | no |
| `last_name` | string min1 max60? | no |
| `email` | string (email)? | no |
| `date_of_birth` | string (date)? | no |
| `gender` | Gender? | no |
| `status` | StudentStatus? | no |
| `department_code` | string max10? | no |
| `gpa` | number ≥0.0 ≤4.0 | string? | no |
| `profile` | ProfileIn? | no |


*Response 200*: `StudentRead`


</details>

<details><summary><code>PUT /api/v1/students/{student_id}</code> - Replace a student (full update)</summary>

*Access*: ADMIN, TEACHER - scope `students:write`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `first_name` | string min1 max60 | yes |
| `last_name` | string min1 max60 | yes |
| `email` | string (email) | yes |
| `date_of_birth` | string (date)? | no |
| `gender` | Gender? | no |
| `department_code` | string max10? | no |
| `gpa` | number ≥0.0 ≤4.0 | string? | no |
| `status` | StudentStatus | yes |
| `admission_date` | string (date) | yes |


*Response 200*: `StudentRead`


</details>

<details><summary><code>POST /api/v1/students/{student_id}/contacts</code> - Add a contact</summary>

*Access*: ADMIN, TEACHER - scope `students:write`  
*Success/other documented codes*: 201, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `contact_type` | ContactType | yes |
| `value` | string min3 max190 | yes |
| `label` | string max60? | no |
| `is_primary` | boolean | no |


*Response 201*: `StudentRead`


</details>

<details><summary><code>DELETE /api/v1/students/{student_id}/contacts/{contact_id}</code> - Remove a contact</summary>

*Access*: ADMIN, TEACHER - scope `students:write`  
*Success/other documented codes*: 204, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |
| `contact_id` | path | integer | yes |


</details>

<details><summary><code>PUT /api/v1/students/{student_id}/interests</code> - Replace interests (many-to-many)</summary>

*Access*: ADMIN, TEACHER - scope `students:write`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `interests` | string min2 max60[] | yes |


*Response 200*: `StudentRead`


</details>


### Student files

| Method | Path | Summary | Access |
|---|---|---|---|
| `GET` | `/api/v1/students/{student_id}/documents` | List documents (metadata) | ADMIN/TEACHER, or the owning student - scope `files:read` |
| `POST` | `/api/v1/students/{student_id}/documents` | Upload a document (PDF, DOCX, TXT, JPEG, PNG; max 5 MB) | ADMIN/TEACHER, or the owning student - scope `files:write` |
| `DELETE` | `/api/v1/students/{student_id}/documents/{file_id}` | Delete a document | ADMIN/TEACHER, or the owning student - scope `files:write` |
| `GET` | `/api/v1/students/{student_id}/documents/{file_id}` | Download a document | ADMIN/TEACHER, or the owning student - scope `files:read` |
| `PATCH` | `/api/v1/students/{student_id}/documents/{file_id}` | Edit document metadata | ADMIN/TEACHER, or the owning student - scope `files:write` |
| `GET` | `/api/v1/students/{student_id}/documents/{file_id}/metadata` | Document metadata | ADMIN/TEACHER, or the owning student - scope `files:read` |
| `GET` | `/api/v1/students/{student_id}/profile-picture` | Download the profile picture | ADMIN/TEACHER, or the owning student - scope `files:read` |
| `PUT` | `/api/v1/students/{student_id}/profile-picture` | Upload/replace the profile picture | ADMIN/TEACHER, or the owning student - scope `files:write` |

<details><summary><code>GET /api/v1/students/{student_id}/documents</code> - List documents (metadata)</summary>

*Access*: ADMIN/TEACHER, or the owning student - scope `files:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |


*Response 200*: `FileRead[]`


</details>

<details><summary><code>POST /api/v1/students/{student_id}/documents</code> - Upload a document (PDF, DOCX, TXT, JPEG, PNG; max 5 MB)</summary>

*Access*: ADMIN/TEACHER, or the owning student - scope `files:write`  
*Success/other documented codes*: 201, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |

*Request body* (`multipart/form-data`):

| Field | Type | Required |
|---|---|---|
| `file` | string | yes |
| `doc_type` | string max40? | no |
| `description` | string max500? | no |


*Response 201*: `FileRead`


</details>

<details><summary><code>DELETE /api/v1/students/{student_id}/documents/{file_id}</code> - Delete a document</summary>

*Access*: ADMIN/TEACHER, or the owning student - scope `files:write`  
*Success/other documented codes*: 204, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |
| `file_id` | path | integer | yes |


</details>

<details><summary><code>GET /api/v1/students/{student_id}/documents/{file_id}</code> - Download a document</summary>

*Access*: ADMIN/TEACHER, or the owning student - scope `files:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |
| `file_id` | path | integer | yes |


*Response 200*: `any`


</details>

<details><summary><code>PATCH /api/v1/students/{student_id}/documents/{file_id}</code> - Edit document metadata</summary>

*Access*: ADMIN/TEACHER, or the owning student - scope `files:write`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |
| `file_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `doc_type` | string max40? | no |
| `description` | string max500? | no |


*Response 200*: `FileRead`


</details>

<details><summary><code>GET /api/v1/students/{student_id}/documents/{file_id}/metadata</code> - Document metadata</summary>

*Access*: ADMIN/TEACHER, or the owning student - scope `files:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |
| `file_id` | path | integer | yes |


*Response 200*: `FileRead`


</details>

<details><summary><code>GET /api/v1/students/{student_id}/profile-picture</code> - Download the profile picture</summary>

*Access*: ADMIN/TEACHER, or the owning student - scope `files:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |


*Response 200*: `any`


</details>

<details><summary><code>PUT /api/v1/students/{student_id}/profile-picture</code> - Upload/replace the profile picture</summary>

*Access*: ADMIN/TEACHER, or the owning student - scope `files:write`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |

*Request body* (`multipart/form-data`):

| Field | Type | Required |
|---|---|---|
| `file` | string | yes |


*Response 200*: `FileRead`


</details>


### Course categories

| Method | Path | Summary | Access |
|---|---|---|---|
| `GET` | `/api/v1/categories` | List categories | Any authenticated user - scope `courses:read` |
| `POST` | `/api/v1/categories` | Create a category | ADMIN - scope `courses:write` |
| `DELETE` | `/api/v1/categories/{cat_id}` | Delete an empty category | ADMIN - scope `courses:write` |
| `PATCH` | `/api/v1/categories/{cat_id}` | Update a category | ADMIN - scope `courses:write` |

<details><summary><code>GET /api/v1/categories</code> - List categories</summary>

*Access*: Any authenticated user - scope `courses:read`  
*Success/other documented codes*: 200  



*Response 200*: `CategoryRead[]`


</details>

<details><summary><code>POST /api/v1/categories</code> - Create a category</summary>

*Access*: ADMIN - scope `courses:write`  
*Success/other documented codes*: 201, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `name` | string min2 max80 | yes |
| `description` | string max300? | no |


*Response 201*: `CategoryRead`


</details>

<details><summary><code>DELETE /api/v1/categories/{cat_id}</code> - Delete an empty category</summary>

*Access*: ADMIN - scope `courses:write`  
*Success/other documented codes*: 204, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `cat_id` | path | integer | yes |


</details>

<details><summary><code>PATCH /api/v1/categories/{cat_id}</code> - Update a category</summary>

*Access*: ADMIN - scope `courses:write`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `cat_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `name` | string min2 max80? | no |
| `description` | string max300? | no |


*Response 200*: `CategoryRead`


</details>


### Courses

| Method | Path | Summary | Access |
|---|---|---|---|
| `GET` | `/api/v1/courses` | List/search courses | Any authenticated user - scope `courses:read` |
| `POST` | `/api/v1/courses` | Create a course | ADMIN, TEACHER - scope `courses:write` |
| `DELETE` | `/api/v1/courses/{course_id}` | Delete a course (no enrollments) | ADMIN - scope `courses:write` (409 while enrolled) |
| `GET` | `/api/v1/courses/{course_id}` | Get a course (includes availability: used by the Enrollment service) | Any authenticated user - scope `courses:read` |
| `PATCH` | `/api/v1/courses/{course_id}` | Partially update a course | ADMIN, or the TEACHER who created/teaches it |
| `PUT` | `/api/v1/courses/{course_id}` | Replace a course | ADMIN, or the TEACHER who created/teaches it |
| `PATCH` | `/api/v1/courses/{course_id}/availability` | Open / close / archive a course | ADMIN, or the TEACHER who created/teaches it |
| `DELETE` | `/api/v1/courses/{course_id}/teachers/{teacher_id}` | Unassign a teacher | ADMIN - scope `courses:write` |
| `PUT` | `/api/v1/courses/{course_id}/teachers/{teacher_id}` | Assign a teacher (validated via the Auth service, REST) | ADMIN - scope `courses:write` |

<details><summary><code>GET /api/v1/courses</code> - List/search courses</summary>

*Access*: Any authenticated user - scope `courses:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `q` | query | string? | no |
| `category_id` | query | integer? | no |
| `status` | query | CourseStatus? | no |
| `teacher_id` | query | integer? | no |
| `min_credits` | query | integer ≥1 ≤10? | no |
| `max_credits` | query | integer ≥1 ≤10? | no |
| `available_only` | query | boolean | no |
| `starts_after` | query | string (date)? | no |
| `page` | query | integer ≥1 | no |
| `size` | query | integer ≥1 ≤100 | no |
| `sort` | query | string? | no |
| `order` | query | enum(asc/desc) | no |


*Response 200*: `Page_CourseSummary_`


</details>

<details><summary><code>POST /api/v1/courses</code> - Create a course</summary>

*Access*: ADMIN, TEACHER - scope `courses:write`  
*Success/other documented codes*: 201, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `title` | string min3 max150 | yes |
| `description` | string max5000? | no |
| `category_id` | integer ≥1.0? | no |
| `credits` | integer ≥1.0 ≤10.0 | yes |
| `duration_weeks` | integer ≥1.0 ≤104.0 | yes |
| `capacity` | integer ≥1.0 ≤1000.0 | no |
| `start_date` | string (date)? | no |
| `end_date` | string (date)? | no |
| `code` | string min3 max20 | yes |
| `status` | CourseStatus | no |


*Response 201*: `CourseRead`


</details>

<details><summary><code>DELETE /api/v1/courses/{course_id}</code> - Delete a course (no enrollments)</summary>

*Access*: ADMIN - scope `courses:write` (409 while enrolled)  
*Success/other documented codes*: 204, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |


</details>

<details><summary><code>GET /api/v1/courses/{course_id}</code> - Get a course (includes availability: used by the Enrollment service)</summary>

*Access*: Any authenticated user - scope `courses:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |


*Response 200*: `CourseRead`


</details>

<details><summary><code>PATCH /api/v1/courses/{course_id}</code> - Partially update a course</summary>

*Access*: ADMIN, or the TEACHER who created/teaches it  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `title` | string min3 max150? | no |
| `description` | string max5000? | no |
| `category_id` | integer ≥1.0? | no |
| `credits` | integer ≥1.0 ≤10.0? | no |
| `duration_weeks` | integer ≥1.0 ≤104.0? | no |
| `capacity` | integer ≥1.0 ≤1000.0? | no |
| `start_date` | string (date)? | no |
| `end_date` | string (date)? | no |


*Response 200*: `CourseRead`


</details>

<details><summary><code>PUT /api/v1/courses/{course_id}</code> - Replace a course</summary>

*Access*: ADMIN, or the TEACHER who created/teaches it  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `title` | string min3 max150 | yes |
| `description` | string max5000? | no |
| `category_id` | integer ≥1.0? | no |
| `credits` | integer ≥1.0 ≤10.0 | yes |
| `duration_weeks` | integer ≥1.0 ≤104.0 | yes |
| `capacity` | integer ≥1.0 ≤1000.0 | no |
| `start_date` | string (date)? | no |
| `end_date` | string (date)? | no |
| `status` | CourseStatus | yes |


*Response 200*: `CourseRead`


</details>

<details><summary><code>PATCH /api/v1/courses/{course_id}/availability</code> - Open / close / archive a course</summary>

*Access*: ADMIN, or the TEACHER who created/teaches it  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `status` | CourseStatus | yes |


*Response 200*: `CourseRead`


</details>

<details><summary><code>DELETE /api/v1/courses/{course_id}/teachers/{teacher_id}</code> - Unassign a teacher</summary>

*Access*: ADMIN - scope `courses:write`  
*Success/other documented codes*: 204, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |
| `teacher_id` | path | integer | yes |


</details>

<details><summary><code>PUT /api/v1/courses/{course_id}/teachers/{teacher_id}</code> - Assign a teacher (validated via the Auth service, REST)</summary>

*Access*: ADMIN - scope `courses:write`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |
| `teacher_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|



*Response 200*: `CourseRead`


</details>


### Course files

| Method | Path | Summary | Access |
|---|---|---|---|
| `GET` | `/api/v1/courses/{course_id}/documents` | List course documents | Any authenticated user - scope `files:read` |
| `POST` | `/api/v1/courses/{course_id}/documents` | Upload a course document (PDF, DOCX, PPTX, TXT, JPEG, PNG; max 10 MB) | ADMIN, or the TEACHER who created/teaches the course - scope `files:write` |
| `DELETE` | `/api/v1/courses/{course_id}/documents/{file_id}` | Delete a document | ADMIN, or the TEACHER who created/teaches the course - scope `files:write` |
| `GET` | `/api/v1/courses/{course_id}/documents/{file_id}` | Download a course document | Any authenticated user - scope `files:read` |
| `PATCH` | `/api/v1/courses/{course_id}/documents/{file_id}` | Edit document metadata | ADMIN, or the TEACHER who created/teaches the course - scope `files:write` |

<details><summary><code>GET /api/v1/courses/{course_id}/documents</code> - List course documents</summary>

*Access*: Any authenticated user - scope `files:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |


*Response 200*: `FileRead[]`


</details>

<details><summary><code>POST /api/v1/courses/{course_id}/documents</code> - Upload a course document (PDF, DOCX, PPTX, TXT, JPEG, PNG; max 10 MB)</summary>

*Access*: ADMIN, or the TEACHER who created/teaches the course - scope `files:write`  
*Success/other documented codes*: 201, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |

*Request body* (`multipart/form-data`):

| Field | Type | Required |
|---|---|---|
| `file` | string | yes |
| `doc_type` | string max40? | no |
| `description` | string max500? | no |


*Response 201*: `FileRead`


</details>

<details><summary><code>DELETE /api/v1/courses/{course_id}/documents/{file_id}</code> - Delete a document</summary>

*Access*: ADMIN, or the TEACHER who created/teaches the course - scope `files:write`  
*Success/other documented codes*: 204, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |
| `file_id` | path | integer | yes |


</details>

<details><summary><code>GET /api/v1/courses/{course_id}/documents/{file_id}</code> - Download a course document</summary>

*Access*: Any authenticated user - scope `files:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |
| `file_id` | path | integer | yes |


*Response 200*: `any`


</details>

<details><summary><code>PATCH /api/v1/courses/{course_id}/documents/{file_id}</code> - Edit document metadata</summary>

*Access*: ADMIN, or the TEACHER who created/teaches the course - scope `files:write`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |
| `file_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `doc_type` | string max40? | no |
| `description` | string max500? | no |


*Response 200*: `FileRead`


</details>


### Enrollments

| Method | Path | Summary | Access |
|---|---|---|---|
| `GET` | `/api/v1/enrollments` | List enrollments (staff) | ADMIN, TEACHER - scope `enrollments:read` |
| `POST` | `/api/v1/enrollments` | Enroll a student in a course | Any authenticated user - scope `enrollments:write` (students enroll only themselves) |
| `GET` | `/api/v1/enrollments/courses/{course_id}` | Enrollments of one course (staff) | ADMIN, TEACHER - scope `enrollments:read` |
| `GET` | `/api/v1/enrollments/me` | My enrollments | Any authenticated user - scope `enrollments:read` |
| `GET` | `/api/v1/enrollments/stats` | Enrollment statistics (staff) | ADMIN, TEACHER - scope `enrollments:read` |
| `GET` | `/api/v1/enrollments/students/{student_id}` | Enrollments of one student (staff, or the student themself) | ADMIN/TEACHER, or the student (own rows only) |
| `DELETE` | `/api/v1/enrollments/{enrollment_id}` | Hard-delete (admin) | ADMIN - scope `enrollments:write` |
| `GET` | `/api/v1/enrollments/{enrollment_id}` | Get an enrollment with its history | ADMIN/TEACHER, or the enrolled student |
| `PATCH` | `/api/v1/enrollments/{enrollment_id}` | Update grade / notes / status (staff) | ADMIN, TEACHER - scope `enrollments:write` |
| `POST` | `/api/v1/enrollments/{enrollment_id}/cancel` | Cancel an enrollment | ADMIN/TEACHER, or the enrolled student |
| `GET` | `/api/v1/enrollments/{enrollment_id}/history` | Status history | ADMIN/TEACHER, or the enrolled student |

<details><summary><code>GET /api/v1/enrollments</code> - List enrollments (staff)</summary>

*Access*: ADMIN, TEACHER - scope `enrollments:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | query | integer? | no |
| `course_id` | query | integer? | no |
| `status` | query | EnrollmentStatus? | no |
| `page` | query | integer ≥1 | no |
| `size` | query | integer ≥1 ≤100 | no |
| `sort` | query | string? | no |
| `order` | query | enum(asc/desc) | no |


*Response 200*: `Page_EnrollmentRead_`


</details>

<details><summary><code>POST /api/v1/enrollments</code> - Enroll a student in a course</summary>

*Access*: Any authenticated user - scope `enrollments:write` (students enroll only themselves)  
*Success/other documented codes*: 201, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `course_id` | integer ≥1.0 | yes |
| `student_id` | integer ≥1.0? | no |
| `notes` | string max1000? | no |


*Response 201*: `EnrollmentRead`


</details>

<details><summary><code>GET /api/v1/enrollments/courses/{course_id}</code> - Enrollments of one course (staff)</summary>

*Access*: ADMIN, TEACHER - scope `enrollments:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `course_id` | path | integer | yes |
| `status` | query | EnrollmentStatus? | no |
| `page` | query | integer ≥1 | no |
| `size` | query | integer ≥1 ≤100 | no |
| `sort` | query | string? | no |
| `order` | query | enum(asc/desc) | no |


*Response 200*: `Page_EnrollmentRead_`


</details>

<details><summary><code>GET /api/v1/enrollments/me</code> - My enrollments</summary>

*Access*: Any authenticated user - scope `enrollments:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `status` | query | EnrollmentStatus? | no |
| `page` | query | integer ≥1 | no |
| `size` | query | integer ≥1 ≤100 | no |
| `sort` | query | string? | no |
| `order` | query | enum(asc/desc) | no |


*Response 200*: `Page_EnrollmentRead_`


</details>

<details><summary><code>GET /api/v1/enrollments/stats</code> - Enrollment statistics (staff)</summary>

*Access*: ADMIN, TEACHER - scope `enrollments:read`  
*Success/other documented codes*: 200  



*Response 200*: `EnrollmentStats`


</details>

<details><summary><code>GET /api/v1/enrollments/students/{student_id}</code> - Enrollments of one student (staff, or the student themself)</summary>

*Access*: ADMIN/TEACHER, or the student (own rows only)  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `student_id` | path | integer | yes |
| `page` | query | integer ≥1 | no |
| `size` | query | integer ≥1 ≤100 | no |
| `sort` | query | string? | no |
| `order` | query | enum(asc/desc) | no |


*Response 200*: `Page_EnrollmentRead_`


</details>

<details><summary><code>DELETE /api/v1/enrollments/{enrollment_id}</code> - Hard-delete (admin)</summary>

*Access*: ADMIN - scope `enrollments:write`  
*Success/other documented codes*: 204, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `enrollment_id` | path | integer | yes |


</details>

<details><summary><code>GET /api/v1/enrollments/{enrollment_id}</code> - Get an enrollment with its history</summary>

*Access*: ADMIN/TEACHER, or the enrolled student  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `enrollment_id` | path | integer | yes |


*Response 200*: `EnrollmentDetail`


</details>

<details><summary><code>PATCH /api/v1/enrollments/{enrollment_id}</code> - Update grade / notes / status (staff)</summary>

*Access*: ADMIN, TEACHER - scope `enrollments:write`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `enrollment_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `grade` | string? | no |
| `notes` | string max1000? | no |
| `status` | enum(ENROLLED/COMPLETED)? | no |


*Response 200*: `EnrollmentDetail`


</details>

<details><summary><code>POST /api/v1/enrollments/{enrollment_id}/cancel</code> - Cancel an enrollment</summary>

*Access*: ADMIN/TEACHER, or the enrolled student  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `enrollment_id` | path | integer | yes |

*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|



*Response 200*: `EnrollmentDetail`


</details>

<details><summary><code>GET /api/v1/enrollments/{enrollment_id}/history</code> - Status history</summary>

*Access*: ADMIN/TEACHER, or the enrolled student  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `enrollment_id` | path | integer | yes |


*Response 200*: `HistoryRead[]`


</details>


### Notifications

| Method | Path | Summary | Access |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | Notification history | ADMIN, TEACHER - scope `notifications:read` |
| `POST` | `/api/v1/notifications` | Queue an e-mail (202 Accepted: delivery happens asynchronously) | ADMIN - scope `notifications:write` |
| `POST` | `/api/v1/notifications/preview` | Render a template without sending | ADMIN - scope `notifications:write` |
| `GET` | `/api/v1/notifications/stats` | Counts by status and template | ADMIN, TEACHER - scope `notifications:read` |
| `GET` | `/api/v1/notifications/templates` | Available e-mail templates | ADMIN, TEACHER - scope `notifications:read` |
| `GET` | `/api/v1/notifications/{notification_id}` | One notification with its delivery attempts | ADMIN, TEACHER - scope `notifications:read` |
| `POST` | `/api/v1/notifications/{notification_id}/retry` | Re-queue a FAILED or DEAD notification | ADMIN - scope `notifications:write` |

<details><summary><code>GET /api/v1/notifications</code> - Notification history</summary>

*Access*: ADMIN, TEACHER - scope `notifications:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `status` | query | NotificationStatus? | no |
| `template` | query | string? | no |
| `recipient` | query | string? | no |
| `page` | query | integer ≥1 | no |
| `size` | query | integer ≥1 ≤100 | no |
| `sort` | query | string? | no |
| `order` | query | enum(asc/desc) | no |


*Response 200*: `Page_NotificationRead_`


</details>

<details><summary><code>POST /api/v1/notifications</code> - Queue an e-mail (202 Accepted: delivery happens asynchronously)</summary>

*Access*: ADMIN - scope `notifications:write`  
*Success/other documented codes*: 202, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `to_email` | string (email) | yes |
| `to_name` | string max130? | no |
| `template` | string | no |
| `variables` | object | no |


*Response 202*: `NotificationRead`


</details>

<details><summary><code>POST /api/v1/notifications/preview</code> - Render a template without sending</summary>

*Access*: ADMIN - scope `notifications:write`  
*Success/other documented codes*: 200, 422  


*Request body* (`application/json`):

| Field | Type | Required |
|---|---|---|
| `template` | string | yes |
| `variables` | object | no |


*Response 200*: `PreviewResponse`


</details>

<details><summary><code>GET /api/v1/notifications/stats</code> - Counts by status and template</summary>

*Access*: ADMIN, TEACHER - scope `notifications:read`  
*Success/other documented codes*: 200  



*Response 200*: `NotificationStats`


</details>

<details><summary><code>GET /api/v1/notifications/templates</code> - Available e-mail templates</summary>

*Access*: ADMIN, TEACHER - scope `notifications:read`  
*Success/other documented codes*: 200  



*Response 200*: `TemplateInfo[]`


</details>

<details><summary><code>GET /api/v1/notifications/{notification_id}</code> - One notification with its delivery attempts</summary>

*Access*: ADMIN, TEACHER - scope `notifications:read`  
*Success/other documented codes*: 200, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `notification_id` | path | integer | yes |


*Response 200*: `NotificationDetail`


</details>

<details><summary><code>POST /api/v1/notifications/{notification_id}/retry</code> - Re-queue a FAILED or DEAD notification</summary>

*Access*: ADMIN - scope `notifications:write`  
*Success/other documented codes*: 202, 422  


*Parameters*:

| Name | In | Type | Required |
|---|---|---|---|
| `notification_id` | path | integer | yes |


*Response 202*: `NotificationRead`


</details>


## 3. Sample requests and responses (captured from a real run)

Produced by `scripts/gen_docs_data.py` against the running stack through the gateway (tokens shortened, the admin password replaced by `…`). `$TOKEN` is the `access_token` returned by the OAuth2 call.


#### Register (public)

```bash
curl -s -X POST 'http://localhost:8000/api/v1/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{"email": "sample.f80488@example.com", "full_name": "Sample Student", "password": "Str0ng!Passw0rd#1"}'
```
```http
HTTP 201

{
  "id": 24,
  "email": "sample.f80488@example.com",
  "full_name": "Sample Student",
  "is_active": true,
  "auth_provider": "local",
  "roles": [
    "STUDENT"
  ],
  "last_login_at": null,
  "created_at": "2026-11-19T08:18:47"
}
```

#### Weak password -> standard 422 error envelope

```bash
curl -s -X POST 'http://localhost:8000/api/v1/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{"email": "x@example.com", "full_name": "Weak", "password": "weak"}'
```
```http
HTTP 422

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "body.password",
        "message": "Value error, Password must contain at least 10 characters, an uppercase letter, a digit, a special character",
        "type": "value_error"
      }
    ],
    "request_id": "4e53d30875eb458a96a25767954b35de",
    "correlation_id": "3a9768a83f174f19ab22f7060d5e8ec2",
    "timestamp": "2026-11-19T08:18:47+00:00",
    "path": "/api/v1/auth/register"
  }
}
```

#### OAuth2 password grant (admin)
Form-encoded (RFC 6749 §4.3). `scope` narrows the token to what the caller asks for.

```bash
curl -s -X POST 'http://localhost:8000/api/v1/auth/token' \
  -d 'username=admin@sms.example.com' -d 'scope=students:read students:write courses:read courses:write enrollments:write enrollments:read' -d 'password=…'
```
```http
HTTP 200

{
  "access_token": "eyJhbGciOiJIUzI1Ni…<truncated>",
  "refresh_token": "eyJhbGciOiJIUzI1Ni…<truncated>",
  "token_type": "bearer",
  "expires_in": 900,
  "scope": "courses:read courses:write enrollments:read enrollments:write students:read students:write"
}
```

#### No token -> 401

```bash
curl -s -X GET 'http://localhost:8000/api/v1/students'
```
```http
HTTP 401

{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Not authenticated",
    "details": [],
    "request_id": "ae65013fdd1d415ca6a98b7f03822275",
    "correlation_id": "ae65013fdd1d415ca6a98b7f03822275",
    "timestamp": "2026-11-19T08:18:47+00:00",
    "path": "/api/v1/students"
  }
}
```

#### Create department

```bash
curl -s -X POST 'http://localhost:8000/api/v1/departments' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"code": "SADCH", "name": "Sample Dept f80488"}'
```
```http
HTTP 201

{
  "id": 8,
  "code": "SADCH",
  "name": "Sample Dept f80488"
}
```

#### Create student (nested profile, contacts, interests)

```bash
curl -s -X POST 'http://localhost:8000/api/v1/students' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"first_name": "Ada", "last_name": "Lovelace", "email": "ada.f80488@example.com", "date_of_birth": "2001-12-10", "gender": "FEMALE", "department_code": "SADCH", "gpa": "3.80", "profile": {"city": "London", "bio": "Mathematics"}, "contacts": [{"contact_type": "PHONE", "value": "+44 20 7946 0958", "is_primary": true}], "interests": ["Mathematics", "Poetry"]}'
```
```http
HTTP 201

{
  "id": 66,
  "student_number": "STU2026000066",
  "first_name": "Ada",
  "last_name": "Lovelace",
  "email": "ada.f80488@example.com",
  "status": "ACTIVE",
  "department": {
    "id": 8,
    "code": "SADCH",
    "name": "Sample Dept f80488"
  },
  "gpa": "3.80",
  "enrolled_courses_count": 0,
  "user_id": null,
  "date_of_birth": "2001-12-10",
  "gender": "FEMALE",
  "admission_date": "2026-11-19",
  "profile": {
    "address_line": null,
    "city": "London",
    "state": null,
    "postal_code": null,
    "country": null,
    "bio": "Mathematics"
  },
  "contacts": [
    {
      "contact_type": "PHONE",
      "value": "+44 20 7946 0958",
      "label": null,
      "is_primary": true,
      "id": 18
    }
  ],
  "interests": [
    "mathematics",
    "poetry"
  ],
  "created_at": "2026-11-19T08:18:47",
  "updated_at": "2026-11-19T08:18:47"
}
```

#### List students: filter + sort + paginate

```bash
curl -s -X GET 'http://localhost:8000/api/v1/students?department=SADCH&sort=gpa&order=desc&page=1&size=5' \
  -H 'Authorization: Bearer $TOKEN'
```
```http
HTTP 200

{
  "items": [
    {
      "id": 66,
      "student_number": "STU2026000066",
      "first_name": "Ada",
      "last_name": "Lovelace",
      "email": "ada.f80488@example.com",
      "status": "ACTIVE",
      "department": {
        "id": 8,
        "code": "SADCH",
        "name": "Sample Dept f80488"
      },
      "gpa": "3.80",
      "enrolled_courses_count": 0
    }
  ],
  "total": 1,
  "page": 1,
  "size": 5,
  "pages": 1
}
```

#### Create category

```bash
curl -s -X POST 'http://localhost:8000/api/v1/categories' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Sample Cat f80488"}'
```
```http
HTTP 201

{
  "id": 8,
  "name": "Sample Cat f80488",
  "description": null
}
```

#### Create course

```bash
curl -s -X POST 'http://localhost:8000/api/v1/courses' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"code": "SADCH101", "title": "Intro to Python", "category_id": 8, "credits": 4, "duration_weeks": 12, "capacity": 2, "status": "OPEN"}'
```
```http
HTTP 201

{
  "id": 13,
  "code": "SADCH101",
  "title": "Intro to Python",
  "credits": 4,
  "duration_weeks": 12,
  "status": "OPEN",
  "capacity": 2,
  "enrolled_count": 0,
  "available_seats": 2,
  "is_available": true,
  "category": {
    "id": 8,
    "name": "Sample Cat f80488",
    "description": null
  },
  "start_date": null,
  "end_date": null,
  "description": null,
  "teachers": [],
  "created_by": 1,
  "created_at": "2026-11-19T08:18:47",
  "updated_at": "2026-11-19T08:18:47"
}
```

#### Enroll (validates student + course over REST, publishes StudentEnrolled)

```bash
curl -s -X POST 'http://localhost:8000/api/v1/enrollments' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"student_id": 66, "course_id": 13}'
```
```http
HTTP 201
x-request-id: de21321822b8420a81e3fe4fe4957faa
x-correlation-id: de21321822b8420a81e3fe4fe4957faa
x-ratelimit-limit: 120
x-ratelimit-remaining: 119

{
  "id": 21,
  "student_id": 66,
  "student_number": "STU2026000066",
  "student_name": "Ada Lovelace",
  "student_email": "ada.f80488@example.com",
  "course_id": 13,
  "course_code": "SADCH101",
  "course_title": "Intro to Python",
  "course_credits": 4,
  "status": "ENROLLED",
  "grade": null,
  "notes": null,
  "enrolled_at": "2026-11-19T08:18:47",
  "completed_at": null,
  "cancelled_at": null,
  "cancel_reason": null
}
```

#### Duplicate enrollment -> 409

```bash
curl -s -X POST 'http://localhost:8000/api/v1/enrollments' \
  -H 'Authorization: Bearer $TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"student_id": 66, "course_id": 13}'
```
```http
HTTP 409

{
  "error": {
    "code": "CONFLICT",
    "message": "Student is already enrolled in SADCH101",
    "details": [],
    "request_id": "17435e6caafb49c7af87c28a35cfe611",
    "correlation_id": "500357e8ded64ce19516fee4686174a8",
    "timestamp": "2026-11-19T08:18:47+00:00",
    "path": "/api/v1/enrollments"
  }
}
```

#### Course after the Kafka event: enrolled_count / available_seats updated

```bash
curl -s -X GET 'http://localhost:8000/api/v1/courses/13' \
  -H 'Authorization: Bearer $TOKEN'
```
```http
HTTP 200

{
  "id": 13,
  "code": "SADCH101",
  "title": "Intro to Python",
  "credits": 4,
  "duration_weeks": 12,
  "status": "OPEN",
  "capacity": 2,
  "enrolled_count": 1,
  "available_seats": 1,
  "is_available": true,
  "category": {
    "id": 8,
    "name": "Sample Cat f80488",
    "description": null
  },
  "start_date": null,
  "end_date": null,
  "description": null,
  "teachers": [],
  "created_by": 1,
  "created_at": "2026-11-19T08:18:47",
  "updated_at": "2026-11-19T08:18:48"
}
```

#### Enrollment with status history

```bash
curl -s -X GET 'http://localhost:8000/api/v1/enrollments/21' \
  -H 'Authorization: Bearer $TOKEN'
```
```http
HTTP 200

{
  "id": 21,
  "student_id": 66,
  "student_number": "STU2026000066",
  "student_name": "Ada Lovelace",
  "student_email": "ada.f80488@example.com",
  "course_id": 13,
  "course_code": "SADCH101",
  "course_title": "Intro to Python",
  "course_credits": 4,
  "status": "ENROLLED",
  "grade": null,
  "notes": null,
  "enrolled_at": "2026-11-19T08:18:47",
  "completed_at": null,
  "cancelled_at": null,
  "cancel_reason": null,
  "history": [
    {
      "from_status": null,
      "to_status": "ENROLLED",
      "changed_by": 1,
      "note": "enrolled",
      "changed_at": "2026-11-19T08:18:47"
    }
  ]
}
```

#### Notification history (e-mails produced by the events)

```bash
curl -s -X GET 'http://localhost:8000/api/v1/notifications?size=3&sort=id&order=desc' \
  -H 'Authorization: Bearer $TOKEN'
```
```http
HTTP 403

{
  "error": {
    "code": "FORBIDDEN",
    "message": "Token lacks required scope(s): notifications:read",
    "details": [],
    "request_id": "931b3c408d3945ec92abd82ef0bdc389",
    "correlation_id": "a9e848001ba94269a646f6f2e0e11d72",
    "timestamp": "2026-11-19T08:18:49+00:00",
    "path": "/api/v1/notifications"
  }
}
```

## 4. Other ready-made collections

* `postman/SMS.postman_collection.json` + `SMS.local.postman_environment.json` — 81 requests in 9 folders as a runnable flow (variables captured automatically). Set `adminPassword` in the environment (or run `python scripts/run_postman_collection.py`, which reads the admin credentials from `.env`).
* `scripts/e2e_verify.py` — 199 executable checks, the best "living" example of every request/response pair.
