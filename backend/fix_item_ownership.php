<?php
require_once __DIR__ . '/db.php';
header('Content-Type: text/plain');

// 安全装置: CLI実行またはローカルホストからのアクセスのみ許可
if (php_sapi_name() !== 'cli' && $_SERVER['REMOTE_ADDR'] !== '127.0.0.1' && $_SERVER['REMOTE_ADDR'] !== '::1') {
    die("Access Denied: This script can only be run locally.");
}

echo "Starting Item Ownership Transfer...\n";

try {
    $pdo = getDB();

    // Target User: info@door-fujita.com (デバッグ社)
    $targetUserId = 'u_69907061c6432';
    $targetTenantId = 't_6990706237db7';

    // Source User: debug@example.com (デバッグ太郎)
    $sourceUserId = 'u_697b2af132f4f';

    // 1. ターゲットユーザー確認
    $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
    $stmt->execute([$targetUserId]);
    if (!$stmt->fetch()) {
        die("Error: Target user ($targetUserId) not found.\n");
    }

    // 2. 対象アイテムカウント
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM items WHERE created_by = ?");
    $stmt->execute([$sourceUserId]);
    $count = $stmt->fetchColumn();

    echo "Found {$count} items created by Source User ($sourceUserId).\n";

    if ($count > 0) {
        // 3. 移譲実行
        $sqlUpdate = "
            UPDATE items 
            SET created_by = ?, tenant_id = ?
            WHERE created_by = ?
        ";
        
        $pdo->beginTransaction();
        $stmt = $pdo->prepare($sqlUpdate);
        $stmt->execute([$targetUserId, $targetTenantId, $sourceUserId]);
        $affected = $stmt->rowCount();
        $pdo->commit();

        echo "Successfully transferred {$affected} items to User {$targetUserId} (Tenant {$targetTenantId}).\n";
    } else {
        echo "No items to transfer.\n";
    }

    // おまけ: DBに存在しないユーザーのアイテムも救済するか？
    // 今回はsourceUserId指定で十分。

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
