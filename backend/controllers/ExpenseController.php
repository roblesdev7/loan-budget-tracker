<?php
declare(strict_types=1);

class ExpenseController
{
    private const VALID_TYPES = ['daily', 'debt_payment', 'principal_reduction', 'credit_card_payment'];

    public function __construct(private PDO $db) {}

    public function index(int $userId): void
    {
        // Optional date range filters: ?start=YYYY-MM-DD&end=YYYY-MM-DD
        $start = $_GET['start'] ?? null;
        $end   = $_GET['end']   ?? null;

        $where  = 'WHERE e.user_id = ?';
        $params = [$userId];

        if ($start && preg_match('/^\d{4}-\d{2}-\d{2}$/', $start)) {
            $where   .= ' AND e.expense_date >= ?';
            $params[] = $start;
        }
        if ($end && preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
            $where   .= ' AND e.expense_date <= ?';
            $params[] = $end;
        }

        $stmt = $this->db->prepare("
            SELECT e.*, ec.name AS category_name, ec.category_type, d.name AS debt_name
            FROM expenses e
            JOIN expense_categories ec ON e.category_id = ec.id
            LEFT JOIN debts d ON e.debt_id = d.id
            $where
            ORDER BY e.expense_date DESC, e.created_at DESC
            LIMIT 300
        ");
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    /**
     * POST /expenses
     *
     * Business rules enforced:
     * 1. base_amount_dop = original_amount × exchange_rate  (computed here, stored persistently)
     * 2. If expense_type != 'daily', deduct amount from linked debt balance — inside a transaction.
     * 3. If payment was in USD, persist the rate to exchange_rates for sticky auto-fill.
     */
    public function store(int $userId): void
    {
        $body   = json_decode(file_get_contents('php://input'), true) ?? [];
        $errors = $this->validate($body);
        if (!empty($errors)) Response::error('Datos inválidos', 422, $errors);

        $originalAmount = (float) $body['original_amount'];
        $currency       = $body['currency'];
        $exchangeRate   = $currency === 'DOP' ? 1.0 : (float) $body['exchange_rate'];
        $baseAmountDop  = round($originalAmount * $exchangeRate, 2); // Compute on entry
        $expenseType    = $body['expense_type'];
        $debtId         = $expenseType !== 'daily' ? (int) $body['debt_id'] : null;

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare('
                INSERT INTO expenses
                    (user_id, category_id, expense_type, debt_id, description,
                     expense_date, original_amount, currency, exchange_rate, base_amount_dop)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');
            $stmt->execute([
                $userId,
                (int) $body['category_id'],
                $expenseType,
                $debtId,
                $body['description'] ?? null,
                $body['expense_date'],
                $originalAmount,
                $currency,
                $exchangeRate,
                $baseAmountDop,
            ]);
            $expenseId = (int) $this->db->lastInsertId();

            // Automatically update debt balance
            if ($debtId !== null) {
                // Bank loans: accept manual new_balance from the bank statement
                $newBalance = null;
                if (isset($body['new_balance'])) {
                    $newBalance = max(0.0, (float) $body['new_balance']);
                }
                $this->deductFromDebt($userId, $debtId, $originalAmount, $baseAmountDop, $exchangeRate, $currency, $newBalance);
            }

            // Persist USD rate for sticky auto-fill
            if ($currency === 'USD') {
                $r = $this->db->prepare('INSERT INTO exchange_rates (user_id, rate) VALUES (?, ?)');
                $r->execute([$userId, $exchangeRate]);
            }

            $this->db->commit();
            Response::success(['id' => $expenseId, 'base_amount_dop' => $baseAmountDop], 201);
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 422);
        }
    }

    public function destroy(int $userId, int $id): void
    {
        $stmt = $this->db->prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        $expense = $stmt->fetch();
        if (!$expense) Response::error('No encontrado', 404);

        $this->db->beginTransaction();
        try {
            if ($expense['debt_id'] !== null && $expense['expense_type'] !== 'daily') {
                $this->reverseDebtPayment($userId, (int) $expense['debt_id'], $expense);
            }

            $del = $this->db->prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?');
            $del->execute([$id, $userId]);

            $this->db->commit();
            Response::success(null, 204);
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 422);
        }
    }

