<?php
// backend/JWTService.php

class JWTService {
    private static $secret_key = 'YOUR_SECRET_KEY_ENV'; // In prod, use Env var
    private static $algorithm = 'HS256';

    public static function encrypt($data) {
        $header = ['typ' => 'JWT', 'alg' => self::$algorithm];
        $payload = array_merge($data, [
            'iat' => time(),
            'exp' => time() + (60 * 60 * 24 * 7) // 1 week expiration
        ]);

        $base64Header = self::base64UrlEncode(json_encode($header));
        $base64Payload = self::base64UrlEncode(json_encode($payload));

        $signature = hash_hmac('sha256', 
            $base64Header . "." . $base64Payload, 
            self::$secret_key, 
            true
        );
        $base64Signature = self::base64UrlEncode($signature);

        return $base64Header . "." . $base64Payload . "." . $base64Signature;
    }

    public static function decrypt($token) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;

        list($base64Header, $base64Payload, $base64Signature) = $parts;

        $signature = self::base64UrlDecode($base64Signature);
        $expectedSignature = hash_hmac('sha256', 
            $base64Header . "." . $base64Payload, 
            self::$secret_key, 
            true
        );

        if (!hash_equals($signature, $expectedSignature)) {
            return null; // Invalid signature
        }

        $payload = json_decode(self::base64UrlDecode($base64Payload), true);
        
        if ($payload['exp'] < time()) {
            return null; // Expired
        }

        return $payload;
    }

    private static function base64UrlEncode($data) {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }

    private static function base64UrlDecode($data) {
        $urlUnsafeData = str_replace(['-', '_'], ['+', '/'], $data);
        $paddedData = str_pad($urlUnsafeData, strlen($data) % 4, '=', STR_PAD_RIGHT);
        return base64_decode($paddedData);
    }

    // Extract Bearer token from headers
    public static function getBearerToken() {
        $headers = null;
        if (isset($_SERVER['Authorization'])) {
            $headers = trim($_SERVER["Authorization"]);
        } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
        } elseif (function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();
            $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
            if (isset($requestHeaders['Authorization'])) {
                $headers = trim($requestHeaders['Authorization']);
            }
        }
        
        if (!empty($headers)) {
            if (preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
                return $matches[1];
            }
        }
        return null;
    }
}
