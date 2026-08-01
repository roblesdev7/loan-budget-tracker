-- ============================================================
-- LOAN & BUDGET TRACKER — Complete Database Schema
-- Dialect  : MySQL 8.0+ (Hostinger compatible)
-- Strategy : Three-Column Ledger for all monetary entries
-- Base Currency : DOP  (Dominican Peso)
-- ============================================================


-- ============================================================
-- 1. USERS
--    Multi-user support with secure password hashing.
-- ============================================================
CREATE TABLE users (
    id            INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)     NOT NULL,
    email         VARCHAR(150)     NOT NULL UNIQUE,
    password_hash VARCHAR(255)     NOT NULL,        -- bcrypt / argon2 hash only, never plaintext
    role          ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    is_active     TINYINT(1)       NOT NULL DEFAULT 1,
    created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- ============================================================
-- 2. EXCHANGE RATES (USD → DOP history)
--    Full history kept. The most recent record per user is the
--    "sticky" default auto-populated on new entry forms.
-- ============================================================
CREATE TABLE exchange_rates (
    id          INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED   NOT NULL,
    rate        DECIMAL(10,4)  NOT NULL COMMENT 'DOP per 1 USD  (e.g. 60.5000)',
    recorded_at TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes       VARCHAR(255),

    CONSTRAINT fk_er_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_er_user_date (user_id, recorded_at)   -- fast lookup for "latest rate"
);


-- ============================================================
-- 3. INCOME CATEGORIES  (user-configurable)
--    Seeds: Salary, Freelance, Business, Investment, Other
-- ============================================================
CREATE TABLE income_categories (
    id         INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED  NOT NULL,
    name       VARCHAR(100)  NOT NULL,
    is_active  TINYINT(1)    NOT NULL DEFAULT 1,
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ic_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY  uq_ic_user_name (user_id, name)
);


-- ============================================================
-- 4. EXPENSE CATEGORIES  (user-configurable, typed)
--    category_type separates daily spending from debt-related
--    payments so the dashboard can split the balance formula.
--    Seeds (daily): House, Vehicle, Electricity, Medical, Dependents, Food, Other
--    Seeds (debt_related): Installment, Principal Reduction, Credit Card Payment
-- ============================================================
CREATE TABLE expense_categories (
    id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    user_id       INT UNSIGNED  NOT NULL,
    name          VARCHAR(100)  NOT NULL,
    category_type ENUM('daily', 'recurring', 'debt_related') NOT NULL DEFAULT 'daily',
    is_active     TINYINT(1)    NOT NULL DEFAULT 1,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ec_user   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY  uq_ec_user_name (user_id, name)
);


