<?php
// backend/services/CryptoService.php
// R-034 Phase 2: AES-256-GCM 暗号化サービス
//
// 用途: Google OAuth リフレッシュトークンを user_google_oauth テーブルに
//       保管する際の暗号化／復号。
//
// 仕様:
//   - アルゴリズム: AES-256-GCM
//   - キー: 32 バイト（hex 文字列 64 文字で渡す。`.env` の YOUKAN_ENCRYPTION_KEY）
//   - 出力フォーマット: base64( IV[12B] || TAG[16B] || CIPHERTEXT )

class CryptoService {
    private const CIPHER = 'aes-256-gcm';
    private const IV_LEN = 12;
    private const TAG_LEN = 16;

    private string $key; // 32 バイト raw key

    public function __construct(string $hexKey) {
        // 32 バイト = 64 hex 文字を期待
        if (!preg_match('/^[0-9a-fA-F]{64}$/', $hexKey)) {
            throw new \InvalidArgumentException(
                'CryptoService: encryption key must be 64 hex chars (32 bytes). Got length ' . strlen($hexKey)
            );
        }
        $raw = hex2bin($hexKey);
        if ($raw === false || strlen($raw) !== 32) {
            throw new \InvalidArgumentException('CryptoService: failed to decode hex key.');
        }
        $this->key = $raw;
    }

    /**
     * 平文を暗号化し base64 文字列を返す。
     * 同じ平文でも IV がランダムなため毎回異なる ciphertext になる。
     */
    public function encrypt(string $plaintext): string {
        $iv = random_bytes(self::IV_LEN);
        $tag = '';
        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_LEN
        );
        if ($ciphertext === false) {
            throw new \RuntimeException('CryptoService: openssl_encrypt failed.');
        }
        return base64_encode($iv . $tag . $ciphertext);
    }

    /**
     * encrypt() の戻り値（base64 文字列）を復号する。
     * 不正・改ざんされた入力に対しては null を返す（例外を投げない）。
     */
    public function decrypt(string $encoded): ?string {
        $raw = base64_decode($encoded, true);
        if ($raw === false || strlen($raw) < self::IV_LEN + self::TAG_LEN) {
            return null;
        }
        $iv = substr($raw, 0, self::IV_LEN);
        $tag = substr($raw, self::IV_LEN, self::TAG_LEN);
        $ciphertext = substr($raw, self::IV_LEN + self::TAG_LEN);
        $plaintext = openssl_decrypt(
            $ciphertext,
            self::CIPHER,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );
        return $plaintext === false ? null : $plaintext;
    }

    /**
     * 環境変数からキーを読み込んでインスタンス化するヘルパー。
     * .env から YOUKAN_ENCRYPTION_KEY を取得する想定。
     */
    public static function fromEnv(): self {
        $key = self::loadEnvKey('YOUKAN_ENCRYPTION_KEY');
        if (!$key) {
            throw new \RuntimeException(
                'CryptoService: YOUKAN_ENCRYPTION_KEY is not set in environment. ' .
                'Generate with: php -r "echo bin2hex(random_bytes(32));"'
            );
        }
        return new self($key);
    }

    /**
     * 簡易 .env ローダ。
     *   1. getenv($name) → 2. $_ENV[$name] → 3. backend/.env から読む
     */
    public static function loadEnvKey(string $name): ?string {
        $val = getenv($name);
        if ($val !== false && $val !== '') {
            return $val;
        }
        if (isset($_ENV[$name]) && $_ENV[$name] !== '') {
            return $_ENV[$name];
        }
        $envPath = __DIR__ . '/../.env';
        if (is_file($envPath)) {
            $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') continue;
                if (strpos($line, '=') === false) continue;
                [$k, $v] = explode('=', $line, 2);
                $k = trim($k);
                $v = trim($v);
                // クォート除去
                if (strlen($v) >= 2 && (($v[0] === '"' && $v[-1] === '"') || ($v[0] === "'" && $v[-1] === "'"))) {
                    $v = substr($v, 1, -1);
                }
                if ($k === $name) {
                    return $v;
                }
            }
        }
        return null;
    }
}
