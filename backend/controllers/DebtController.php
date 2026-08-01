<?php
declare(strict_types=1);

class DebtController
{
    public function __construct(private PDO $db) {}

    public function index(int $userId): void
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM debts WHERE user_id = ? ORDER BY status ASC, created_at DESC'
        );
        $stmt->execute([$userId]);
        Response::success($stmt->fetchAll());
    }

    public function show(int $userId, int $id): void
    {
        $stmt = $this->db->prepare('SELECT * FROM debts WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        $debt = $stmt->fetch();
        if (!$debt) Response::error('No encontrado', 404);

        $ps = $this->db->prepare('
            SELECT e.id, e.expense_date, e.description, e.original_amount, e.currency,
                   e.base_amount_dop, e.expense_type, ec.name AS category_name
            FROM expenses e
            JOIN expense_categories ec ON e.category_id = ec.id
            WHERE e.debt_id = ? AND e.user_id = ?
            ORDER BY e.expense_date DESC, e.created_at DESC
            LIMIT 50
        ');
        $ps->execute([$id, $userId]);

        $paid = (float) $debt['original_amount'] - (float) $debt['current_balance'];
        $paidPct = (float) $debt['original_amount'] > 0
            ? round($paid / (float) $debt['original_amount'] * 100, 1)
            : 0;

        Response::success([
            'debt'      => $debt,
            'payments'  => $ps->fetchAll(),
            'paid_pct'  => $paidPct,
            'paid_amount' => round($paid, 2),
        ]);
    }

    /** PUT /debts/:id/balance — update balance without recording a payment */
    public function adjustBalance(int $userId, int $id): void
    {
        $stmt = $this->db->prepare('SELECT * FROM debts WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        $debt = $stmt->fetch();
        if (!$debt) Response::error('No encontrado', 404);

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (!isset($body['current_balance']) || (float) $body['current_balance'] < 0)
            Response::error('Saldo inválido', 422);

        $newBalance = (float) $body['current_balance'];
        $rate       = (float) $debt['exchange_rate'];
        $newBalanceDop = round($newBalance * $rate, 2);
        $newStatus  = $newBalance <= 0 ? 'paid_off' : 'active';

        $upd = $this->db->prepare(
            'UPDATE debts SET current_balance = ?, current_balance_dop = ?, status = ? WHERE id = ? AND user_id = ?'
        );
        $upd->execute([$newBalance, $newBalanceDop, $newStatus, $id, $userId]);

        Response::success([
            'id'              => $id,
            'current_balance' => $newBalance,
            'status'          => $newStatus,
        ]);
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

        $isCreditCard = $body['debt_type'] === 'credit_card';
        $isInformal   = $body['debt_type'] === 'informal';

        $stmt = $this->db->prepare('
            INSERT INTO debts (
                user_id, debt_type, name, institution_name, account_number, interest_rate, credit_limit,
                creditor_name, creditor_address, creditor_phone,
                original_amount, currency, exchange_rate, base_amount_dop,
                current_balance, current_balance_dop, start_date, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $userId,
            $body['debt_type'],
            $body['name'],
            !$isInformal ? ($body['institution_name'] ?? null) : null,
            !$isInformal ? ($body['account_number'] ?? null)   : null,
            !$isInformal && isset($body['interest_rate']) ? (float) $body['interest_rate'] : null,
            $isCreditCard && isset($body['credit_limit'])  ? (float) $body['credit_limit']  : null,
            $isInformal   ? ($body['creditor_name']    ?? null) : null,
            $isInformal   ? ($body['creditor_address'] ?? null) : null,
            $isInformal   ? ($body['creditor_phone']   ?? null) : null,
            $originalAmount,
            $currency,
            $exchangeRate,
            $baseAmountDop,
            $originalAmount,  // current_balance starts at original
            $baseAmountDop,   // current_balance_dop starts at base
            $body['start_date'],
            $body['notes'] ?? null,
        ]);

        Response::success(['id' => (int) $this->db->lastInsertId()], 201);
    }

    public function update(int $userId, int $id): void
    {
        $stmt = $this->db->prepare('SELECT id, debt_type FROM debts WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        $debt = $stmt->fetch();
        if (!$debt) Response::error('No encontrado', 404);

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($body['name'])) Response::error('Nombre requerido', 422);

        $isCreditCard = $debt['debt_type'] === 'credit_card';
        $isInformal   = $debt['debt_type'] === 'informal';

        $stmt = $this->db->prepare('
            UPDATE debts
            SET name = ?, institution_name = ?, account_number = ?, interest_rate = ?, credit_limit = ?,
                creditor_name = ?, creditor_address = ?, creditor_phone = ?, status = ?, notes = ?
            WHERE id = ? AND user_id = ?
        ');
        $stmt->execute([
            $body['name'],
            !$isInformal ? ($body['institution_name'] ?? null) : null,
            !$isInformal ? ($body['account_number']   ?? null) : null,
            !$isInformal && isset($body['interest_rate']) ? (float) $body['interest_rate'] : null,
            $isCreditCard && isset($body['credit_limit']) ? (float) $body['credit_limit']  : null,
            $isInformal ? ($body['creditor_name']    ?? null) : null,
            $isInformal ? ($body['creditor_address'] ?? null) : null,
            $isInformal ? ($body['creditor_phone']   ?? null) : null,
            in_array($body['status'] ?? 'active', ['active', 'paid_off', 'closed'], true)
                ? $body['status'] : 'active',
            $body['notes'] ?? null,
            $id,
            $userId,
        ]);

        Response::success(['id' => $id]);
    }

    public function destroy(int $userId, int $id): void
    {
        $stmt = $this->db->prepare('DELETE FROM debts WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        if ($stmt->rowCount() === 0) Response::error('No encontrado', 404);
        Response::success(null, 204);
    }

    private function validate(array $body): array
    {
        $validTypes = ['credit_card', 'bank_loan_personal', 'bank_loan_vehicle', 'bank_loan_mortgage', 'informal'];
        $errors = [];

        if (!in_array($body['debt_type'] ?? '', $validTypes, true))
            $errors['debt_type'] = 'Tipo de deuda inválido';
        if (empty($body['name']))
            $errors['name'] = 'Nombre requerido';
        if (!isset($body['original_amount']) || (float) $body['original_amount'] <= 0)
            $errors['original_amount'] = 'Monto debe ser mayor a 0';
        if (!in_array($body['currency'] ?? '', ['DOP', 'USD'], true))
            $errors['currency'] = 'Moneda inválida';
        if (($body['currency'] ?? '') === 'USD' && (!isset($body['exchange_rate']) || (float) $body['exchange_rate'] <= 0))
            $errors['exchange_rate'] = 'Tasa de cambio requerida para USD';
        if (empty($body['start_date']))
            $errors['start_date'] = 'Fecha de inicio requerida';

        return $errors;
    }
}
