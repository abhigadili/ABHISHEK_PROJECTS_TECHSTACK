# Database design

MySQL 8 · InnoDB · `utf8mb4` · database **`library_management`**. The schema lives in
[`database/migrations/001_init_schema.sql`](../database/migrations/001_init_schema.sql) and is applied by
`npm run db:migrate` (recorded in `schema_migrations`, each file runs once, in filename order).
Add future changes as `002_*.sql`, `003_*.sql`, ….

## Tables and relationships

| Area | Table | Purpose / key relations |
|---|---|---|
| Identity | `roles` | `admin`, `librarian`, `member` (one role per user) |
| | `users` | login identity; `role_id → roles`; unique `email`; `status` (pending/active/suspended/inactive); `failed_login_count`, `locked_until` for brute-force lockout |
| | `user_images` | **profile picture bytes** (`LONGBLOB data`) + `mime_type`, `size_bytes`, `sha256`; 1:1 with `users` (PK = `user_id`, `ON DELETE CASCADE`) |
| | `sessions` | server-side sessions; PK is the SHA-256 of the cookie token (the raw token is never stored) |
| | `password_reset_tokens` | SHA-256 of single-use reset tokens with expiry |
| Membership | `member_types` | policy per type: loan limit/days, renewals, reservations, fine/day, grace days, max fine per loan, term length, fee |
| | `member_profiles` | 1:1 with member users: unique `member_code`, DOB, gender, address fields, registration date |
| | `memberships` | one row per membership **term** (history); `user_id`, `member_type_id`, `start_date`, `end_date`, `status` |
| Catalogue | `books` | bibliographic record; unique nullable `isbn10`/`isbn13`; `publisher_id → publishers`; `status` active/archived |
| | `book_copies` | one row per physical copy; unique `accession_number`; `status` available / on_loan / held / damaged / lost / withdrawn |
| | `authors`, `publishers`, `categories` (self-referencing `parent_id`) | reference data; `status` active/archived |
| | `book_authors`, `book_categories` | many-to-many link tables |
| Circulation | `loans` | `user_id`, `book_id`, `copy_id`, `issued_at`, `due_date`, `returned_at`, `renewal_count`, `status` active/returned/lost, `issued_by`, `returned_processed_by` |
| | `loan_renewals` | renewal history (old/new due date, who) |
| | `reservations` | queue entry per member+book: pending → ready (copy held, `expires_at`) → fulfilled / cancelled / expired |
| Money | `fines` | `fine_type` overdue/lost/damage/manual; `amount`, `waived_amount`, `paid_amount` (+ CHECK `waived+paid ≤ amount`); `status`; creator / waiver staff |
| | `payments` | receipts (`kind` payment/refund, unique `receipt_number`, method, reference); a refund row points to the payment it reverses |
| | `payment_allocations` | which part of a payment was applied to which fine (partial / multi-fine payments) |
| Other | `notifications` | in-app notifications (`is_read`, `link`, unique `dedupe_key` for idempotent reminders) |
| | `favorites`, `reviews` | reading list; ratings with optional moderation (`status`) |
| | `library_settings` | key/value policy & contact settings (typed) |
| | `audit_logs` | who did what to which entity (JSON details, IP) |

## Integrity guarantees enforced by MySQL itself

* **No double issue of a copy** – generated column `loans.open_copy_id = IF(status='active', copy_id, NULL)` with a
  `UNIQUE` index: two open loans for one copy are impossible even if application checks were bypassed.
* **One open reservation per member and book** – generated `reservations.open_key` + `UNIQUE`.
* **Inventory counts cannot drift** – total / available / borrowed / held counts are never stored; they are
  aggregated from `book_copies` on every read.
* Money: `DECIMAL(10,2)`, CHECK constraints (`amount > 0` on payments, non-negative fine columns, `paid + waived ≤ amount`).
* Foreign keys on every relation; history is retained by archiving (books, authors, publishers, categories) or by
  status transitions (loans, reservations, fines, payments). Payments and fines are never deleted.
* Unique keys: `users.email`, `member_profiles.member_code`, `books.isbn10/isbn13` (NULLs allowed – local books),
  `book_copies.accession_number`, `categories.slug/name`, `payments.receipt_number`.

## Transactions and locking

Multi-step operations run in a transaction (`withTx`): registration (user + profile + membership + picture),
issue, return, renewal, reservation allocation, payments, refunds. Rows that decide an outcome are locked with
`SELECT … FOR UPDATE` (member row for borrowing limits, copy row for issue, fine rows for payments); copy selection
uses `SKIP LOCKED`. Link tables are synchronised by diffing (a blanket `DELETE` on an empty range would take gap locks
and deadlock concurrent inserts – found and fixed during testing).

## Dates and times

All sessions run `SET time_zone = '+00:00'`; `DATETIME` values are UTC and returned as ISO strings; `DATE` columns
(`due_date`, `birth`, membership dates) are plain `YYYY-MM-DD` strings.

## Seed data

`database/seeds/001_dev_catalog.sql` (publishers, authors, categories, 13 books) plus copies and three demo users
are loaded by `npm run db:seed` (development only; refuses to run if `books` is not empty).
Policy defaults (settings and the Student / Faculty / General / Premium types) are part of the migration, because the
application needs them to run.

## Backup and restore

```bash
# consistent logical backup (no table locks for InnoDB), including routines/events and the BLOB pictures
mysqldump --single-transaction --routines --events --default-character-set=utf8mb4 \
  -h 127.0.0.1 -P 3306 -u <backup_user> -p library_management | gzip > library_management_$(date +%F).sql.gz

# restore into an empty database
mysql -u <admin_user> -p -e "CREATE DATABASE library_management CHARACTER SET utf8mb4"
gunzip -c library_management_2026-10-15.sql.gz | mysql -u <admin_user> -p library_management
```

Notes: profile pictures are inside the dump (`user_images`). Keep backups encrypted and off the database host. Test a
restore regularly. For point-in-time recovery enable the binary log. Do **not** run `npm run db:reset` on production
(it refuses when `NODE_ENV=production`).

## Exporting data

Reports can be exported as CSV from **Staff → Reports** (same permissions as the screens; spreadsheet formula
injection is neutralised). Book catalogue import uses CSV too (**Staff → Bulk import**).
