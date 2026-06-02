<?php
// backend/tests/CryptoServiceTest.php
// R-034 Phase 2: AES-256-GCM の暗号化往復をテスト
require_once __DIR__ . '/../services/CryptoService.php';

class CryptoServiceTest {
    private CryptoService $crypto;
    private string $key;

    public function __construct() {
        // 32 バイトの hex キー（テスト用固定値）
        $this->key = str_repeat('a1b2', 16); // 32 バイト = 64 hex 文字
        $this->crypto = new CryptoService($this->key);
    }

    public function run(): void {
        echo "Running CryptoService Tests...\n";
        $this->testRoundtripASCII();
        $this->testRoundtripUTF8();
        $this->testRoundtripLong();
        $this->testRejectTamperedCiphertext();
        $this->testDifferentCiphertextEachCall();
        $this->testRejectInvalidKey();
        echo "All tests passed!\n";
    }

    private function testRoundtripASCII(): void {
        echo "  [Test] ASCII roundtrip...";
        $plain = 'refresh_token_abc123';
        $encrypted = $this->crypto->encrypt($plain);
        $decrypted = $this->crypto->decrypt($encrypted);
        assert($decrypted === $plain, "ASCII roundtrip failed: got '$decrypted'");
        echo " OK\n";
    }

    private function testRoundtripUTF8(): void {
        echo "  [Test] UTF-8 roundtrip...";
        $plain = '晴樹さんのリフレッシュトークン🔒';
        $encrypted = $this->crypto->encrypt($plain);
        $decrypted = $this->crypto->decrypt($encrypted);
        assert($decrypted === $plain, "UTF-8 roundtrip failed: got '$decrypted'");
        echo " OK\n";
    }

    private function testRoundtripLong(): void {
        echo "  [Test] Long string roundtrip...";
        $plain = str_repeat('x', 4096);
        $encrypted = $this->crypto->encrypt($plain);
        $decrypted = $this->crypto->decrypt($encrypted);
        assert($decrypted === $plain, "Long roundtrip failed (length mismatch)");
        echo " OK\n";
    }

    private function testRejectTamperedCiphertext(): void {
        echo "  [Test] Reject tampered ciphertext...";
        $plain = 'sensitive_token';
        $encrypted = $this->crypto->encrypt($plain);
        $tampered = substr_replace($encrypted, 'XXXX', 30, 4);
        $result = $this->crypto->decrypt($tampered);
        assert($result === null, "Tampered ciphertext should return null, got: " . var_export($result, true));
        echo " OK\n";
    }

    private function testDifferentCiphertextEachCall(): void {
        echo "  [Test] Random IV produces different ciphertext...";
        $plain = 'same_input';
        $c1 = $this->crypto->encrypt($plain);
        $c2 = $this->crypto->encrypt($plain);
        assert($c1 !== $c2, "Two encryptions of same plaintext should differ (random IV)");
        echo " OK\n";
    }

    private function testRejectInvalidKey(): void {
        echo "  [Test] Invalid key length throws...";
        $threw = false;
        try {
            new CryptoService('shortkey');
        } catch (\InvalidArgumentException $e) {
            $threw = true;
        }
        assert($threw, "Short key should throw InvalidArgumentException");
        echo " OK\n";
    }
}

$test = new CryptoServiceTest();
$test->run();
