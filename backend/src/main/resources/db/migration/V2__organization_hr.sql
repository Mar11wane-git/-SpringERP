-- Organization structure and human resources.

CREATE TABLE departments (
    id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(20)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    parent_id   BIGINT,
    manager_id  BIGINT,
    active      BOOLEAN      NOT NULL,
    created_at  DATETIME(6)  NOT NULL,
    updated_at  DATETIME(6)  NOT NULL,
    version     BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uk_departments_code UNIQUE (code),
    CONSTRAINT uk_departments_name UNIQUE (name),
    CONSTRAINT fk_departments_parent FOREIGN KEY (parent_id) REFERENCES departments (id)
);

CREATE TABLE employees (
    id                BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    employee_number   VARCHAR(20)  NOT NULL,
    first_name        VARCHAR(80)  NOT NULL,
    last_name         VARCHAR(80)  NOT NULL,
    email             VARCHAR(150) NOT NULL,
    phone             VARCHAR(40),
    job_title         VARCHAR(100) NOT NULL,
    department_id     BIGINT,
    manager_id        BIGINT,
    user_id           BIGINT,
    employment_type   VARCHAR(20)  NOT NULL,
    status            VARCHAR(20)  NOT NULL,
    hire_date         DATE         NOT NULL,
    contract_end_date DATE,
    termination_date  DATE,
    created_at        DATETIME(6)  NOT NULL,
    updated_at        DATETIME(6)  NOT NULL,
    version           BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uk_employees_number UNIQUE (employee_number),
    CONSTRAINT uk_employees_email UNIQUE (email),
    CONSTRAINT uk_employees_user UNIQUE (user_id),
    CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments (id),
    CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id) REFERENCES employees (id),
    CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE INDEX idx_employees_last_name ON employees (last_name, first_name);
CREATE INDEX idx_employees_status ON employees (status);

ALTER TABLE departments
    ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id) REFERENCES employees (id);

CREATE TABLE employee_status_history (
    id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    employee_id BIGINT       NOT NULL,
    from_status VARCHAR(20),
    to_status   VARCHAR(20)  NOT NULL,
    changed_at  DATETIME(6)  NOT NULL,
    changed_by  VARCHAR(150),
    note        VARCHAR(255),
    CONSTRAINT fk_status_history_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
);
CREATE INDEX idx_status_history_employee ON employee_status_history (employee_id, changed_at);

CREATE TABLE leave_requests (
    id             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    employee_id    BIGINT       NOT NULL,
    leave_type     VARCHAR(20)  NOT NULL,
    start_date     DATE         NOT NULL,
    end_date       DATE         NOT NULL,
    working_days   INT          NOT NULL,
    reason         VARCHAR(500),
    status         VARCHAR(20)  NOT NULL,
    requested_by   BIGINT,
    decided_by     BIGINT,
    decided_at     DATETIME(6),
    decision_note  VARCHAR(500),
    created_at     DATETIME(6)  NOT NULL,
    updated_at     DATETIME(6)  NOT NULL,
    version        BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT ck_leave_dates CHECK (end_date >= start_date),
    CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_leave_requested_by FOREIGN KEY (requested_by) REFERENCES users (id),
    CONSTRAINT fk_leave_decided_by FOREIGN KEY (decided_by) REFERENCES users (id)
);
CREATE INDEX idx_leave_employee_status ON leave_requests (employee_id, status);
CREATE INDEX idx_leave_status ON leave_requests (status, start_date);

CREATE TABLE employee_documents (
    id                BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    employee_id       BIGINT       NOT NULL,
    category          VARCHAR(30)  NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename   VARCHAR(64)  NOT NULL,
    content_type      VARCHAR(100) NOT NULL,
    size_bytes        BIGINT       NOT NULL,
    uploaded_by       VARCHAR(150),
    uploaded_at       DATETIME(6)  NOT NULL,
    CONSTRAINT uk_employee_documents_stored UNIQUE (stored_filename),
    CONSTRAINT fk_employee_documents_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
);
CREATE INDEX idx_employee_documents_employee ON employee_documents (employee_id);
