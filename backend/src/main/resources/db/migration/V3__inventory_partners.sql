-- Business partners (customers, suppliers) and inventory.

CREATE TABLE customers (
    id           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code         VARCHAR(20)   NOT NULL,
    name         VARCHAR(150)  NOT NULL,
    contact_name VARCHAR(150),
    email        VARCHAR(150),
    phone        VARCHAR(40),
    tax_id       VARCHAR(50),
    address_line VARCHAR(200),
    city         VARCHAR(100),
    postal_code  VARCHAR(20),
    country      VARCHAR(100),
    notes        VARCHAR(1000),
    active       BOOLEAN       NOT NULL,
    created_at   DATETIME(6)   NOT NULL,
    updated_at   DATETIME(6)   NOT NULL,
    version      BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT uk_customers_code UNIQUE (code),
    CONSTRAINT uk_customers_email UNIQUE (email),
    CONSTRAINT uk_customers_tax_id UNIQUE (tax_id)
);
CREATE INDEX idx_customers_name ON customers (name);

CREATE TABLE suppliers (
    id           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code         VARCHAR(20)   NOT NULL,
    name         VARCHAR(150)  NOT NULL,
    contact_name VARCHAR(150),
    email        VARCHAR(150),
    phone        VARCHAR(40),
    tax_id       VARCHAR(50),
    address_line VARCHAR(200),
    city         VARCHAR(100),
    postal_code  VARCHAR(20),
    country      VARCHAR(100),
    notes        VARCHAR(1000),
    active       BOOLEAN       NOT NULL,
    created_at   DATETIME(6)   NOT NULL,
    updated_at   DATETIME(6)   NOT NULL,
    version      BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT uk_suppliers_code UNIQUE (code),
    CONSTRAINT uk_suppliers_email UNIQUE (email),
    CONSTRAINT uk_suppliers_tax_id UNIQUE (tax_id)
);
CREATE INDEX idx_suppliers_name ON suppliers (name);

CREATE TABLE categories (
    id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    created_at  DATETIME(6)  NOT NULL,
    updated_at  DATETIME(6)  NOT NULL,
    version     BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uk_categories_name UNIQUE (name)
);

CREATE TABLE products (
    id               BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sku              VARCHAR(40)   NOT NULL,
    name             VARCHAR(150)  NOT NULL,
    description      VARCHAR(1000),
    category_id      BIGINT,
    supplier_id      BIGINT,
    unit             VARCHAR(20)   NOT NULL,
    unit_price       DECIMAL(19,2) NOT NULL,
    cost_price       DECIMAL(19,2) NOT NULL,
    tax_rate         DECIMAL(5,2)  NOT NULL,
    quantity_on_hand INT           NOT NULL DEFAULT 0,
    reorder_level    INT           NOT NULL DEFAULT 0,
    active           BOOLEAN       NOT NULL,
    created_at       DATETIME(6)   NOT NULL,
    updated_at       DATETIME(6)   NOT NULL,
    version          BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT uk_products_sku UNIQUE (sku),
    CONSTRAINT ck_products_quantity CHECK (quantity_on_hand >= 0),
    CONSTRAINT ck_products_prices CHECK (unit_price >= 0 AND cost_price >= 0),
    CONSTRAINT ck_products_reorder CHECK (reorder_level >= 0),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id),
    CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
);
CREATE INDEX idx_products_name ON products (name);
CREATE INDEX idx_products_stock ON products (active, quantity_on_hand);

-- Ledger of every stock change. quantity is a signed delta; quantity_after is the
-- resulting on-hand quantity, so the history can be audited without recomputation.
CREATE TABLE stock_movements (
    id             BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product_id     BIGINT        NOT NULL,
    movement_type  VARCHAR(20)   NOT NULL,
    quantity       INT           NOT NULL,
    quantity_after INT           NOT NULL,
    unit_cost      DECIMAL(19,2),
    supplier_id    BIGINT,
    sales_order_id BIGINT,
    reference      VARCHAR(60),
    note           VARCHAR(255),
    created_at     DATETIME(6)   NOT NULL,
    created_by     VARCHAR(150),
    CONSTRAINT ck_stock_movements_nonzero CHECK (quantity <> 0),
    CONSTRAINT fk_stock_movements_product FOREIGN KEY (product_id) REFERENCES products (id),
    CONSTRAINT fk_stock_movements_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
);
CREATE INDEX idx_stock_movements_product ON stock_movements (product_id, created_at);
CREATE INDEX idx_stock_movements_type ON stock_movements (movement_type, created_at);
