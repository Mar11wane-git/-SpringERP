-- Sales orders, invoices and payments. Monetary amounts are DECIMAL(19,2);
-- invoices snapshot their lines and billing details so they never change
-- when products or customers are edited later.

CREATE TABLE sales_orders (
    id             BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_number   VARCHAR(30)   NOT NULL,
    customer_id    BIGINT        NOT NULL,
    status         VARCHAR(20)   NOT NULL,
    order_date     DATE          NOT NULL,
    notes          VARCHAR(1000),
    currency       VARCHAR(3)    NOT NULL,
    subtotal       DECIMAL(19,2) NOT NULL,
    discount_total DECIMAL(19,2) NOT NULL,
    tax_total      DECIMAL(19,2) NOT NULL,
    total          DECIMAL(19,2) NOT NULL,
    confirmed_at   DATETIME(6),
    completed_at   DATETIME(6),
    cancelled_at   DATETIME(6),
    created_by     VARCHAR(150),
    created_at     DATETIME(6)   NOT NULL,
    updated_at     DATETIME(6)   NOT NULL,
    version        BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT uk_sales_orders_number UNIQUE (order_number),
    CONSTRAINT fk_sales_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
);
CREATE INDEX idx_sales_orders_customer ON sales_orders (customer_id);
CREATE INDEX idx_sales_orders_status ON sales_orders (status, order_date);

CREATE TABLE sales_order_lines (
    id               BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id         BIGINT        NOT NULL,
    line_no          INT           NOT NULL,
    product_id       BIGINT        NOT NULL,
    description      VARCHAR(255)  NOT NULL,
    quantity         INT           NOT NULL,
    unit_price       DECIMAL(19,2) NOT NULL,
    discount_percent DECIMAL(5,2)  NOT NULL,
    tax_rate         DECIMAL(5,2)  NOT NULL,
    line_subtotal    DECIMAL(19,2) NOT NULL,
    line_tax         DECIMAL(19,2) NOT NULL,
    line_total       DECIMAL(19,2) NOT NULL,
    CONSTRAINT ck_order_lines_quantity CHECK (quantity > 0),
    CONSTRAINT ck_order_lines_discount CHECK (discount_percent BETWEEN 0 AND 100),
    CONSTRAINT uk_order_lines_no UNIQUE (order_id, line_no),
    CONSTRAINT fk_order_lines_order FOREIGN KEY (order_id) REFERENCES sales_orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_order_lines_product FOREIGN KEY (product_id) REFERENCES products (id)
);
CREATE INDEX idx_order_lines_product ON sales_order_lines (product_id);

ALTER TABLE stock_movements
    ADD CONSTRAINT fk_stock_movements_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders (id);

CREATE TABLE invoices (
    id              BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    invoice_number  VARCHAR(30)   NOT NULL,
    sales_order_id  BIGINT        NOT NULL,
    customer_id     BIGINT        NOT NULL,
    bill_to_name    VARCHAR(150)  NOT NULL,
    bill_to_address VARCHAR(500),
    status          VARCHAR(20)   NOT NULL,
    issue_date      DATE          NOT NULL,
    due_date        DATE          NOT NULL,
    currency        VARCHAR(3)    NOT NULL,
    subtotal        DECIMAL(19,2) NOT NULL,
    discount_total  DECIMAL(19,2) NOT NULL,
    tax_total       DECIMAL(19,2) NOT NULL,
    total           DECIMAL(19,2) NOT NULL,
    amount_paid     DECIMAL(19,2) NOT NULL,
    notes           VARCHAR(1000),
    cancelled_at    DATETIME(6),
    created_at      DATETIME(6)   NOT NULL,
    updated_at      DATETIME(6)   NOT NULL,
    version         BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT uk_invoices_number UNIQUE (invoice_number),
    CONSTRAINT ck_invoices_dates CHECK (due_date >= issue_date),
    CONSTRAINT ck_invoices_paid CHECK (amount_paid >= 0 AND amount_paid <= total),
    CONSTRAINT fk_invoices_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders (id),
    CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
);
-- One non-cancelled invoice per order is enforced by InvoiceService under a row lock on the order,
-- so an order can be re-invoiced after its invoice was cancelled.
CREATE INDEX idx_invoices_order ON invoices (sales_order_id);
CREATE INDEX idx_invoices_status_due ON invoices (status, due_date);
CREATE INDEX idx_invoices_customer ON invoices (customer_id);
CREATE INDEX idx_invoices_issue_date ON invoices (issue_date);

CREATE TABLE invoice_lines (
    id               BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    invoice_id       BIGINT        NOT NULL,
    line_no          INT           NOT NULL,
    product_id       BIGINT,
    description      VARCHAR(255)  NOT NULL,
    quantity         INT           NOT NULL,
    unit_price       DECIMAL(19,2) NOT NULL,
    discount_percent DECIMAL(5,2)  NOT NULL,
    tax_rate         DECIMAL(5,2)  NOT NULL,
    line_subtotal    DECIMAL(19,2) NOT NULL,
    line_tax         DECIMAL(19,2) NOT NULL,
    line_total       DECIMAL(19,2) NOT NULL,
    CONSTRAINT uk_invoice_lines_no UNIQUE (invoice_id, line_no),
    CONSTRAINT fk_invoice_lines_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
    CONSTRAINT fk_invoice_lines_product FOREIGN KEY (product_id) REFERENCES products (id)
);

-- Payments are recorded manually by accounting staff; no payment provider is integrated.
CREATE TABLE payments (
    id           BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    invoice_id   BIGINT        NOT NULL,
    payment_date DATE          NOT NULL,
    amount       DECIMAL(19,2) NOT NULL,
    method       VARCHAR(20)   NOT NULL,
    reference    VARCHAR(100),
    note         VARCHAR(255),
    recorded_by  VARCHAR(150),
    created_at   DATETIME(6)   NOT NULL,
    CONSTRAINT ck_payments_amount CHECK (amount > 0),
    CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id)
);
CREATE INDEX idx_payments_invoice ON payments (invoice_id);
CREATE INDEX idx_payments_date ON payments (payment_date);
