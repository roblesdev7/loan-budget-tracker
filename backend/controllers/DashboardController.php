<?php
declare(strict_types=1);

class DashboardController
{
    public function __construct(private PDO $db) {}

    /**
     * GET /dashboard
     * Available balance = Total Income (DOP) − Total Expenses (DOP)
     */
    public function summary(int $userId): void
    {
        $monthStart = date('Y-m-01');
        $monthEnd   = date('Y-m-t');

        // Total income (all time)
        $s = $this->db->prepare('SELECT COALESCE(SUM(base_amount_dop), 0) FROM income WHERE user_id = ?');
        $s->execute([$userId]);
        $totalIncome = (float) $s->fetchColumn();

        // Total expenses (all time)
        $s = $this->db->prepare('SELECT COALESCE(SUM(base_amount_dop), 0) FROM expenses WHERE user_id = ?');
        $s->execute([$userId]);
        $totalExpenses = (float) $s->fetchColumn();

        // Category-type totals (all time)
        $dailyExpenses     = $this->sumByCategoryType($userId, 'daily');
        $recurringExpenses = $this->sumByCategoryType($userId, 'recurring');
        $debtPayments      = $this->sumByCategoryType($userId, 'debt_related');

        // Current month breakdown
        $monthlyDaily     = $this->sumByCategoryType($userId, 'daily', $monthStart, $monthEnd);
        $monthlyRecurring = $this->sumByCategoryType($userId, 'recurring', $monthStart, $monthEnd);
        $monthlyDebt      = $this->sumByCategoryType($userId, 'debt_related', $monthStart, $monthEnd);

        // Active debts
        $s = $this->db->prepare(
            'SELECT COUNT(*) AS cnt, COALESCE(SUM(current_balance_dop), 0) AS total
             FROM debts WHERE user_id = ? AND status = "active"'
        );
        $s->execute([$userId]);
        $activeDebts = $s->fetch();

        // Latest exchange rate (sticky)
        $s = $this->db->prepare(
            'SELECT rate FROM exchange_rates WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1'
        );
        $s->execute([$userId]);
        $latestRate = (float) ($s->fetchColumn() ?: 60.0);

        // Recent expenses for dashboard table
        $s = $this->db->prepare('
            SELECT e.id, e.expense_date, e.description, e.original_amount, e.currency,
                   e.base_amount_dop, e.expense_type, ec.name AS category_name,
                   ec.category_type, d.name AS debt_name
            FROM expenses e
            JOIN expense_categories ec ON e.category_id = ec.id
            LEFT JOIN debts d ON e.debt_id = d.id
            WHERE e.user_id = ?
            ORDER BY e.expense_date DESC, e.created_at DESC
            LIMIT 15
        ');
        $s->execute([$userId]);
        $recentExpenses = $s->fetchAll();

        $upcomingBills = $this->upcomingBills($userId);
        $budgets       = $this->budgetProgress($userId, $monthStart, $monthEnd);

        Response::success([
            'total_income_dop'          => round($totalIncome, 2),
            'total_expenses_dop'        => round($totalExpenses, 2),
            'daily_expenses_dop'        => round($dailyExpenses, 2),
            'recurring_expenses_dop'    => round($recurringExpenses, 2),
            'debt_payments_dop'         => round($debtPayments, 2),
            'available_balance_dop'     => round($totalIncome - $totalExpenses, 2),
            'monthly_daily_dop'         => round($monthlyDaily, 2),
            'monthly_recurring_dop'     => round($monthlyRecurring, 2),
            'monthly_debt_dop'          => round($monthlyDebt, 2),
            'monthly_commitments_dop'   => round($monthlyRecurring + $monthlyDebt, 2),
            'active_debts_count'        => (int) $activeDebts['cnt'],
            'total_debt_balance_dop'    => round((float) $activeDebts['total'], 2),
            'latest_exchange_rate'      => $latestRate,
            'recent_expenses'           => $recentExpenses,
            'upcoming_bills'            => $upcomingBills,
            'budgets'                   => $budgets,
        ]);
    }

    private function upcomingBills(int $userId): array
    {
        try {
            $stmt = $this->db->prepare('
                SELECT rb.*, ec.name AS category_name,
                    ROUND(rb.original_amount * rb.exchange_rate, 2) AS base_amount_dop,
                    d.name AS debt_name, d.debt_type
                FROM recurring_bills rb
                JOIN expense_categories ec ON rb.category_id = ec.id
                LEFT JOIN debts d ON rb.debt_id = d.id
                WHERE rb.user_id = ? AND rb.is_active = 1
                ORDER BY rb.due_day ASC
            ');
            $stmt->execute([$userId]);
            $rows  = $stmt->fetchAll();
            $today = new \DateTimeImmutable('today');

            $bills = array_map(function ($r) use ($today) {
                $frequency = $r['billing_frequency'] ?? 'monthly';
                $dueDay = (int) $r['due_day'];
                $dueMonth = isset($r['due_month']) ? (int) $r['due_month'] : null;
                $daysUntil = $this->daysUntilDue($today, $frequency, $dueDay, $dueMonth);

                return [
                    'id'                => (int) $r['id'],
                    'name'              => $r['name'],
                    'category_name'     => $r['category_name'],
                    'category_id'       => (int) $r['category_id'],
                    'due_day'           => $dueDay,
                    'due_month'         => $dueMonth,
                    'billing_frequency' => $frequency,
                    'days_until'        => $daysUntil,
                    'original_amount'   => (float) $r['original_amount'],
                    'currency'          => $r['currency'],
                    'base_amount_dop'   => (float) $r['base_amount_dop'],
                    'debt_id'           => $r['debt_id'] ? (int) $r['debt_id'] : null,
                    'debt_name'         => $r['debt_name'],
                    'bill_type'         => $r['debt_id'] ? 'debt_installment' : 'subscription',
                ];
            }, $rows);

            // Yearly bills only surface on the dashboard when renewal is near
            return array_values(array_filter($bills, function ($b) {
                if ($b['billing_frequency'] === 'yearly') {
                    return $b['days_until'] <= 60;
                }
                return true;
            }));
        } catch (\Throwable) {
            return [];
        }
    }

    private function daysUntilDue(
        \DateTimeImmutable $today,
        string $frequency,
        int $dueDay,
        ?int $dueMonth,
    ): int {
        if ($frequency === 'yearly' && $dueMonth !== null) {
            $year = (int) $today->format('Y');
            $due = \DateTimeImmutable::createFromFormat('!Y-n-j', "$year-$dueMonth-$dueDay");
            if (!$due || $due < $today) {
                $due = \DateTimeImmutable::createFromFormat('!Y-n-j', ($year + 1) . "-$dueMonth-$dueDay");
            }
            return (int) $today->diff($due)->days;
        }

        $todayDay = (int) $today->format('j');
        $daysInMonth = (int) $today->format('t');

        return $dueDay >= $todayDay
            ? $dueDay - $todayDay
            : ($daysInMonth - $todayDay + $dueDay);
    }

    private function budgetProgress(int $userId, string $start, string $end): array
    {
        try {
            $stmt = $this->db->prepare('
                SELECT cb.id, cb.category_id, cb.monthly_limit_dop, ec.name AS category_name,
                    COALESCE((
                        SELECT SUM(e.base_amount_dop) FROM expenses e
                        WHERE e.category_id = cb.category_id AND e.user_id = ?
                          AND e.expense_date BETWEEN ? AND ?
                    ), 0) AS spent_dop
                FROM category_budgets cb
                JOIN expense_categories ec ON cb.category_id = ec.id
                WHERE cb.user_id = ? AND cb.is_active = 1
                ORDER BY spent_dop DESC
                LIMIT 5
            ');
            $stmt->execute([$userId, $start, $end, $userId]);
            return array_map(function ($r) {
                $limit = (float) $r['monthly_limit_dop'];
                $spent = (float) $r['spent_dop'];
                return [
                    'category_name'     => $r['category_name'],
                    'monthly_limit_dop' => $limit,
                    'spent_dop'         => round($spent, 2),
                    'percentage_used'   => $limit > 0 ? round($spent / $limit * 100, 1) : 0,
                ];
            }, $stmt->fetchAll());
        } catch (\Throwable) {
            return [];
        }
    }

    private function sumByCategoryType(
        int $userId,
        string $type,
        ?string $start = null,
        ?string $end = null,
    ): float {
        $where  = 'WHERE e.user_id = ? AND ec.category_type = ?';
        $params = [$userId, $type];

        if ($start !== null) {
            $where   .= ' AND e.expense_date >= ?';
            $params[] = $start;
        }
        if ($end !== null) {
            $where   .= ' AND e.expense_date <= ?';
            $params[] = $end;
        }

        $s = $this->db->prepare(
            "SELECT COALESCE(SUM(e.base_amount_dop), 0)
             FROM expenses e
             JOIN expense_categories ec ON e.category_id = ec.id
             $where"
        );
        $s->execute($params);
        return (float) $s->fetchColumn();
    }
}
