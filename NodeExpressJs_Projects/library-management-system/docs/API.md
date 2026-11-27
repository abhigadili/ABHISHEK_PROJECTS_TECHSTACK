# REST API (`/api/v1`)

Base URL in development: `http://localhost:4000/api/v1`. JSON in/out unless noted.

**Conventions**

* Success: `{ "data": … }`; lists add `"meta": { page, pageSize, total, totalPages }` (query `?page=&pageSize=`).
* Error: `{ "error": { "code", "message", "details?" } }`. `details` holds per-field messages for validation errors (`400`).
  Status codes: `400` validation · `401` not signed in · `403` not allowed · `404` not found · `409` duplicate · `422` business-rule
  violation (e.g. borrowing limit) · `429` rate limit / lockout · `500` generic (no internals leaked).
* Auth: HttpOnly cookie `lms_session` (set by login/registration). Every **non-GET** request must send header
  `X-LMS-Client: web` (CSRF guard) and, from a browser on another origin, `credentials: 'include'`.
* Uploads use `multipart/form-data` (`picture`, `file`); never base64-in-JSON.

**Permission legend** – 🌐 public · 🔑 any signed-in user · 👤 member (own data only) · 🧑‍💼 staff (librarian + admin) · 👑 admin only.
Permissions are enforced by the API; the UI merely hides what a user cannot do.

## Auth & account – `/auth`, `/profile`, `/users`
| Method & path | Who | Notes |
|---|---|---|
| `POST /auth/register` | 🌐 | multipart; **always creates a member**; optional `picture`; `memberTypeId` optional; rate limited; sets session unless approval is required |
| `POST /auth/login` · `POST /auth/logout` | 🌐 · 🔑 | 5 failures ⇒ 15-minute lockout; suspended/inactive ⇒ 403 |
| `GET /auth/me` | 🔑 | current user, membership policy, `hasPicture` |
| `POST /auth/change-password` | 🔑 | needs current password; revokes other sessions |
| `POST /auth/forgot-password` · `POST /auth/reset-password` | 🌐 | single-use hashed token, 60-min expiry; same response for unknown emails |
| `GET/PATCH /profile` | 🔑 | own profile (name, phone, DOB, address…) |
| `GET /users/:id/picture` | 🔑 self or staff | streams bytes from MySQL with `Content-Type`, `ETag`, `Cache-Control: private` |
| `PUT /users/:id/picture` · `DELETE …` | 🔑 self, or staff for members (admin for anyone) | multipart `picture`, JPEG/PNG/WebP ≤ 2 MB, content sniffed |

## Members, staff, membership types
| Method & path | Who | Notes |
|---|---|---|
| `GET /members` | 🧑‍💼 | search `q`, `status`, `typeId` |
| `POST /members` | 🧑‍💼 | register a member (multipart, optional picture); temp password returned once if none given |
| `GET /members/:id` · `GET /members/:id/memberships` | 👤 self / 🧑‍💼 | |
| `PATCH /members/:id` | 🧑‍💼 | details, email |
| `POST /members/:id/status` | 🧑‍💼 | `{status: active\|suspended\|inactive, reason}`; suspension kills sessions, notifies the member, audited |
| `POST /members/:id/membership` | 🧑‍💼 | renew (same type extends) or change type (new term; history kept) |
| `GET /member-types` | 🌐 active types · `GET /member-types/all` 👑 | `POST`, `PUT /member-types/:id` 👑 |
| `GET/POST /staff`, `PATCH /staff/:id`, `POST /staff/:id/status`, `POST /staff/:id/reset-password` | 👑 | cannot demote/deactivate yourself or the last admin |

## Catalogue
| Method & path | Who | Notes |
|---|---|---|
| `GET /books` | 🌐 | filters `q,title,isbn,author,authorId,categoryId(+children),publisherId,publisher,language,format,yearFrom,yearTo,availability`; `sort=title\|newest\|year\|popularity\|availability`; archived only visible to staff via `status=` |
| `GET /books/recent` · `/books/popular` · `/books/languages` | 🌐 | popular = from real loans |
| `GET /books/:id` | 🌐 | details, authors, categories, copy counts, rating, related books; adds `isFavorite`, `myReservation`, `myActiveLoan` when signed in |
| `POST /books` · `PUT /books/:id` | 🧑‍💼 | validated ISBN checksums, multi-author / multi-category, optional initial `copies` |
| `POST /books/:id/archive` · `/restore` | 🧑‍💼 | archive blocked by active loans/reservations |
| `DELETE /books/:id` | 👑 | only without any circulation history (otherwise 422 → archive) |
| `GET/POST /books/:id/copies` | 🧑‍💼 | accession numbers generated or supplied |
| `PATCH/DELETE /copies/:id` | 🧑‍💼 | status → available/damaged/lost/withdrawn; on-loan copies refuse; delete only if never loaned |
| `GET /books/import/template` · `POST /books/import[?dryRun=1]` | 🧑‍💼 | CSV, all-or-nothing, per-row error report |
| `GET/POST/PUT/DELETE /categories`, `/authors`, `/publishers` | 🌐 read · 🧑‍💼 write · 👑 delete | delete archives when in use |

