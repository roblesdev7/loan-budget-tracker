<?php
declare(strict_types=1);

// Load .env file for local development (Hostinger: set vars via control panel instead)
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$key, $val] = array_map('trim', explode('=', $line, 2));
        if (!getenv($key)) {
            putenv("$key=$val");
            $_ENV[$key] = $val;
        }
    }
}

return [
    'jwt_secret' => $_ENV['JWT_SECRET'] ?? 'change-this-in-production-minimum-32-chars',
    'jwt_expiry'  => 86400, // 24 hours
    'db' => [
        'host'    => $_ENV['DB_HOST']  ?? 'localhost',
        'port'    => $_ENV['DB_PORT']  ?? '3306',
        'name'    => $_ENV['DB_NAME']  ?? 'loan_budget',
        'user'    => $_ENV['DB_USER']  ?? 'root',
        'pass'    => $_ENV['DB_PASS']  ?? '',
        'charset' => 'utf8mb4',
    ],
    'allowed_origins' => explode(',', $_ENV['ALLOWED_ORIGINS'] ?? 'http://localhost:5173'),
    'allow_public_registration' => filter_var(
        $_ENV['ALLOW_PUBLIC_REGISTRATION'] ?? 'false',
        FILTER_VALIDATE_BOOLEAN
    ),
];
