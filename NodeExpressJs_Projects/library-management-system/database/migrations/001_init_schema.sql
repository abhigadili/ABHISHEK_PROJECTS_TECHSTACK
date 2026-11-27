-- Library Management System - initial schema (MySQL 8, InnoDB, utf8mb4)
-- Applied by `npm run db:migrate` (backend/scripts/db.ts). Each file runs once and is
-- recorded in schema_migrations.

-- ---------------------------------------------------------------------------
-- Identity & access
-- ---------------------------------------------------------------------------
CREATE TABLE roles (
  id          TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  name        VARCHAR(30) NOT NULL,
  description VARCHAR(255) NULL,
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB;

INSERT INTO roles (id, name, description) VALUES
  (1, 'admin',     'Full administration of the library'),
  (2, 'librarian', 'Circulation, inventory, members and fines'),
  (3, 'member',    'Library patron');

CREATE TABLE users (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email               VARCHAR(190) NOT NULL,
  password_hash       VARCHAR(100) NOT NULL,
  full_name           VARCHAR(150) NOT NULL,
  phone               VARCHAR(30) NULL,
  role_id             TINYINT UNSIGNED NOT NULL,
  status              ENUM('pending','active','suspended','inactive') NOT NULL DEFAULT 'active',
  status_reason       VARCHAR(255) NULL,
  failed_login_count  INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until        DATETIME NULL,
  last_login_at       DATETIME NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role_status (role_id, status),
  KEY ix_users_name (full_name),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB;

-- Profile pictures live in MySQL (LONGBLOB), separate from users so that list
-- queries never drag image bytes along.
CREATE TABLE user_images (
  user_id     BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  mime_type   VARCHAR(50) NOT NULL,
  size_bytes  INT UNSIGNED NOT NULL,
  sha256      CHAR(64) NOT NULL,
  data        LONGBLOB NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_images_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Server-side sessions: the cookie carries a random token, only its SHA-256 is stored.
CREATE TABLE sessions (
  id          CHAR(64) NOT NULL PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  expires_at  DATETIME NOT NULL,
  ip_address  VARCHAR(64) NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_sessions_user (user_id),
  KEY ix_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE password_reset_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_prt_hash (token_hash),
  KEY ix_prt_user (user_id),
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------
CREATE TABLE member_types (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name                 VARCHAR(60) NOT NULL,
  description          VARCHAR(255) NULL,
  max_loans            SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  loan_days            SMALLINT UNSIGNED NOT NULL DEFAULT 14,
  max_renewals         SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  renewal_days         SMALLINT UNSIGNED NOT NULL DEFAULT 14,
  max_reservations     SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  fine_per_day         DECIMAL(8,2) NOT NULL DEFAULT 0.50,
  grace_days           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_fine_per_loan    DECIMAL(10,2) NULL,
  membership_days      SMALLINT UNSIGNED NOT NULL DEFAULT 365,
  membership_fee       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_active            TINYINT(1) NOT NULL DEFAULT 1,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_member_types_name (name)
) ENGINE=InnoDB;

CREATE TABLE member_profiles (
  user_id            BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  member_code        VARCHAR(20) NOT NULL,
  date_of_birth      DATE NULL,
  gender             ENUM('female','male','other','undisclosed') NULL,
  address            VARCHAR(255) NULL,
  city               VARCHAR(80) NULL,
  state              VARCHAR(80) NULL,
  postal_code        VARCHAR(20) NULL,
  country            VARCHAR(80) NULL,
  registration_date  DATE NOT NULL,
  UNIQUE KEY uq_member_code (member_code),
  CONSTRAINT fk_member_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- One row per membership term; the active row with the latest end_date is the current one.
CREATE TABLE memberships (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  member_type_id  INT UNSIGNED NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          ENUM('active','expired','suspended','cancelled') NOT NULL DEFAULT 'active',
  created_by      BIGINT UNSIGNED NULL,
  notes           VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_memberships_user (user_id, status, end_date),
  KEY ix_memberships_type (member_type_id),
  KEY ix_memberships_end (status, end_date),
  CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_memberships_type FOREIGN KEY (member_type_id) REFERENCES member_types (id),
  CONSTRAINT fk_memberships_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
CREATE TABLE publishers (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(190) NOT NULL,
  address     VARCHAR(255) NULL,
  email       VARCHAR(190) NULL,
  phone       VARCHAR(40) NULL,
  website     VARCHAR(255) NULL,
  status      ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_publishers_name (name)
) ENGINE=InnoDB;

CREATE TABLE authors (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(190) NOT NULL,
  biography     TEXT NULL,
  nationality   VARCHAR(80) NULL,
  date_of_birth DATE NULL,
  image_url     VARCHAR(500) NULL,
  status        ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_authors_name (name)
) ENGINE=InnoDB;

CREATE TABLE categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  slug        VARCHAR(140) NOT NULL,
  description VARCHAR(500) NULL,
  parent_id   INT UNSIGNED NULL,
  status      ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categories_slug (slug),
  UNIQUE KEY uq_categories_name (name),
  KEY ix_categories_parent (parent_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Copy counts (total / available / borrowed / reserved) are always derived from
-- book_copies, so they cannot drift from the physical records.
CREATE TABLE books (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  isbn10           CHAR(10) NULL,
  isbn13           CHAR(13) NULL,
  title            VARCHAR(255) NOT NULL,
  subtitle         VARCHAR(255) NULL,
  description      TEXT NULL,
  publisher_id     INT UNSIGNED NULL,
  edition          VARCHAR(40) NULL,
  publication_year SMALLINT UNSIGNED NULL,
  language         VARCHAR(40) NOT NULL DEFAULT 'English',
  pages            SMALLINT UNSIGNED NULL,
  cover_url        VARCHAR(500) NULL,
  location         VARCHAR(100) NULL,
  format           ENUM('hardcover','paperback','ebook','audiobook','other') NOT NULL DEFAULT 'paperback',
  acquisition_date DATE NULL,
  acquisition_cost DECIMAL(10,2) NULL,
  status           ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_by       BIGINT UNSIGNED NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_books_isbn13 (isbn13),
  UNIQUE KEY uq_books_isbn10 (isbn10),
  KEY ix_books_title (title),
  KEY ix_books_publisher (publisher_id),
  KEY ix_books_year (publication_year),
  KEY ix_books_language (language),
  KEY ix_books_status_created (status, created_at),
  FULLTEXT KEY ft_books_text (title, subtitle, description),
  CONSTRAINT fk_books_publisher FOREIGN KEY (publisher_id) REFERENCES publishers (id) ON DELETE SET NULL,
  CONSTRAINT fk_books_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE book_authors (
  book_id    BIGINT UNSIGNED NOT NULL,
  author_id  INT UNSIGNED NOT NULL,
  position   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, author_id),
  KEY ix_book_authors_author (author_id),
  CONSTRAINT fk_ba_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
  CONSTRAINT fk_ba_author FOREIGN KEY (author_id) REFERENCES authors (id)
) ENGINE=InnoDB;

CREATE TABLE book_categories (
  book_id      BIGINT UNSIGNED NOT NULL,
  category_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (book_id, category_id),
  KEY ix_bc_category (category_id),
  CONSTRAINT fk_bc_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
  CONSTRAINT fk_bc_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB;

-- available  : on the shelf and issuable
-- on_loan    : currently issued
-- held       : returned and set aside for the member at the head of the reservation queue
-- damaged / lost / withdrawn : not circulating
CREATE TABLE book_copies (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  book_id           BIGINT UNSIGNED NOT NULL,
  accession_number  VARCHAR(40) NOT NULL,
  status            ENUM('available','on_loan','held','damaged','lost','withdrawn') NOT NULL DEFAULT 'available',
  shelf_location    VARCHAR(100) NULL,
  condition_notes   VARCHAR(255) NULL,
  acquired_on       DATE NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_copies_accession (accession_number),
  KEY ix_copies_book_status (book_id, status),
  CONSTRAINT fk_copies_book FOREIGN KEY (book_id) REFERENCES books (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Circulation
-- ---------------------------------------------------------------------------
CREATE TABLE loans (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NOT NULL,
  book_id             BIGINT UNSIGNED NOT NULL,
  copy_id             BIGINT UNSIGNED NOT NULL,
  issued_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date            DATE NOT NULL,
  returned_at         DATETIME NULL,
  renewal_count       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status              ENUM('active','returned','lost') NOT NULL DEFAULT 'active',
  return_condition    ENUM('good','damaged','lost') NULL,
  issued_by           BIGINT UNSIGNED NULL,
  returned_processed_by BIGINT UNSIGNED NULL,
  reservation_id      BIGINT UNSIGNED NULL,
  notes               VARCHAR(255) NULL,
  -- NULL while the loan is open; lets MySQL guarantee one open loan per copy.
  open_copy_id        BIGINT UNSIGNED AS (IF(status = 'active', copy_id, NULL)) STORED,
  UNIQUE KEY uq_loans_one_open_per_copy (open_copy_id),
  KEY ix_loans_user_status (user_id, status),
  KEY ix_loans_book (book_id),
  KEY ix_loans_copy (copy_id),
  KEY ix_loans_due (status, due_date),
  KEY ix_loans_issued (issued_at),
  CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_loans_book FOREIGN KEY (book_id) REFERENCES books (id),
  CONSTRAINT fk_loans_copy FOREIGN KEY (copy_id) REFERENCES book_copies (id),
  CONSTRAINT fk_loans_issuer FOREIGN KEY (issued_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_loans_returner FOREIGN KEY (returned_processed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE loan_renewals (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  loan_id       BIGINT UNSIGNED NOT NULL,
  renewed_by    BIGINT UNSIGNED NULL,
  old_due_date  DATE NOT NULL,
  new_due_date  DATE NOT NULL,
  renewed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_renewals_loan (loan_id),
  CONSTRAINT fk_renewals_loan FOREIGN KEY (loan_id) REFERENCES loans (id),
  CONSTRAINT fk_renewals_user FOREIGN KEY (renewed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- pending   : waiting in the queue (ordered by created_at, id)
-- ready     : a copy has been set aside (copy_id) until expires_at
-- fulfilled : the member borrowed the book
CREATE TABLE reservations (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  book_id       BIGINT UNSIGNED NOT NULL,
  copy_id       BIGINT UNSIGNED NULL,
  status        ENUM('pending','ready','fulfilled','cancelled','expired') NOT NULL DEFAULT 'pending',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ready_at      DATETIME NULL,
  expires_at    DATETIME NULL,
  closed_at     DATETIME NULL,
  -- NULL once the reservation is closed; enforces one open reservation per member+book.
  open_key      VARCHAR(40) AS (IF(status IN ('pending','ready'), CONCAT(user_id, '-', book_id), NULL)) STORED,
  UNIQUE KEY uq_reservations_one_open (open_key),
  KEY ix_reservations_book_status (book_id, status, created_at),
  KEY ix_reservations_user (user_id, status),
  KEY ix_reservations_expiry (status, expires_at),
  CONSTRAINT fk_res_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_res_book FOREIGN KEY (book_id) REFERENCES books (id),
  CONSTRAINT fk_res_copy FOREIGN KEY (copy_id) REFERENCES book_copies (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------
CREATE TABLE fines (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT UNSIGNED NOT NULL,
  loan_id        BIGINT UNSIGNED NULL,
  fine_type      ENUM('overdue','lost','damage','manual') NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  waived_amount  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  paid_amount    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status         ENUM('outstanding','partial','paid','waived') NOT NULL DEFAULT 'outstanding',
  reason         VARCHAR(255) NULL,
  waiver_reason  VARCHAR(255) NULL,
  created_by     BIGINT UNSIGNED NULL,
  waived_by      BIGINT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_fines_user_status (user_id, status),
  KEY ix_fines_loan (loan_id),
  KEY ix_fines_created (created_at),
  CONSTRAINT ck_fines_amounts CHECK (amount >= 0 AND waived_amount >= 0 AND paid_amount >= 0
                                     AND waived_amount + paid_amount <= amount),
  CONSTRAINT fk_fines_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_fines_loan FOREIGN KEY (loan_id) REFERENCES loans (id),
  CONSTRAINT fk_fines_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_fines_waiver FOREIGN KEY (waived_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- kind = 'payment' rows are positive receipts; kind = 'refund' rows reverse a payment
-- (reverses_payment_id) and are never deleted, giving a complete audit trail.
CREATE TABLE payments (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_number       VARCHAR(30) NOT NULL,
  user_id              BIGINT UNSIGNED NOT NULL,
  kind                 ENUM('payment','refund') NOT NULL DEFAULT 'payment',
  amount               DECIMAL(10,2) NOT NULL,
  method               ENUM('cash','card','online','cheque','other') NOT NULL DEFAULT 'cash',
  reference            VARCHAR(100) NULL,
  notes                VARCHAR(255) NULL,
  reverses_payment_id  BIGINT UNSIGNED NULL,
  received_by          BIGINT UNSIGNED NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payments_receipt (receipt_number),
  UNIQUE KEY uq_payments_one_reversal (reverses_payment_id),
  KEY ix_payments_user (user_id, created_at),
  KEY ix_payments_created (created_at),
  CONSTRAINT ck_payments_amount CHECK (amount > 0),
  CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_payments_reverses FOREIGN KEY (reverses_payment_id) REFERENCES payments (id),
  CONSTRAINT fk_payments_receiver FOREIGN KEY (received_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- How much of a payment was applied to which fine (supports partial / multi-fine payments).
CREATE TABLE payment_allocations (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_id  BIGINT UNSIGNED NOT NULL,
  fine_id     BIGINT UNSIGNED NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  KEY ix_pa_payment (payment_id),
  KEY ix_pa_fine (fine_id),
  CONSTRAINT ck_pa_amount CHECK (amount > 0),
  CONSTRAINT fk_pa_payment FOREIGN KEY (payment_id) REFERENCES payments (id),
  CONSTRAINT fk_pa_fine FOREIGN KEY (fine_id) REFERENCES fines (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Engagement & operations
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  type        VARCHAR(40) NOT NULL,
  title       VARCHAR(150) NOT NULL,
  message     VARCHAR(500) NOT NULL,
  link        VARCHAR(255) NULL,
  dedupe_key  VARCHAR(120) NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  read_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notifications_dedupe (dedupe_key),
  KEY ix_notifications_user (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE favorites (
  user_id     BIGINT UNSIGNED NOT NULL,
  book_id     BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, book_id),
  KEY ix_favorites_book (book_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE reviews (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  book_id     BIGINT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL,
  comment     VARCHAR(2000) NULL,
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reviews_user_book (user_id, book_id),
  KEY ix_reviews_book (book_id, status),
  CONSTRAINT ck_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE library_settings (
  setting_key  VARCHAR(80) NOT NULL PRIMARY KEY,
  value        VARCHAR(1000) NOT NULL,
  value_type   ENUM('string','number','boolean','text') NOT NULL DEFAULT 'string',
  category     VARCHAR(40) NOT NULL DEFAULT 'general',
  description  VARCHAR(255) NULL,
  updated_by   BIGINT UNSIGNED NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id     BIGINT UNSIGNED NULL,
  action       VARCHAR(60) NOT NULL,
  entity_type  VARCHAR(40) NOT NULL,
  entity_id    VARCHAR(40) NULL,
  details      JSON NULL,
  ip_address   VARCHAR(64) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_audit_actor (actor_id, created_at),
  KEY ix_audit_entity (entity_type, entity_id),
  KEY ix_audit_created (created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Default configuration (policy values, not sample data)
-- ---------------------------------------------------------------------------
INSERT INTO library_settings (setting_key, value, value_type, category, description) VALUES
  ('library_name',                 'City Public Library',      'string',  'general',     'Name shown across the application'),
  ('library_address',              '1 Library Square, Springfield', 'string', 'general', 'Street address'),
  ('library_phone',                '+1 555 0100',              'string',  'general',     'Contact phone'),
  ('library_email',                'info@library.example',     'string',  'general',     'Contact email'),
  ('library_hours',                'Mon-Fri 09:00-20:00; Sat 10:00-16:00; Sun closed', 'text', 'general', 'Opening hours'),
  ('library_about',                'A community library lending books, offering study spaces and reading programmes for everyone.', 'text', 'general', 'About text'),
  ('currency_symbol',              '$',                        'string',  'general',     'Currency symbol shown for money'),
  ('registration_requires_approval','false',                   'boolean', 'membership',  'New self-registered members stay pending until staff activate them'),
  ('default_member_type_id',       '3',                        'number',  'membership',  'Membership type given to self-registered members'),
  ('block_borrowing_if_overdue',   'true',                     'boolean', 'circulation', 'Members with an overdue loan cannot borrow or renew'),
  ('max_outstanding_balance',      '10.00',                    'number',  'fines',       'Borrowing is blocked once unpaid fines reach this amount'),
  ('lost_book_default_charge',     '25.00',                    'number',  'fines',       'Lost-book charge when the book has no acquisition cost'),
  ('lost_book_processing_fee',     '5.00',                     'number',  'fines',       'Fee added on top of the replacement cost of a lost book'),
  ('damage_default_charge',        '10.00',                    'number',  'fines',       'Default damage charge'),
  ('reservation_hold_days',        '3',                        'number',  'reservations','Days a returned copy is held for the next member in the queue'),
  ('due_soon_days',                '3',                        'number',  'notifications','Send a reminder this many days before the due date'),
  ('review_moderation',            'false',                    'boolean', 'reviews',     'New reviews need staff approval before they are shown');

-- Membership types: the policy values below are defaults an admin can edit.
INSERT INTO member_types (id, name, description, max_loans, loan_days, max_renewals, renewal_days, max_reservations, fine_per_day, grace_days, max_fine_per_loan, membership_days, membership_fee) VALUES
  (1, 'Student', 'Students with a valid ID',        5, 14, 2, 14, 5, 0.25, 1,  10.00, 365, 0.00),
  (2, 'Faculty', 'Teaching and research staff',    10, 30, 3, 30, 8, 0.25, 3,  15.00, 730, 0.00),
  (3, 'General', 'General public membership',       5, 14, 2, 14, 5, 0.50, 0,  20.00, 365, 10.00),
  (4, 'Premium', 'Extended limits and loan periods',15, 28, 4, 28, 10, 0.50, 2, 25.00, 365, 40.00);
