<?php
declare(strict_types=1);

class AuthController
{
    public function __construct(private PDO $db) {}

    public function config(): void
    {
        $cfg = require __DIR__ . '/../config/config.php';
        Response::success([
            'allow_public_registration' => (bool) ($cfg['allow_public_registration'] ?? false),
        ]);
    }

    public function me(int $userId): void
    {
        $stmt = $this->db->prepare(
            'SELECT id, name, email, role FROM users WHERE id = ? AND is_active = 1'
        );
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user) Response::error('Usuario no encontrado', 404);

        Response::success([
            'id'    => (int) $user['id'],
            'name'  => $user['name'],
            'email' => $user['email'],
            'role'  => $user['role'] ?? 'user',
        ]);
    }

    public function register(): void
    {
        $cfg = require __DIR__ . '/../config/config.php';
        if (!($cfg['allow_public_registration'] ?? false)) {
            Response::error('El registro público está deshabilitado', 403);
        }

        $body  = json_decode(file_get_contents('php://input'), true) ?? [];
        $name  = trim($body['name']  ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $pass  = $body['password'] ?? '';

        $errors = $this->validateCredentials($name, $email, $pass);
        if (!empty($errors)) Response::error('Datos inválidos', 422, $errors);

        $stmt = $this->db->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) Response::error('Email ya registrado', 409);

        $userId = $this->createUser($name, $email, $pass, 'user');
        $token  = $this->tokenFor($userId, $name, $email, 'user');

        Response::success([
            'token' => $token,
            'user'  => ['id' => $userId, 'name' => $name, 'email' => $email, 'role' => 'user'],
        ], 201);
    }

    public function login(): void
    {
        $body  = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = strtolower(trim($body['email']    ?? ''));
        $pass  = $body['password'] ?? '';

        if (empty($email) || empty($pass)) Response::error('Email y contraseña requeridos', 422);

        $stmt = $this->db->prepare(
            'SELECT id, name, email, password_hash, role FROM users WHERE email = ? AND is_active = 1'
        );
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($pass, $user['password_hash'])) {
            Response::error('Credenciales incorrectas', 401);
        }

        $token = $this->tokenFor(
            (int) $user['id'],
            $user['name'],
            $user['email'],
            $user['role'] ?? 'user',
        );

        Response::success([
            'token' => $token,
            'user'  => [
                'id'    => (int) $user['id'],
                'name'  => $user['name'],
                'email' => $user['email'],
                'role'  => $user['role'] ?? 'user',
            ],
        ]);
    }

    public function updateProfile(int $userId): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $stmt = $this->db->prepare(
            'SELECT id, name, email, password_hash, role FROM users WHERE id = ? AND is_active = 1'
        );
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user) Response::error('Usuario no encontrado', 404);

        $currentPass = $body['current_password'] ?? '';
        $newPass     = $body['new_password'] ?? '';
        $newEmail    = isset($body['email'])
            ? strtolower(trim($body['email']))
            : $user['email'];

        if (!password_verify($currentPass, $user['password_hash'])) {
            Response::error('Contraseña actual incorrecta', 422, [
                'current_password' => 'Contraseña actual incorrecta',
            ]);
        }

        $errors = [];
        if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Email inválido';
        }
        if (strlen($newPass) < 12) {
            $errors['new_password'] = 'La nueva contraseña debe tener mínimo 12 caracteres';
        }
        if (!empty($errors)) Response::error('Datos inválidos', 422, $errors);

        if ($newEmail !== $user['email']) {
            $stmt = $this->db->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
            $stmt->execute([$newEmail, $userId]);
            if ($stmt->fetch()) Response::error('Email ya registrado', 409);
        }

        $hash = password_hash($newPass, PASSWORD_ARGON2ID);
        $stmt = $this->db->prepare(
            'UPDATE users SET email = ?, password_hash = ? WHERE id = ?'
        );
        $stmt->execute([$newEmail, $hash, $userId]);

        $token = $this->tokenFor(
            $userId,
            $user['name'],
            $newEmail,
            $user['role'] ?? 'user',
        );

        Response::success([
            'token' => $token,
            'user'  => [
                'id'    => $userId,
                'name'  => $user['name'],
                'email' => $newEmail,
                'role'  => $user['role'] ?? 'user',
            ],
        ]);
    }

    private function createUser(string $name, string $email, string $pass, string $role): int
    {
        $hash = password_hash($pass, PASSWORD_ARGON2ID);
        $stmt = $this->db->prepare(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$name, $email, $hash, $role]);
        $userId = (int) $this->db->lastInsertId();

        $this->db->exec("CALL seed_default_categories($userId)");

        $stmt = $this->db->prepare(
            'INSERT INTO exchange_rates (user_id, rate, notes) VALUES (?, 60.0000, ?)'
        );
        $stmt->execute([$userId, 'Tasa inicial']);

        return $userId;
    }

    private function tokenFor(int $id, string $name, string $email, string $role): string
    {
        return JWT::generate([
            'sub'   => $id,
            'name'  => $name,
            'email' => $email,
            'role'  => $role,
        ]);
    }

    private function validateCredentials(string $name, string $email, string $pass): array
    {
        $errors = [];
        if (empty($name)) $errors['name'] = 'El nombre es requerido';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Email inválido';
        if (strlen($pass) < 12) $errors['password'] = 'Mínimo 12 caracteres';
        return $errors;
    }
}
