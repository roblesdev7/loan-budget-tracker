<?php
declare(strict_types=1);

class ExchangeRateController
{
    public function __construct(private PDO $db) {}

    /** GET /exchange-rates/latest — Returns the most recent rate (sticky default) */
    public function latest(int $userId): void
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM exchange_rates WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1'
        );
        $stmt->execute([$userId]);
        $rate = $stmt->fetch();
        Response::success($rate ?: ['rate' => 60.0, 'notes' => null]);
    }

    /** GET /exchange-rates — Returns last 30 rates */
    public function history(int $userId): void
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM exchange_rates WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 30'
        );
        $stmt->execute([$userId]);
        Response::success($stmt->fetchAll());
    }

    /** POST /exchange-rates — Manually log a new rate */
    public function store(int $userId): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $rate = (float) ($body['rate'] ?? 0);

        if ($rate <= 0) Response::error('Tasa inválida — debe ser mayor a 0', 422);

        $stmt = $this->db->prepare(
            'INSERT INTO exchange_rates (user_id, rate, notes) VALUES (?, ?, ?)'
        );
        $stmt->execute([$userId, $rate, $body['notes'] ?? null]);

        Response::success(['id' => (int) $this->db->lastInsertId(), 'rate' => $rate], 201);
    }
}
