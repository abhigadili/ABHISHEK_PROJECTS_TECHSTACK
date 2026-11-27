-- ============================================================
-- RestaurantDB — owned exclusively by restaurant-service.
-- This service never participates in the Kafka event choreography — it's a
-- pure catalog service (menu browsing), so it has no async coupling to the
-- other three services.
-- ============================================================
DROP DATABASE IF EXISTS RestaurantDB;
CREATE DATABASE RestaurantDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE RestaurantDB;

CREATE TABLE Categories (
    category_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_name   VARCHAR(100) NOT NULL,
    category_type   ENUM('CUISINE','MENU_ITEM') NOT NULL,
    description     VARCHAR(255),
    UNIQUE KEY uq_category_name_type (category_name, category_type)
) ENGINE=InnoDB;

CREATE TABLE Restaurants (
    restaurant_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id     BIGINT NOT NULL,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    phone           VARCHAR(20),
    email           VARCHAR(100),
    price_range     ENUM('$','$$','$$$') DEFAULT '$$',
    average_rating  DECIMAL(2,1) DEFAULT 0.0,
    total_ratings   INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_restaurant_category FOREIGN KEY (category_id) REFERENCES Categories(category_id)
) ENGINE=InnoDB;

CREATE TABLE Restaurant_Address (
    address_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL,
    address_line1   VARCHAR(150),
    address_line2   VARCHAR(150),
    city            VARCHAR(50),
    state           VARCHAR(50),
    postal_code     VARCHAR(20),
    country         VARCHAR(50),
    latitude        DECIMAL(9,6),
    longitude       DECIMAL(9,6),
    CONSTRAINT fk_raddress_restaurant FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Menu_Items (
    menu_item_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL,
    category_id     BIGINT NOT NULL,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    price           DECIMAL(10,2) NOT NULL,
    is_vegetarian   BOOLEAN DEFAULT FALSE,
    is_available    BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_menuitem_restaurant FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id) ON DELETE CASCADE,
    CONSTRAINT fk_menuitem_category FOREIGN KEY (category_id) REFERENCES Categories(category_id)
) ENGINE=InnoDB;

