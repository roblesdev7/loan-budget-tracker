<?php
declare(strict_types=1);

class JWT
{
    private static string $secret = '';
    private static int    $expiry = 86400;

    public static function init(string $secret, int $expiry = 86400): void
    {
        self::$secret = $secret;
        self::$expiry = $expiry;
    }

    public static function generate(array $payload): string
    {
        $header          = self::b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload['iat']  = time();
        $payload['exp']  = time() + self::$expiry;
        $body            = self::b64url(json_encode($payload));
        $sig             = self::b64url(hash_hmac('sha256', "$header.$body", self::$secret, true));

        return "$header.$body.$sig";
    }

    /** @return array|false */
    public static function verify(string $token): array|false
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return false;
        }

        [$header, $body, $sig] = $parts;

        $expected = self::b64url(hash_hmac('sha256', "$header.$body", self::$secret, true));
        if (!hash_equals($expected, $sig)) {
            return false;
        }

        $data = json_decode(self::b64urlDecode($body), true);
        if (!is_array($data) || ($data['exp'] ?? 0) < time()) {
            return false;
        }

        return $data;
    }

    private static function b64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64urlDecode(string $data): string
    {
        $pad  = (4 - strlen($data) % 4) % 4;
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', $pad));
    }
}
