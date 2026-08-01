<?php
declare(strict_types=1);

class AnalyticsController
{
    public function __construct(private PDO $db) {}

    /**
     * GET /analytics?period=YYYY-MM
     * Returns all aggregated data needed for the analytics dashboard.
     * period defaults to the current month.
     */
    public function summary(int $userId): void
    {
        $period = $_GET['period'] ?? date('Y-m');
        if (!preg_match('/^\d{4}-\d{2}$/', $period)) {
            Response::error('Formato de período inválido. Use YYYY-MM', 422);
        }

        [$year, $month] = explode('-', $period);
        $startDate = "$year-$month-01";
        $endDate   = date('Y-m-t', strtotime($startDate)); // last day of month

        Response::success([
            'period'                  => $period,
            'expenses_by_category'    => $this->expensesByCategory($userId, $startDate, $endDate),
            'spending_breakdown'      => $this->spendingBreakdown($userId, $startDate, $endDate),
            'daily_vs_debt'           => $this->spendingBreakdown($userId, $startDate, $endDate),
            'income_vs_expenses_6m'   => $this->incomeVsExpenses6m($userId),
            'debt_breakdown'          => $this->debtBreakdown($userId),
            'monthly_totals'          => $this->monthlyTotals($userId, $startDate, $endDate),
            'month_over_month'        => $this->monthOverMonth($userId, $period),
        ]);
    }

