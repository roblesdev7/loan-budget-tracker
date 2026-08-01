-- Phase 2-3 features: recurring bills registry + monthly budget caps
-- Run once: mysql -u USER -p DB_NAME < 002_phase_features.sql

CREATE TABLE IF NOT EXISTS recurring_bills (
    id              INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED     NOT NULL,
    category_id     INT UNSIGNED     NOT NULL,
    name            VARCHAR(150)     NOT NULL,
    original_amount DECIMAL(14,2)    NOT NULL,
    currency        ENUM('DOP','USD') NOT NULL DEFAULT 'DOP',
    exchange_rate   DECIMAL(10,4)    NOT NULL DEFAULT 1.0000,
    due_day         TINYINT UNSIGNED NOT NULL COMMENT 'Day of month 1-28',
    is_active       TINYINT(1)       NOT NULL DEFAULT 1,
    notes           VARCHAR(255),
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_rb_user     FOREIGN KEY (user_id)     REFERENCES users(id)              ON DELETE CASCADE,
    CONSTRAINT fk_rb_category FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT,
    CONSTRAINT chk_rb_due_day CHECK (due_day BETWEEN 1 AND 28),
    INDEX idx_rb_user (user_id, is_active)
);

CREATE TABLE IF NOT EXISTS category_budgets (
    id               INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    user_id          INT UNSIGNED  NOT NULL,
    category_id      INT UNSIGNED  NOT NULL,
    monthly_limit_dop DECIMAL(14,2) NOT NULL,
    is_active        TINYINT(1)    NOT NULL DEFAULT 1,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_budget_user     FOREIGN KEY (user_id)     REFERENCES users(id)              ON DELETE CASCADE,
    CONSTRAINT fk_budget_category FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE,
    UNIQUE KEY uq_budget_user_category (user_id, category_id)
);