    public function update(int $userId, int $id): void
    {
        $stmt = $this->db->prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        $existing = $stmt->fetch();
        if (!$existing) Response::error('No encontrado', 404);

        $body   = json_decode(file_get_contents('php://input'), true) ?? [];
        $errors = $this->validate($body);
        if (!empty($errors)) Response::error('Datos inválidos', 422, $errors);

        $originalAmount = (float) $body['original_amount'];
        $currency       = $body['currency'];
        $exchangeRate   = $currency === 'DOP' ? 1.0 : (float) $body['exchange_rate'];
        $baseAmountDop  = round($originalAmount * $exchangeRate, 2);
        $expenseType    = $body['expense_type'];
        $debtId         = $expenseType !== 'daily' ? (int) $body['debt_id'] : null;

        $this->db->beginTransaction();
        try {
            if ($existing['debt_id'] !== null && $existing['expense_type'] !== 'daily') {
                $this->reverseDebtPayment($userId, (int) $existing['debt_id'], $existing);
            }

            $upd = $this->db->prepare('
                UPDATE expenses
                SET category_id = ?, expense_type = ?, debt_id = ?, description = ?,
                    expense_date = ?, original_amount = ?, currency = ?,
                    exchange_rate = ?, base_amount_dop = ?
                WHERE id = ? AND user_id = ?
            ');
            $upd->execute([
                (int) $body['category_id'],
                $expenseType,
                $debtId,
                $body['description'] ?? null,
                $body['expense_date'],
                $originalAmount,
                $currency,
                $exchangeRate,
                $baseAmountDop,
                $id,
                $userId,
            ]);

            if ($debtId !== null) {
                $newBalance = isset($body['new_balance']) ? max(0.0, (float) $body['new_balance']) : null;
                $this->deductFromDebt($userId, $debtId, $originalAmount, $baseAmountDop, $exchangeRate, $currency, $newBalance);
            }

            $this->db->commit();
            Response::success(['id' => $id, 'base_amount_dop' => $baseAmountDop]);
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 422);
        }
    }

    /**
     * Restores debt balance when a debt-related expense is deleted.
     * Inverse of deductFromDebt auto-deduction (bank loans with manual new_balance
     * cannot be restored exactly — payment amount is added back as best effort).
     */
    private function reverseDebtPayment(int $userId, int $debtId, array $expense): void
    {
        $stmt = $this->db->prepare(
            'SELECT id, current_balance, current_balance_dop, currency, exchange_rate, original_amount
             FROM debts WHERE id = ? AND user_id = ?
             FOR UPDATE'
        );
        $stmt->execute([$debtId, $userId]);
        $debt = $stmt->fetch();

        if (!$debt) {
            throw new \RuntimeException('Deuda asociada no encontrada');
        }

        $paymentAmount   = (float) $expense['original_amount'];
        $baseAmountDop   = (float) $expense['base_amount_dop'];
        $paymentCurrency = $expense['currency'];
        $paymentRate     = (float) $expense['exchange_rate'];

        $debtCurrency   = $debt['currency'];
        $currBalance    = (float) $debt['current_balance'];
        $currBalanceDop = (float) $debt['current_balance_dop'];
        $originalAmount = (float) $debt['original_amount'];

        $newBalanceDop = min(
            round($currBalanceDop + $baseAmountDop, 2),
            round($originalAmount * (float) $debt['exchange_rate'], 2),
        );

        if ($debtCurrency === $paymentCurrency) {
            $newBalance = min(round($currBalance + $paymentAmount, 2), $originalAmount);
        } elseif ($debtCurrency === 'DOP') {
            $newBalance = $newBalanceDop;
        } else {
            $rateToUse  = $paymentRate > 1.0 ? $paymentRate : (float) $debt['exchange_rate'];
            $newBalance = $rateToUse > 0
                ? min(round($newBalanceDop / $rateToUse, 2), $originalAmount)
                : min(round($currBalance + $paymentAmount, 2), $originalAmount);
        }

        $upd = $this->db->prepare(
            'UPDATE debts SET current_balance = ?, current_balance_dop = ?, status = "active" WHERE id = ?'
        );
        $upd->execute([$newBalance, $newBalanceDop, $debtId]);
    }