-- ============================================================
-- 5. DEBTS
--    Single table, discriminated by debt_type.
--    Formal fields (institution, credit_limit, etc.) are NULL
--    for informal debts, and vice-versa.
--
--    THREE-COLUMN LEDGER on the original principal:
--      original_amount  → what was borrowed
--      currency         → DOP or USD
--      exchange_rate    → rate at time of entry (1.0 for DOP)
--      base_amount_dop  → original_amount * exchange_rate (computed on entry)
--
--    Running balance (decremented by each payment):
--      current_balance     → in original currency
--      current_balance_dop → current_balance * exchange_rate of last payment
-- ============================================================
CREATE TABLE debts (
    id                  INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED  NOT NULL,

    -- Discriminator
    debt_type           ENUM(
                            'credit_card',
                            'bank_loan_personal',
                            'bank_loan_vehicle',
                            'bank_loan_mortgage',
                            'informal'
                        ) NOT NULL,

    name                VARCHAR(150)  NOT NULL COMMENT 'Display name, e.g. "VISA BHD León", "Préstamo José"',

    -- ── Formal debt fields (NULL for informal) ──────────────
    institution_name    VARCHAR(150)  COMMENT 'Bank or institution',
    account_number      VARCHAR(50)   COMMENT 'Reference / last-4 digits',
    interest_rate       DECIMAL(5,2)  COMMENT 'Annual interest rate %',
    credit_limit        DECIMAL(14,2) COMMENT 'Credit cards only: maximum credit line in original_currency',

    -- ── Informal debt fields (NULL for formal) ──────────────
    creditor_name       VARCHAR(150),
    creditor_address    TEXT,
    creditor_phone      VARCHAR(30),

    -- ── Three-Column Ledger (original principal) ────────────
    original_amount     DECIMAL(14,2) NOT NULL,
    currency            ENUM('DOP','USD') NOT NULL DEFAULT 'DOP',
    exchange_rate       DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
    base_amount_dop     DECIMAL(14,2) NOT NULL COMMENT 'Computed on entry: original_amount * exchange_rate',

    -- ── Running balance ─────────────────────────────────────
    current_balance     DECIMAL(14,2) NOT NULL COMMENT 'Remaining balance in original currency',
    current_balance_dop DECIMAL(14,2) NOT NULL COMMENT 'current_balance * exchange_rate of last payment',

    status              ENUM('active','paid_off','closed') NOT NULL DEFAULT 'active',
    start_date          DATE          NOT NULL,
    notes               TEXT,
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- ── Constraints ─────────────────────────────────────────
    CONSTRAINT fk_debt_user   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- exchange_rate must be 1.0 for DOP entries
    CONSTRAINT chk_dop_rate   CHECK (currency != 'DOP' OR exchange_rate = 1.0000),

    -- credit_limit only makes sense for credit cards
    CONSTRAINT chk_credit_limit CHECK (debt_type = 'credit_card' OR credit_limit IS NULL),

    INDEX idx_debt_user_type   (user_id, debt_type),
    INDEX idx_debt_user_status (user_id, status)
);


-- ============================================================
-- 6. INCOME
--    Three-Column Ledger. base_amount_dop is computed and
--    stored by the backend on every INSERT/UPDATE.
-- ============================================================
CREATE TABLE income (
    id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED  NOT NULL,
    category_id     INT UNSIGNED  NOT NULL,
    description     VARCHAR(255),
    income_date     DATE          NOT NULL,

    -- Three-Column Ledger
    original_amount DECIMAL(14,2) NOT NULL,
    currency        ENUM('DOP','USD') NOT NULL DEFAULT 'DOP',
    exchange_rate   DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
    base_amount_dop DECIMAL(14,2) NOT NULL COMMENT 'Computed on entry: original_amount * exchange_rate',

    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_income_user     FOREIGN KEY (user_id)     REFERENCES users(id)              ON DELETE CASCADE,
    CONSTRAINT fk_income_category FOREIGN KEY (category_id) REFERENCES income_categories(id)  ON DELETE RESTRICT,
    CONSTRAINT chk_income_dop_rate CHECK (currency != 'DOP' OR exchange_rate = 1.0000),

    INDEX idx_income_user_date (user_id, income_date)
);


