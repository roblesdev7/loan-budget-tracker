<?php
declare(strict_types=1);

class ExportController
{
    public function __construct(private PDO $db) {}

    /**
     * GET /export/csv?type=expenses|income&start=&end=
     */
    public function csv(int $userId): void
    {
        $type  = $_GET['type'] ?? 'expenses';
        $start = $_GET['start'] ?? date('Y-m-01');
        $end   = $_GET['end']   ?? date('Y-m-t');

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
            Response::error('Rango de fechas inválido', 422);
        }

        $filename = "{$type}_{$start}_{$end}.csv";
        header('Content-Type: text/csv; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"$filename\"");
        header('Cache-Control: no-cache');

        $out = fopen('php://output', 'w');
        fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF)); // UTF-8 BOM for Excel

        if ($type === 'income') {
            fputcsv($out, ['Fecha', 'Categoría', 'Descripción', 'Moneda', 'Monto', 'Tasa', 'DOP']);
            $stmt = $this->db->prepare('
                SELECT i.income_date, ic.name AS category_name, i.description,
                       i.currency, i.original_amount, i.exchange_rate, i.base_amount_dop
                FROM income i
                JOIN income_categories ic ON i.category_id = ic.id
                WHERE i.user_id = ? AND i.income_date BETWEEN ? AND ?
                ORDER BY i.income_date DESC
            ');
            $stmt->execute([$userId, $start, $end]);
            foreach ($stmt->fetchAll() as $r) {
                fputcsv($out, [
                    $r['income_date'], $r['category_name'], $r['description'] ?? '',
                    $r['currency'], $r['original_amount'], $r['exchange_rate'], $r['base_amount_dop'],
                ]);
            }
        } else {
            fputcsv($out, ['Fecha', 'Categoría', 'Tipo', 'Deuda', 'Descripción', 'Moneda', 'Monto', 'Tasa', 'DOP']);
            $stmt = $this->db->prepare('
                SELECT e.expense_date, ec.name AS category_name, e.expense_type,
                       d.name AS debt_name, e.description, e.currency,
                       e.original_amount, e.exchange_rate, e.base_amount_dop
                FROM expenses e
                JOIN expense_categories ec ON e.category_id = ec.id
                LEFT JOIN debts d ON e.debt_id = d.id
                WHERE e.user_id = ? AND e.expense_date BETWEEN ? AND ?
                ORDER BY e.expense_date DESC
            ');
            $stmt->execute([$userId, $start, $end]);
            foreach ($stmt->fetchAll() as $r) {
                fputcsv($out, [
                    $r['expense_date'], $r['category_name'], $r['expense_type'],
                    $r['debt_name'] ?? '', $r['description'] ?? '',
                    $r['currency'], $r['original_amount'], $r['exchange_rate'], $r['base_amount_dop'],
                ]);
            }
        }

        fclose($out);
        exit;
    }
}
