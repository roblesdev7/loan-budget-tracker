-- Promote your account to admin and update email
-- Run AFTER 006_user_roles.sql
-- Password is set separately (see setup_admin_password.php)

UPDATE users
SET role = 'admin',
    email = 'roblesdev07@gmail.com'
WHERE email IN ('jose@test.com', 'roblesdev07@gmail.com');
