-- Support monthly and yearly recurring bills (domains, hosting, etc.)
-- Run once: mysql -u USER -p DB_NAME < 004_billing_frequency.sql

ALTER TABLE recurring_bills
    ADD COLUMN billing_frequency ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly' AFTER due_day,
    ADD COLUMN due_month TINYINT UNSIGNED NULL COMMENT '1-12, required when billing_frequency = yearly' AFTER billing_frequency,
    ADD CONSTRAINT chk_rb_due_month CHECK (due_month IS NULL OR due_month BETWEEN 1 AND 12);