CREATE TABLE Menu_Item_Images (
    image_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    menu_item_id    BIGINT NOT NULL,
    image_url       VARCHAR(255) NOT NULL,
    is_primary      BOOLEAN DEFAULT FALSE,
    uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_image_menuitem FOREIGN KEY (menu_item_id) REFERENCES Menu_Items(menu_item_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Restaurant_Hours (
    hours_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL,
    day_of_week     TINYINT NOT NULL COMMENT '0=Sunday .. 6=Saturday',
    open_time       TIME,
    close_time      TIME,
    is_closed       BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_hours_restaurant FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Restaurant_Ratings (
    rating_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL,
    customer_id     BIGINT NOT NULL COMMENT 'reference to a customer id from OrderDB — no cross-DB FK',
    rating          TINYINT NOT NULL,
    review_text     TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rating_restaurant FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id) ON DELETE CASCADE,
    CONSTRAINT chk_rating_range CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE Restaurant_Offers (
    offer_id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id       BIGINT NOT NULL,
    title               VARCHAR(150) NOT NULL,
    description         VARCHAR(255),
    discount_percent    DECIMAL(5,2),
    min_order_amount    DECIMAL(10,2),
    valid_from          DATE,
    valid_to            DATE,
    is_active           BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_offer_restaurant FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- sample data ----
INSERT INTO Categories (category_name, category_type, description) VALUES
('Italian',    'CUISINE', 'Pizza, pasta and Italian classics'),
('Indian',     'CUISINE', 'North and South Indian cuisine'),
('Chinese',    'CUISINE', 'Chinese and Indo-Chinese dishes'),
('Fast Food',  'CUISINE', 'Burgers, fries and quick bites'),
('Appetizer',  'MENU_ITEM', 'Starters and small plates'),
('Main Course','MENU_ITEM', 'Primary dishes'),
('Dessert',    'MENU_ITEM', 'Sweets and desserts'),
('Beverage',   'MENU_ITEM', 'Drinks, both hot and cold');

INSERT INTO Restaurants (category_id, name, description, phone, email, price_range, average_rating, total_ratings) VALUES
(1, 'Bella Italia',      'Authentic wood-fired pizza and handmade pasta', '9800000001', 'contact@bellaitalia.example', '$$', 4.5, 120),
(2, 'Spice Route',       'Traditional Indian curries and tandoori grills', '9800000002', 'contact@spiceroute.example', '$$', 4.3, 98),
(3, 'Golden Dragon',     'Indo-Chinese favourites and noodle bowls',       '9800000003', 'contact@goldendragon.example', '$', 4.1, 76),
(4, 'Burger Junction',   'Classic American burgers and crispy fries',      '9800000004', 'contact@burgerjunction.example', '$', 4.0, 150);

INSERT INTO Restaurant_Address (restaurant_id, address_line1, city, state, postal_code, country, latitude, longitude) VALUES
(1, '12 MG Road',     'Bengaluru', 'Karnataka',   '560001', 'India', 12.975900, 77.605900),
(2, '45 Park Street',  'Kolkata',   'West Bengal', '700016', 'India', 22.552600, 88.352900),
(3, '78 Anna Salai',   'Chennai',   'Tamil Nadu',  '600002', 'India', 13.060000, 80.264400),
(4, '23 Sector 15',    'Gurugram',  'Haryana',     '122001', 'India', 28.459500, 77.026600);

INSERT INTO Menu_Items (restaurant_id, category_id, name, description, price, is_vegetarian) VALUES
(1, 6, 'Margherita Pizza',  'Classic tomato, mozzarella and basil',         450.00, TRUE),
(1, 6, 'Chicken Alfredo',   'Creamy alfredo pasta with grilled chicken',    520.00, FALSE),
(1, 7, 'Tiramisu',          'Coffee-soaked ladyfingers with mascarpone',    250.00, TRUE),
(2, 6, 'Butter Chicken',    'Chicken in a rich tomato-butter gravy',        420.00, FALSE),
(2, 6, 'Paneer Tikka Masala','Grilled paneer in a spiced curry',            380.00, TRUE),
(2, 8, 'Masala Chai',       'Spiced Indian tea',                             60.00, TRUE),
(3, 6, 'Kung Pao Chicken',  'Wok-tossed chicken with peanuts and chilies',  360.00, FALSE),
(3, 5, 'Spring Rolls',      'Crispy vegetable spring rolls',                180.00, TRUE),
(4, 6, 'Classic Cheeseburger','Beef patty, cheddar, lettuce, tomato',       220.00, FALSE),
(4, 6, 'Veggie Burger',     'Grilled vegetable patty with special sauce',   200.00, TRUE);

INSERT INTO Menu_Item_Images (menu_item_id, image_url, is_primary) VALUES
(1, '/images/menu/margherita.jpg', TRUE),
(4, '/images/menu/butter-chicken.jpg', TRUE),
(7, '/images/menu/kung-pao.jpg', TRUE),
(9, '/images/menu/cheeseburger.jpg', TRUE);

INSERT INTO Restaurant_Hours (restaurant_id, day_of_week, open_time, close_time) VALUES
(1, 1, '11:00:00', '23:00:00'), (1, 2, '11:00:00', '23:00:00'),
(2, 1, '10:00:00', '22:30:00'), (2, 2, '10:00:00', '22:30:00'),
(3, 1, '11:30:00', '22:00:00'), (3, 2, '11:30:00', '22:00:00'),
(4, 1, '09:00:00', '23:59:00'), (4, 2, '09:00:00', '23:59:00');

INSERT INTO Restaurant_Ratings (restaurant_id, customer_id, rating, review_text) VALUES
(1, 1, 5, 'Best pizza in town!'),
(2, 2, 4, 'Great flavours, quick delivery'),
(3, 1, 4, 'Loved the spring rolls'),
(4, 3, 3, 'Good but a bit pricey');

INSERT INTO Restaurant_Offers (restaurant_id, title, description, discount_percent, min_order_amount, valid_from, valid_to) VALUES
(1, '20% Off Weekdays',   'Get 20% off on orders above 500', 20.00, 500.00, '2026-01-01', '2026-12-31'),
(2, 'Flat 100 Off',       'Flat 100 off on orders above 400', NULL, 400.00, '2026-01-01', '2026-12-31'),
(4, 'Combo Deal 15% Off', '15% off on combo meals',           15.00, 300.00, '2026-01-01', '2026-12-31');
