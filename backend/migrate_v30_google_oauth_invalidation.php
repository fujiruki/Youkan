<?php
// backend/migrate_v30_google_oauth_invalidation.php
// R-072: Google OAuth失効検知・再連携UX実装
//   - user_google_oauth に invalidated_at / last_error カラムを追加
//   - invalidated_at: refreshAccessToken() が invalid_grant を検知した時刻（NULL=正常）
//   - last_error: 直近のリフレッシュ失敗理由（診断用の生メッセージ）
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v30 (Google OAuth invalidation tracking)...\n";

    $tables = [];
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $tables[] = $row['name'];
    }

    if (!in_array('user_google_oauth', $tables)) {
        echo "user_google_oauth table does not exist yet. Skipping (run migrate_v28 first).\n";
    } else {
        $cols = [];
        $stmt = $pdo->query("PRAGMA table_info(user_google_oauth)");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) { $cols[] = $row['name']; }

        $needed = [
            'invalidated_at' => 'INTEGER',
            'last_error' => 'TEXT',
        ];
        foreach ($needed as $col => $def) {
            if (!in_array($col, $cols)) {
                $pdo->exec("ALTER TABLE user_google_oauth ADD COLUMN $col $def");
                echo "  added column: $col\n";
            } else {
                echo "  column already exists: $col\n";
            }
        }
    }

    echo "Migration v30 completed successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
