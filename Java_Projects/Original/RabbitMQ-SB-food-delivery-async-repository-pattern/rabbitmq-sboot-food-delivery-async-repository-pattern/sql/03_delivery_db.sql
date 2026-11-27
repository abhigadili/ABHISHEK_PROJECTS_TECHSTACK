-- ============================================================
-- DeliveryDB — owned exclusively by delivery-service.
-- order_id below is a reference to OrderDB.Orders.order_id — no cross-DB FK.
-- Deliveries are created entirely from a Kafka event (PaymentCompletedEvent),
-- never from a direct call by order-service.
-- ============================================================
DROP DATABASE IF EXISTS DeliveryDB;
CREATE DATABASE DeliveryDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE DeliveryDB;

CREATE TABLE Delivery_Partners (
    partner_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    email           VARCHAR(100),
    vehicle_type    VARCHAR(30),
    license_number  VARCHAR(50),
    is_available    BOOLEAN DEFAULT TRUE,
    average_rating  DECIMAL(2,1) DEFAULT 0.0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Deliveries (
    delivery_id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id                BIGINT NOT NULL COMMENT 'reference to OrderDB.Orders.order_id',
    partner_id              BIGINT NULL,
    pickup_address          VARCHAR(255),
    drop_address            VARCHAR(255),
    status                  VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    estimated_delivery_time TIMESTAMP NULL,
    actual_delivery_time    TIMESTAMP NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_delivery_partner FOREIGN KEY (partner_id) REFERENCES Delivery_Partners(partner_id)
) ENGINE=InnoDB;

CREATE TABLE Delivery_Status (
    status_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    delivery_id     BIGINT NOT NULL,
    status          VARCHAR(30) NOT NULL,
    notes           VARCHAR(255),
    changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dstatus_delivery FOREIGN KEY (delivery_id) REFERENCES Deliveries(delivery_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Delivery_Location_History (
    location_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    delivery_id     BIGINT NOT NULL,
    latitude        DECIMAL(9,6) NOT NULL,
    longitude       DECIMAL(9,6) NOT NULL,
    recorded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_location_delivery FOREIGN KEY (delivery_id) REFERENCES Deliveries(delivery_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- sample data ----
INSERT INTO Delivery_Partners (name, phone, email, vehicle_type, license_number, is_available, average_rating) VALUES
('Ravi Kumar',    '9900000001', 'ravi.kumar@delivery.example',    'Motorcycle', 'DL-001', TRUE,  4.7),
('Sunita Devi',   '9900000002', 'sunita.devi@delivery.example',   'Scooter',    'DL-002', TRUE,  4.5),
('Manoj Verma',   '9900000003', 'manoj.verma@delivery.example',   'Motorcycle', 'DL-003', TRUE,  4.8),
('Ayesha Khan',   '9900000004', 'ayesha.khan@delivery.example',   'Bicycle',    'DL-004', FALSE, 4.6);

INSERT INTO Deliveries (order_id, partner_id, pickup_address, drop_address, status, estimated_delivery_time, actual_delivery_time, created_at) VALUES
(1, 1, 'Bella Italia, 12 MG Road, Bengaluru', '221B Residency Road, Bengaluru', 'DELIVERED', '2026-06-20 20:00:00', '2026-06-20 20:05:00', '2026-06-20 19:16:30'),
(2, 2, 'Spice Route, 45 Park Street, Kolkata', '14 Salt Lake, Kolkata',         'DELIVERED', '2026-06-22 13:45:00', '2026-06-22 13:50:00', '2026-06-22 13:06:30'),
(3, 3, 'Burger Junction, 23 Sector 15, Gurugram', '9 DLF Phase 2, Gurugram',    'ASSIGNED',  '2026-06-30 21:00:00', NULL,                   '2026-06-30 20:11:30');

INSERT INTO Delivery_Status (delivery_id, status, notes, changed_at) VALUES
(1, 'ASSIGNED',  'Assigned to Ravi Kumar',   '2026-06-20 19:16:30'),
(1, 'PICKED_UP', 'Picked up from restaurant','2026-06-20 19:35:00'),
(1, 'DELIVERED', 'Delivered to customer',    '2026-06-20 20:05:00'),
(2, 'ASSIGNED',  'Assigned to Sunita Devi',  '2026-06-22 13:06:30'),
(2, 'PICKED_UP', 'Picked up from restaurant','2026-06-22 13:20:00'),
(2, 'DELIVERED', 'Delivered to customer',    '2026-06-22 13:50:00'),
(3, 'ASSIGNED',  'Assigned to Manoj Verma',  '2026-06-30 20:11:30');

INSERT INTO Delivery_Location_History (delivery_id, latitude, longitude, recorded_at) VALUES
(3, 28.459500, 77.026600, '2026-06-30 20:12:00'),
(3, 28.470000, 77.055000, '2026-06-30 20:20:00'),
(3, 28.481900, 77.088900, '2026-06-30 20:35:00');
