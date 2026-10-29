-- Core platform tables: company settings, users and authentication,
-- audit trail, notifications and document numbering.
-- All timestamps are stored in UTC (DATETIME(6)); business dates use DATE.

CREATE TABLE company_settings (
    id                          BIGINT       NOT NULL PRIMARY KEY,
    name                        VARCHAR(150) NOT NULL,
    legal_name                  VARCHAR(200),
    tax_id                      VARCHAR(50),
    email                       VARCHAR(150),
    phone                       VARCHAR(40),
    address_line                VARCHAR(200),
    city                        VARCHAR(100),
    postal_code                 VARCHAR(20),
    country                     VARCHAR(100),
    currency                    VARCHAR(3)   NOT NULL,
    timezone                    VARCHAR(60)  NOT NULL,
    default_tax_rate            DECIMAL(5,2) NOT NULL,
    payment_terms_days          INT          NOT NULL,
    invoice_footer              VARCHAR(500),
    updated_at                  DATETIME(6)  NOT NULL,
    version                     BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT ck_company_singleton CHECK (id = 1),
    CONSTRAINT ck_company_terms CHECK (payment_terms_days BETWEEN 0 AND 365)
);

INSERT INTO company_settings (id, name, currency, timezone, default_tax_rate, payment_terms_days, updated_at, version)
VALUES (1, 'My Company', 'EUR', 'UTC', 20.00, 30, CURRENT_TIMESTAMP(6), 0);

CREATE TABLE users (
    id                    BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email                 VARCHAR(150) NOT NULL,
    full_name             VARCHAR(150) NOT NULL,
    password_hash         VARCHAR(100) NOT NULL,
    role                  VARCHAR(30)  NOT NULL,
    active                BOOLEAN      NOT NULL,
    must_change_password  BOOLEAN      NOT NULL,
    failed_login_attempts INT          NOT NULL DEFAULT 0,
    locked_until          DATETIME(6),
    last_login_at         DATETIME(6),
    password_changed_at   DATETIME(6),
    created_at            DATETIME(6)  NOT NULL,
    updated_at            DATETIME(6)  NOT NULL,
    version               BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE TABLE refresh_tokens (
    id           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT       NOT NULL,
    token_hash   VARCHAR(64)  NOT NULL,
    family_id    VARCHAR(36)  NOT NULL,
    expires_at   DATETIME(6)  NOT NULL,
    revoked_at   DATETIME(6),
    created_at   DATETIME(6)  NOT NULL,
    created_ip   VARCHAR(45),
    user_agent   VARCHAR(255),
    CONSTRAINT uk_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);

-- Append-only. actor_id deliberately has no foreign key so history survives user changes.
CREATE TABLE audit_events (
    id             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    occurred_at    DATETIME(6)  NOT NULL,
    actor_id       BIGINT,
    actor_email    VARCHAR(150),
    action         VARCHAR(60)  NOT NULL,
    entity_type    VARCHAR(60),
    entity_id      VARCHAR(60),
    summary        VARCHAR(500) NOT NULL,
    ip_address     VARCHAR(45),
    correlation_id VARCHAR(64)
);
CREATE INDEX idx_audit_events_occurred ON audit_events (occurred_at);
CREATE INDEX idx_audit_events_action ON audit_events (action);
CREATE INDEX idx_audit_events_entity ON audit_events (entity_type, entity_id);
CREATE INDEX idx_audit_events_actor ON audit_events (actor_id);

CREATE TABLE notifications (
    id           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    recipient_id BIGINT       NOT NULL,
    type         VARCHAR(40)  NOT NULL,
    title        VARCHAR(150) NOT NULL,
    message      VARCHAR(500) NOT NULL,
    link         VARCHAR(255),
    created_at   DATETIME(6)  NOT NULL,
    read_at      DATETIME(6),
    CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_notifications_recipient ON notifications (recipient_id, read_at, created_at);

-- Gap-free business numbering (INV-2026-00001 ...), one row per prefix and year.
CREATE TABLE document_sequences (
    sequence_key VARCHAR(40) NOT NULL PRIMARY KEY,
    next_value   BIGINT      NOT NULL
);
