-- Migration: add 'recurring' expense category type + seed categories for existing users
-- Run once on production: mysql -u USER -p DB_NAME < 001_recurring_categories.sql

ALTER TABLE expense_categories
    MODIFY category_type ENUM('daily', 'recurring', 'debt_related') NOT NULL DEFAULT 'daily';

-- Recreate seed procedure with recurring categories
DROP PROCEDURE IF EXISTS seed_default_categories;

DELIMITER $$

CREATE PROCEDURE seed_default_categories(IN p_user_id INT UNSIGNED)
BEGIN
    INSERT INTO income_categories (user_id, name) VALUES
        (p_user_id, 'Salario'),
        (p_user_id, 'Freelance'),
        (p_user_id, 'Negocio'),
        (p_user_id, 'Inversión'),
        (p_user_id, 'Otro');

    INSERT INTO expense_categories (user_id, name, category_type) VALUES
        (p_user_id, 'Vivienda',        'daily'),
        (p_user_id, 'Vehículo',        'daily'),
        (p_user_id, 'Electricidad',    'daily'),
        (p_user_id, 'Médico',          'daily'),
        (p_user_id, 'Dependientes',    'daily'),
        (p_user_id, 'Alimentación',    'daily'),
        (p_user_id, 'Otro gasto',      'daily');

    INSERT INTO expense_categories (user_id, name, category_type) VALUES
        (p_user_id, 'Suscripciones',   'recurring'),
        (p_user_id, 'Internet',        'recurring'),
        (p_user_id, 'Teléfono',        'recurring'),
        (p_user_id, 'Seguros',         'recurring'),
        (p_user_id, 'Servicios fijos', 'recurring');

    INSERT INTO expense_categories (user_id, name, category_type) VALUES
        (p_user_id, 'Cuota préstamo',  'debt_related'),
        (p_user_id, 'Abono capital',   'debt_related'),
        (p_user_id, 'Pago tarjeta',    'debt_related');
END$$

DELIMITER ;

-- Seed recurring categories for existing users (skip duplicates)
INSERT INTO expense_categories (user_id, name, category_type)
SELECT u.id, cat.name, 'recurring'
FROM users u
CROSS JOIN (
    SELECT 'Suscripciones'   AS name UNION ALL
    SELECT 'Internet'        UNION ALL
    SELECT 'Teléfono'          UNION ALL
    SELECT 'Seguros'           UNION ALL
    SELECT 'Servicios fijos'
) cat
WHERE NOT EXISTS (
    SELECT 1 FROM expense_categories ec
    WHERE ec.user_id = u.id AND ec.name = cat.name
);
