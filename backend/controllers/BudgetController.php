<?php
declare(strict_types=1);

class BudgetController
{
    public function __construct(private PDO $db) {}

    public function index(int $userId): void
    {
        $monthStart = date('Y-m-01');
        $monthEnd   = date('Y-m-t');

        $stmt = $this->db->prepare('
            SELECT cb.*, ec.name AS category_name, ec.category_type,
                COALESCE((
                    SELECT SUM(e.base_amount_dop)
                    FROM expenses e
                    WHERE e.category_id = cb.category_id
                      AND e.user_id = ?
                      AND e.expense_date BETWEEN ? AND ?
                ), 0) AS spent_dop
            FROM category_budgets cb
            JOIN expense_categories ec ON cb.category_id = ec.id
            WHERE cb.user_id = ? AND cb.is_active = 1
            ORDER BY ec.name
        ');
        $stmt->execute([$userId, $monthStart, $monthEnd, $userId]);
        $rows = $stmt->fetchAll();

        Response::success(array_map(function ($r) {
            $limit = (float) $r['monthly_limit_dop'];
            $spent = (float) $r['spent_dop'];
            return [
                'id'                => (int) $r['id'],
                'category_id'       => (int) $r['category_id'],
                'category_name'     => $r['category_name'],
                'category_type'     => $r['category_type'],
                'monthly_limit_dop' => $limit,
                'spent_dop'         => round($spent, 2),
                'remaining_dop'     => round($limit - $spent, 2),
                'percentage_used'   => $limit > 0 ? round($spent / $limit * 100, 1) : 0,
            ];
        }, $rows));
    }

    public function store(int $userId): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($body['category_id'])) Response::error('Categoría requerida', 422);
        if (!isset($body['monthly_limit_dop']) || (float) $body['monthly_limit_dop'] <= 0)
            Response::error('Límite mensual inválido', 422);

        $stmt = $this->db->prepare('
            INSERT INTO category_budgets (user_id, category_id, monthly_limit_dop)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE monthly_limit_dop = VALUES(monthly_limit_dop), is_active = 1
        ');
        $stmt->execute([$userId, (int) $body['category_id'], (float) $body['monthly_limit_dop']]);

        Response::success(['id' => (int) $this->db->lastInsertId()], 201);
    }

    public function update(int $userId, int $id): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $stmt = $this->db->prepare('
            UPDATE category_budgets
            SET monthly_limit_dop = ?, is_active = ?
            WHERE id = ? AND user_id = ?
        ');
        $stmt->execute([
            (float) ($body['monthly_limit_dop'] ?? 0),
            (int) ($body['is_active'] ?? 1),
            $id,
            $userId,
        ]);
        if ($stmt->rowCount() === 0) Response::error('No encontrado', 404);
        Response::success(['id' => $id]);
    }

    public function destroy(int $userId, int $id): void
    {
        $stmt = $this->db->prepare('DELETE FROM category_budgets WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        if ($stmt->rowCount() === 0) Response::error('No encontrado', 404);
        Response::success(null, 204);
    }
}