-- ============================================================
-- 7. EXPENSES
--    Three-Column Ledger. expense_type drives business logic:
--
--      'daily'               → no debt linkage (debt_id NULL)
--      'debt_payment'        → reduces current_balance on linked debt
--      'principal_reduction' → explicit principal-only payment
--      'credit_card_payment' → reduces credit card balance
--
--    CHECK constraint enforces debt_id presence based on type.
-- ============================================================
CREATE TABLE expenses (
    id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED  NOT NULL,
    category_id     INT UNSIGNED  NOT NULL,

    expense_type    ENUM(
                        'daily',
                        'debt_payment',
                        'principal_reduction',
                        'credit_card_payment'
                    ) NOT NULL,

    -- Required when expense_type != 'daily'
    debt_id         INT UNSIGNED  COMMENT 'Links payment to a specific debt',

    description     VARCHAR(255),
    expense_date    DATE          NOT NULL,

    -- Three-Column Ledger
    original_amount DECIMAL(14,2) NOT NULL,
    currency        ENUM('DOP','USD') NOT NULL DEFAULT 'DOP',
    exchange_rate   DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
    base_amount_dop DECIMAL(14,2) NOT NULL COMMENT 'Computed on entry: original_amount * exchange_rate',

    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_exp_user     FOREIGN KEY (user_id)     REFERENCES users(id)               ON DELETE CASCADE,
    CONSTRAINT fk_exp_category FOREIGN KEY (category_id) REFERENCES expense_categories(id)  ON DELETE RESTRICT,
    CONSTRAINT fk_exp_debt     FOREIGN KEY (debt_id)     REFERENCES debts(id)               ON DELETE RESTRICT,

    -- Business rule: debt_id is required for all non-daily expense types
    CONSTRAINT chk_debt_linkage CHECK (
        (expense_type = 'daily' AND debt_id IS NULL) OR
        (expense_type != 'daily' AND debt_id IS NOT NULL)
    ),

    CONSTRAINT chk_exp_dop_rate CHECK (currency != 'DOP' OR exchange_rate = 1.0000),

    INDEX idx_exp_user_date (user_id, expense_date),
    INDEX idx_exp_debt      (debt_id)
);


-- ============================================================
-- 8. SEED DATA — Default categories per new user
--    These are inserted via a stored procedure called after
--    user registration (see seed_default_categories below).
-- ============================================================
DELIMITER $$

CREATE PROCEDURE seed_default_categories(IN p_user_id INT UNSIGNED)
BEGIN
    -- Income categories
    INSERT INTO income_categories (user_id, name) VALUES
        (p_user_id, 'Salario'),
        (p_user_id, 'Freelance'),
        (p_user_id, 'Negocio'),
        (p_user_id, 'Inversión'),
        (p_user_id, 'Otro');

    -- Daily expense categories
    INSERT INTO expense_categories (user_id, name, category_type) VALUES
        (p_user_id, 'Vivienda',        'daily'),
        (p_user_id, 'Vehículo',        'daily'),
        (p_user_id, 'Electricidad',    'daily'),
        (p_user_id, 'Médico',          'daily'),
        (p_user_id, 'Dependientes',    'daily'),
        (p_user_id, 'Alimentación',    'daily'),
        (p_user_id, 'Otro gasto',      'daily');

    -- Recurring fixed monthly expenses
    INSERT INTO expense_categories (user_id, name, category_type) VALUES
        (p_user_id, 'Suscripciones',   'recurring'),
        (p_user_id, 'Herramientas IA', 'recurring'),
        (p_user_id, 'Hosting',         'recurring'),
        (p_user_id, 'Dominios',        'recurring'),
        (p_user_id, 'Internet',        'recurring'),
        (p_user_id, 'Teléfono',        'recurring'),
        (p_user_id, 'Seguros',         'recurring'),
        (p_user_id, 'Servicios fijos', 'recurring');

    -- Debt-related expense categories
    INSERT INTO expense_categories (user_id, name, category_type) VALUES
        (p_user_id, 'Cuota préstamo',  'debt_related'),
        (p_user_id, 'Abono capital',   'debt_related'),
        (p_user_id, 'Pago tarjeta',    'debt_related');
END$$

DELIMITER ;


-- ============================================================
-- QUICK-REFERENCE: Available Balance Formula
-- ============================================================
-- SELECT
--     (SELECT COALESCE(SUM(base_amount_dop), 0) FROM income    WHERE user_id = ?)  AS total_income_dop,
--     (SELECT COALESCE(SUM(base_amount_dop), 0) FROM expenses  WHERE user_id = ?)  AS total_expenses_dop,
--     (
--         (SELECT COALESCE(SUM(base_amount_dop), 0) FROM income   WHERE user_id = ?) -
--         (SELECT COALESCE(SUM(base_amount_dop), 0) FROM expenses WHERE user_id = ?)
--     ) AS available_balance_dop;
