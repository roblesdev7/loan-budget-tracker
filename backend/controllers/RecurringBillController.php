<?php
declare(strict_types=1);

class RecurringBillController
{
    public function __construct(private PDO $db) {}

    public function index(int $userId): void
    {
        $stmt = $this->db->prepare('
            SELECT rb.*, ec.name AS category_name, d.name AS debt_name, d.debt_type
            FROM recurring_bills rb
            JOIN expense_categories ec ON rb.category_id = ec.id
            LEFT JOIN debts d ON rb.debt_id = d.id
            WHERE rb.user_id = ?
            ORDER BY rb.due_day ASC, rb.name ASC
        ');
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll();

        Response::success(array_map(fn($r) => $this->formatBill($r), $rows));
    }

    public function store(int $userId): void
    {
        $body   = json_decode(file_get_contents('php://input'), true) ?? [];
        $errors = $this->validate($userId, $body);
        if (!empty($errors)) Response::error('Datos inválidos', 422, $errors);

        $currency     = $body['currency'];
        $exchangeRate = $currency === 'DOP' ? 1.0 : (float) $body['exchange_rate'];
        $debtId       = !empty($body['debt_id']) ? (int) $body['debt_id'] : null;

        $stmt = $this->db->prepare('
            INSERT INTO recurring_bills
                (user_id, category_id, debt_id, name, original_amount, currency, exchange_rate,
                 due_day, billing_frequency, due_month, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $userId,
            (int) $body['category_id'],
            $debtId,
            trim($body['name']),
            (float) $body['original_amount'],
            $currency,
            $exchangeRate,
            (int) $body['due_day'],
            $this->billingFrequency($body),
            $this->dueMonth($body),
            $body['notes'] ?? null,
        ]);

        Response::success(['id' => (int) $this->db->lastInsertId()], 201);
    }

    public function update(int $userId, int $id): void
    {
        $stmt = $this->db->prepare('SELECT id FROM recurring_bills WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        if (!$stmt->fetch()) Response::error('No encontrado', 404);

        $body   = json_decode(file_get_contents('php://input'), true) ?? [];
        $errors = $this->validate($userId, $body);
        if (!empty($errors)) Response::error('Datos inválidos', 422, $errors);

        $currency     = $body['currency'];
        $exchangeRate = $currency === 'DOP' ? 1.0 : (float) $body['exchange_rate'];
        $debtId       = !empty($body['debt_id']) ? (int) $body['debt_id'] : null;

        $stmt = $this->db->prepare('
            UPDATE recurring_bills
            SET category_id = ?, debt_id = ?, name = ?, original_amount = ?, currency = ?,
                exchange_rate = ?, due_day = ?, billing_frequency = ?, due_month = ?,
                notes = ?, is_active = ?
            WHERE id = ? AND user_id = ?
        ');
        $stmt->execute([
            (int) $body['category_id'],
            $debtId,
            trim($body['name']),
            (float) $body['original_amount'],
            $currency,
            $exchangeRate,
            (int) $body['due_day'],
            $this->billingFrequency($body),
            $this->dueMonth($body),
            $body['notes'] ?? null,
            (int) ($body['is_active'] ?? 1),
            $id,
            $userId,
        ]);

        Response::success(['id' => $id]);
    }

    public function destroy(int $userId, int $id): void
    {
        $stmt = $this->db->prepare('DELETE FROM recurring_bills WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        if ($stmt->rowCount() === 0) Response::error('No encontrado', 404);
        Response::success(null, 204);
    }

    private function formatBill(array $r): array
    {
        return [
            ...$r,
            'bill_type' => $r['debt_id'] ? 'debt_installment' : 'subscription',
        ];
    }

    private function validate(int $userId, array $body): array
    {
        $errors = [];
        if (empty($body['name'])) $errors['name'] = 'Nombre requerido';
        if (empty($body['category_id'])) $errors['category_id'] = 'Categoría requerida';
        if (!isset($body['original_amount']) || (float) $body['original_amount'] <= 0)
            $errors['original_amount'] = 'Monto inválido';
        if (!in_array($body['currency'] ?? '', ['DOP', 'USD'], true))
            $errors['currency'] = 'Moneda inválida';
        $dueDay = (int) ($body['due_day'] ?? 0);
        if ($dueDay < 1 || $dueDay > 28) $errors['due_day'] = 'Día debe ser 1-28';

        $frequency = $this->billingFrequency($body);
        if (!in_array($frequency, ['monthly', 'yearly'], true))
            $errors['billing_frequency'] = 'Frecuencia inválida';

        if ($frequency === 'yearly') {
            $dueMonth = (int) ($body['due_month'] ?? 0);
            if ($dueMonth < 1 || $dueMonth > 12)
                $errors['due_month'] = 'Mes requerido para pagos anuales (1-12)';
        }

        if (!empty($body['debt_id']) && $frequency !== 'monthly')
            $errors['billing_frequency'] = 'Las cuotas de deuda deben ser mensuales';
        if (($body['currency'] ?? '') === 'USD' && (!isset($body['exchange_rate']) || (float) $body['exchange_rate'] <= 0))
            $errors['exchange_rate'] = 'Tasa requerida para USD';

        if (!empty($body['debt_id'])) {
            $stmt = $this->db->prepare(
                'SELECT id FROM debts WHERE id = ? AND user_id = ? AND status = "active"'
            );
            $stmt->execute([(int) $body['debt_id'], $userId]);
            if (!$stmt->fetch()) $errors['debt_id'] = 'Deuda no válida';
        }

        return $errors;
    }

    private function billingFrequency(array $body): string
    {
        $frequency = $body['billing_frequency'] ?? 'monthly';
        if (!empty($body['debt_id'])) return 'monthly';
        return in_array($frequency, ['monthly', 'yearly'], true) ? $frequency : 'monthly';
    }

    private function dueMonth(array $body): ?int
    {
        if ($this->billingFrequency($body) !== 'yearly') return null;
        $month = (int) ($body['due_month'] ?? 0);
        return ($month >= 1 && $month <= 12) ? $month : null;
    }
}
