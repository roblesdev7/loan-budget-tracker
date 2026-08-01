<?php
declare(strict_types=1);

class IncomeController
{
    public function __construct(private PDO $db) {}

    public function index(int $userId): void
    {
        // Optional date range filters: ?start=YYYY-MM-DD&end=YYYY-MM-DD
        $start = $_GET['start'] ?? null;
        $end   = $_GET['end']   ?? null;

        $where  = 'WHERE i.user_id = ?';
        $params = [$userId];

        if ($start && preg_match('/^\d{4}-\d{2}-\d{2}$/', $start)) {
            $where   .= ' AND i.income_date >= ?';
            $params[] = $start;
        }
        if ($end && preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
            $where   .= ' AND i.income_date <= ?';
            $params[] = $end;
        }

        $stmt = $this->db->prepare("
            SELECT i.*, ic.name AS category_name
            FROM income i
            JOIN income_categories ic ON i.category_id = ic.id
            $where
            ORDER BY i.income_date DESC, i.created_at DESC
            LIMIT 300
        ");
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    public function store(int $userId): void
    {
        $body   = json_decode(file_get_contents('php://input'), true) ?? [];
        $errors = $this->validate($body);
        if (!empty($errors)) Response::error('Datos inválidos', 422, $errors);

        $originalAmount = (float) $body['original_amount'];
        $currency       = $body['currency'];
        $exchangeRate   = $currency === 'DOP' ? 1.0 : (float) $body['exchange_rate'];
        $baseAmountDop  = round($originalAmount * $exchangeRate, 2); // Compute on entry

        $stmt = $this->db->prepare('
            INSERT INTO income
                (user_id, category_id, description, income_date, original_amount, currency, exchange_rate, base_amount_dop)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $userId,
            (int) $body['category_id'],
            $body['description'] ?? null,
            $body['income_date'],
            $originalAmount,
            $currency,
            $exchangeRate,
            $baseAmountDop,
        ]);
        $incomeId = (int) $this->db->lastInsertId();

        // Persist USD rate to history for sticky auto-population
        if ($currency === 'USD') {
            $r = $this->db->prepare('INSERT INTO exchange_rates (user_id, rate) VALUES (?, ?)');
            $r->execute([$userId, $exchangeRate]);
        }

        Response::success(['id' => $incomeId, 'base_amount_dop' => $baseAmountDop], 201);
    }

    public function update(int $userId, int $id): void
    {
        $stmt = $this->db->prepare('SELECT id FROM income WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        if (!$stmt->fetch()) Response::error('No encontrado', 404);

        $body   = json_decode(file_get_contents('php://input'), true) ?? [];
        $errors = $this->validate($body);
        if (!empty($errors)) Response::error('Datos inválidos', 422, $errors);

        $originalAmount = (float) $body['original_amount'];
        $currency       = $body['currency'];
        $exchangeRate   = $currency === 'DOP' ? 1.0 : (float) $body['exchange_rate'];
        $baseAmountDop  = round($originalAmount * $exchangeRate, 2);

        $stmt = $this->db->prepare('
            UPDATE income
            SET category_id = ?, description = ?, income_date = ?,
                original_amount = ?, currency = ?, exchange_rate = ?, base_amount_dop = ?
            WHERE id = ? AND user_id = ?
        ');
        $stmt->execute([
            (int) $body['category_id'],
            $body['description'] ?? null,
            $body['income_date'],
            $originalAmount,
            $currency,
            $exchangeRate,
            $baseAmountDop,
            $id,
            $userId,
        ]);

        Response::success(['id' => $id, 'base_amount_dop' => $baseAmountDop]);
    }

    public function destroy(int $userId, int $id): void
    {
        $stmt = $this->db->prepare('DELETE FROM income WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        if ($stmt->rowCount() === 0) Response::error('No encontrado', 404);
        Response::success(null, 204);
    }

    private function validate(array $body): array
    {
        $errors = [];
        if (empty($body['category_id']))
            $errors['category_id'] = 'Categoría requerida';
        if (empty($body['income_date']))
            $errors['income_date'] = 'Fecha requerida';
        if (!isset($body['original_amount']) || (float) $body['original_amount'] <= 0)
            $errors['original_amount'] = 'Monto debe ser mayor a 0';
        if (!in_array($body['currency'] ?? '', ['DOP', 'USD'], true))
            $errors['currency'] = 'Moneda inválida';
        if (($body['currency'] ?? '') === 'USD' && (!isset($body['exchange_rate']) || (float) $body['exchange_rate'] <= 0))
            $errors['exchange_rate'] = 'Tasa de cambio requerida para USD';
        return $errors;
    }
}
