-- Admin role for user management
-- Run once: mysql -u USER -p DB_NAME < 006_user_roles.sql

ALTER TABLE users
    ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER password_hash;
