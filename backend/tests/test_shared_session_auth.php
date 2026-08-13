<?php
// backend/tests/test_shared_session_auth.php
// R-096: auth-hub の共有セッション（df_session）による認証を検証する。
//
// 方針は「置き換え」ではなく「追加」。既存のJWT認証はそのまま残し、
// df_session Cookie が送られてきた場合のみ auth-hub 経由の認証を試みる。
//
// auth-hub 本体を起動せずに検証するため、auth_client.php の 'verifier' 差し替え口を使う。
// auth_config() は array_merge で設定を畳み込むため、テストが先に verifier を仕込んでおけば
// BaseController が driver/base だけを設定しても verifier は残る。

$tmpDb = sys_get_temp_dir() . '/youkan_shared_session_test_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../BaseController.php';
require_once __DIR__ . '/../auth_client.php';

$passed = 0;
$failed = 0;

function assertSame_($name, $expected, $actual) {
    global $passed, $failed;
    if ($expected === $actual) {
        echo "[PASS] $name\n";
        $passed++;
    } else {
        echo "[FAIL] $name - expected " . var_export($expected, true) . ", got " . var_export($actual, true) . "\n";
        $failed++;
    }
}

class SharedSessionTestController extends BaseController {
    public function run(): array {
        $this->authenticate();
        return [
            'userId' => $this->currentUserId,
            'tenantId' => $this->currentTenantId,
            'role' => $this->currentUser['role'] ?? null,
            'name' => $this->currentUser['name'] ?? null,
            'shared' => $this->isSharedSession,
        ];
    }
}

$pdo = getDB();
$pdo->exec("DELETE FROM users");
$pdo->exec("DELETE FROM memberships");
$pdo->exec("DELETE FROM tenants");
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('t_shared', '共有テナント', 0)");
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, auth_user_id, active_tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, 0)")
    ->execute(['u_shared', 'shared@example.com', password_hash('pw', PASSWORD_DEFAULT), '共有 太郎', 42, 't_shared']);
$pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES ('u_shared', 't_shared', 'admin', 0)");

// auth-hub の応答をスタブする。Youkanのユーザーとは別体系の整数IDを返す
auth_configure([
    'verifier' => fn(string $token): ?array => $token === 'valid-session'
        ? ['id' => 42, 'name' => 'auth-hub 上の表示名']
        : null,
]);

// --- 1. df_session が有効なら auth-hub 経由で認証される ---
$_COOKIE['df_session'] = 'valid-session';
$_SERVER['HTTP_AUTHORIZATION'] = '';
auth_reset_cache();

$result = (new SharedSessionTestController())->run();
assertSame_('df_session で Youkan のユーザーIDに解決される', 'u_shared', $result['userId']);
assertSame_('共有セッション由来であることが記録される', true, $result['shared']);
assertSame_('active_tenant_id がテナント文脈として復元される', 't_shared', $result['tenantId']);
assertSame_('role は memberships から解決される', 'admin', $result['role']);

// --- 2. 未紐付けユーザー（auth_user_id が一致しない）は従来のJWT認証へフォールバックする ---
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_jwtonly', 'jwtonly@example.com', password_hash('pw', PASSWORD_DEFAULT), 'JWT 専用']);

$_COOKIE['df_session'] = 'unknown-session'; // auth-hub 側で無効
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . JWTService::encrypt([
    'sub' => 'u_jwtonly',
    'name' => 'JWT 専用',
    'account_type' => 'user',
    'tenant_id' => null,
    'role' => 'user',
]);
auth_reset_cache();

$result = (new SharedSessionTestController())->run();
assertSame_('df_session が無効ならJWT認証にフォールバックする', 'u_jwtonly', $result['userId']);
assertSame_('JWT経路では共有セッション扱いにしない', false, $result['shared']);

// --- 3. Cookie が無ければ従来通りJWTのみで認証される ---
unset($_COOKIE['df_session']);
auth_reset_cache();

$result = (new SharedSessionTestController())->run();
assertSame_('Cookie無しでも既存のJWT認証は変わらず動く', 'u_jwtonly', $result['userId']);

echo "\n合計: $passed passed, $failed failed\n";
@unlink($tmpDb);
exit($failed > 0 ? 1 : 0);
