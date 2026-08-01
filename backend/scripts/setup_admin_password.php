<?php
/**
 * Set admin password on the server (never commit passwords to git).
 *
 * Usage on Hostinger:
 *   cd ~/domains/joseroblesm.com/public_html/api
 *   php scripts/setup_admin_password.php 'YourStrongPasswordHere'
 */
declare(strict_types=1);

if ($argc < 2) {
    fwrite(STDERR, "Usage: php scripts/setup_admin_password.php 'YourPassword'\n");
    exit(1);
}

$password = $argv[1];
$email    = $argv[2] ?? 'roblesdev07@gmail.com';

if (strlen($password) < 12) {
    fwrite(STDERR, "Password must be at least 12 characters.\n");
    exit(1);
}

require_once __DIR__ . '/../config/Database.php';

$db   = Database::getConnection();
$hash = password_hash($password, PASSWORD_ARGON2ID);

$stmt = $db->prepare('UPDATE users SET password_hash = ? WHERE email = ? AND role = ?');
$stmt->execute([$hash, $email, 'admin']);

if ($stmt->rowCount() === 0) {
    fwrite(STDERR, "No admin user found for email: $email\n");
    exit(1);
}

echo "Password updated for $email\n";
