-- Seed recurring categories for IA tools, hosting, and domains
-- Run once: mysql -u USER -p DB_NAME < 005_extra_recurring_categories.sql

INSERT INTO expense_categories (user_id, name, category_type)
SELECT u.id, cat.name, 'recurring'
FROM users u
CROSS JOIN (
    SELECT 'Herramientas IA' AS name UNION ALL
    SELECT 'Hosting'         UNION ALL
    SELECT 'Dominios'
) cat
WHERE NOT EXISTS (
    SELECT 1 FROM expense_categories ec
    WHERE ec.user_id = u.id AND ec.name = cat.name
);
