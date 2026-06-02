<?php
// backend/migrate_v28_google_calendar.php
// R-034 Phase 2: Google カレンダー連携用テーブル
//   - user_google_oauth: OAuth リフレッシュトークン保管（AES-256-GCM 暗号化）
//   - external_events_cache: Google カレンダーから取得したイベントのキャッシュ
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v28 (Google Calendar tables)...\n";

    $tables = [];
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $tables[] = $row['name'];
    }

    if (!in_array('user_google_oauth', $tables)) {
        echo "Creating user_google_oauth table...\n";
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS user_google_oauth (
                user_id TEXT PRIMARY KEY,
                encrypted_refresh_token BLOB NOT NULL,
                primary_calendar_email TEXT,
                primary_calendar_id TEXT,
                last_sync_at INTEGER,
                created_at INTEGER NOT NULL
            )
        ");
        echo "user_google_oauth table created.\n";
    } else {
        echo "user_google_oauth table already exists.\n";
    }

    if (!in_array('external_events_cache', $tables)) {
        echo "Creating external_events_cache table...\n";
        // 仕様書（docs/SPEC/04_データ設計.md §3.7）通り。
        // users テーブルの主キーは `id` だが、SPEC では `user_id` 参照と書いてあるため
        // SQLite の FK は users(id) を実体に向けつつ、カラム名は仕様に従い user_id とする。
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS external_events_cache (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                calendar_id TEXT NOT NULL,
                event_id TEXT NOT NULL,
                start_at INTEGER NOT NULL,
                end_at INTEGER NOT NULL,
                all_day INTEGER NOT NULL DEFAULT 0,
                title TEXT,
                location TEXT,
                fetched_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_external_events_user_date ON external_events_cache(user_id, start_at)");
        echo "external_events_cache table created.\n";
    } else {
        echo "external_events_cache table already exists.\n";
    }

    echo "Migration v28 completed successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