    /** Expenses grouped by category name for the selected month */
    private function expensesByCategory(int $userId, string $start, string $end): array
    {
        $stmt = $this->db->prepare('
            SELECT
                ec.name            AS category,
                ec.category_type,
                COALESCE(SUM(e.base_amount_dop), 0) AS total_dop,
                COUNT(e.id)        AS count
            FROM expense_categories ec
            LEFT JOIN expenses e
                ON e.category_id = ec.id
                AND e.user_id = ?
                AND e.expense_date BETWEEN ? AND ?
            WHERE ec.user_id = ? AND ec.is_active = 1
            GROUP BY ec.id, ec.name, ec.category_type
            HAVING total_dop > 0
            ORDER BY total_dop DESC
        ');
        $stmt->execute([$userId, $start, $end, $userId]);
        $rows  = $stmt->fetchAll();
        $total = array_sum(array_column($rows, 'total_dop'));

        return array_map(function ($r) use ($total) {
            return [
                'category'      => $r['category'],
                'category_type' => $r['category_type'],
                'total_dop'     => (float) $r['total_dop'],
                'count'         => (int)   $r['count'],
                'percentage'    => $total > 0 ? round((float) $r['total_dop'] / $total * 100, 1) : 0,
            ];
        }, $rows);
    }

    /** Daily, recurring, and debt payment totals for the month */
    private function spendingBreakdown(int $userId, string $start, string $end): array
    {
        $stmt = $this->db->prepare('
            SELECT
                ec.category_type,
                COALESCE(SUM(e.base_amount_dop), 0) AS total_dop
            FROM expenses e
            JOIN expense_categories ec ON e.category_id = ec.id
            WHERE e.user_id = ? AND e.expense_date BETWEEN ? AND ?
            GROUP BY ec.category_type
        ');
        $stmt->execute([$userId, $start, $end]);
        $rows = $stmt->fetchAll();

        $result = ['daily' => 0.0, 'recurring' => 0.0, 'debt_related' => 0.0];
        foreach ($rows as $r) {
            $result[$r['category_type']] = (float) $r['total_dop'];
        }
        return $result;
    }

    /** Income vs expenses for the last 6 months */
    private function incomeVsExpenses6m(int $userId): array
    {
        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $months[] = date('Y-m', strtotime("-$i months"));
        }

        $incomeSql = '
            SELECT DATE_FORMAT(income_date, "%Y-%m") AS m, COALESCE(SUM(base_amount_dop), 0) AS total
            FROM income WHERE user_id = ?
            AND income_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 5 MONTH), "%Y-%m-01")
            GROUP BY m
        ';
        $expSql = '
            SELECT DATE_FORMAT(expense_date, "%Y-%m") AS m, COALESCE(SUM(base_amount_dop), 0) AS total
            FROM expenses WHERE user_id = ?
            AND expense_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 5 MONTH), "%Y-%m-01")
            GROUP BY m
        ';

        $si = $this->db->prepare($incomeSql);
        $si->execute([$userId]);
        $incomeMap = array_column($si->fetchAll(), 'total', 'm');

        $se = $this->db->prepare($expSql);
        $se->execute([$userId]);
        $expMap = array_column($se->fetchAll(), 'total', 'm');

        return array_map(fn($m) => [
            'month'       => $m,
            'label'       => $this->shortMonth($m),
            'income_dop'  => (float) ($incomeMap[$m]  ?? 0),
            'expense_dop' => (float) ($expMap[$m] ?? 0),
        ], $months);
    }

    /** Active debt balances for pie chart */
    private function debtBreakdown(int $userId): array
    {
        $stmt = $this->db->prepare('
            SELECT name, debt_type, current_balance_dop
            FROM debts
            WHERE user_id = ? AND status = "active"
            ORDER BY current_balance_dop DESC
        ');
        $stmt->execute([$userId]);
        $rows  = $stmt->fetchAll();
        $total = array_sum(array_column($rows, 'current_balance_dop'));

        return array_map(fn($r) => [
            'name'        => $r['name'],
            'debt_type'   => $r['debt_type'],
            'balance_dop' => (float) $r['current_balance_dop'],
            'percentage'  => $total > 0 ? round((float) $r['current_balance_dop'] / $total * 100, 1) : 0,
        ], $rows);
    }

    /** Income + expense totals for selected month */
    private function monthlyTotals(int $userId, string $start, string $end): array
    {
        $si = $this->db->prepare(
            'SELECT COALESCE(SUM(base_amount_dop),0) FROM income WHERE user_id=? AND income_date BETWEEN ? AND ?'
        );
        $si->execute([$userId, $start, $end]);

        $se = $this->db->prepare(
            'SELECT COALESCE(SUM(base_amount_dop),0) FROM expenses WHERE user_id=? AND expense_date BETWEEN ? AND ?'
        );
        $se->execute([$userId, $start, $end]);

        $income   = (float) $si->fetchColumn();
        $expenses = (float) $se->fetchColumn();

        return [
            'income_dop'   => $income,
            'expenses_dop' => $expenses,
            'balance_dop'  => $income - $expenses,
        ];
    }

    private function shortMonth(string $yearMonth): string
    {
        $months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        [, $m] = explode('-', $yearMonth);
        return $months[(int)$m - 1];
    }

    /** Compare selected month vs previous month */
    private function monthOverMonth(int $userId, string $period): array
    {
        [$y, $m] = array_map('intval', explode('-', $period));
        $prev    = $m === 1 ? sprintf('%04d-12', $y - 1) : sprintf('%04d-%02d', $y, $m - 1);

        $curStart  = "$period-01";
        $curEnd    = date('Y-m-t', strtotime($curStart));
        $prevStart = "$prev-01";
        $prevEnd   = date('Y-m-t', strtotime($prevStart));

        $income  = $this->periodSum('income', 'income_date', $userId, $curStart, $curEnd);
        $incomeP = $this->periodSum('income', 'income_date', $userId, $prevStart, $prevEnd);
        $exp     = $this->periodSum('expenses', 'expense_date', $userId, $curStart, $curEnd);
        $expP    = $this->periodSum('expenses', 'expense_date', $userId, $prevStart, $prevEnd);

        $delta = fn(float $cur, float $prev) => $prev > 0
            ? round(($cur - $prev) / $prev * 100, 1)
            : ($cur > 0 ? 100.0 : 0.0);

        return [
            'current_period'  => $period,
            'previous_period' => $prev,
            'income_dop'      => ['current' => $income,  'previous' => $incomeP, 'change_pct' => $delta($income, $incomeP)],
            'expenses_dop'    => ['current' => $exp,     'previous' => $expP,    'change_pct' => $delta($exp, $expP)],
            'balance_dop'     => [
                'current'  => round($income - $exp, 2),
                'previous' => round($incomeP - $expP, 2),
            ],
            'daily_dop'       => $this->typeCompare($userId, 'daily', $curStart, $curEnd, $prevStart, $prevEnd),
            'recurring_dop'   => $this->typeCompare($userId, 'recurring', $curStart, $curEnd, $prevStart, $prevEnd),
            'debt_dop'        => $this->typeCompare($userId, 'debt_related', $curStart, $curEnd, $prevStart, $prevEnd),
        ];
    }

    private function periodSum(string $table, string $dateCol, int $userId, string $start, string $end): float
    {
        $s = $this->db->prepare(
            "SELECT COALESCE(SUM(base_amount_dop),0) FROM $table WHERE user_id=? AND $dateCol BETWEEN ? AND ?"
        );
        $s->execute([$userId, $start, $end]);
        return round((float) $s->fetchColumn(), 2);
    }

    private function typeCompare(int $userId, string $type, string $cs, string $ce, string $ps, string $pe): array
    {
        $cur  = $this->sumTypeInRange($userId, $type, $cs, $ce);
        $prev = $this->sumTypeInRange($userId, $type, $ps, $pe);
        $delta = $prev > 0 ? round(($cur - $prev) / $prev * 100, 1) : ($cur > 0 ? 100.0 : 0.0);
        return ['current' => $cur, 'previous' => $prev, 'change_pct' => $delta];
    }

    private function sumTypeInRange(int $userId, string $type, string $start, string $end): float
    {
        $s = $this->db->prepare('
            SELECT COALESCE(SUM(e.base_amount_dop),0)
            FROM expenses e JOIN expense_categories ec ON e.category_id = ec.id
            WHERE e.user_id=? AND ec.category_type=? AND e.expense_date BETWEEN ? AND ?
        ');
        $s->execute([$userId, $type, $start, $end]);
        return round((float) $s->fetchColumn(), 2);
    }
}
