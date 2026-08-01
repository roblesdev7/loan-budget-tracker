<?php
declare(strict_types=1);

class CategoryController
{
    public function __construct(private PDO $db) {}

    // ── Income categories ──────────────────────────────────

    public function indexIncome(int $userId): void
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM income_categories WHERE user_id = ? AND is_active = 1 ORDER BY name'
        );
        $stmt->execute([$userId]);
        Response::success($stmt->fetchAll());
    }

    public function storeIncome(int $userId): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($body['name'] ?? '');
        if (empty($name)) Response::error('Nombre requerido', 422);

        $stmt = $this->db->prepare(
            'INSERT INTO income_categories (user_id, name) VALUES (?, ?)'
        );
        $stmt->execute([$userId, $name]);
        Response::success(['id' => (int) $this->db->lastInsertId()], 201);
    }

    public function updateIncome(int $userId, int $id): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $stmt = $this->db->prepare(
            'UPDATE income_categories SET name = ?, is_active = ? WHERE id = ? AND user_id = ?'
        );
        $stmt->execute([trim($body['name'] ?? ''), (int) ($body['is_active'] ?? 1), $id, $userId]);
        if ($stmt->rowCount() === 0) Response::error('No encontrado', 404);
        Response::success(['id' => $id]);
    }

    // ── Expense categories ─────────────────────────────────

    public function indexExpense(int $userId): void
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM expense_categories WHERE user_id = ? AND is_active = 1 ORDER BY category_type, name'
        );
        $stmt->execute([$userId]);
        Response::success($stmt->fetchAll());
    }

    public function storeExpense(int $userId): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($body['name'] ?? '');
        $type = $body['category_type'] ?? 'daily';

        $errors = [];
        if (empty($name))                              $errors['name']          = 'Nombre requerido';
        if (!in_array($type, ['daily', 'recurring', 'debt_related'], true)) $errors['category_type'] = 'Tipo inválido';
        if (!empty($errors)) Response::error('Datos inválidos', 422, $errors);

        $stmt = $this->db->prepare(
            'SELECT id FROM expense_categories WHERE user_id = ? AND name = ?'
        );
        $stmt->execute([$userId, $name]);
        if ($stmt->fetch()) Response::error('Ya existe una categoría con ese nombre', 422, ['name' => 'Nombre duplicado']);

        $stmt = $this->db->prepare(
            'INSERT INTO expense_categories (user_id, name, category_type) VALUES (?, ?, ?)'
        );
        $stmt->execute([$userId, $name, $type]);
        Response::success(['id' => (int) $this->db->lastInsertId()], 201);
    }

    public function updateExpense(int $userId, int $id): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $stmt = $this->db->prepare(
            'UPDATE expense_categories SET name = ?, is_active = ? WHERE id = ? AND user_id = ?'
        );
        $stmt->execute([trim($body['name'] ?? ''), (int) ($body['is_active'] ?? 1), $id, $userId]);
        if ($stmt->rowCount() === 0) Response::error('No encontrado', 404);
        Response::success(['id' => $id]);
    }
}
