<?php
declare(strict_types=1);

class Auth
{
    /** Validates Bearer token and returns its payload. Terminates with 401 on failure. */
    public static function require(): array
    {
        $payload = self::verifyToken();
        return $payload;
    }

    /** Returns authenticated user id from JWT payload. */
    public static function userId(): int
    {
        return (int) self::require()['sub'];
    }

    private static function verifyToken(): array
    {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $auth = '';
        foreach ($headers as $name => $value) {
            if (strtolower($name) === 'authorization') {
                $auth = $value;
                break;
            }
        }

        if (!str_starts_with($auth, 'Bearer ')) {
            Response::error('No autorizado', 401);
        }

        $token   = substr($auth, 7);
        $payload = JWT::verify($token);

        if ($payload === false) {
            Response::error('Token inválido o expirado', 401);
        }

        return $payload;
    }
}
