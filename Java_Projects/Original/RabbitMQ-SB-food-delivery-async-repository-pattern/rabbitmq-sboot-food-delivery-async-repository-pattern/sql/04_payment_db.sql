-- ============================================================
-- PaymentDB — owned exclusively by payment-service.
-- order_id below is a reference to OrderDB.Orders.order_id — no cross-DB FK.
-- Payments here are created entirely from a Kafka event (OrderCreatedEvent),
-- never from a direct call by order-service.
-- ============================================================
DROP DATABASE IF EXISTS PaymentDB;
CREATE DATABASE PaymentDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE PaymentDB;

CREATE TABLE Payment_Methods (
    method_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id     BIGINT NOT NULL COMMENT 'reference to OrderDB customer id',
    method_type     ENUM('CARD','UPI','WALLET','COD','NETBANKING') NOT NULL,
    provider        VARCHAR(50),
    masked_details  VARCHAR(50),
    is_default      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Payments (
    payment_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id        BIGINT NOT NULL COMMENT 'reference to OrderDB.Orders.order_id',
    method_id       BIGINT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(10) DEFAULT 'INR',
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    transaction_ref VARCHAR(100),
    paid_at         TIMESTAMP NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_method FOREIGN KEY (method_id) REFERENCES Payment_Methods(method_id)
) ENGINE=InnoDB;

CREATE TABLE Refunds (
    refund_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_id      BIGINT NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    reason          VARCHAR(255),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    processed_at    TIMESTAMP NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_refund_payment FOREIGN KEY (payment_id) REFERENCES Payments(payment_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Payment_Logs (
    log_id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_id      BIGINT NOT NULL,
    event_type      VARCHAR(30) NOT NULL,
    message         VARCHAR(255),
    logged_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_payment FOREIGN KEY (payment_id) REFERENCES Payments(payment_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- sample data ----
INSERT INTO Payment_Methods (customer_id, method_type, provider, masked_details, is_default) VALUES
(1, 'CARD', 'Visa',      '**** **** **** 1234', TRUE),
(2, 'UPI',  'GPay',      'sunita@okicici',       TRUE),
(3, 'CARD', 'Mastercard','**** **** **** 5678', TRUE);

INSERT INTO Payments (order_id, method_id, amount, status, transaction_ref, paid_at, created_at) VALUES
(1, 1, 913.00, 'SUCCESS', 'TXN-PMT-1001', '2026-06-20 19:16:00', '2026-06-20 19:15:30'),
(2, 2, 510.00, 'SUCCESS', 'TXN-PMT-1002', '2026-06-22 13:06:00', '2026-06-22 13:05:30'),
(3, 3, 405.00, 'SUCCESS', 'TXN-PMT-1003', '2026-06-30 20:11:00', '2026-06-30 20:10:30');

INSERT INTO Payment_Logs (payment_id, event_type, message, logged_at) VALUES
(1, 'INITIATED',        'Payment initiated for order 1', '2026-06-20 19:15:30'),
(1, 'GATEWAY_RESPONSE', 'Gateway approved transaction',  '2026-06-20 19:15:55'),
(1, 'SUCCESS',          'Payment marked successful',     '2026-06-20 19:16:00'),
(2, 'INITIATED',        'Payment initiated for order 2', '2026-06-22 13:05:30'),
(2, 'SUCCESS',          'Payment marked successful',     '2026-06-22 13:06:00'),
(3, 'INITIATED',        'Payment initiated for order 3', '2026-06-30 20:10:30'),
(3, 'SUCCESS',          'Payment marked successful',     '2026-06-30 20:11:00');

INSERT INTO Refunds (payment_id, amount, reason, status, processed_at) VALUES
(2, 60.00, 'Item unavailable — Masala Chai refunded', 'PROCESSED', '2026-06-22 14:30:00');
