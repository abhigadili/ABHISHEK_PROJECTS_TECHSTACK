-- ============================================================
-- OrderDB — owned exclusively by order-service.
--
-- restaurant_id, customer_id and menu_item_id below are references to rows
-- that live in RestaurantDB (owned by restaurant-service) — there is
-- deliberately no cross-database foreign key for them, same reasoning as
-- the earlier student-management microservices project in this workspace.
-- Unlike that project, this service doesn't validate them with a
-- synchronous call either — the whole point of this system is
-- asynchronous-only communication, so order-service simply trusts the
-- ids it's given and lets the async Kafka consumers downstream (payment,
-- delivery) do their own work independently.
-- ============================================================
DROP DATABASE IF EXISTS OrderDB;
CREATE DATABASE OrderDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE OrderDB;

CREATE TABLE Customer_Address (
    address_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id     BIGINT NOT NULL,
    address_line1   VARCHAR(150),
    address_line2   VARCHAR(150),
    city            VARCHAR(50),
    state           VARCHAR(50),
    postal_code     VARCHAR(20),
    country         VARCHAR(50),
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    is_default      BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB;

CREATE TABLE Order_Coupons (
    coupon_id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    code                VARCHAR(30) NOT NULL UNIQUE,
    description         VARCHAR(255),
    discount_percent    DECIMAL(5,2),
    discount_amount     DECIMAL(10,2),
    min_order_amount    DECIMAL(10,2),
    valid_from          DATE,
    valid_to            DATE,
    usage_limit         INT DEFAULT 0,
    times_used          INT DEFAULT 0,
    is_active           BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE Orders (
    order_id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id         BIGINT NOT NULL,
    restaurant_id       BIGINT NOT NULL,
    delivery_address_id BIGINT NOT NULL,
    coupon_id           BIGINT NULL,
    order_status        VARCHAR(30) NOT NULL DEFAULT 'PLACED',
    total_amount        DECIMAL(10,2) NOT NULL,
    discount_amount     DECIMAL(10,2) DEFAULT 0.00,
    delivery_fee        DECIMAL(10,2) DEFAULT 0.00,
    final_amount        DECIMAL(10,2) NOT NULL,
    placed_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_address FOREIGN KEY (delivery_address_id) REFERENCES Customer_Address(address_id),
    CONSTRAINT fk_order_coupon FOREIGN KEY (coupon_id) REFERENCES Order_Coupons(coupon_id)
) ENGINE=InnoDB;

CREATE TABLE Order_Items (
    order_item_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id        BIGINT NOT NULL,
    menu_item_id    BIGINT NOT NULL COMMENT 'reference to RestaurantDB.Menu_Items.menu_item_id',
    item_name       VARCHAR(150) NOT NULL COMMENT 'snapshot of the name at order time',
    quantity        INT NOT NULL DEFAULT 1,
    unit_price      DECIMAL(10,2) NOT NULL,
    subtotal        DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_orderitem_order FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Order_Status_History (
    history_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id        BIGINT NOT NULL,
    status          VARCHAR(30) NOT NULL,
    notes           VARCHAR(255),
    changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_order FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- sample data ----
INSERT INTO Customer_Address (customer_id, address_line1, city, state, postal_code, country, latitude, longitude, is_default) VALUES
(1, '221B Residency Road', 'Bengaluru', 'Karnataka',  '560025', 'India', 12.971600, 77.594600, TRUE),
(2, '14 Salt Lake',        'Kolkata',   'West Bengal','700064', 'India', 22.579500, 88.417500, TRUE),
(3, '9 DLF Phase 2',       'Gurugram',  'Haryana',    '122002', 'India', 28.481900, 77.088900, TRUE);

INSERT INTO Order_Coupons (code, description, discount_percent, min_order_amount, valid_from, valid_to, usage_limit, times_used) VALUES
('WELCOME10', '10% off for new customers',  10.00, 200.00, '2026-01-01', '2026-12-31', 1000, 45),
('SAVE50',    'Flat 50 off orders above 300', NULL, 300.00, '2026-01-01', '2026-12-31', 500, 120);

UPDATE Order_Coupons SET discount_amount = 50.00 WHERE code = 'SAVE50';

INSERT INTO Orders (customer_id, restaurant_id, delivery_address_id, coupon_id, order_status, total_amount, discount_amount, delivery_fee, final_amount, placed_at) VALUES
(1, 1, 1, 1, 'DELIVERED', 970.00, 97.00, 40.00, 913.00, '2026-06-20 19:15:00'),
(2, 2, 2, NULL, 'DELIVERED', 480.00, 0.00, 30.00, 510.00, '2026-06-22 13:05:00'),
(3, 4, 3, 2, 'CONFIRMED', 420.00, 50.00, 35.00, 405.00, '2026-06-30 20:10:00');

INSERT INTO Order_Items (order_id, menu_item_id, item_name, quantity, unit_price, subtotal) VALUES
(1, 1, 'Margherita Pizza', 1, 450.00, 450.00),
(1, 2, 'Chicken Alfredo',  1, 520.00, 520.00),
(2, 4, 'Butter Chicken',   1, 420.00, 420.00),
(2, 6, 'Masala Chai',      1, 60.00,  60.00),
(3, 9, 'Classic Cheeseburger', 1, 220.00, 220.00),
(3, 10,'Veggie Burger',    1, 200.00, 200.00);

INSERT INTO Order_Status_History (order_id, status, notes, changed_at) VALUES
(1, 'PLACED',    'Order placed by customer',       '2026-06-20 19:15:00'),
(1, 'CONFIRMED', 'Payment successful',             '2026-06-20 19:16:00'),
(1, 'DELIVERED', 'Delivered to customer',          '2026-06-20 20:05:00'),
(2, 'PLACED',    'Order placed by customer',       '2026-06-22 13:05:00'),
(2, 'CONFIRMED', 'Payment successful',             '2026-06-22 13:06:00'),
(2, 'DELIVERED', 'Delivered to customer',          '2026-06-22 13:50:00'),
(3, 'PLACED',    'Order placed by customer',       '2026-06-30 20:10:00'),
(3, 'CONFIRMED', 'Payment successful',             '2026-06-30 20:11:00');
