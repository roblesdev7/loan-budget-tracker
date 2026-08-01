<?php
declare(strict_types=1);

class AdminController
{
    public function __construct(private PDO $db) {}

    public function indexUsers(int $adminId): void
    {
        $this->assertAdmin($adminId);

        $stmt = $this->db->query('
            SELECT id, name, email, role, is_active, created_at
            FROM users
            ORDER BY created_at ASC
        ');
        Response::success($stmt->fetchAll());
    }

    public function storeUser(int $adminId): void
    {
        $this->assertAdmin($adminId);

        $body  = json_decode(file_get_contents('php://input'), true) ?? [];
        $name  = trim($body['name'] ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $pass  = $body['password'] ?? '';

        $errors = [];
        if (empty($name)) $errors['name'] = 'El nombre es requerido';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Email inválido';
        if (strlen($pass) < 12) $errors['password'] = 'Mínimo 12 caracteres';
        if (!empty($errors)) Response::error('Datos inválidos', 422, $errors);

        $stmt = $this->db->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) Response::error('Email ya registrado', 409);

        $hash = password_hash($pass, PASSWORD_ARGON2ID);
        $stmt = $this->db->prepare(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$name, $email, $hash, 'user']);
        $userId = (int) $this->db->lastInsertId();

        $this->db->exec("CALL seed_default_categories($userId)");

        $stmt = $this->db->prepare(
            'INSERT INTO exchange_rates (user_id, rate, notes) VALUES (?, 60.0000, ?)'
        );
        $stmt->execute([$userId, 'Tasa inicial']);

        $stmt = $this->db->prepare("
            INSERT INTO expense_categories (user_id, name, category_type)
            SELECT ?, cat.name, 'recurring'
            FROM (
                SELECT 'Herramientas IA' AS name UNION ALL
                SELECT 'Hosting' UNION ALL
                SELECT 'Dominios'
            ) cat
            WHERE NOT EXISTS (
                SELECT 1 FROM expense_categories ec
                WHERE ec.user_id = ? AND ec.name = cat.name
            )
        ");
        $stmt->execute([$userId, $userId]);

        Response::success([
            'id'    => $userId,
            'name'  => $name,
            'email' => $email,
            'role'  => 'user',
        ], 201);
    }

    public function updateUser(int $adminId, int $targetId): void
    {
        $this->assertAdmin($adminId);

        if ($targetId === $adminId) {
            Response::error('No puedes desactivar tu propia cuenta', 422);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $isActive = isset($body['is_active']) ? (int) (bool) $body['is_active'] : null;
        if ($isActive === null) Response::error('is_active requerido', 422);

        $stmt = $this->db->prepare('UPDATE users SET is_active = ? WHERE id = ?');
        $stmt->execute([$isActive, $targetId]);
        if ($stmt->rowCount() === 0) Response::error('Usuario no encontrado', 404);

        Response::success(['id' => $targetId, 'is_active' => $isActive]);
    }

    private function assertAdmin(int $userId): void
    {
        $stmt = $this->db->prepare(
            'SELECT role FROM users WHERE id = ? AND is_active = 1'
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row || $row['role'] !== 'admin') {
            Response::error('Acceso denegado', 403);
        }
    }
}
