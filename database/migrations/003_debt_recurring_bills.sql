-- Link recurring bills to debts for scheduled loan/card installments
-- Run once: mysql -u USER -p DB_NAME < 003_debt_recurring_bills.sql

ALTER TABLE recurring_bills
    ADD COLUMN debt_id INT UNSIGNED NULL COMMENT 'NULL = subscription, set = debt installment' AFTER category_id,
    ADD CONSTRAINT fk_rb_debt FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE;