## Circulation – `/loans`, `/reservations`
| Method & path | Who | Notes |
|---|---|---|
| `GET /loans` | 🧑‍💼 | `status=active\|overdue\|closed\|returned\|lost`, `q`, `memberId`, `bookId`, `from`, `to` |
| `GET /loans/mine` | 👤 | own loans only (`?memberId=` ignored for members) |
| `GET /loans/:id` | 👤 own / 🧑‍💼 | includes renewals and fines |
| `POST /loans/issue` | 🧑‍💼 | `{memberId\|memberCode, bookId\|copyId\|accessionNumber, dueDate?}`; eligibility, limits, overdue/fine blocks; transactional |
| `POST /loans/return` | 🧑‍💼 | `{loanId\|accessionNumber, condition: good\|damaged\|lost, damageCharge?}`; creates fines; hands copy to the reservation queue |
| `POST /loans/:id/renew` | 👤 own / 🧑‍💼 | renewal limit, overdue, reservation and balance rules |
| `GET /reservations` | 🧑‍💼 | `status=open\|pending\|ready\|…`, `q` |
| `GET /reservations/mine` · `POST /reservations` | 👤 | reserve only when no copy is available; queue position returned |
| `POST /reservations/:id/cancel` | 👤 own / 🧑‍💼 | releases a held copy to the next member |

## Fines & payments
| Method & path | Who | Notes |
|---|---|---|
| `GET /fines` · `GET /fines/balance/:memberId` | 🧑‍💼 | |
| `GET /fines/mine` | 👤 | with outstanding balance in `meta` |
| `POST /fines` | 🧑‍💼 | manual/damage/lost charge |
| `POST /fines/:id/waive` | 🧑‍💼 | reason mandatory; partial or full; audited |
| `GET /payments` | 🧑‍💼 | · `GET /payments/mine` 👤 · `GET /payments/:id` 👤 own / 🧑‍💼 (receipt data) |
| `POST /payments` | 🧑‍💼 | `{memberId, amount, method, reference?, notes?, fineIds?}` – partial/full, oldest-first; locks fine rows; rejects card-number-like input |
| `POST /payments/:id/refund` | 👑 | creates a linked reversal record and restores fine balances |

## Engagement, dashboards, reports, admin
| Method & path | Who | Notes |
|---|---|---|
| `GET /notifications`, `/notifications/unread-count`, `POST /notifications/read-all`, `POST /notifications/:id/read` | 🔑 | own only |
| `GET /favorites`, `PUT/DELETE /favorites/:bookId` | 🔑 | reading list |
| `GET /reviews/book/:bookId` 🌐 · `PUT /reviews/book/:bookId` 👤 (must have borrowed) · `DELETE /reviews/:id` own/staff | | moderation: `GET /reviews`, `POST /reviews/:id/moderate` 🧑‍💼 |
| `GET /dashboard/staff` | 🧑‍💼 | live statistics, trends, recent activity |
| `GET /dashboard/member` | 🔑 | own loans, dues, reservations, notifications |
| `GET /reports` · `GET /reports/:name[?format=csv]` | 🧑‍💼 | 17 reports: inventory, availability, books-by-category/author/publisher, issue-return-history, current/overdue-loans, member-borrowing, most-borrowed, inactive-books, lost-damaged, outstanding-dues, fine-collection, payment-history, membership-registrations/expirations; filters `from,to,q`; CSV export is audited |
| `GET /settings/public` | 🌐 | name, address, hours, contact |
| `GET /settings` 🧑‍💼 · `PUT /settings` 👑 | | validated by type; audited |
| `GET /audit-logs` | 👑 | filters `action` (prefix), `entityType`, `actorId`, `from`, `to` |
| `POST /admin/jobs/run` | 👑 | run the maintenance job now (see README) |
| `GET /health` | 🌐 | DB ping |