    /**
     * Updates debt balance after a payment.
     *
     * If $newBalance is provided (bank loans): sets balance directly from bank statement.
     * Otherwise: deducts payment amount automatically (credit cards, informal debts).
     */
    private function deductFromDebt(
        int    $userId,
        int    $debtId,
        float  $amount,
        float  $baseAmountDop,
        float  $paymentRate,
        string $paymentCurrency,
        ?float $newBalance = null,
    ): void {
        $stmt = $this->db->prepare(
            'SELECT id, current_balance, current_balance_dop, currency, exchange_rate
             FROM debts WHERE id = ? AND user_id = ? AND status = "active"
             FOR UPDATE'
        );
        $stmt->execute([$debtId, $userId]);
        $debt = $stmt->fetch();

        if (!$debt) {
            throw new \RuntimeException('Deuda no encontrada, inactiva o no te pertenece');
        }

        // Manual new_balance override (bank loans: cuota no baja el capital completo)
        if ($newBalance !== null) {
            $newBalanceDop = round($newBalance * $paymentRate, 2);
            $newStatus     = $newBalance <= 0 ? 'paid_off' : 'active';
            $upd = $this->db->prepare(
                'UPDATE debts SET current_balance = ?, current_balance_dop = ?, status = ? WHERE id = ?'
            );
            $upd->execute([$newBalance, $newBalanceDop, $newStatus, $debtId]);
            return;
        }

        // Auto-deduction (credit cards, informal debts)
        $debtCurrency   = $debt['currency'];
        $currBalance    = (float) $debt['current_balance'];
        $currBalanceDop = (float) $debt['current_balance_dop'];

        $newBalanceDop = max(0.0, $currBalanceDop - $baseAmountDop);

        if ($debtCurrency === $paymentCurrency) {
            $newBalance = max(0.0, $currBalance - $amount);
        } elseif ($debtCurrency === 'DOP') {
            $newBalance = $newBalanceDop;
        } else {
            $rateToUse  = $paymentRate > 1.0 ? $paymentRate : (float) $debt['exchange_rate'];
            $newBalance = $rateToUse > 0 ? round($newBalanceDop / $rateToUse, 2) : $currBalance;
        }

        $newStatus = $newBalance <= 0 ? 'paid_off' : 'active';

        $upd = $this->db->prepare(
            'UPDATE debts SET current_balance = ?, current_balance_dop = ?, status = ? WHERE id = ?'
        );
        $upd->execute([$newBalance, $newBalanceDop, $newStatus, $debtId]);
    }

    private function validate(array $body): array
    {
        $errors = [];

        if (empty($body['category_id']))
            $errors['category_id'] = 'Categoría requerida';
        if (empty($body['expense_date']))
            $errors['expense_date'] = 'Fecha requerida';
        if (!isset($body['original_amount']) || (float) $body['original_amount'] <= 0)
            $errors['original_amount'] = 'Monto debe ser mayor a 0';
        if (!in_array($body['currency'] ?? '', ['DOP', 'USD'], true))
            $errors['currency'] = 'Moneda inválida';
        if (!in_array($body['expense_type'] ?? '', self::VALID_TYPES, true))
            $errors['expense_type'] = 'Tipo de gasto inválido';
        if (($body['expense_type'] ?? 'daily') !== 'daily' && empty($body['debt_id']))
            $errors['debt_id'] = 'Se requiere una deuda para este tipo de gasto';
        if (($body['currency'] ?? '') === 'USD' && (!isset($body['exchange_rate']) || (float) $body['exchange_rate'] <= 0))
            $errors['exchange_rate'] = 'Tasa de cambio requerida para USD';

        return $errors;
    }
}
